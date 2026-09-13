import 'server-only'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { affiliates } from '@/db/schema'

/**
 * المسوّقون بالعمولة — صفحة اللوحة (`/dashboard/affiliates`) وتطبيق الموبايل
 * (`/api/app/affiliates`) الاتنين بيقروا من هنا.
 */
export async function loadAffiliates(storeId: string) {
  return db
    .select()
    .from(affiliates)
    .where(eq(affiliates.storeId, storeId))
    .orderBy(desc(affiliates.createdAt))
    .limit(200)
}
