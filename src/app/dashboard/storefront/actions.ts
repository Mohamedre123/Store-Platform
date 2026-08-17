'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { storeThemes, type Section, type ThemeTokens } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { getTheme } from '@/lib/themes'
import { contentFor } from '@/lib/theme-content'

export type ThemeActionState = { ok?: boolean; error?: string } | null

/** تطبيق ثيم: ياخد لوحته الافتراضية ما لم يكن التاجر عدّل ألوانه بنفسه */
export async function applyThemeAction(slug: string): Promise<ThemeActionState> {
  const { store } = await getDashboardContext()
  const theme = getTheme(slug)

  const [current] = await db
    .select()
    .from(storeThemes)
    .where(eq(storeThemes.storeId, store.id))
    .limit(1)

  const tokens: ThemeTokens = {
    ...(current?.tokens ?? {}),
    primary: theme.palette.primary,
    accent: theme.palette.accent,
    radius: theme.radius,
  }

  /**
   * الثيم بييجي بمحتواه: أقسام مرتّبة وشرائح بانر ونصوص جاهزة.
   * التاجر يعدّل فوقها بدل ما يبدأ من صفحة فاضية.
   */
  const content = contentFor(theme.slug)
  const previousDraft = (current?.draft ?? {}) as Record<string, unknown>

  await db
    .update(storeThemes)
    .set({
      themeSlug: theme.slug,
      tokens,
      homeSections: content.sections,
      announcementBar: { ...(current?.announcementBar ?? {}), enabled: true, text: content.announcement.text },
      draft: {
        ...previousDraft,
        hero: { style: theme.layout.hero, height: 'md', autoplay: true, intervalSeconds: 6, slides: content.slides },
      },
    })
    .where(eq(storeThemes.storeId, store.id))

  revalidatePath('/dashboard/storefront')
  return { ok: true }
}

/** حفظ توكنات الهوية (الألوان والحواف ومجموعة الأيقونات) */
export async function saveTokensAction(tokens: Partial<ThemeTokens>): Promise<ThemeActionState> {
  const { store } = await getDashboardContext()

  const [current] = await db
    .select({ tokens: storeThemes.tokens })
    .from(storeThemes)
    .where(eq(storeThemes.storeId, store.id))
    .limit(1)

  await db
    .update(storeThemes)
    .set({ tokens: { ...(current?.tokens ?? { primary: '#634b9a' }), ...tokens } })
    .where(eq(storeThemes.storeId, store.id))

  revalidatePath('/dashboard/storefront')
  return { ok: true }
}

/** حفظ ترتيب أقسام الصفحة الرئيسية وحالة تشغيلها */
export async function saveSectionsAction(sections: Section[]): Promise<ThemeActionState> {
  const { store } = await getDashboardContext()

  await db
    .update(storeThemes)
    .set({ homeSections: sections, publishedAt: new Date() })
    .where(eq(storeThemes.storeId, store.id))

  revalidatePath('/dashboard/storefront')
  return { ok: true }
}
