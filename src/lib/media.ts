import 'server-only'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/db'
import { mediaAssets } from '@/db/schema'
import { listStoredObjects, publicUrl, UPLOAD_FOLDERS, type UploadFolder } from './storage'

/**
 * مكتبة وسائط المتجر.
 *
 * ## الجدول بيكمّل التخزين مش بيستبدله
 * التخزين بيعرف اسم الملف وحجمه وبس — مش بيعرف التاجر رفعه ليه ولا
 * الاسم اللي هو نفسه سمّاه بيه. والصف هنا بيدّي الملف اسمًا يقراه
 * التاجر ومجلدًا معروفًا، فيقدر يلاقي صورة رفعها الشهر اللي فات بين
 * أربعمية ملف بأسماء أرقام.
 *
 * ## والقديم بيتسجّل لوحده
 * الملفات اللي اترفعت قبل الجدول مالهاش صفوف — وهي بالظبط صور تاجر
 * شغّال من شهور. `syncFromStorage` بتقرا التخزين وتسجّلها أول ما
 * يفتح المعرض، فما يفتحش فاضيًا على أنشط التجّار.
 */

export type MediaItem = {
  id: string
  url: string
  path: string
  name: string
  folder: string
  sizeBytes: number
  createdAt: string
}

/** الاسم اللي التاجر بيقراه — من غير الطابع الزمني اللي التخزين بيلزقه */
export function displayName(storagePath: string, original?: string | null): string {
  if (original?.trim()) return original.trim()
  const file = storagePath.split('/').pop() ?? storagePath
  /* «1738492_a8Xk2p.jpg» → «a8Xk2p.jpg» — الطابع الزمني ضجيج للقارئ */
  return file.replace(/^\d{10,}_/, '')
}

/**
 * تسجيل ملف مرفوع في المكتبة.
 *
 * **ما بيرميش أبدًا.** الرفع نجح خلاص والملف موجود على التخزين؛ لو
 * الصف فشل، التاجر ما يصحّش يشوف «فشل الرفع» على صورة اترفعت فعلًا
 * وهو شايفها قدامه. المكتبة بتلاقيها في المزامنة بعدين.
 */
export async function recordUpload(input: {
  storeId: string
  path: string
  url: string
  name: string
  folder: UploadFolder
  sizeBytes: number
  mimeType?: string | null
  uploadedBy?: string | null
}): Promise<void> {
  try {
    await db
      .insert(mediaAssets)
      .values({
        storeId: input.storeId,
        path: input.path,
        url: input.url,
        name: input.name.slice(0, 200),
        folder: input.folder,
        sizeBytes: input.sizeBytes,
        mimeType: input.mimeType ?? null,
        uploadedBy: input.uploadedBy ?? null,
      })
      /* نفس المسار مرتين = مزامنة سبقت الرفع. مش خطأ. */
      .onConflictDoNothing()
  } catch (e) {
    console.error('فشل تسجيل الوسيط في المكتبة:', e)
  }
}

/**
 * مزامنة اللي على التخزين ومش مسجَّل.
 *
 * بترجّع عدد اللي اتضاف. بتتنادى من صفحة المعرض، وبتقرا المجلدات
 * الخمسة في نداءات متوازية — واجهة التخزين بترجّع مستوى واحد بس
 * في المرة.
 */
export async function syncFromStorage(storeId: string): Promise<number> {
  const batches = await Promise.all(
    UPLOAD_FOLDERS.map(async (folder) => {
      const objects = await listStoredObjects(storeId, folder, 200)
      return objects.map((o) => ({ ...o, folder }))
    }),
  )

  const found = batches.flat()
  if (found.length === 0) return 0

  const existing = await db
    .select({ path: mediaAssets.path })
    .from(mediaAssets)
    .where(
      and(
        eq(mediaAssets.storeId, storeId),
        inArray(
          mediaAssets.path,
          found.map((f) => f.path),
        ),
      ),
    )

  const known = new Set(existing.map((e) => e.path))
  const missing = found.filter((f) => !known.has(f.path))
  if (missing.length === 0) return 0

  await db
    .insert(mediaAssets)
    .values(
      missing.map((m) => ({
        storeId,
        path: m.path,
        url: publicUrl(m.path),
        name: displayName(m.path),
        folder: m.folder,
        sizeBytes: m.size,
        /*
          `createdAt` من التخزين لا `now()`.

          الصورة اترفعت من ٦ شهور. لو سجّلناها بتاريخ النهارده،
          المعرض بيرتّبها فوق أحدث حاجة رفعها التاجر إمبارح —
          والترتيب الزمني بيبقى كذبة كاملة من أول مزامنة.
        */
        ...(m.createdAt ? { createdAt: new Date(m.createdAt) } : {}),
      })),
    )
    .onConflictDoNothing()

  return missing.length
}

export type MediaUsage = { productImages: number }

/**
 * الوسيط ده مستعمل فين؟
 *
 * الحذف قرار ما بيترجعش فيه: الصورة اللي اتشالت من التخزين بتبوّظ
 * كل منتج بيشاور عليها، والتاجر ما بيكتشفش غير لما عميل يشتكي.
 * العدّاد ده بيخلّي القرار مبنيًا على معلومة.
 *
 * بيقرا الروابط من `products.images` (jsonb array) — المكان الوحيد
 * اللي بيتخزّن فيه رابط صورة بشكل قابل للفهرسة.
 */
export async function usageFor(storeId: string, urls: string[]): Promise<Map<string, MediaUsage>> {
  const out = new Map<string, MediaUsage>()
  if (urls.length === 0) return out

  const rows = await db.execute<{ url: string; n: number }>(sql`
    select u.url, count(*)::int as n
    from products p
    cross join lateral jsonb_array_elements_text(p.images) as u(url)
    where p.store_id = ${storeId}
      and p.deleted_at is null
      and u.url in (${sql.join(
        urls.map((u) => sql`${u}`),
        sql`, `,
      )})
    group by u.url
  `)

  for (const r of rows) out.set(r.url, { productImages: r.n })
  return out
}

/** وسائط المتجر بترتيب الأحدث */
export async function listMedia(
  storeId: string,
  folder?: string,
  limit = 120,
): Promise<MediaItem[]> {
  const rows = await db
    .select({
      id: mediaAssets.id,
      url: mediaAssets.url,
      path: mediaAssets.path,
      name: mediaAssets.name,
      folder: mediaAssets.folder,
      sizeBytes: mediaAssets.sizeBytes,
      createdAt: mediaAssets.createdAt,
    })
    .from(mediaAssets)
    .where(
      folder
        ? and(eq(mediaAssets.storeId, storeId), eq(mediaAssets.folder, folder))
        : eq(mediaAssets.storeId, storeId),
    )
    .orderBy(desc(mediaAssets.createdAt))
    .limit(limit)

  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))
}
