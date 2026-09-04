import 'server-only'
import { nanoid } from 'nanoid'

/**
 * تخزين الصور على Supabase Storage.
 *
 * كل ملف تحت مسار متجره: store-assets/<storeId>/<نوع>/<اسم>
 * فحذف متجر = حذف مجلده، والمسار نفسه بيوضّح ملك مين.
 *
 * الرفع بيمر من السيرفر عشان مفتاح الخدمة ما يوصلش للمتصفح أبدًا،
 * وعشان نقدر نتحقق من صلاحية التاجر على المتجر قبل ما نكتب أي حاجة.
 */

const BUCKET = 'store-assets'
const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']

export type UploadFolder = 'products' | 'categories' | 'banners' | 'logos' | 'misc'

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('التخزين غير مضبوط — راجع NEXT_PUBLIC_SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY')
  return { url: url.replace(/\/$/, ''), key }
}

export function validateImage(file: File): { ok: true } | { ok: false; error: string } {
  if (!ALLOWED.includes(file.type)) {
    return { ok: false, error: 'الصيغة مش مدعومة. استخدم JPG أو PNG أو WebP.' }
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: 'الصورة أكبر من ٥ ميجا. صغّرها وجرّب تاني.' }
  }
  return { ok: true }
}

/** اسم ملف آمن: بلا حروف عربية أو مسافات تكسر الروابط */
function safeName(original: string) {
  const ext = (original.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
  return `${Date.now()}_${nanoid(8)}.${ext || 'jpg'}`
}

export async function uploadImage(
  storeId: string,
  folder: UploadFolder,
  file: File,
): Promise<{ ok: true; url: string; path: string } | { ok: false; error: string }> {
  const check = validateImage(file)
  if (!check.ok) return check

  const { url, key } = config()
  const path = `${storeId}/${folder}/${safeName(file.name)}`

  const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      'Content-Type': file.type,
      'x-upsert': 'false',
      // سنة كاملة — اسم الملف فريد فلا حاجة لإعادة التحميل أبدًا
      'cache-control': 'public, max-age=31536000, immutable',
    },
    body: await file.arrayBuffer(),
  })

  if (!res.ok) {
    const body = await res.text()
    console.error('فشل رفع الصورة:', res.status, body)
    return { ok: false, error: 'مقدرناش نرفع الصورة. جرّب تاني.' }
  }

  return { ok: true, url: `${url}/storage/v1/object/public/${BUCKET}/${path}`, path }
}

/** حذف صورة — يقبل الرابط الكامل أو المسار */
export async function deleteImage(storeId: string, urlOrPath: string): Promise<boolean> {
  const { url, key } = config()
  const marker = `/object/public/${BUCKET}/`
  const path = urlOrPath.includes(marker) ? urlOrPath.split(marker)[1] : urlOrPath

  // حاجز أمان: ما نمسحش ملفًا خارج مجلد المتجر مهما كان المُدخَل
  if (!path.startsWith(`${storeId}/`)) return false

  const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${key}`, apikey: key },
  })
  return res.ok
}

export type StoredObject = { path: string; name: string; size: number; createdAt: string | null }

/**
 * قايمة الملفات المرفوعة تحت مجلد متجر.
 *
 * ## ليه محتاجينها مع إن عندنا جدول
 * جدول `media` بيتكتب مع كل رفعة **من دلوقتي**. الملفات اللي اترفعت
 * قبل ما الجدول يتعمل مالهاش صف — وهي بالظبط صور منتجات التاجر
 * اللي شغّال من شهور. من غير القراءة دي، معرض الوسائط بيفتح فاضي
 * لأنشط التجّار، وهو أسوأ انطباع أول ممكن.
 *
 * بتقرا مجلدًا واحدًا في النداء: واجهة التخزين بترجّع محتوى مستوى
 * واحد بس، والمجلدات عندنا معروفة ومحدودة.
 */
export async function listStoredObjects(
  storeId: string,
  folder: UploadFolder,
  limit = 100,
): Promise<StoredObject[]> {
  const { url, key } = config()

  const res = await fetch(`${url}/storage/v1/object/list/${BUCKET}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prefix: `${storeId}/${folder}`,
      limit,
      sortBy: { column: 'created_at', order: 'desc' },
    }),
    cache: 'no-store',
  })

  if (!res.ok) return []

  const rows = (await res.json()) as Array<{
    name: string
    created_at?: string
    metadata?: { size?: number } | null
  }>

  return rows
    /* المجلدات بترجع بلا metadata — مش ملفات */
    .filter((r) => r.metadata)
    .map((r) => ({
      path: `${storeId}/${folder}/${r.name}`,
      name: r.name,
      size: r.metadata?.size ?? 0,
      createdAt: r.created_at ?? null,
    }))
}

/** الرابط العام لمسار مخزّن */
export function publicUrl(path: string): string {
  const { url } = config()
  return `${url}/storage/v1/object/public/${BUCKET}/${path}`
}

export const UPLOAD_FOLDERS: UploadFolder[] = ['products', 'categories', 'banners', 'logos', 'misc']
