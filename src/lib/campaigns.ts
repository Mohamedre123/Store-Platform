import 'server-only'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { campaigns, customers, stores } from '@/db/schema'
import { sendEmail } from './email'
import { generateToken, hashToken } from './crypto'
import { appUrl } from './domain'
import type { CampaignAudience } from '@/db/schema'

/**
 * حملات البريد.
 *
 * ## اللي بيبعت فعلًا هو `sendEmail` زي ما هو
 * الملف ده ما بيلمسش نقل البريد ولا ترويساته ولا نطاق الإرسال —
 * كل ده شغّال ومتحقَّق منه، وأي لمسة فيه بتخاطر بوصول رسايل الطلبات
 * نفسها. اللي هنا فوقه: مين يستقبل، وإيه اللي بيتكتب، وإزاي
 * الدفعات بتتقسّم.
 *
 * ## والإرسال دايمًا `bulk`
 * ده بيخلّي ترويسة «إلغاء الاشتراك» تتحطّ. الرسالة التسويقية من
 * غيرها بتتقرا من فلاتر البريد على إنها إرسال جماعي مقنّع في شكل
 * معاملة — وبتروح السبام ومعاها سمعة نطاق التاجر.
 */

/** كام رسالة في المهمة الواحدة */
const BATCH_SIZE = 40

/**
 * شرط الجمهور.
 *
 * **موافقة التسويق شرط في كل الحالات.** اللي ألغى اشتراكه ما
 * بيستقبلش حاجة مهما كان الجمهور المختار — والفلتر هنا لأنه
 * المكان الوحيد اللي كل حملة بتمرّ عليه.
 */
function audienceWhere(storeId: string, audience: CampaignAudience) {
  const base = [
    eq(customers.storeId, storeId),
    eq(customers.acceptsMarketing, true),
    eq(customers.isBlocked, false),
    sql`${customers.email} is not null and ${customers.email} <> ''`,
  ]

  if (audience === 'buyers') base.push(sql`${customers.ordersCount} > 0`)
  if (audience === 'non_buyers') base.push(sql`${customers.ordersCount} = 0`)
  if (audience === 'abandoned') {
    base.push(sql`exists (
      select 1 from orders o
      where o.customer_id = ${customers.id}
        and o.store_id = ${storeId}
        and o.is_incomplete = true
    )`)
  }

  return and(...base)
}

/** حجم الجمهور — التاجر بيشوفه قبل ما يبعت */
export async function audienceSize(
  storeId: string,
  audience: CampaignAudience,
): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(customers)
    .where(audienceWhere(storeId, audience))
  return row?.n ?? 0
}

/**
 * قالب الرسالة.
 *
 * بسيط عن قصد: عنوان، ونص التاجر بفقراته، وزر اختياري. المحرّر
 * الغني بيخلّي التاجر يلزق HTML من مكان تاني بستايلات بتتكسر في
 * جيميل — والرسالة اللي بتتكسر أسوأ من رسالة بسيطة.
 */
function renderCampaign(input: {
  storeName: string
  subject: string
  body: string
  ctaLabel?: string | null
  ctaUrl?: string | null
}): { html: string; text: string } {
  /* الهروب إلزامي: نص التاجر بيتحط في HTML، وقوس واحد بيكسر الرسالة */
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const paragraphs = input.body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 14px;line-height:1.8;color:#1b1b1f">${esc(p).replace(/\n/g, '<br>')}</p>`,
    )
    .join('')

  const button =
    input.ctaLabel?.trim() && input.ctaUrl?.trim()
      ? `<p style="margin:24px 0 0"><a href="${esc(input.ctaUrl.trim())}" style="display:inline-block;background:#634b9a;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600">${esc(input.ctaLabel.trim())}</a></p>`
      : ''

  const html = `<div dir="rtl" style="font-family:system-ui,-apple-system,'Segoe UI',Tahoma,sans-serif;max-width:560px;margin:0 auto;padding:24px">
<h1 style="margin:0 0 18px;font-size:20px;color:#1b1b1f">${esc(input.subject)}</h1>
${paragraphs}${button}
</div>`

  /* نسخة نصية لكل رسالة — غيابها إشارة سبام معروفة */
  const text = [input.body, input.ctaUrl?.trim()].filter(Boolean).join('\n\n')

  return { html, text }
}

