'use server'

import { revalidatePath } from 'next/cache'
import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { platformNotices } from '@/db/schema'
import { requirePlatformAdmin } from '@/lib/store-context'
import { isKnownDestination } from '@/lib/notice-rewards-meta'
import { formatCount } from '@/lib/utils'

export type NoticeState = { ok?: boolean; error?: string } | null

/**
 * رسايل الإدارة — إنشاء وتعديل وحذف.
 *
 * ## كل فعل بيعيد فحص الأدمن
 * `requirePlatformAdmin` بترجّع ٤٠٤ لغير الأدمن. الصفحة بتخبّي
 * الأزرار، والأفعال هي اللي بتمنع النداء المباشر — الاتنين لازم.
 */

const schema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(3, 'اكتب عنوان الرسالة').max(120),
  body: z.string().trim().min(5, 'اكتب نص الرسالة').max(2000),
  ctaLabel: z.string().trim().max(40).nullish(),
  ctaHref: z.string().trim().max(300).nullish(),
  tone: z.enum(['offer', 'praise', 'info']),
  rewardKind: z.enum(['none', 'free_days', 'link']).default('none'),
  rewardDays: z.coerce.number().int().min(0).max(365).default(0),
  audience: z.enum(['all', 'stores', 'rule']),
  targetStoreIds: z.array(z.string().uuid()).max(200).default([]),
  minDeliveredOrders: z.coerce.number().int().min(0).max(1_000_000).default(0),
  minReferrals: z.coerce.number().int().min(0).max(10_000).default(0),
  isActive: z.boolean().default(true),
})

export async function saveNoticeAction(raw: unknown): Promise<NoticeState> {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'بيانات ناقصة' }

  const admin = await requirePlatformAdmin()
  const input = parsed.data

  if (input.audience === 'stores' && input.targetStoreIds.length === 0) {
    return { error: 'اختار متجر واحد على الأقل' }
  }
  if (input.audience === 'rule' && input.minDeliveredOrders === 0 && input.minReferrals === 0) {
    return { error: 'حطّ شرطًا واحدًا على الأقل — طلبات مسلَّمة أو إحالات' }
  }

  /*
    وجهة الزرار من قايمة مقفولة — لا من نص حر.

    الحقل القديم كان بيقبل أي نص، يعني `javascript:` بيشتغل لو
    اتلزق بالغلط، ومسار مش موجود بيودّي التاجر على ٤٠٤. والزرار ده
    بيتعرض في لوحة كل تاجر.

    والفحص هنا مش تكرار لفحص الشاشة: الشاشة `select`، والفعل ده
    بيتنادى من الشبكة مباشرة كمان.
  */
  let href: string | null = null
  if (input.rewardKind === 'link') {
    href = input.ctaHref?.trim() || null
    if (!href) return { error: 'اختار الصفحة اللي الزرار يوديه لها' }
    if (!isKnownDestination(href)) return { error: 'الصفحة دي مش في القايمة' }
  }

  /*
    الأيام شرط لمكافأة الأيام.

    الصفر كان بيعدّي فيطلع زرار «فعّل ٠ يوم مجاني» — بيتضغط وما
    بيعملش حاجة، والتاجر يفتكر النظام بايظ.
  */
  const rewardDays = input.rewardKind === 'free_days' ? input.rewardDays : 0
  if (input.rewardKind === 'free_days' && rewardDays < 1) {
    return { error: 'حدّد مدة المكافأة بالأيام' }
  }

  const values = {
    title: input.title,
    body: input.body,
    /*
      نص فاضي بيتملى هنا لا في الشاشة.

      الزرار من غير نص بيرسم مستطيلًا فاضي في لوحة التاجر — والفعل
      ده بيتنادى من الشبكة كمان، فالافتراضي لازم يبقى في الجهتين.
    */
    ctaLabel:
      input.ctaLabel?.trim() ||
      (input.rewardKind === 'free_days'
        ? `فعّل ${formatCount(input.rewardDays)} يوم مجاني`
        : input.rewardKind === 'link'
          ? 'افتح الصفحة'
          : null),
    ctaHref: href,
    rewardKind: input.rewardKind,
    rewardDays,
    tone: input.tone,
    audience: input.audience,
    targetStoreIds: input.audience === 'stores' ? input.targetStoreIds : [],
    minDeliveredOrders: input.audience === 'rule' ? input.minDeliveredOrders : 0,
    minReferrals: input.audience === 'rule' ? input.minReferrals : 0,
    isActive: input.isActive,
    updatedAt: new Date(),
  }

  if (input.id) {
    const updated = await db
      .update(platformNotices)
      .set(values)
      .where(eq(platformNotices.id, input.id))
      .returning({ id: platformNotices.id })
    if (!updated.length) return { error: 'الرسالة مش موجودة' }
  } else {
    await db.insert(platformNotices).values({ ...values, createdBy: admin.id })
  }

  revalidatePath('/dashboard/admin')
  /*
    لوحة كل تاجر بتتغيّر معاها.

    الرسالة الجديدة المفروض تبان من غير ما التاجر يعمل حاجة —
    و`/dashboard` بيتحسب لكل متجر على حدة، فالتفريغ العام هو الطريق
    الوحيد اللي بيوصلهم كلهم.
  */
  revalidatePath('/dashboard', 'page')
  return { ok: true }
}

export async function toggleNoticeAction(id: string, isActive: boolean): Promise<NoticeState> {
  await requirePlatformAdmin()
  await db
    .update(platformNotices)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(platformNotices.id, id))
  revalidatePath('/dashboard/admin')
  revalidatePath('/dashboard', 'page')
  return { ok: true }
}

export async function deleteNoticeAction(id: string): Promise<NoticeState> {
  await requirePlatformAdmin()
  await db.delete(platformNotices).where(eq(platformNotices.id, id))
  revalidatePath('/dashboard/admin')
  revalidatePath('/dashboard', 'page')
  return { ok: true }
}

/** كل الرسايل — للوحة الإدارة */
export async function listNotices() {
  await requirePlatformAdmin()
  return db.select().from(platformNotices).orderBy(desc(platformNotices.createdAt)).limit(100)
}
