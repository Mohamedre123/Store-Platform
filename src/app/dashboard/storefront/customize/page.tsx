import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { storeThemes } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { getTheme } from '@/lib/themes'
import { defaultCustomization, mergeCustomization, type PanelKey } from '@/lib/customization'
import { Customizer } from './customizer'

export const metadata = { title: 'تخصيص المتجر' }

export default async function CustomizePage() {
  const { store } = await getDashboardContext()

  const [row] = await db.select().from(storeThemes).where(eq(storeThemes.storeId, store.id)).limit(1)
  const theme = getTheme(row?.themeSlug ?? 'zawya')
  const base = defaultCustomization(theme)

  const draft = (row?.draft ?? {}) as Record<string, unknown>
  // المسوّدة الكاملة (فيها لوحة الهوية) هي المصدر لو موجودة، وإلا نبني من
  // الأعمدة المنشورة — ده بيخلي المحرّر يفتح على آخر شغل التاجر بالظبط.
  const draftIsFull = draft && typeof draft.identity === 'object'

  const customization = draftIsFull
    ? mergeCustomization(base, draft as Partial<Record<PanelKey, unknown>>)
    : mergeCustomization(base, {
        identity: {
          ...(row?.tokens ?? {}),
          logoLight: store.logoLight,
          logoDark: store.logoDark,
          favicon: store.favicon,
          hideNameInHeader: store.hideNameInHeader,
        },
        announcement: row?.announcementBar,
        header: row?.header,
        listing: row?.listingPage,
        productPage: row?.productPage,
        cart: row?.cart,
        footer: row?.footer,
        hero: draft.hero,
        toolbar: draft.toolbar,
        preloader: draft.preloader,
      })

  // نضمن إن الشعار والفافيكون بيجوا من جدول المتجر (مصدرهم الحقيقي)
  customization.identity.logoLight = store.logoLight
  customization.identity.logoDark = store.logoDark
  customization.identity.favicon = store.favicon
  customization.identity.hideNameInHeader = store.hideNameInHeader

  return (
    <Customizer
      initial={customization}
      previewUrl={`/s/${store.slug}?preview=1`}
      themeName={theme.name}
    />
  )
}
