'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import {
  users,
  stores,
  storeMembers,
  checkoutSettings,
  storeThemes,
  thankYouSettings,
  loyaltySettings,
  messagingSettings,
  paymentMethods,
  shippingZones,
  inventoryLocations,
  pages,
} from '@/db/schema'
import { createSession, destroySession, hashPassword, verifyPassword } from '@/lib/auth'
import { isValidSlug } from '@/lib/domain'
import { issueEmailOtp } from '@/lib/otp'
import { config } from '@/lib/config'
import { contentFor } from '@/lib/theme-content'
import { suggestStoreSlug } from '@/lib/utils'

export type FormState = { error?: string; fieldErrors?: Record<string, string> } | null

const signupSchema = z.object({
  name: z.string().trim().min(2, 'اكتب اسمك'),
  email: z.string().trim().toLowerCase().email('البريد الإلكتروني غير صحيح'),
  password: z.string().min(8, 'كلمة المرور لازم تكون 8 حروف على الأقل'),
  storeName: z.string().trim().min(2, 'اكتب اسم متجرك'),
  storeSlug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'الرابط قصير جدًا')
    .max(40, 'الرابط طويل جدًا'),
})

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('البريد الإلكتروني غير صحيح'),
  password: z.string().min(1, 'اكتب كلمة المرور'),
})

function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? '_')
    if (!out[key]) out[key] = issue.message
  }
  return out
}

async function requestMeta() {
  const h = await headers()
  return {
    userAgent: h.get('user-agent') ?? undefined,
    ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
  }
}

/* ────────────────────────── تسجيل جديد ────────────────────────── */

export async function signupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signupSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
    storeName: formData.get('storeName'),
    storeSlug: formData.get('storeSlug') || suggestStoreSlug(String(formData.get('storeName') ?? '')),
  })

  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) }
  }

  const { name, email, password, storeName, storeSlug } = parsed.data

  if (!isValidSlug(storeSlug)) {
    return {
      fieldErrors: {
        storeSlug: 'الرابط لازم يكون حروف إنجليزية صغيرة وأرقام وشرطات فقط، وغير محجوز',
      },
    }
  }

  const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
  if (existingUser) {
    return { fieldErrors: { email: 'البريد ده مسجّل قبل كده — سجّل دخول' } }
  }

  const [existingStore] = await db
    .select({ id: stores.id })
    .from(stores)
    .where(eq(stores.slug, storeSlug))
    .limit(1)
  if (existingStore) {
    return { fieldErrors: { storeSlug: 'الرابط ده محجوز — جرّب رابط تاني' } }
  }

  const passwordHash = await hashPassword(password)

  /**
   * إنشاء الحساب والمتجر في معاملة واحدة.
   * لو أي خطوة فشلت، ما ينفعش يفضل حساب من غير متجر أو متجر من غير إعدادات.
   */
  const userId = await db.transaction(async (tx) => {
    const [user] = await tx.insert(users).values({ email, passwordHash, name }).returning({ id: users.id })

    const trialEndsAt = new Date()
    trialEndsAt.setDate(trialEndsAt.getDate() + config.trialDays)

    const [store] = await tx
      .insert(stores)
      .values({
        slug: storeSlug,
        name: storeName,
        email,
        status: 'trial',
        trialEndsAt,
      })
      .returning({ id: stores.id })

    await tx.insert(storeMembers).values({
      storeId: store.id,
      userId: user.id,
      role: 'owner',
      acceptedAt: new Date(),
    })

    // إعدادات افتراضية صالحة للبيع من أول دقيقة
    await tx.insert(checkoutSettings).values({ storeId: store.id })
    await tx.insert(thankYouSettings).values({ storeId: store.id })
    await tx.insert(messagingSettings).values({ storeId: store.id })
    await tx.insert(loyaltySettings).values({
      storeId: store.id,
      tiers: [
        { key: 'bronze', name: 'برونزي', minPoints: 0, color: '#a97142', perks: [], discountBps: 0 },
        { key: 'silver', name: 'فضي', minPoints: 500, color: '#9ca3af', perks: [], discountBps: 200 },
        { key: 'gold', name: 'ذهبي', minPoints: 2000, color: '#d4a017', perks: [], discountBps: 500 },
        { key: 'platinum', name: 'بلاتيني', minPoints: 5000, color: '#6b7280', perks: [], discountBps: 800 },
      ],
    })

    await tx.insert(storeThemes).values({
      storeId: store.id,
      themeSlug: 'zawya',
      tokens: { primary: '#634b9a', radius: 'lg', mode: 'light' },
      homeSections: contentFor('zawya').sections,
    })

    // الدفع عند الاستلام مفعّل افتراضيًا — هو الأساس في السوق المصري
    await tx.insert(paymentMethods).values([
      { storeId: store.id, gateway: 'cod', enabled: true, displayName: 'الدفع عند الاستلام', sortOrder: 0 },
      { storeId: store.id, gateway: 'manual', enabled: false, displayName: 'تحويل بنكي / محفظة', sortOrder: 1 },
    ])

    await tx.insert(shippingZones).values({
      storeId: store.id,
      country: 'EG',
      name: 'مصر',
      enabled: true,
      defaultPrice: 5000, // 50 ج.م
      freeShippingEnabled: true,
      freeOverAmount: 100000, // 1000 ج.م
      minDays: 2,
      maxDays: 5,
    })

    await tx.insert(inventoryLocations).values({
      storeId: store.id,
      name: 'المخزن الرئيسي',
      isDefault: true,
    })

    await tx.insert(pages).values([
      { storeId: store.id, slug: 'terms', title: 'الشروط والأحكام', type: 'terms', isPublished: false },
      { storeId: store.id, slug: 'privacy', title: 'سياسة الخصوصية', type: 'privacy', isPublished: false },
      { storeId: store.id, slug: 'refund', title: 'سياسة الاسترجاع', type: 'refund', isPublished: false },
    ])

    return user.id
  })

  await createSession(userId, await requestMeta())

  // رمز التأكيد يُرسل بعد إنشاء الجلسة، فيقدر يعيد الطلب من صفحة التأكيد
  const otp = await issueEmailOtp(userId, email, name)
  if (otp.ok && otp.autoVerified) redirect('/dashboard')
  redirect('/verify')
}

/* ────────────────────────── تسجيل الدخول ────────────────────────── */

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error) }

  const { email, password } = parsed.data

  const [user] = await db
    .select({ id: users.id, passwordHash: users.passwordHash, emailVerifiedAt: users.emailVerifiedAt, name: users.name })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  // رسالة واحدة للحالتين — لا نكشف إن كان البريد مسجّلًا أم لا
  const invalid = { error: 'البريد أو كلمة المرور غير صحيحة' }
  if (!user?.passwordHash) return invalid
  if (!(await verifyPassword(password, user.passwordHash))) return invalid

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id))
  await createSession(user.id, await requestMeta())

  if (!user.emailVerifiedAt) {
    const otp = await issueEmailOtp(user.id, email, user.name)
    if (!(otp.ok && otp.autoVerified)) redirect('/verify')
  }

  redirect('/dashboard')
}

export async function logoutAction() {
  await destroySession()
  redirect('/login')
}
