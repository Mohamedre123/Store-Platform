'use server'

import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { customers } from '@/db/schema'
import { getStore, getStoreTheme, type StorefrontStore } from '@/lib/storefront'
import {
  createCustomerSession,
  customerHasPassword,
  findOrCreateByEmail,
  findOrCreateCustomer,
  setCustomerPassword,
  verifyCustomerPassword,
} from '@/lib/customer-auth'
import { issueCustomerOtp, readIdentity, verifyCustomerOtp, type Channel } from '@/lib/customer-otp'

/**
 * دخول العميل — برقمه أو ببريده، برمز أو بكلمة سر.
 *
 * كل الأفعال هنا بتاخد «معرّف» واحد (`identifier`) والخادم هو اللي
 * بيقرّر ده رقم ولا بريد. الواجهة بخانة واحدة بدل خانتين والعميل
 * يختار — والاختيار ده خطوة زيادة عند أول احتكاك، ودي أغلى خطوة
 * في المتجر كله.
 */

export type LoginState =
  | { ok: true; step: 'code'; channel: Channel; masked: string; note?: string }
  | { ok: true; step: 'done' }
  | { ok: true; step: 'password'; masked: string }
  | { ok: false; error: string }

/**
 * هوية المتجر للرسايل — اسمه وشعاره ولونه.
 *
 * اللون بييجي من توكنز الثيم عشان الرمز في الرسالة يطلع بنفس لون
 * الزراير اللي العميل شافها في المتجر قبل ما يطلب الرمز.
 */
async function storeBrand(store: StorefrontStore) {
  const theme = await getStoreTheme(store.id)
  return { name: store.name, logo: store.logoLight, primary: theme.custom.identity.primary }
}
/**
 * الخطوة الأولى: العميل كتب رقمه أو بريده.
 *
 * لو عنده كلمة سر، بنعرضها كخيار أسرع **من غير ما نمنع الرمز** —
 * اللي نسي كلمة سرّه لازم يلاقي طريقًا يدخل بيه في نفس الشاشة.
 */
export async function startLoginAction(input: {
  storeIdentifier: string
  identifier: string
}): Promise<LoginState> {
  const store = await getStore(input.storeIdentifier)
  if (!store) return { ok: false, error: 'المتجر مش موجود' }

  const identity = readIdentity(input.identifier, store.country)
  if (!identity) return { ok: false, error: 'اكتب رقم تليفون صحيح أو بريد إلكتروني' }

  const hasPassword = await customerHasPassword(store.id, identity.kind, identity.value)
  if (hasPassword) {
    return {
      ok: true,
      step: 'password',
      masked: identity.kind === 'email' ? identity.value : identity.value,
    }
  }

  const res = await issueCustomerOtp({
    storeId: store.id,
    brand: await storeBrand(store),
    identity,
    country: store.country,
  })

  if (!res.ok) return { ok: false, error: res.error }

  return {
    ok: true,
    step: 'code',
    channel: res.channel,
    masked: res.masked,
    note: res.devCode ? `رمز التطوير: ${res.devCode}` : undefined,
  }
}

/** طلب رمز صراحةً — لمن نسي كلمة سرّه أو عايز يدخل بالرمز */
export async function sendCodeAction(input: {
  storeIdentifier: string
  identifier: string
}): Promise<LoginState> {
  const store = await getStore(input.storeIdentifier)
  if (!store) return { ok: false, error: 'المتجر مش موجود' }

  const identity = readIdentity(input.identifier, store.country)
  if (!identity) return { ok: false, error: 'اكتب رقم تليفون صحيح أو بريد إلكتروني' }

  const res = await issueCustomerOtp({
    storeId: store.id,
    brand: await storeBrand(store),
    identity,
    country: store.country,
  })

  if (!res.ok) return { ok: false, error: res.error }

  return {
    ok: true,
    step: 'code',
    channel: res.channel,
    masked: res.masked,
    note: res.devCode ? `رمز التطوير: ${res.devCode}` : undefined,
  }
}

/** تأكيد الرمز وفتح الجلسة */
export async function verifyCodeAction(input: {
  storeIdentifier: string
  identifier: string
  code: string
  name?: string
}): Promise<LoginState> {
  const store = await getStore(input.storeIdentifier)
  if (!store) return { ok: false, error: 'المتجر مش موجود' }

  const identity = readIdentity(input.identifier, store.country)
  if (!identity) return { ok: false, error: 'بيانات غير صحيحة' }

  const res = await verifyCustomerOtp(store.id, identity, input.code)
  if (!res.ok) return { ok: false, error: res.error }

  const customerId =
    identity.kind === 'phone'
      ? await findOrCreateCustomer(store.id, identity.value, input.name)
      : await findOrCreateByEmail(store.id, identity.value, input.name)

  /*
    الوسيلة اللي اتحقّق بيها بتتعلّم «مؤكّدة».
    ده اللي بيخلّي رسايل الطلبات تروح على حاجة مثبتة إنها بتوصله،
    مش على أي حاجة اتكتبت في خانة.
  */
  await db
    .update(customers)
    .set(
      identity.kind === 'phone'
        ? { phoneVerifiedAt: new Date(), ...(input.name ? { name: input.name } : {}) }
        : { emailVerifiedAt: new Date(), ...(input.name ? { name: input.name } : {}) },
    )
    .where(and(eq(customers.id, customerId), eq(customers.storeId, store.id)))

  await createCustomerSession(store.id, customerId)
  return { ok: true, step: 'done' }
}

/** دخول بكلمة السر */
export async function loginWithPasswordAction(input: {
  storeIdentifier: string
  identifier: string
  password: string
}): Promise<LoginState> {
  const store = await getStore(input.storeIdentifier)
  if (!store) return { ok: false, error: 'المتجر مش موجود' }

  const identity = readIdentity(input.identifier, store.country)
  if (!identity) return { ok: false, error: 'بيانات غير صحيحة' }

  const res = await verifyCustomerPassword(
    store.id,
    identity.kind,
    identity.value,
    input.password,
  )
  if (!res.ok) return { ok: false, error: res.error }

  await createCustomerSession(store.id, res.customerId)
  return { ok: true, step: 'done' }
}

/** العميل بيحطّ كلمة سر لحسابه من صفحة حسابه */
export async function setPasswordAction(input: {
  storeIdentifier: string
  password: string
}): Promise<{ ok?: boolean; error?: string }> {
  const store = await getStore(input.storeIdentifier)
  if (!store) return { error: 'المتجر مش موجود' }

  const { getCurrentCustomer } = await import('@/lib/customer-auth')
  const customer = await getCurrentCustomer(store.id)
  if (!customer) return { error: 'لازم تسجّل دخول الأول' }

  return setCustomerPassword(store.id, customer.id, input.password)
}
