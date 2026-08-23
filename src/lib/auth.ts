import 'server-only'
import { cookies, headers } from 'next/headers'
import { cache } from 'react'
import { and, eq, gt } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { db } from '@/db'
import { sessions, users, storeMembers, stores } from '@/db/schema'
import { generateToken, hashToken } from './crypto'
import { ROOT_DOMAIN } from './domain'
import { config } from './config'

const SESSION_COOKIE = 'zawya_session'
const SESSION_DAYS = config.session.days

/**
 * نطاق الكوكي — يُشتقّ من المضيف الفعلي للطلب لا من الإعدادات.
 *
 * السبب: المنصة بتتقدّم من أكتر من مضيف — نطاقها، ونطاق Vercel،
 * وlocalhost. لو ثبّتنا النطاق من متغيّر البيئة، المتصفح بيرفض
 * الكوكي على أي مضيف تاني، فالمستخدم يدخل بنجاح ثم يلاقي نفسه
 * خارج مع أول ضغطة — وده اللي كان بيحصل على vercel.app.
 *
 * لما المضيف تحت نطاق المنصة، بنستخدم نطاقًا أبًا («.zawyaeg.site»)
 * عشان الجلسة تسري على اللوحة والمتاجر معًا. غير كده كوكي للمضيف
 * وحده، وهو المقبول دايمًا.
 */
async function sessionCookieDomain(): Promise<string | undefined> {
  // ROOT_DOMAIN منظَّف بالفعل (بدون بروتوكول/www/مسار) فالكوكي يشتغل مهما
  // كان شكل المتغيّر في Vercel
  const root = ROOT_DOMAIN.split(':')[0]
  if (!root || !root.includes('.') || root.endsWith('.vercel.app')) return undefined

  const host = (await headers()).get('host')?.split(':')[0].toLowerCase().replace(/^www\./, '')
  if (!host) return undefined
  if (host !== root && !host.endsWith('.' + root)) return undefined

  return '.' + root
}

export type SessionUser = {
  id: string
  email: string
  name: string
  emailVerifiedAt: Date | null
  phone: string | null
  avatar: string | null
  locale: 'ar' | 'en'
  isPlatformAdmin: boolean
}

/* ────────────────────────── كلمات المرور ────────────────────────── */

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/* ────────────────────────── الجلسات ────────────────────────── */

export async function createSession(userId: string, meta: { userAgent?: string; ip?: string } = {}) {
  const token = generateToken()
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)

  await db.insert(sessions).values({
    userId,
    tokenHash: hashToken(token),
    userAgent: meta.userAgent?.slice(0, 500),
    ip: meta.ip,
    expiresAt,
  })

  const jar = await cookies()
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    domain: await sessionCookieDomain(),
    expires: expiresAt,
  })

  return token
}

export async function destroySession() {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (token) {
    await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)))
  }
  jar.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    domain: await sessionCookieDomain(),
    maxAge: 0,
  })
}

/**
 * المستخدم الحالي. مغلّف بـcache عشان استدعاؤه في أكتر من مكان
 * في نفس الطلب ما يعملش أكتر من استعلام.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (!token) return null

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      phone: users.phone,
      avatar: users.avatar,
      locale: users.locale,
      emailVerifiedAt: users.emailVerifiedAt,
      isPlatformAdmin: users.isPlatformAdmin,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1)

  return rows[0] ?? null
})

/* ────────────────────────── المتاجر ────────────────────────── */

export type MemberStore = {
  id: string
  slug: string
  name: string
  logoLight: string | null
  status: string
  role: string
  isPublished: boolean
}

/**
 * كل المتاجر اللي المستخدم عضو فيها بأعمدتها الكاملة + دوره.
 *
 * مغلّفة بـcache فبتتنادى مرة واحدة في الطلب: التبديل بين المتاجر
 * وسياق اللوحة الاتنين بيقروا منها بدل ما كل واحد يعمل استعلام لوحده —
 * ده بيشيل رحلة كاملة للخادم من كل تنقّل في اللوحة.
 */
export const getMemberStoresFull = cache(
  async (userId: string): Promise<Array<typeof stores.$inferSelect & { role: string }>> => {
    const rows = await db
      .select({ store: stores, role: storeMembers.role })
      .from(storeMembers)
      .innerJoin(stores, eq(stores.id, storeMembers.storeId))
      .where(eq(storeMembers.userId, userId))
    return rows.map((r) => ({ ...r.store, role: r.role }))
  },
)

/** كل المتاجر اللي المستخدم عضو فيها — يخدم تعدّد المتاجر بحساب واحد */
export const getUserStores = cache(async (userId: string): Promise<MemberStore[]> => {
  const full = await getMemberStoresFull(userId)
  return full.map((s) => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
    logoLight: s.logoLight,
    status: s.status,
    role: s.role,
    isPublished: s.isPublished,
  }))
})

/** يتحقق أن المستخدم فعلًا عضو في المتجر — البوابة الوحيدة لأي بيانات متجر */
export const requireStoreAccess = cache(async (userId: string, storeId: string) => {
  const rows = await db
    .select({ role: storeMembers.role, permissions: storeMembers.permissions })
    .from(storeMembers)
    .where(and(eq(storeMembers.userId, userId), eq(storeMembers.storeId, storeId)))
    .limit(1)

  return rows[0] ?? null
})
