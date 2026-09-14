import 'server-only'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { banners } from '@/db/schema'

/**
 * بانرات المتجر — صفحة اللوحة (`/dashboard/storefront/banners`) وتطبيق
 * الموبايل (`/api/app/banners`) الاتنين بيقروا من هنا.
 */
export async function loadBanners(storeId: string) {
  return db.select().from(banners).where(eq(banners.storeId, storeId)).orderBy(desc(banners.createdAt)).limit(100)
}
