'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { shipments } from '@/db/schema'
import { courierByToken } from '@/lib/couriers'
import { applyShipmentStatus, loadFlowStore } from '@/lib/order-flow'

export type TaskState = { ok?: boolean; error?: string } | null

/**
 * أفعال صفحة المندوب.
 *
 * ## الرمز هو الجلسة — والفحص بيتعاد في كل فعل
 * الصفحة بتتحقّق من الرمز لما بتتفتح، بس الفعل بيتنادى من المتصفح
 * مباشرةً ومحدّش يضمن إنه جاي من الصفحة دي. عشان كده كل فعل هنا
 * بيبدأ من الرمز، ويتأكّد إن الشحنة **بتاعة المندوب ده هو**: من
 * غير الشرط ده، أي حد معاه رمز مندوب كان يقدر يغيّر حالة أي شحنة
 * في أي متجر بمجرد إنه يعرف معرّفها.
 *
 * ## والمندوب مالوش غير تلات أفعال
 * «اتسلّم» و«معرفتش أسلّم» و«حصّلت الفلوس». أي حاجة تانية — إلغاء،
 * تعديل مبلغ، تغيير عنوان — قرار التاجر، والمندوب مش المفروض يقدر
 * يعمله من الشارع.
 */

const schema = z.object({
  token: z.string().min(16).max(64),
  shipmentId: z.string().uuid(),
})

/** بيرجّع المندوب والشحنة بعد التأكد إنهم مع بعض — أو رسالة رفض */
async function authorize(token: string, shipmentId: string) {
  const parsed = schema.safeParse({ token, shipmentId })
  if (!parsed.success) return { error: 'بيانات مش مظبوطة' as const }

  const courier = await courierByToken(parsed.data.token)
  if (!courier) return { error: 'الرابط ده مش شغّال — كلّم صاحب المتجر' as const }

  const [shipment] = await db
    .select({ id: shipments.id, storeId: shipments.storeId, status: shipments.status })
    .from(shipments)
    .where(
      and(
        eq(shipments.id, parsed.data.shipmentId),
        eq(shipments.courierId, courier.id),
        eq(shipments.storeId, courier.storeId),
      ),
    )
    .limit(1)

  if (!shipment) return { error: 'الطلب ده مش معاك' as const }
  return { courier, shipment }
}

export async function courierDeliverAction(
  token: string,
  shipmentId: string,
  collected: boolean,
): Promise<TaskState> {
  const auth = await authorize(token, shipmentId)
  if ('error' in auth) return { error: auth.error }

  const store = await loadFlowStore(auth.shipment.storeId)
  if (!store) return { error: 'حصلت مشكلة — جرّب تاني' }

  /*
    تعليم التحصيل قبل تغيير الحالة.

    `applyShipmentStatus` بيبعت للعميل رسالة «طلبك اتسلّم» وبيصرف
    نقاط الولاء. لو التحصيل اتكتب بعده وفشل، الطلب بيبقى «اتسلّم»
    وفلوسه مش مسجّلة على المندوب — والتاجر بيقفل حسابه ناقص.
  */
  if (collected) {
    await db
      .update(shipments)
      .set({ isCodCollected: true, updatedAt: new Date() })
      .where(eq(shipments.id, shipmentId))
  }

  const res = await applyShipmentStatus(store, shipmentId, 'delivered', {
    type: 'system',
    label: `المندوب ${auth.courier.name}`,
  })

  if (res.error) return { error: res.error }
  revalidatePath(`/mandoub/${token}`)
  return { ok: true }
}

export async function courierFailAction(
  token: string,
  shipmentId: string,
  reason: string,
): Promise<TaskState> {
  const auth = await authorize(token, shipmentId)
  if ('error' in auth) return { error: auth.error }

  const store = await loadFlowStore(auth.shipment.storeId)
  if (!store) return { error: 'حصلت مشكلة — جرّب تاني' }

  const res = await applyShipmentStatus(
    store,
    shipmentId,
    'failed',
    { type: 'system', label: `المندوب ${auth.courier.name}` },
    reason.trim().slice(0, 200) || undefined,
  )

  if (res.error) return { error: res.error }
  revalidatePath(`/mandoub/${token}`)
  return { ok: true }
}

/**
 * «أنا خرجت بيه» — الشحنة بقت في الطريق.
 *
 * بتبعت للعميل «طلبك في الطريق» من نفس المسار اللي شركات الشحن
 * بتمشي فيه، فالعميل ما بيفرقش بين مندوب التاجر وشركة كبيرة.
 */
export async function courierPickupAction(token: string, shipmentId: string): Promise<TaskState> {
  const auth = await authorize(token, shipmentId)
  if ('error' in auth) return { error: auth.error }

  const store = await loadFlowStore(auth.shipment.storeId)
  if (!store) return { error: 'حصلت مشكلة — جرّب تاني' }

  const res = await applyShipmentStatus(store, shipmentId, 'out_for_delivery', {
    type: 'system',
    label: `المندوب ${auth.courier.name}`,
  })

  if (res.error) return { error: res.error }
  revalidatePath(`/mandoub/${token}`)
  return { ok: true }
}
