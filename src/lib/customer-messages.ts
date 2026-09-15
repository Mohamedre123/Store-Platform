import 'server-only'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { customers, orderEvents, orders } from '@/db/schema'
import { safeReplyTo, sendEmail } from '@/lib/email'
import { enqueue } from '@/lib/jobs'
import { merchantMessageEmail } from '@/lib/store-emails'
import type { ActiveStore } from '@/lib/store-context'
import { getStoreTheme } from '@/lib/storefront'
import { readWhatsapp, sendWhatsapp, sendWhatsappImage, type SendResult } from '@/lib/whatsapp'

/**
 * رسايل التاجر لعملاءه — بالبريد أو واتساب أو الاتنين.
 *
 * بيبعتها مساعد المتجر لما التاجر يقوله «ابعت لطلبات كذا رسالة بكذا». بتخرج بنفس
 * طريق رسايل الطلبات بالظبط: البريد بهوية المتجر (`merchantMessageEmail`) واسمه
 * والرد لبريد التاجر، وواتساب من رقم المتجر المربوط — ومتسجّلة في سجل الرسايل
 * وفي سجل كل طلب.
 *
 * ## واتساب واحدة كل دقيقة
 * أول رسالة بتطلع فورًا والباقي بيتحجز في طابور المهام بدقيقة بين كل واحدة —
 * الباقات المجانية عند المزوّد بترفض أي رسالة تانية في نفس الدقيقة.
 */

export type MessageChannel = 'email' | 'whatsapp' | 'both'

export type CustomerMessageInput = {
  orderNumbers?: number[]
  customerIds?: string[]
  channel: MessageChannel
  subject?: string
  body: string
  imageUrl?: string | null
  buttonLabel?: string | null
  buttonUrl?: string | null
}

export type CustomerMessageSummary = {
  recipients: number
  emailed: number
  whatsappSent: number
  whatsappQueued: number
  failed: string[]
  skipped: string[]
}

type Recipient = {
  orderId: string | null
  orderNumber: number | null
  customerId: string | null
  name: string | null
  phone: string | null
  email: string | null
}

/** أقصى عدد عملاء في المرة الواحدة — الحملات الكبيرة مكانها صفحة الحملات */
const MAX_RECIPIENTS = 100

export const safeHttpsUrl = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : ''
  return /^https:\/\/[^\s"'<>]+$/.test(s) ? s.slice(0, 800) : null
}

const fill = (text: string, r: Recipient) =>
  text
    .split('{{اسم_العميل}}')
    .join(r.name?.trim() || 'عميلنا')
    .split('{{رقم_الطلب}}')
    .join(r.orderNumber ? String(r.orderNumber) : '')

const who = (r: Recipient) => (r.orderNumber ? `#${r.orderNumber}` : r.name?.trim() || 'عميل')

