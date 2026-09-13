import 'server-only'
import type { ActiveStore } from '@/lib/store-context'
import { loadCategories } from '@/lib/categories-data'

/**
 * شكل شاشة الأقسام اللي تطبيق الموبايل بيستلمه — الأب قبل أولاده، والأولاد
 * ورا أبوهم على طول (نفس ترتيب اللوحة).
 */
export async function categoriesPayload(store: ActiveStore) {
  const rows = await loadCategories(store.id)
  const names = new Map(rows.map((c) => [c.id, c.name]))
  const roots = rows.filter((c) => !c.parentId || !names.has(c.parentId))
  const ordered = roots.flatMap((root) => [root, ...rows.filter((c) => c.parentId === root.id)])

  return {
    categories: ordered.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      image: c.image,
      isActive: c.isActive,
      parentId: c.parentId && names.has(c.parentId) ? c.parentId : null,
      parentName: c.parentId ? (names.get(c.parentId) ?? null) : null,
      productCount: Number(c.productCount),
    })),
  }
}
