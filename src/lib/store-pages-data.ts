import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { pages } from '@/db/schema'
import type { PageRow } from '@/app/dashboard/settings/pages/pages-editor'

/** صفحات المتجر الثابتة (الإرجاع والخصوصية والشروط) — صفحة اللوحة ومسار التطبيق والمساعد بيقروا من هنا */
export async function loadStorePages(storeId: string): Promise<PageRow[]> {
  const rows = await db
    .select({
      id: pages.id,
      slug: pages.slug,
      title: pages.title,
      content: pages.content,
      type: pages.type,
      showInFooter: pages.showInFooter,
      isPublished: pages.isPublished,
    })
    .from(pages)
    .where(eq(pages.storeId, storeId))
    .orderBy(pages.sortOrder)
  return rows as PageRow[]
}
