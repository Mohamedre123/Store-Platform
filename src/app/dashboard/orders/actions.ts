'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { orderEvents, orders } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { applyOrderStatus } from '@/lib/order-flow'
import type { OrderStatus } from '@/db/schema'
import { normalizeChannel, resolveChannel, wantsEmail, wantsWhatsapp } from '@/lib/notify-channel'
import { sendWhatsapp } from '@/lib/whatsapp'
import { sendEmail } from '@/lib/email'
import { merchantMessageEmail } from '@/lib/store-emails'
import { getStoreTheme } from '@/lib/storefront'

/**
 * تغيير حالة الطلب من اللوحة.
 *
 * المنطق نفسه في `@/lib/order-flow` مش هنا: نفس التحوّل بينادى من
 * ويب هوك بوابة الدفع وشركة الشحن، ودول مالهمش جلسة تاجر. الفعل ده
 * غلاف بيجيب السياق ويسلّم.
 */
export async function updateOrderStatusAction(
  orderId: string,
  status: OrderStatus,
  /** اللي التاجر مختاره في شريط القنوات فوق أزرار الحالة */
  channel?: unknown,
) {
  const { store, user } = await getDashboardContext()

  await applyOrderStatus(
    store,
    orderId,
    status,
    { type: 'merchant', userId: user.id },
    normalizeChannel(channel),
  )

  revalidatePath('/dashboard/orders')
  revalidatePath(`/dashboard/orders/${orderId}`)
}

export async function addOrderNoteAction(orderId: string, note: string) {
  const { store, user } = await getDashboardContext()
  const text = note.trim()
  if (!text) return

  await db.insert(orderEvents).values({
    orderId,
    storeId: store.id,
    type: 'note',
    message: text,
    actorType: 'merchant',
    actorId: user.id,
  })

  revalidatePath(`/dashboard/orders/${orderId}`)
}

/**
 * بعت رسالة استرداد لصاحب السلة المتروكة.
 *
 * ## الإرسال من الخادم لا من تليفون التاجر
 * الزرار كان بيفتح `wa.me` — يعني التاجر لازم يكون فاتح واتساب على
 * نفس الجهاز، ولازم يدوس «إرسال» بنفسه، ومفيش أي أثر إن الرسالة
 * اتبعتت. دلوقتي بتتبعت من حساب المتجر المربوط، وبتتسجّل.
 *
 * ولو الواتساب مش مربوط، بنرجّع رابط `wa.me` عشان التاجر يكمّل
 * بإيده بدل ما يقف — الرسالة اللي محدّش بعتها سلة ضايعة.
 *
 * ## السطر في المسار الزمني مش رفاهية
 * التاجر اللي بيراجع سلاته بعد يومين ما بيعرفش كلّم مين — فيكلّم
 * الواحد مرتين وتلاتة، والعميل يحسّها مطاردة ويسيب المتجر خالص.
 */
export async function sendRecoveryMessageAction(input: {
  orderId: string
  label: string
  text: string
  channel?: unknown
}): Promise<{ ok: boolean; sent: string[]; failed: string[]; waHref?: string }> {
  const { store, user } = await getDashboardContext()
  const text = input.text.trim().slice(0, 2000)

  const [order] = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      phone: orders.customerPhone,
      email: orders.customerEmail,
      customerId: orders.customerId,
    })
    .from(orders)
    .where(and(eq(orders.id, input.orderId), eq(orders.storeId, store.id)))
    .limit(1)

  if (!order || !text) return { ok: false, sent: [], failed: [] }

  /* «تلقائي» بيتحوّل لقناة حقيقية حسب اللي معانا من العميل */
  const channel = resolveChannel(normalizeChannel(input.channel), {
    phone: Boolean(order.phone),
    email: Boolean(order.email),
  })

  const sent: string[] = []
  const failed: string[] = []
  let waHref: string | undefined

  if (wantsWhatsapp(channel) && order.phone) {
    const res = await sendWhatsapp(store.id, order.phone, text)
    if (res.ok) {
      sent.push('واتساب')
    } else {
      failed.push(`واتساب — ${res.error}`)
      /* الطريق اليدوي لسه مفتوح: أحسن من إن التاجر يقف */
      waHref = `https://wa.me/${order.phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`
    }
  }

  if (wantsEmail(channel) && order.email) {
    const theme = await getStoreTheme(store.id)
    const mail = merchantMessageEmail(
      { name: store.name, logo: store.logoLight, primary: theme.custom.identity.primary },
      {
        subject: `بخصوص طلبك من ${store.name}`,
        body: text,
      },
    )

    const res = await sendEmail({
      to: order.email,
      ...mail,
      replyTo: store.email ?? undefined,
      senderName: store.name,
      log: {
        storeId: store.id,
        event: 'cart_recovery',
        orderId: order.id,
        customerId: order.customerId ?? undefined,
      },
    })

    if (res.ok) sent.push('البريد')
    else failed.push(`البريد — ${res.error}`)
  }

  if (sent.length || failed.length) {
    await db.insert(orderEvents).values({
      orderId: order.id,
      storeId: store.id,
      type: 'message_sent',
      message: sent.length
        ? `بعتنا رسالة استرداد (${input.label}) على ${sent.join(' و')}`
        : `فشل إرسال رسالة الاسترداد (${input.label}): ${failed.join('، ')}`,
      meta: { label: input.label, sent, failed },
      actorType: 'merchant',
      actorId: user.id,
    })
  }

  revalidatePath(`/dashboard/orders/${input.orderId}`)
  return { ok: sent.length > 0, sent, failed, waHref }
}

/** حذف طلب ناقص — التاجر شافه وقرّر إنه مش هيتابعه */
export async function dismissIncompleteAction(orderId: string) {
  const { store } = await getDashboardContext()

  await db
    .delete(orders)
    .where(and(eq(orders.id, orderId), eq(orders.storeId, store.id), eq(orders.isIncomplete, true)))

  revalidatePath('/dashboard/orders')
}
