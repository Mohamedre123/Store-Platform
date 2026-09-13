import 'server-only'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { categories, coupons, offers, products } from '@/db/schema'
import type { ActiveStore } from '@/lib/store-context'
import type { CouponRow } from '@/app/dashboard/marketing/coupons-manager'
import type { OfferRow } from '@/app/dashboard/marketing/offers-manager'
import type { BundleRow } from '@/app/dashboard/marketing/bundles-manager'

/**
 * بيانات صفحة التسويق (الكوبونات والعروض والباقات) — صفحة اللوحة
 * و`/api/app/marketing` بيقروا من هنا. نفس الاستعلامات اللي كانت في الصفحة.
 */
export async function loadMarketing(store: ActiveStore) {
  const [couponRows, productRows, categoryRows, offerRows] = await Promise.all([
    db
      .select()
      .from(coupons)
      .where(eq(coupons.storeId, store.id))
      .orderBy(desc(coupons.isActive), desc(coupons.createdAt))
      .limit(200),
    db
      .select({ id: products.id, name: products.name, price: products.price })
      .from(products)
      .where(and(eq(products.storeId, store.id), eq(products.status, 'active')))
      .orderBy(products.name)
      .limit(500),
    db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(eq(categories.storeId, store.id))
      .orderBy(categories.sortOrder),
    db.select().from(offers).where(eq(offers.storeId, store.id)).orderBy(offers.sortOrder),
  ])

  const rows = couponRows as CouponRow[]

  /*
    العروض والباقات في نفس الجدول وبيتفرّقوا بـ`type`.

    من غير الفصل ده، الباقة كانت بتطلع في شاشة عروض الكمية كعرض
    بلا شرايح — سطر فاضي التاجر مش فاهم هو إيه ولا ليه مش شغّال.
  */
  return {
    coupons: rows,
    products: productRows,
    categories: categoryRows,
    quantityOffers: offerRows.filter((o) => o.type === 'quantity_break') as OfferRow[],
    bundles: offerRows.filter((o) => o.type === 'fixed_bundle') as BundleRow[],
    active: rows.filter((c) => c.isActive).length,
    totalUses: rows.reduce((n, c) => n + c.usedCount, 0),
  }
}
