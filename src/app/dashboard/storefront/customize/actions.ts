'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { storeThemes, stores } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import type { Customization } from '@/lib/customization'

/**
 * حفظ التخصيص.
 *
 * الإعدادات كلها تُخزَّن في عمود JSON واحد، وبعض القيم تُنسخ كذلك
 * على جدول المتجر (الشعار، إخفاء الاسم) لأن أماكن تانية بتقراها
 * من هناك — لوحة التحكم والبريد وبطاقة المتجر.
 */
export async function saveCustomizationAction(customization: Customization) {
  const { store } = await getDashboardContext()

  await db
    .update(storeThemes)
    .set({
      tokens: {
        primary: customization.identity.primary,
        accent: customization.identity.accent,
        background: customization.identity.background,
        surface: customization.identity.surface,
        text: customization.identity.text,
        radius: customization.identity.radius,
        fontHeading: customization.identity.fontHeading,
        fontBody: customization.identity.fontBody,
        iconSet: customization.identity.iconSet,
      },
      header: customization.header,
      footer: customization.footer,
      productPage: customization.productPage,
      listingPage: customization.listing,
      cart: customization.cart,
      announcementBar: customization.announcement,
      draft: { hero: customization.hero, toolbar: customization.toolbar },
      publishedAt: new Date(),
    })
    .where(eq(storeThemes.storeId, store.id))

  await db
    .update(stores)
    .set({
      logoLight: customization.identity.logoLight,
      logoDark: customization.identity.logoDark,
      favicon: customization.identity.favicon,
      hideNameInHeader: customization.identity.hideNameInHeader,
    })
    .where(eq(stores.id, store.id))

  revalidatePath('/dashboard/storefront')
  return { ok: true }
}
