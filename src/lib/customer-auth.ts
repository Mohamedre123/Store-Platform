import 'server-only'
import { cookies, headers } from 'next/headers'
import { cache } from 'react'
import { and, eq, gt } from 'drizzle-orm'
import { db } from '@/db'
import { customerSessions, customers } from '@/db/schema'
import { generateToken, hashToken } from './crypto'
import { hashPassword, verifyPassword } from './auth'
import { ROOT_DOMAIN } from './domain'

/**
 * حسابات عملاء المتجر.
 *
 * منفصلة تمامًا عن حسابات التجّار: عميل متجر A مالوش أي علاقة بمتجر B
 * حتى لو نفس الرقم. الكوكي نفسه مقيّد بالمتجر عشان جلسة في متجر ما
 * تفتحش حساب في متجر تاني.
 *
 * الدخول برمز على الرقم أو البريد، أو بكلمة سر لو العميل عمل واحدة.
 * الرمز هو الافتراضي لأن العميل اللي بيشتري مرة كل شهرين مش هيفتكر
 * كلمة سر — وكلمة السر متاحة للي بيشتري كتير وعايز دخولًا أسرع.
 */

const SESSION_DAYS = 60

/**
 * أقصى سكون قبل ما الجلسة تموت.
 *
 * الصلاحية شهرين، بس **٢٤ ساعة من غير أي نشاط بتقفلها**. الفرق
 * ده مقصود: العميل اللي بيدخل كل يومين بتفضل جلسته شغّالة، والجهاز
 * المشترك أو الموبايل الضايع ما بيفضلش فاتح على حساب فيه عناوين
 * وتاريخ طلبات لشهرين.
 */
const IDLE_HOURS = 24

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
  /** الولاء — بيتقرا في نفس الاستعلام بدل استعلام تاني على كل صفحة */
  lifetimePoints: number
  tier: string
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
    ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    expiresAt,
    lastSeenAt: new Date(),
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

    const hash = hashToken(token)
    const idleCutoff = new Date(Date.now() - IDLE_HOURS * 3_600_000)

    const rows = await db
      .select({
        id: customers.id,
        name: customers.name,
        phone: customers.phone,
        email: customers.email,
        lifetimePoints: customers.lifetimePoints,
        tier: customers.tier,
        sessionId: customerSessions.id,
        lastSeenAt: customerSessions.lastSeenAt,
      })
      .from(customerSessions)
      .innerJoin(customers, eq(customers.id, customerSessions.customerId))
      .where(
        and(
          eq(customerSessions.tokenHash, hash),
          eq(customerSessions.storeId, storeId),
          gt(customerSessions.expiresAt, new Date()),
          // السكون الطويل بيقفل الجلسة حتى لو صلاحيتها لسه سارية
          gt(customerSessions.lastSeenAt, idleCutoff),
        ),
      )
      .limit(1)

    const row = rows[0]
    if (!row) return null

    /*
      تحديث آخر نشاط — مرة كل ساعة بحد أقصى.

      الكتابة مع كل طلب كانت هتعمل تحديثًا على كل صفحة يفتحها
      العميل، وده حِمل حقيقي على الجدول من غير فايدة: الفرق بين
      «آخر نشاط من دقيقة» و«من نص ساعة» مالوش أثر على حد الـ٢٤ ساعة.
    */
    if (Date.now() - new Date(row.lastSeenAt).getTime() > 3_600_000) {
      void db
        .update(customerSessions)
        .set({ lastSeenAt: new Date() })
        .where(eq(customerSessions.id, row.sessionId))
        .catch(() => undefined)
    }

    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      email: row.email,
      lifetimePoints: row.lifetimePoints,
      tier: row.tier,
    }
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

/* ────────────────────────── كلمة السر ────────────────────────── */

/**
 * كلمة سر اختيارية للعميل.
 *
 * مش بديل للرمز — إضافة ليه. العميل اللي بيشتري كل أسبوع بيزهق من
 * انتظار رمز في كل مرة، واللي بيشتري مرة في الشهرين مش هيفتكر كلمة
 * سر. الاتنين متاحين والعميل بيختار.
 */
export async function setCustomerPassword(
  storeId: string,
  customerId: string,
  password: string,
): Promise<{ ok?: boolean; error?: string }> {
  if (password.length < 8) return { error: 'كلمة السر لازم تكون ٨ حروف على الأقل' }

  await db
    .update(customers)
    .set({ passwordHash: await hashPassword(password) })
    .where(and(eq(customers.id, customerId), eq(customers.storeId, storeId)))

  return { ok: true }
}

/**
 * دخول بكلمة السر.
 *
 * **الرد واحد سواء الحساب موجود أو كلمة السر غلط.** التفرقة بتخلّي
 * أي حد يجرّب أرقام ويعرف مين عميل عند التاجر ده — ودي بداية أي
 * محاولة انتحال.
 */
export async function verifyCustomerPassword(
  storeId: string,
  field: 'phone' | 'email',
  value: string,
  password: string,
): Promise<{ ok: true; customerId: string } | { ok: false; error: string }> {
  const [row] = await db
    .select({ id: customers.id, hash: customers.passwordHash })
    .from(customers)
    .where(
      and(
        eq(customers.storeId, storeId),
        field === 'phone' ? eq(customers.phone, value) : eq(customers.email, value),
      ),
    )
    .limit(1)

  const fail = { ok: false as const, error: 'البيانات غلط. جرّب الدخول برمز بدل كلمة السر.' }

  if (!row?.hash) return fail
  if (!(await verifyPassword(password, row.hash))) return fail

  return { ok: true, customerId: row.id }
}

/** فيه كلمة سر متسجّلة؟ الواجهة بتعرض خانتها على أساسها */
export async function customerHasPassword(
  storeId: string,
  field: 'phone' | 'email',
  value: string,
): Promise<boolean> {
  const [row] = await db
    .select({ hash: customers.passwordHash })
    .from(customers)
    .where(
      and(
        eq(customers.storeId, storeId),
        field === 'phone' ? eq(customers.phone, value) : eq(customers.email, value),
      ),
    )
    .limit(1)

  return Boolean(row?.hash)
}

/** يوجد العميل أو ينشئه بالبريد — للي بيدخل ببريده مش برقمه */
export async function findOrCreateByEmail(storeId: string, email: string, name?: string | null) {
  const [existing] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.storeId, storeId), eq(customers.email, email)))
    .limit(1)

  if (existing) return existing.id

  const [created] = await db
    .insert(customers)
    .values({ storeId, email, name: name || null, emailVerifiedAt: new Date() })
    .returning({ id: customers.id })

  return created.id
}