async function resolveRecipients(storeId: string, input: CustomerMessageInput) {
  const out: Recipient[] = []
  const skipped: string[] = []

  const numbers = [...new Set((input.orderNumbers ?? []).filter((n) => Number.isInteger(n) && n > 0))]
  if (numbers.length) {
    const rows = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        customerId: orders.customerId,
        name: orders.customerName,
        phone: orders.customerPhone,
        email: orders.customerEmail,
      })
      .from(orders)
      .where(and(eq(orders.storeId, storeId), inArray(orders.orderNumber, numbers)))
    for (const n of numbers) {
      const row = rows.find((r) => r.orderNumber === n)
      if (!row) {
        skipped.push(`#${n}: الطلب مش موجود`)
        continue
      }
      out.push({
        orderId: row.id,
        orderNumber: row.orderNumber,
        customerId: row.customerId ?? null,
        name: row.name ?? null,
        phone: row.phone ?? null,
        email: row.email ?? null,
      })
    }
  }

  const ids = [...new Set((input.customerIds ?? []).filter((id) => /^[0-9a-f-]{36}$/i.test(id)))]
  if (ids.length) {
    const rows = await db
      .select({ id: customers.id, name: customers.name, phone: customers.phone, email: customers.email })
      .from(customers)
      .where(and(eq(customers.storeId, storeId), inArray(customers.id, ids)))
    for (const row of rows) {
      out.push({ orderId: null, orderNumber: null, customerId: row.id, name: row.name, phone: row.phone, email: row.email })
    }
    if (rows.length < ids.length) skipped.push(`${ids.length - rows.length} عميل مش موجود`)
  }

  /* نفس العميل مذكور مرتين (طلبين ليه) بياخد رسالة واحدة */
  const seen = new Set<string>()
  const unique = out.filter((r) => {
    const key = `${(r.phone ?? '').replace(/\D/g, '').slice(-10)}|${(r.email ?? '').toLowerCase()}`
    if (key === '|') return true
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return { recipients: unique, skipped }
}

/** رسالة واتساب واحدة — بالصورة لو فيه، وبترجع للنص لوحده لو الصورة اترفضت */
export async function deliverWhatsappMessage(
  storeId: string,
  m: { phone: string; text: string; imageUrl: string | null; orderId: string | null; customerId: string | null },
): Promise<SendResult> {
  const log = { event: 'wa_merchant_message', orderId: m.orderId ?? undefined, customerId: m.customerId ?? undefined }
  if (m.imageUrl) {
    const res = await sendWhatsappImage(storeId, m.phone, m.imageUrl, m.text, log)
    if (res.ok || res.error === 'واتساب مش مربوط' || res.error === 'رقم غير صالح') return res
  }
  return sendWhatsapp(storeId, m.phone, m.text, log)
}

export async function sendCustomerMessages(
  store: ActiveStore,
  actorId: string,
  input: CustomerMessageInput,
): Promise<{ ok: true; summary: CustomerMessageSummary } | { ok: false; error: string }> {
  const body = input.body.trim().slice(0, 3000)
  if (!body) return { ok: false, error: 'اكتب نص الرسالة' }
  const subject = (input.subject?.trim() || `رسالة من ${store.name}`).slice(0, 150)
  const imageUrl = safeHttpsUrl(input.imageUrl)
  const buttonUrl = safeHttpsUrl(input.buttonUrl)
  const buttonLabel = input.buttonLabel?.trim().slice(0, 40) || null

  const { recipients, skipped } = await resolveRecipients(store.id, input)
  if (!recipients.length) return { ok: false, error: skipped.length ? skipped.join('، ') : 'حدّد أرقام الطلبات أو العملاء' }
  if (recipients.length > MAX_RECIPIENTS) {
    return { ok: false, error: `أقصى حاجة ${MAX_RECIPIENTS} عميل في المرة — للأكتر استخدم الحملات من التسويق` }
  }

  const wantsEmail = input.channel !== 'whatsapp'
  let wantsWhatsapp = input.channel !== 'email'
  const failed: string[] = []

  if (wantsWhatsapp) {
    const wa = await readWhatsapp(store.id)
    if (wa.provider === 'off' || !wa.hasKey) {
      if (input.channel === 'whatsapp') {
        return {
          ok: false,
          error: 'واتساب المتجر مش مربوط — اربطه الأول من الإعدادات ← واتساب (بمسح الكود)، أو ابعت الرسالة على البريد.',
        }
      }
      wantsWhatsapp = false
      failed.push('واتساب مش مربوط — اتبعت على البريد بس')
    }
  }

  const brand = wantsEmail
    ? {
        name: store.name,
        logo: store.logoLight,
        primary: (await getStoreTheme(store.id)).custom.identity.primary,
        email: store.email,
        slug: store.slug,
      }
    : null

  const summary: CustomerMessageSummary = {
    recipients: recipients.length,
    emailed: 0,
    whatsappSent: 0,
    whatsappQueued: 0,
    failed,
    skipped: [...skipped],
  }

  let waIndex = 0
  for (const r of recipients) {
    const channels: string[] = []

    if (wantsEmail && brand) {
      if (r.email) {
        const mail = merchantMessageEmail(brand, {
          subject: fill(subject, r),
          body: fill(body, r),
          actionUrl: buttonUrl,
          actionLabel: buttonLabel ?? undefined,
          imageUrl,
        })
        const res = await sendEmail({
          to: r.email,
          ...mail,
          replyTo: safeReplyTo(store.email),
          sender: { name: store.name, slug: store.slug },
          log: { storeId: store.id, event: 'merchant_message', orderId: r.orderId ?? undefined, customerId: r.customerId ?? undefined },
        })
        if (res.ok) {
          summary.emailed++
          channels.push('البريد')
        } else summary.failed.push(`${who(r)} (بريد): ${res.error}`)
      } else if (input.channel === 'email') summary.skipped.push(`${who(r)}: مالوش بريد`)
    }

    if (wantsWhatsapp) {
      if (r.phone) {
        const text = buttonUrl ? `${fill(body, r)}\n\n${buttonUrl}` : fill(body, r)
        if (waIndex === 0) {
          const res = await deliverWhatsappMessage(store.id, { phone: r.phone, text, imageUrl, orderId: r.orderId, customerId: r.customerId })
          if (res.ok) {
            summary.whatsappSent++
            channels.push('واتساب')
          } else summary.failed.push(`${who(r)} (واتساب): ${res.error}`)
        } else {
          await enqueue({
            storeId: store.id,
            type: 'customer.message',
            payload: { phone: r.phone, text, imageUrl, orderId: r.orderId, customerId: r.customerId },
            delayMinutes: waIndex,
            maxAttempts: 3,
          })
          summary.whatsappQueued++
          channels.push('واتساب (في الطابور)')
        }
        waIndex++
      } else if (input.channel === 'whatsapp') summary.skipped.push(`${who(r)}: مالوش رقم`)
    }

    if (r.orderId && channels.length) {
      await db.insert(orderEvents).values({
        orderId: r.orderId,
        storeId: store.id,
        type: 'message_sent',
        message: `رسالة من المتجر على ${channels.join(' و')}: ${subject}`,
        meta: { subject, body: body.slice(0, 500), imageUrl, via: 'assistant' },
        actorType: 'merchant',
        actorId,
      })
    }
  }

  return { ok: true, summary }
}
