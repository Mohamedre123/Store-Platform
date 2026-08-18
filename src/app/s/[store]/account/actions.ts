'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { customerAddresses, customers, wishlists } from '@/db/schema'
import { getStore } from '@/lib/storefront'
import {
  createCustomerSession,
  destroyCustomerSession,
  findOrCreateCustomer,
  getCurrentCustomer,
} from '@/lib/customer-auth'
import { issueOrderOtp, verifyOrderOtp } from '@/lib/order-otp'
import { normalizePhone } from '@/lib/utils'

export type AuthState = { ok?: boolean; error?: string; sent?: boolean; target?: string } | null

/**
 * طلب رمز دخول.
 *
 * بنستخدم نفس نظام رموز الطلبات: رمز واحد صالح، ينتهي بعد ١٠ دقايق،
 * وبعد ٥ محاولات غلط لازم رمز جديد.
 */
export async function requestLoginCodeAction(input: {
  storeIdentifier: string
  phone: string
  email?: string
}): Promise<AuthState> {
  const store = await getStore(input.storeIdentifier)
  if (!store) return { error: 'المتجر مش موجود' }

  const phone = normalizePhone(input.phone, store.country === 'EG' ? '20' : '966')
  if (phone.replace(/\D/g, '').length < 10) return { error: 'اكتب رقم تليفون صحيح' }

  /**
   * لو العميل موجود وليه بريد مسجّل، بنبعت عليه — من غير ما نطلب منه
   * يكتبه تاني. ده بيمنع كمان إن حد يكتب رقم غيره وبريده هو ويدخل
   * على حساب مش بتاعه.
   */
  const [existing] = await db
    .select({ email: customers.email })
    .from(customers)
    .where(and(eq(customers.storeId, store.id), eq(customers.phone, phone)))
    .limit(1)

  const target = existing?.email || input.email
  if (!target) {
    return { error: 'مالناش بريد مسجّل للرقم ده. اكتب بريدك عشان نبعتلك الرمز.' }
  }
  if (existing?.email && input.email && existing.email !== input.email) {
    return { error: 'الرقم ده مسجّل ببريد تاني. استخدم البريد المسجّل.' }
  }

  const res = await issueOrderOtp({
    storeId: store.id,
    storeName: store.name,
    phone,
    email: target,
  })

  if (!res.ok) return { error: res.error }
  return { ok: true, sent: true, target: res.maskedTarget }
}

/** تأكيد رمز الدخول وفتح الجلسة */
export async function verifyLoginCodeAction(input: {
  storeIdentifier: string
  phone: string
  code: string
  name?: string
  email?: string
}): Promise<AuthState> {
  const store = await getStore(input.storeIdentifier)
  if (!store) return { error: 'المتجر مش موجود' }

  const phone = normalizePhone(input.phone, store.country === 'EG' ? '20' : '966')
  const verified = await verifyOrderOtp(store.id, phone, input.code)
  if (!verified.ok) return { error: verified.error }

  const customerId = await findOrCreateCustomer(store.id, phone, input.name)

  // البريد بيتسجّل أول مرة بس — تغييره بعد كده من صفحة الحساب
  if (input.email) {
    await db
      .update(customers)
      .set({ email: input.email })
      .where(and(eq(customers.id, customerId), eq(customers.storeId, store.id)))
  }

  await createCustomerSession(store.id, customerId)
  return { ok: true }
}

export async function logoutCustomerAction(storeIdentifier: string) {
  const store = await getStore(storeIdentifier)
  if (!store) return
  await destroyCustomerSession(store.id)
  revalidatePath(`/s/${store.slug}/account`)
}

/* ────────────────────────── المفضّلة ────────────────────────── */

export async function toggleWishlistAction(input: {
  storeIdentifier: string
  productId: string
}): Promise<{ ok: boolean; saved?: boolean; needsLogin?: boolean }> {
  const store = await getStore(input.storeIdentifier)
  if (!store) return { ok: false }

  const customer = await getCurrentCustomer(store.id)
  if (!customer) return { ok: false, needsLogin: true }

  const [existing] = await db
    .select({ id: wishlists.id })
    .from(wishlists)
    .where(and(eq(wishlists.customerId, customer.id), eq(wishlists.productId, input.productId)))
    .limit(1)

  if (existing) {
    await db.delete(wishlists).where(eq(wishlists.id, existing.id))
    return { ok: true, saved: false }
  }

  await db.insert(wishlists).values({
    storeId: store.id,
    customerId: customer.id,
    productId: input.productId,
  })
  return { ok: true, saved: true }
}

/* ────────────────────────── العناوين ────────────────────────── */

export async function saveAddressAction(input: {
  storeIdentifier: string
  id?: string
  label: string
  name: string
  phone: string
  city: string
  area: string
  street: string
  building: string
  isDefault: boolean
}): Promise<{ ok?: boolean; error?: string }> {
  const store = await getStore(input.storeIdentifier)
  if (!store) return { error: 'المتجر مش موجود' }

  const customer = await getCurrentCustomer(store.id)
  if (!customer) return { error: 'لازم تسجّل دخول' }

  if (!input.city.trim()) return { error: 'اختار المحافظة' }

  const values = {
    label: input.label.trim() || null,
    name: input.name.trim() || null,
    phone: input.phone.trim() ? normalizePhone(input.phone, store.country === 'EG' ? '20' : '966') : null,
    country: store.country,
    city: input.city.trim(),
    area: input.area.trim() || null,
    street: input.street.trim() || null,
    building: input.building.trim() || null,
    isDefault: input.isDefault,
  }

  // عنوان افتراضي واحد بس — نشيل العلامة عن الباقي قبل ما نحطها
  if (input.isDefault) {
    await db
      .update(customerAddresses)
      .set({ isDefault: false })
      .where(eq(customerAddresses.customerId, customer.id))
  }

  if (input.id) {
    await db
      .update(customerAddresses)
      .set(values)
      .where(and(eq(customerAddresses.id, input.id), eq(customerAddresses.customerId, customer.id)))
  } else {
    await db.insert(customerAddresses).values({ ...values, customerId: customer.id, storeId: store.id })
  }

  revalidatePath(`/s/${store.slug}/account`)
  return { ok: true }
}

export async function deleteAddressAction(storeIdentifier: string, id: string) {
  const store = await getStore(storeIdentifier)
  if (!store) return
  const customer = await getCurrentCustomer(store.id)
  if (!customer) return

  await db
    .delete(customerAddresses)
    .where(and(eq(customerAddresses.id, id), eq(customerAddresses.customerId, customer.id)))

  revalidatePath(`/s/${store.slug}/account`)
}
