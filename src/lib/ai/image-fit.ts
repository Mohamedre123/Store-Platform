import 'server-only'

/**
 * ظبط مقاسات الصور.
 *
 * ## ليه ده موجود
 * موديلات صور OpenAI بتطلّع تلات مقاسات بس: مربّع و٢:٣ طولي و٣:٢
 * عرضي. ومقاس إنستجرام ٤:٥ والستوري ٩:١٦ مش منهم. الصورة ٢:٣ اللي
 * بتتنشر زي ما هي إنستجرام بيقصّها بمزاجه — وممكن يقصّ المنتج نفسه.
 *
 * فبنطلب الأقرب ونقصّ **من النص** للنسبة المطلوبة بالظبط، والوصف
 * بيقول للموديل يسيب المنتج بعيد عن الحواف عشان القصّ ما يلمسوش.
 *
 * ## و`sharp` بيتحمّل وقت الحاجة بس
 * الملف ده متوصّل بطبقة الذكاء اللي البوت بيستخدمها مع كل رسالة عميل.
 * الاستيراد في أول الملف كان هيحمّل مكتبة صور على كل رسالة شات من غير
 * ما يحتاجها — ويزوّد وقت أول رد.
 */

async function lib() {
  return (await import('sharp')).default
}

export function ratioOf(aspect: string): number {
  const [w, h] = aspect.split(':').map(Number)
  return w > 0 && h > 0 ? w / h : 1
}

/** قصّ من النص لنسبة بعينها — JPEG عشان الحجم يفضل معقول للنشر */
export async function fitToAspect(
  buf: Buffer,
  aspect: string,
): Promise<{ buffer: Buffer; mimeType: string }> {
  const sharp = await lib()
  const meta = await sharp(buf).metadata()
  const W = meta.width ?? 0
  const H = meta.height ?? 0
  if (!W || !H) return { buffer: buf, mimeType: 'image/png' }

  const target = ratioOf(aspect)
  const current = W / H

  let width = W
  let height = H
  if (Math.abs(current - target) > 0.01) {
    if (current > target) width = Math.round(H * target)
    else height = Math.round(W / target)
  }

  const left = Math.round((W - width) / 2)
  const top = Math.round((H - height) / 2)

  const buffer = await sharp(buf)
    .extract({ left, top, width, height })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer()

  return { buffer, mimeType: 'image/jpeg' }
}

/**
 * صورة بمقاس محدَّد بالظبط — مرجع فيديو Sora.
 *
 * Sora بيرفض الصورة المرجعية لو مقاسها مش نفس مقاس الفيديو حرفيًا.
 */
export async function fitToSize(buf: Buffer, width: number, height: number): Promise<Buffer> {
  const sharp = await lib()
  return sharp(buf).rotate().resize(width, height, { fit: 'cover' }).jpeg({ quality: 90 }).toBuffer()
}

/**
 * صورة مرجعية بصيغة مقبولة وحجم معقول.
 *
 * صور المنتجات عندنا ممكن تكون AVIF أو WebP أو ٦٠٠٠ بكسل. OpenAI
 * بتاخد PNG وJPEG وWebP وبحجم محدود — والصورة الكبيرة بتتحاسب أغلى
 * من غير أي فرق في الناتج.
 */
export async function asReferencePng(buf: Buffer): Promise<Buffer> {
  const sharp = await lib()
  return sharp(buf)
    .rotate()
    .resize({ width: 1536, height: 1536, fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer()
}
