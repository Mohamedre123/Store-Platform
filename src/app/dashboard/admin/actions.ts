'use server'

import { revalidatePath } from 'next/cache'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { stores, subscriptionRequests, subscriptions } from '@/db/schema'
import { requirePlatformAdmin } from '@/lib/store-context'
import { activateStore, deactivateStore } from '@/lib/subscription'
import { recordAudit } from '@/lib/audit'
import { getPlan } from '@/lib/plans'
import { formatDate } from '@/lib/utils'

export type AdminState = { ok?: boolean; error?: string; message?: string } | null

/**
 * كل فعل هنا بيمرّ على `requirePlatformAdmin` الأول.
 *
 * **الفحص في كل فعل لا في الصفحة بس.** الصفحة بترجّع 404 لغير الأدمن،
 * لكن أفعال الخادم دي مسارات مستقلة بيتنادوا بـPOST — واللي عارف
 * اسم الفعل يقدر يناديه من غير ما يفتح الصفحة أصلًا. الحماية اللي
 * في الصفحة بس مش حماية.
 */

const activateSchema = z.object({
  storeId: z.string().uuid(),
  plan: z.enum(['trial', 'monthly', 'yearly']),
  requestId: z.string().uuid().optional(),
})

export async function activateAction(raw: unknown): Promise<AdminState> {
  const admin = await requirePlatformAdmin()

  const parsed = activateSchema.safeParse(raw)
  if (!parsed.success) return { error: 'بيانات ناقصة' }

  const res = await activateStore({
    storeId: parsed.data.storeId,
    plan: parsed.data.plan,
    adminId: admin.id,
    requestId: parsed.data.requestId,
  })
  if (!res.ok) return { error: res.error }

  await recordAudit({
    storeId: parsed.data.storeId,
    userId: admin.id,
    action: 'subscription.activate',
    resource: 'store',
    resourceId: parsed.data.storeId,
    after: { plan: parsed.data.plan, until: res.until.toISOString() },
  })

  revalidatePath('/dashboard/admin')
  const plan = getPlan(parsed.data.plan)
  return {
    ok: true,
    message: `اتفعّل ${plan?.name ?? ''} لحد ${formatDate(res.until)} — وهيوصله إيميل بالتفعيل`,
  }
}

/**
 * «جدّد» — نفس باقته المدفوعة الأخيرة، من نهاية فترته الحالية.
 *
 * التاجر بيحوّل ويبعت، والإدارة كانت بتدوّر هو كان شهري ولا سنوي عشان
 * تدوس الزرار الصح. هنا الزرار عارف لوحده، والتاجر بيوصله إيميل
 * «اتجدّد لحد…» بالتاريخ الجديد.
 */
export async function renewAction(storeId: string): Promise<AdminState> {
  const admin = await requirePlatformAdmin()

  const parsed = z.string().uuid().safeParse(storeId)
  if (!parsed.success) return { error: 'متجر غير معروف' }

  const [store] = await db.select({ plan: stores.plan }).from(stores).where(eq(stores.id, parsed.data)).limit(1)
  if (!store) return { error: 'المتجر مش موجود' }

  let planKey = store.plan === 'monthly' || store.plan === 'yearly' ? store.plan : null
  if (!planKey) {
    const [last] = await db
      .select({ plan: subscriptions.plan })
      .from(subscriptions)
      .where(and(eq(subscriptions.storeId, parsed.data), inArray(subscriptions.plan, ['monthly', 'yearly'])))
      .orderBy(desc(subscriptions.startedAt))
      .limit(1)
    planKey = last?.plan === 'monthly' || last?.plan === 'yearly' ? last.plan : null
  }
  if (!planKey) return { error: 'المتجر ده ما اشتركش في باقة مدفوعة قبل كده — فعّل شهري أو سنوي.' }

  const res = await activateStore({ storeId: parsed.data, plan: planKey, adminId: admin.id })
  if (!res.ok) return { error: res.error }

  await recordAudit({
    storeId: parsed.data,
    userId: admin.id,
    action: 'subscription.activate',
    resource: 'store',
    resourceId: parsed.data,
    after: { plan: planKey, until: res.until.toISOString(), renew: true },
  })

  revalidatePath('/dashboard/admin')
  return {
    ok: true,
    message: `اتجدّد ${getPlan(planKey)?.name ?? ''} لحد ${formatDate(res.until)} — وهيوصله إيميل بالتجديد`,
  }
}

export async function deactivateAction(storeId: string): Promise<AdminState> {
  const admin = await requirePlatformAdmin()

  const parsed = z.string().uuid().safeParse(storeId)
  if (!parsed.success) return { error: 'متجر غير معروف' }

  await deactivateStore(parsed.data, admin.id)

  await recordAudit({
    storeId: parsed.data,
    userId: admin.id,
    action: 'subscription.deactivate',
    resource: 'store',
    resourceId: parsed.data,
  })

  revalidatePath('/dashboard/admin')
  return { ok: true, message: 'اتقفل — المميزات وقفت فورًا، ووصله إيميل بالإيقاف' }
}

/** رفض طلب — التحويل ما وصلش أو الإيصال مش مظبوط */
export async function rejectRequestAction(input: {
  requestId: string
  note?: string
}): Promise<AdminState> {
  const admin = await requirePlatformAdmin()

  const parsed = z
    .object({ requestId: z.string().uuid(), note: z.string().trim().max(300).optional() })
    .safeParse(input)
  if (!parsed.success) return { error: 'بيانات ناقصة' }

  await db
    .update(subscriptionRequests)
    .set({
      status: 'rejected',
      reviewedBy: admin.id,
      reviewedAt: new Date(),
      note: parsed.data.note || 'ما وصلناش تأكيد التحويل',
    })
    .where(eq(subscriptionRequests.id, parsed.data.requestId))

  revalidatePath('/dashboard/admin')
  return { ok: true, message: 'الطلب اترفض' }
}
