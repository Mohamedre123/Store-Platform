'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { storeThemes, stores } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import type { ThemeTokens } from '@/db/schema'
import { normalizePhone } from '@/lib/utils'

export type SettingsState = { ok?: boolean; error?: string } | null

/**
 * بيانات المتجر الأساسية — الاسم والشعار ووسائل التواصل.
 *
 * الشعار هنا هو نفسه اللي بيظهر في الهيدر وشاشة التحميل والبريد، فأي
 * تعديل هنا بيسري على المتجر كله فورًا (من غير ما يعدي على «نشر»
 * التخصيص، لأن دي بيانات مش شكل).
 */
export async function saveStoreInfoAction(input: {
  name: string
  tagline: string
  email: string
  phone: string
  whatsapp: string
  logoLight: string | null
  favicon: string | null
  /**
   * ألوان الهوية.
   *
   * هنا لا في محرّر الثيم وحده: التاجر بيفتح «بيانات المتجر» أول
   * يوم عشان يحطّ اسمه وشعاره، ولونه جزء من نفس الحاجة. إجباره
   * يروح لمحرّر التخصيص عشان لونين كان بيخلّي أغلب المتاجر تفضل
   * باللون الافتراضي.
   */
  primary?: string
  accent?: string
}): Promise<SettingsState> {
  const { store } = await getDashboardContext()

  const name = input.name.trim()
  if (!name) return { error: 'اسم المتجر مطلوب' }
  if (name.length > 80) return { error: 'اسم المتجر طويل أوي' }

  const email = input.email.trim()
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { error: 'البريد الإلكتروني مش صحيح' }
  }

  const dial = store.country === 'EG' ? '20' : '966'

  await db
    .update(stores)
    .set({
      name,
      tagline: input.tagline.trim() || null,
      email: email || null,
      phone: input.phone.trim() ? normalizePhone(input.phone, dial) : null,
      whatsapp: input.whatsapp.trim() ? normalizePhone(input.whatsapp, dial) : null,
      logoLight: input.logoLight,
      favicon: input.favicon,
    })
    .where(eq(stores.id, store.id))

  /*
    الألوان بتتحفظ في تخصيص الثيم — هو مصدر الحقيقة للعرض.
    لو خزّنّاها على المتجر كمان، بيبقى فيه رقمان للون الواحد
    وواحد فيهم هيقدم من غير ما حد ياخد باله.
  */
  const hex = /^#[0-9a-fA-F]{6}$/
  if ((input.primary && hex.test(input.primary)) || (input.accent && hex.test(input.accent))) {
    await saveIdentityColors(store.id, {
      primary: input.primary && hex.test(input.primary) ? input.primary : undefined,
      accent: input.accent && hex.test(input.accent) ? input.accent : undefined,
    })
  }

  revalidatePath('/dashboard/settings')
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/storefront')
  return { ok: true }
}

/**
 * يكتب لونَي الهوية في «توكنز» الثيم — هي مصدر ألوان المتجر المنشور.
 *
 * والمسوّدة بتتحدّث معاها لو كانت كاملة: التاجر اللي فتح محرّر
 * التخصيص وسابه من غير نشر، لو غيّر لونه من هنا كان هيلاقي المحرّر
 * لسه على اللون القديم ويفتكر إن الحفظ ضاع.
 */
async function saveIdentityColors(
  storeId: string,
  colors: { primary?: string; accent?: string },
): Promise<void> {
  const patch = {
    ...(colors.primary ? { primary: colors.primary } : {}),
    ...(colors.accent ? { accent: colors.accent } : {}),
  }
  if (!Object.keys(patch).length) return

  const [row] = await db
    .select({ tokens: storeThemes.tokens, draft: storeThemes.draft })
    .from(storeThemes)
    .where(eq(storeThemes.storeId, storeId))
    .limit(1)

  if (!row) return

  const draft = (row.draft ?? {}) as Record<string, unknown>
  const draftIdentity = draft.identity as Record<string, unknown> | undefined

  await db
    .update(storeThemes)
    .set({
      /*
        دمج جزئي: بنكتب اللونين وسايبين باقي التوكنز زي ما هي.
        الكتابة الكاملة كانت هتمسح الخط والحواف اللي التاجر ظبّطهم
        من محرّر الثيم.
      */
      tokens: { ...((row.tokens ?? {}) as ThemeTokens), ...patch } as ThemeTokens,
      ...(draftIdentity
        ? { draft: { ...draft, identity: { ...draftIdentity, ...patch } } }
        : {}),
    })
    .where(eq(storeThemes.storeId, storeId))
}

/**
 * الإعدادات المالية والإقليمية.
 *
 * تغيير العملة أو الدولة بيأثر على العرض بس — المبالغ المخزّنة أرقام
 * صحيحة بالوحدة الصغرى وما بتتحوّلش تلقائيًا. لو التاجر غيّر العملة
 * بعد ما باع، الأرقام القديمة بتفضل بقيمتها، فبننبّهه في الواجهة.
 */
export async function saveRegionalAction(input: {
  country: string
  currency: string
  vatEnabled: boolean
  vatRate: string
  vatIncludedInPrice: boolean
}): Promise<SettingsState> {
  const { store } = await getDashboardContext()

  // النسبة بنقاط الأساس: 14% → 1400
  const pct = Number(input.vatRate)
  if (input.vatEnabled && (!Number.isFinite(pct) || pct < 0 || pct > 100)) {
    return { error: 'نسبة الضريبة لازم تكون من ٠ لـ١٠٠' }
  }

  await db
    .update(stores)
    .set({
      country: input.country,
      currency: input.currency,
      vatEnabled: input.vatEnabled,
      vatRate: Math.round((pct || 0) * 100),
      vatIncludedInPrice: input.vatIncludedInPrice,
    })
    .where(eq(stores.id, store.id))

  revalidatePath('/dashboard/settings')
  return { ok: true }
}
