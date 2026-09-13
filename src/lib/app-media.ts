import 'server-only'
import type { ActiveStore } from '@/lib/store-context'
import { listMedia, syncFromStorage, usageFor } from '@/lib/media'
import { FOLDER_LABELS } from '@/lib/media-meta'

/**
 * شكل معرض الوسائط اللي تطبيق الموبايل بيستلمه — نفس صفحة اللوحة: مزامنة الملفات
 * القديمة الأول، وبعدين القايمة وكل صورة مستعملة في كام منتج.
 */
export async function mediaPayload(store: ActiveStore) {
  const synced = await syncFromStorage(store.id)
  const rows = await listMedia(store.id)
  const usage = await usageFor(
    store.id,
    rows.map((r) => r.url),
  )

  return {
    synced,
    totalBytes: rows.reduce((n, r) => n + r.sizeBytes, 0),
    folders: Object.entries(FOLDER_LABELS).map(([key, label]) => ({ key, label })),
    items: rows.map((r) => ({
      id: r.id,
      url: r.url,
      name: r.name,
      folder: r.folder,
      folderLabel: FOLDER_LABELS[r.folder] ?? r.folder,
      sizeBytes: r.sizeBytes,
      createdAt: r.createdAt,
      usedIn: usage.get(r.url)?.productImages ?? 0,
    })),
  }
}
