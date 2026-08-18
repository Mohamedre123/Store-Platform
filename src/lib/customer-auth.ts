import 'server-only'
import { cookies, headers } from 'next/headers'
import { cache } from 'react'
import { and, eq, gt } from 'drizzle-orm'
import { db } from '@/db'
import { customerSessions, customers } from '@/db/schema'
import { generateToken, hashToken } from './crypto'
import { ROOT_DOMAIN } from './domain'

/**
 * حسابات عملاء المتجر.
 *
 * منفصلة تمامًا عن حسابات التجّار: عميل متجر A مالوش أي علاقة بمتجر B
 * حتى لو نفس الرقم. الكوكي نفسه مقيّد بالمتجر عشان جلسة في متجر ما
 * تفتحش حساب في متجر تاني.
 *
 * الدخول بالرقم + رمز تحقق — مفيش كلمة مرور. العميل المصري مش هيفتكر
 * كلمة سر لمتجر بيشتري منه مرة كل شهرين، وأي كلمة سر بيحطها هتبقى
 * مكرّرة من مكان تاني.
 */

const SESSION_DAYS = 60

/** اسم كوكي مخصّص لكل متجر — جلسة لكل متجر على حدة */
function cookieName(storeId: string) {
  return `zw_c_${storeId.replace(/-/g, '').slice(0, 12)}`
}

export type StoreCustomer = {
  id: string
  name: string | null
  /** العميل ممكن يتسجّل ببريد من غير رقم في حالات نادرة */
  phone: string | null
  email: string | null
}

export async function createCustomerSession(storeId: string, customerId: string) {
  const token = generateToken(32)
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000)

  const h = await headers()
  await db.insert(customerSessions).values({
    customerId,
    storeId,
    tokenHash: hashToken(token),
    userAgent: h.get('user-agent')?.slice(0, 500),
    expiresAt,
  })

  const jar = await cookies()
  jar.set(cookieName(storeId), token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
    // بدون domain: الكوكي بيتقيّد بالمضيف الحالي، وده المطلوب عشان
    // النطاق المخصّص للتاجر ونطاقنا الفرعي ما يتشاركوش جلسات
  })

  return token
}

export const getCurrentCustomer = cache(
  async (storeId: string): Promise<StoreCustomer | null> => {
    const jar = await cookies()
    const token = jar.get(cookieName(storeId))?.value
    if (!token) return null

    const rows = await db
      .select({
        id: customers.id,
        name: customers.name,
        phone: customers.phone,
        email: customers.email,
      })
      .from(customerSessions)
      .innerJoin(customers, eq(customers.id, customerSessions.customerId))
      .where(
        and(
          eq(customerSessions.tokenHash, hashToken(token)),
          eq(customerSessions.storeId, storeId),
          gt(customerSessions.expiresAt, new Date()),
        ),
      )
      .limit(1)

    return rows[0] ?? null
  },
)

export async function destroyCustomerSession(storeId: string) {
  const jar = await cookies()
  const name = cookieName(storeId)
  const token = jar.get(name)?.value

  if (token) {
    await db.delete(customerSessions).where(eq(customerSessions.tokenHash, hashToken(token)))
  }

  jar.set(name, '', { httpOnly: true, path: '/', maxAge: 0 })
}

/** يوجد العميل أو ينشئه بالرقم — نفس مفتاح الطلبات */
export async function findOrCreateCustomer(storeId: string, phone: string, name?: string | null) {
  const [row] = await db
    .insert(customers)
    .values({ storeId, phone, name: name || null })
    .onConflictDoUpdate({
      target: [customers.storeId, customers.phone],
      set: name ? { name } : { phone },
    })
    .returning({ id: customers.id })

  return row.id
}
