import { NextResponse } from 'next/server'
import { getDashboardContext } from '@/lib/store-context'
import { uploadImage, type UploadFolder } from '@/lib/storage'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const FOLDERS: UploadFolder[] = ['products', 'categories', 'banners', 'logos', 'misc']

/**
 * رفع صورة.
 *
 * المسار محمي بسياق اللوحة: التاجر لازم يكون مسجّلًا وعضوًا في متجر،
 * والصورة بتتكتب تحت مجلد متجره هو — فمحدش يقدر يكتب في مجلد غيره
 * حتى لو عدّل الطلب.
 */
export async function POST(request: Request) {
  const { store } = await getDashboardContext()

  const form = await request.formData()
  const file = form.get('file')
  const folder = String(form.get('folder') ?? 'misc') as UploadFolder

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'مافيش ملف مرفوع' }, { status: 400 })
  }
  if (!FOLDERS.includes(folder)) {
    return NextResponse.json({ error: 'مجلد غير معروف' }, { status: 400 })
  }

  const result = await uploadImage(store.id, folder, file)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

  return NextResponse.json({ url: result.url, path: result.path })
}
