'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { users } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { hashPassword, verifyPassword } from '@/lib/auth'
import { recordAudit } from '@/lib/audit'

export type AccountState = { ok?: boolean; error?: string } | null

/**
 * حساب التاجر نفسه — مش متجره.
 *
 * ## الفرق ده كان ناقصًا خالص
 * كل الإعدادات في اللوحة عن **المتجر**: اسمه ونطاقه وشحنه. مفيش
 * أي مكان التاجر يغيّر فيه اسمه هو، ولا كلمة سرّه. اللي عايز يغيّر
 * كلمة سرّه كان لازم يسجّل خروج ويستعمل «نسيت كلمة السر» ويستنى
 * بريدًا — عشان يعمل حاجة هو فاكرها أصلًا.
 *
 * والحساب واحد والمتاجر ممكن تبقى أكتر: التغيير هنا بيمشي على كل
 * متاجره، عشان كده الصفحة برّه `settings` اللي كلها بتخص متجرًا
 * واحدًا.
 */

const profileSchema = z.object({
  name: z.string().trim().min(2, 'اكتب اسمك').max(80),
  phone: z.string().trim().max(24).nullish(),
})

export async function saveProfileAction(raw: unknown): Promise<AccountState> {
  const parsed = profileSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'بيانات ناقصة' }

  const { user } = await getDashboardContext()

  await db
    .update(users)
    .set({
      name: parsed.data.name,
      phone: parsed.data.phone?.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id))

  revalidatePath('/dashboard/account')
  revalidatePath('/dashboard')
  return { ok: true }
}

const passwordSchema = z.object({
  current: z.string().min(1, 'اكتب كلمة السر الحالية'),
  next: z.string().min(8, 'كلمة السر الجديدة ٨ حروف على الأقل').max(200),
})

/**
 * تغيير كلمة السر — **بكلمة السر الحالية**.
 *
 * ## ليه بنسأل عن الحالية والجلسة مفتوحة أصلًا
 * الجلسة مفتوحة معناها إن اللي قدام الشاشة فتحها **في وقت ما** —
 * مش إنه صاحبها دلوقتي. التاجر بينسى لوحته مفتوحة على لاب في
 * المكتب أو موبايل عند حد، وأي حد يعدّي يقدر يغيّر كلمة السر
 * ويقفل عليه حسابه ومتجره.
 *
 * ## وكل الجلسات التانية ما بتتقفلش هنا
 * ده قرار منفصل ومكانه صفحة الأجهزة — التاجر اللي بيغيّر كلمة
 * سرّه احتياطيًّا مش عايز يخرج من كل أجهزته بالضرورة، واللي حسابه
 * اتسرق عايز يقفلهم كلهم بضغطة واحدة واضحة.
 */
export async function changePasswordAction(raw: unknown): Promise<AccountState> {
  const parsed = passwordSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'بيانات ناقصة' }

  const { user, store } = await getDashboardContext()

  const [row] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1)

  if (!row?.passwordHash) {
    return { error: 'الحساب ده مالوش كلمة سر — استعمل «نسيت كلمة السر» عشان تعمل واحدة' }
  }

  const ok = await verifyPassword(parsed.data.current, row.passwordHash)
  if (!ok) return { error: 'كلمة السر الحالية غلط' }

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(parsed.data.next), updatedAt: new Date() })
    .where(eq(users.id, user.id))

  /*
    السجل بيقول «اتغيّرت» ولا بيسجّل أي جزء منها.

    التاجر اللي حسابه اتسرق بيدوّر في السجل على «إمتى اتغيّرت» —
    وده بيقول له إن اللي دخل غيّرها ومتى.
  */
  await recordAudit({
    storeId: store.id,
    userId: user.id,
    action: 'account.password_changed',
    resource: 'user',
    resourceId: user.id,
  })

  return { ok: true }
}
