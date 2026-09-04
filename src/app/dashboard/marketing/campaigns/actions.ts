'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { campaigns } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { assertCan } from '@/lib/permissions'
import { audienceSize } from '@/lib/campaigns'
import { isEmailConfigured } from '@/lib/email'
import { enqueue } from '@/lib/jobs'
import { featureBlock } from '@/lib/entitlements'

export type CampaignState = { ok?: boolean; error?: string; id?: string } | null

const schema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, 'اكتب اسم الحملة').max(80),
  subject: z.string().trim().min(3, 'اكتب عنوان الرسالة').max(150),
  body: z.string().trim().min(10, 'اكتب نص الرسالة').max(5000),
  ctaLabel: z.string().trim().max(40).nullish(),
  ctaUrl: z.string().trim().max(500).nullish(),
  audience: z.enum(['all', 'buyers', 'non_buyers', 'abandoned']),
})

export async function saveCampaignAction(raw: unknown): Promise<CampaignState> {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'بيانات ناقصة' }
  const input = parsed.data

  const { store, user, actor } = await getDashboardContext()
  assertCan(actor, 'marketing.manage')

  /*
    الزر من غير عنوان (أو العكس) بيرسم زرارًا بيودّي على فاضي.
    الاتنين مع بعض أو ولا واحد.
  */
  const hasCta = Boolean(input.ctaLabel?.trim() && input.ctaUrl?.trim())

  const values = {
    name: input.name,
    subject: input.subject,
    body: input.body,
    ctaLabel: hasCta ? input.ctaLabel!.trim() : null,
    ctaUrl: hasCta ? input.ctaUrl!.trim() : null,
    audience: input.audience,
  }

  if (input.id) {
    /*
      الحملة اللي بدأت ما بتتعدّلش.

      نص اتغيّر في نصّ الإرسال معناه إن نص المشتركين استقبلوا رسالة
      ونصّهم استقبلوا رسالة تانية — والتاجر مش عارف مين شاف إيه.
    */
    const [current] = await db
      .select({ status: campaigns.status })
      .from(campaigns)
      .where(and(eq(campaigns.id, input.id), eq(campaigns.storeId, store.id)))
      .limit(1)

    if (!current) return { error: 'الحملة مش موجودة' }
    if (current.status !== 'draft') return { error: 'الحملة دي اتبعتت خلاص — اعمل واحدة جديدة.' }

    await db
      .update(campaigns)
      .set(values)
      .where(and(eq(campaigns.id, input.id), eq(campaigns.storeId, store.id)))

    revalidatePath('/dashboard/marketing/campaigns')
    return { ok: true, id: input.id }
  }

  const [created] = await db
    .insert(campaigns)
    .values({ storeId: store.id, createdBy: user.id, ...values })
    .returning({ id: campaigns.id })

  revalidatePath('/dashboard/marketing/campaigns')
  return { ok: true, id: created.id }
}

/**
 * بدء الإرسال.
 *
 * ## الحجز في الطابور لا الإرسال هنا
 * الفعل ده بيرد على ضغطة التاجر، والرد لازم يرجع في ثانية. الإرسال
 * الفعلي بيتقسّم على مهام، وكل مهمة بتاخد دفعة وبتحجز اللي بعدها —
 * فالتاجر بيقفل الشاشة والحملة بتكمّل.
 */
export async function startCampaignAction(id: string): Promise<CampaignState> {
  const { store, actor } = await getDashboardContext()
  assertCan(actor, 'marketing.manage')

  /* حملات البريد ميزة مشتركين — نفس بوابة باقي المميزات المقفولة */
  const blocked = await featureBlock('ai')
  if (blocked) {
    return { error: 'حملات البريد للمشتركين — اشترك من صفحة الاشتراك وهتتفتح على طول.' }
  }

  if (!isEmailConfigured()) {
    return { error: 'البريد مش مضبوط على المنصة دلوقتي. جرّب بعد شوية.' }
  }

  const [campaign] = await db
    .select({ id: campaigns.id, status: campaigns.status, audience: campaigns.audience })
    .from(campaigns)
    .where(and(eq(campaigns.id, id), eq(campaigns.storeId, store.id)))
    .limit(1)

  if (!campaign) return { error: 'الحملة مش موجودة' }
  if (campaign.status !== 'draft') return { error: 'الحملة دي بدأت خلاص.' }

  const size = await audienceSize(store.id, campaign.audience)
  if (size === 0) {
    return { error: 'مفيش حد في الجمهور ده. جرّب جمهورًا تاني أو استنى مشتركين جدد.' }
  }

  await db
    .update(campaigns)
    .set({
      status: 'sending',
      startedAt: new Date(),
      /* لقطة وقت الإرسال — التقرير ما يتغيّرش بعدها لما مشترك جديد ييجي */
      audienceCount: size,
      sentCount: 0,
      failedCount: 0,
    })
    .where(and(eq(campaigns.id, campaign.id), eq(campaigns.storeId, store.id)))

  await enqueue({
    storeId: store.id,
    type: 'campaign.send',
    payload: { campaignId: campaign.id },
  })

  revalidatePath('/dashboard/marketing/campaigns')
  return { ok: true }
}

export async function deleteCampaignAction(id: string): Promise<CampaignState> {
  const { store, actor } = await getDashboardContext()
  assertCan(actor, 'marketing.manage')

  const deleted = await db
    .delete(campaigns)
    .where(
      and(
        eq(campaigns.id, id),
        eq(campaigns.storeId, store.id),
        /*
          الحملة اللي بتتبعت دلوقتي ما بتتحذفش.

          حذف الصف وسط الإرسال بيخلّي مهمة الدفعة الجاية تلاقي حملة
          مش موجودة وتقف — والتاجر شايف إن الحملة اتلغت وهو نصها
          اتبعت فعلًا ومحدّش يعرف لمين.
        */
        eq(campaigns.status, 'draft'),
      ),
    )
    .returning({ id: campaigns.id })

  if (!deleted.length) return { error: 'مينفعش تحذف حملة بدأت.' }

  revalidatePath('/dashboard/marketing/campaigns')
  return { ok: true }
}

/** حجم الجمهور — الشاشة بتسأل عنه وهو بيغيّر الاختيار */
export async function audienceSizeAction(
  audience: 'all' | 'buyers' | 'non_buyers' | 'abandoned',
): Promise<number> {
  const { store, actor } = await getDashboardContext()
  assertCan(actor, 'marketing.manage')
  return audienceSize(store.id, audience)
}
