'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { subscriptionRequests } from '@/db/schema'
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
  return { ok: true, message: `اتفعّل ${plan?.name ?? ''} لحد ${formatDate(res.until)}` }
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
  return { ok: true, message: 'اتقفل — المميزات وقفت فورًا' }
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
