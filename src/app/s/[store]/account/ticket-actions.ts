'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getStore } from '@/lib/storefront'
import { getCurrentCustomer } from '@/lib/customer-auth'
import { customerTickets, openTicket, replyToTicket, ticketMessages } from '@/lib/tickets'
import type { TicketMessage } from '@/lib/tickets-meta'

export type CustomerTicketState = { ok?: boolean; error?: string; ticketNumber?: number } | null

/**
 * أفعال الشكاوى من جهة العميل.
 *
 * ## الهوية من الكوكي لا من جسم الطلب
 * كل فعل بيبدأ من `getCurrentCustomer`. لو استقبلنا `customerId`
 * من المتصفح، أي حد كان يقدر يفتح شكوى باسم عميل تاني — أو أخطر،
 * يقرا شكاوى عميل تاني بمعرّفه.
 *
 * ## والقراءة مفلترة بالعميل كمان لا بالمتجر وحده
 * `replyToTicket` بتاخد `customerId` هنا: من غيره، عميل مسجّل في
 * المتجر كان يقدر يكتب في شكوى أي عميل تاني بمعرّفها.
 */

const openSchema = z.object({
  storeIdentifier: z.string().min(1),
  subject: z.string().trim().min(3, 'اكتب الموضوع').max(160),
  category: z.enum(['order', 'product', 'shipping', 'payment', 'other']),
  body: z.string().trim().min(5, 'اشرح المشكلة').max(4000),
  orderId: z.string().uuid().nullish(),
})

export async function openTicketAction(raw: unknown): Promise<CustomerTicketState> {
  const parsed = openSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'بيانات ناقصة' }
  const input = parsed.data

  const store = await getStore(input.storeIdentifier)
  if (!store) return { error: 'المتجر مش موجود' }

  const customer = await getCurrentCustomer(store.id)
  if (!customer) return { error: 'سجّل دخولك الأول' }

  const res = await openTicket({
    storeId: store.id,
    customerId: customer.id,
    customerName: customer.name,
    customerPhone: customer.phone,
    customerEmail: customer.email,
    orderId: input.orderId ?? null,
    subject: input.subject,
    category: input.category,
    body: input.body,
  })

  if (!res.ok) return { error: res.error }
  revalidatePath(`/s/${input.storeIdentifier}/account`)
  return { ok: true, ticketNumber: res.ticketNumber }
}

const replySchema = z.object({
  storeIdentifier: z.string().min(1),
  ticketId: z.string().uuid(),
  body: z.string().trim().min(1, 'اكتب رسالتك').max(4000),
})

export async function customerReplyAction(raw: unknown): Promise<CustomerTicketState> {
  const parsed = replySchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'بيانات ناقصة' }
  const input = parsed.data

  const store = await getStore(input.storeIdentifier)
  if (!store) return { error: 'المتجر مش موجود' }

  const customer = await getCurrentCustomer(store.id)
  if (!customer) return { error: 'سجّل دخولك الأول' }

  const res = await replyToTicket({
    storeId: store.id,
    ticketId: input.ticketId,
    author: 'customer',
    authorName: customer.name,
    body: input.body,
    customerId: customer.id,
  })

  if (!res.ok) return { error: res.error }
  revalidatePath(`/s/${input.storeIdentifier}/account`)
  return { ok: true }
}

export async function loadMyTicketAction(
  storeIdentifier: string,
  ticketId: string,
): Promise<{ messages: TicketMessage[] } | { error: string }> {
  const store = await getStore(storeIdentifier)
  if (!store) return { error: 'المتجر مش موجود' }

  const customer = await getCurrentCustomer(store.id)
  if (!customer) return { error: 'سجّل دخولك الأول' }

  /*
    التأكد إن الشكوى بتاعته قبل ما نرجّع رسايلها.

    `customerTickets` بترجّع شكاويه هو بس، فالفحص ده بيمنع قراءة
    شكوى عميل تاني بمعرّفها — والمعرّفات uuid بس ده مش سبب كافي
    نسيب الباب مفتوح.
  */
  const mine = await customerTickets(store.id, customer.id)
  if (!mine.some((t) => t.id === ticketId)) return { error: 'الشكوى مش موجودة' }

  return { messages: await ticketMessages(store.id, ticketId) }
}
