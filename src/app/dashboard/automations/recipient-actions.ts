'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { notificationRecipients } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { normalizePhone } from '@/lib/utils'
import type { AutomationEvent, Channel } from '@/db/schema'

export type RecipientState = { ok?: boolean; error?: string } | null

/**
 * مستقبلو إشعارات الطلبات.
 *
 * التاجر اللي معاه موظفين مش بيقدر يقعد على اللوحة طول اليوم.
 * الشخص المسؤول عن التغليف يهمّه «طلب جديد» بس، وصاحب المحل يهمّه
 * «طلب اتلغى». إشعار واحد للكل معناه إن الاتنين بيتجاهلوه بعد يومين.
 */

const EVENTS: AutomationEvent[] = [
  'order_placed',
  'order_confirmed',
  'order_shipped',
  'order_delivered',
  'order_cancelled',
  'abandoned_cart',
]

const CHANNELS: Channel[] = ['telegram', 'whatsapp', 'email', 'sms']

const schema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().max(80).optional(),
  channel: z.enum(['telegram', 'whatsapp', 'email', 'sms']),
  /** رقم أو بريد أو معرّف محادثة تيليجرام حسب القناة */
  target: z.string().trim().min(1, 'اكتب وسيلة التواصل').max(120),
  events: z.array(z.string()).min(1, 'اختار حدثًا واحدًا على الأقل'),
  isActive: z.boolean().optional(),
})

export async function saveRecipientAction(raw: unknown): Promise<RecipientState> {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'بيانات ناقصة' }

  const { store } = await getDashboardContext()
  const input = parsed.data

  const events = input.events.filter((e): e is AutomationEvent =>
    EVENTS.includes(e as AutomationEvent),
  )
  if (events.length === 0) return { error: 'اختار حدثًا واحدًا على الأقل' }

  /*
    الوجهة بتتخزّن في العمود الصح حسب القناة.

    تيليجرام بياخد معرّف محادثة رقمي، وواتساب والرسايل بياخدوا رقمًا
    دوليًا، والبريد بياخد بريدًا. تخزينهم في عمود واحد كان هيخلّي
    الإرسال يخمّن — والتخمين الغلط معناه إشعار بيروح لحد تاني.
  */
  const isPhone = input.channel === 'whatsapp' || input.channel === 'sms'
  const values = {
    name: input.name || null,
    channel: input.channel as Channel,
    phone: isPhone
      ? normalizePhone(input.target, store.country === 'EG' ? '20' : '966')
      : input.channel === 'email'
        ? input.target.toLowerCase()
        : null,
    chatId: input.channel === 'telegram' ? input.target : null,
    events,
    isActive: input.isActive ?? true,
  }

  if (input.channel === 'email' && !/^\S+@\S+\.\S+$/.test(input.target)) {
    return { error: 'اكتب بريدًا صحيحًا' }
  }

  if (input.id) {
    await db
      .update(notificationRecipients)
      .set(values)
      .where(
        and(
          eq(notificationRecipients.id, input.id),
          eq(notificationRecipients.storeId, store.id),
        ),
      )
  } else {
    await db.insert(notificationRecipients).values({ ...values, storeId: store.id })
  }

  revalidatePath('/dashboard/automations')
  return { ok: true }
}

export async function deleteRecipientAction(id: string): Promise<RecipientState> {
  const { store } = await getDashboardContext()

  await db
    .delete(notificationRecipients)
    .where(
      and(eq(notificationRecipients.id, id), eq(notificationRecipients.storeId, store.id)),
    )

  revalidatePath('/dashboard/automations')
  return { ok: true }
}

export async function toggleRecipientAction(
  id: string,
  isActive: boolean,
): Promise<RecipientState> {
  const { store } = await getDashboardContext()

  await db
    .update(notificationRecipients)
    .set({ isActive })
    .where(
      and(eq(notificationRecipients.id, id), eq(notificationRecipients.storeId, store.id)),
    )

  return { ok: true }
}

export { EVENTS as RECIPIENT_EVENTS, CHANNELS as RECIPIENT_CHANNELS }