export type BatchResult = { sent: number; failed: number; done: boolean }

/**
 * إرسال دفعة واحدة من الحملة.
 *
 * ## الترتيب ثابت والتخطّي بالإزاحة
 * الترتيب بالمعرّف عشان الدفعات ما تتداخلش: من غير ترتيب ثابت،
 * قاعدة البيانات ممكن ترجّع نفس العميل في دفعتين ويستقبل الرسالة
 * مرتين — وده بيخلّيه يلغي اشتراكه.
 *
 * ## والفشل بيتعدّ ولا بيوقّف
 * بريد واحد بايظ في ألف مشترك ما يصحّش يوقّف الحملة كلها. بيتسجّل
 * في العدّاد وفي سجل الرسايل، والحملة بتكمّل.
 */
export async function sendCampaignBatch(campaignId: string): Promise<BatchResult> {
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, campaignId))
    .limit(1)

  if (!campaign) return { sent: 0, failed: 0, done: true }
  if (campaign.status !== 'sending') return { sent: 0, failed: 0, done: true }

  const [store] = await db
    .select({ name: stores.name, slug: stores.slug, email: stores.email })
    .from(stores)
    .where(eq(stores.id, campaign.storeId))
    .limit(1)

  if (!store) return { sent: 0, failed: 0, done: true }

  const batch = await db
    .select({
      id: customers.id,
      email: customers.email,
      unsubscribeToken: customers.unsubscribeToken,
    })
    .from(customers)
    .where(audienceWhere(campaign.storeId, campaign.audience))
    .orderBy(customers.id)
    .limit(BATCH_SIZE)
    .offset(campaign.sentCount + campaign.failedCount)

  if (batch.length === 0) {
    await db
      .update(campaigns)
      .set({ status: 'sent', finishedAt: new Date() })
      .where(eq(campaigns.id, campaign.id))
    return { sent: 0, failed: 0, done: true }
  }

  const { html, text } = renderCampaign({
    storeName: store.name,
    subject: campaign.subject,
    body: campaign.body,
    ctaLabel: campaign.ctaLabel,
    ctaUrl: campaign.ctaUrl,
  })

  let sent = 0
  let failed = 0

  for (const c of batch) {
    if (!c.email) {
      failed += 1
      continue
    }

    /*
      رمز إلغاء الاشتراك بيتولّد للي مالوش واحد.

      العملاء اللي اتسجّلوا قبل ما الرمز يتضاف مالهمش واحد، ومن
      غيره ترويسة «إلغاء بضغطة» بتوعد بعنوان مش هيشتغل — والوعد
      اللي مش وراه تنفيذ بيتحسب عيبًا أكبر من غيابه.
    */
    if (!c.unsubscribeToken) {
      const raw = generateToken(16)
      await db
        .update(customers)
        .set({ unsubscribeToken: hashToken(raw) })
        .where(eq(customers.id, c.id))
    }

    const res = await sendEmail({
      to: c.email,
      subject: campaign.subject,
      html,
      text,
      bulk: true,
      sender: { name: store.name, slug: store.slug },
      replyTo: store.email ?? undefined,
      log: { storeId: campaign.storeId, event: 'campaign', customerId: c.id },
    })

    if (res.ok) sent += 1
    else failed += 1
  }

  await db
    .update(campaigns)
    .set({
      sentCount: sql`${campaigns.sentCount} + ${sent}`,
      failedCount: sql`${campaigns.failedCount} + ${failed}`,
    })
    .where(eq(campaigns.id, campaign.id))

  /* أقل من دفعة كاملة = آخر دفعة */
  const done = batch.length < BATCH_SIZE
  if (done) {
    await db
      .update(campaigns)
      .set({ status: 'sent', finishedAt: new Date() })
      .where(eq(campaigns.id, campaign.id))
  }

  return { sent, failed, done }
}

/** رابط إلغاء الاشتراك — بيتحط في الترويسة وفي ذيل الرسالة */
export function unsubscribeUrl(rawToken: string): string {
  return appUrl(`/api/unsubscribe?t=${encodeURIComponent(rawToken)}`)
}
