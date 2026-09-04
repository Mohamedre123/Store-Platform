import { toMinorUnits } from './utils'

/**
 * استيراد المنتجات من ملف CSV.
 *
 * ## ليه ده مش رفاهية
 * التاجر اللي بينقل من منصة تانية عنده تلتمية منتج. لو مفيش استيراد،
 * هو قدام اختيارين: يقعد أسبوع يدخّلهم بإيده، أو ما ينقلش. أغلبهم
 * بيختار التاني — فغياب الشاشة دي بيمنع الانضمام من أصله.
 *
 * ## الأعمدة بتتعرّف لوحدها
 * كل منصة بتصدّر بأسماء أعمدة مختلفة: «Title» و«Name» و«اسم المنتج»
 * و«product_name». إلزام التاجر بقالب بتاعنا معناه إنه يفتح إكسل
 * ويعيد ترتيب تلتمية صف — وده نفس تكلفة الإدخال اليدوي.
 *
 * ## والمعاينة قبل الكتابة
 * الاستيراد بيتقسّم لخطوتين: قراءة وعرض، وبعدين كتابة. التاجر بيشوف
 * أول خمس صفوف زي ما إحنا فهمناهم قبل ما نلمس كتالوجه — والملف
 * المفهوم غلط بيتكشف قبل ما يعمل تلتمية منتج بأسعار مقلوبة.
 */

/**
 * قارئ CSV.
 *
 * ## ليه مكتوب بإيد مش مكتبة
 * المشروع مالوش أي اعتماد على مكتبة تحليل، وإضافة واحدة عشان
 * الشاشة دي بتزوّد حجم الحزمة على كل صفحة. والصيغة اللي محتاجينها
 * محدودة: فواصل، واقتباس مزدوج، واقتباس جوّه اقتباس (`""`).
 *
 * ## وبيتعامل مع السطر الجديد جوّه الخانة
 * وصف المنتج بيتصدّر بأسطر جوّه اقتباس. القارئ اللي بيقسّم على
 * `\n` بيكسّر الصف ده لسطرين ويخرّب الملف كله من أول وصف طويل.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  /* شطب علامة ترتيب البايتات — إكسل بيحطّها وبتلزق في اسم أول عمود */
  const src = text.replace(/^﻿/, '')

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i]

    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          quoted = false
        }
      } else {
        field += ch
      }
      continue
    }

    if (ch === '"') {
      quoted = true
    } else if (ch === ',') {
      row.push(field)
      field = ''
    } else if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (ch !== '\r') {
      field += ch
    }
  }

  /* آخر صف من غير سطر جديد في آخر الملف */
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows.filter((r) => r.some((c) => c.trim() !== ''))
}

export type ImportField =
  | 'name'
  | 'description'
  | 'price'
  | 'compareAtPrice'
  | 'costPrice'
  | 'sku'
  | 'stock'
  | 'category'
  | 'brand'
  | 'image'

/**
 * أسماء الأعمدة المعروفة لكل حقل.
 *
 * القايمة دي مجمّعة من صادرات شوبيفاي وووكومرس والمنصات العربية
 * اللي التجّار بينقلوا منها فعلًا — بالعربي والإنجليزي.
 */
const ALIASES: Record<ImportField, string[]> = {
  name: ['name', 'title', 'product name', 'product_name', 'اسم المنتج', 'الاسم', 'المنتج'],
  description: ['description', 'body', 'body (html)', 'details', 'الوصف', 'التفاصيل'],
  price: ['price', 'variant price', 'regular price', 'selling price', 'السعر', 'سعر البيع'],
  compareAtPrice: [
    'compare at price',
    'compare_at_price',
    'variant compare at price',
    'sale price',
    'old price',
    'السعر قبل الخصم',
    'السعر المشطوب',
  ],
  costPrice: ['cost', 'cost price', 'cost per item', 'التكلفة', 'سعر التكلفة'],
  sku: ['sku', 'variant sku', 'code', 'barcode', 'الكود', 'كود المنتج'],
  stock: ['stock', 'quantity', 'qty', 'inventory', 'variant inventory qty', 'الكمية', 'المخزون'],
  category: ['category', 'collection', 'type', 'product category', 'القسم', 'التصنيف'],
  brand: ['brand', 'vendor', 'manufacturer', 'الماركة', 'العلامة التجارية'],
  image: ['image', 'image src', 'images', 'image url', 'photo', 'الصورة', 'صورة'],
}

const norm = (s: string) => s.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')

/**
 * يخمّن أنهي عمود بيقابل أنهي حقل.
 *
 * بيرجّع فهرس العمود لكل حقل عرفه، و`-1` للي ما عرفهوش. التاجر
 * بيقدر يعدّل التخمين قبل الاستيراد — التخمين بيوفّر الشغل، مش
 * بيفرض نفسه.
 */
export function guessColumns(header: string[]): Record<ImportField, number> {
  const normalized = header.map(norm)
  const out = {} as Record<ImportField, number>

  for (const [field, names] of Object.entries(ALIASES) as Array<[ImportField, string[]]>) {
    out[field] = normalized.findIndex((h) => names.includes(h))
    /* المطابقة الجزئية احتياطي — «Variant Price (EGP)» مش في القايمة */
    if (out[field] === -1) {
      out[field] = normalized.findIndex((h) => names.some((n) => h.includes(n)))
    }
  }

  return out
}

export type ImportRow = {
  name: string
  description: string | null
  price: number
  compareAtPrice: number | null
  costPrice: number | null
  sku: string | null
  stock: number
  category: string | null
  brand: string | null
  image: string | null
}

export type ImportIssue = { line: number; reason: string }

/**
 * يحوّل صفوف الملف لمنتجات — ويقول إيه اللي ما عدّاش وليه.
 *
 * الصف الغلط بيتخطّى ولا بيوقّف الملف: ملف بتلتمية صف فيه خمسة
 * بأسعار فاضية ما يصحّش يرفض التلتمية كلهم. والتاجر بيشوف الخمسة
 * بأرقام سطورهم فيصلّحهم في ملفه.
 */
export function mapRows(
  rows: string[][],
  columns: Record<ImportField, number>,
): { items: ImportRow[]; issues: ImportIssue[] } {
  const items: ImportRow[] = []
  const issues: ImportIssue[] = []

  const cell = (row: string[], idx: number): string =>
    idx >= 0 && idx < row.length ? row[idx].trim() : ''

  /* الرقم من نص التاجر: بيشيل رموز العملة والفواصل والمسافات */
  const num = (raw: string): number | null => {
    if (!raw) return null
    const cleaned = raw
      .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
      .replace(/[^\d.,-]/g, '')
      .replace(/,/g, '')
    if (!cleaned) return null
    const n = Number(cleaned)
    return Number.isFinite(n) ? n : null
  }

  rows.forEach((row, i) => {
    /* +2: الصف الأول ترويسة، والعد عند التاجر بيبدأ من ١ */
    const line = i + 2

    const name = cell(row, columns.name)
    if (!name) {
      issues.push({ line, reason: 'مفيش اسم منتج' })
      return
    }

    const price = num(cell(row, columns.price))
    if (price === null || price <= 0) {
      issues.push({ line, reason: `«${name}» — السعر ناقص أو مش رقم` })
      return
    }

    const compareAt = num(cell(row, columns.compareAtPrice))
    const cost = num(cell(row, columns.costPrice))
    const stock = num(cell(row, columns.stock))

    /*
      أول صورة بس من خانة فيها أكتر من رابط.

      شوبيفاي بيصدّر صفًا لكل صورة، وووكومرس بيحطّهم في خانة واحدة
      مفصولين بفاصلة. الاتنين بيدّوا نفس النتيجة هنا: أول صورة هي
      الرئيسية، والباقي التاجر بيضيفه من المنتج.
    */
    const rawImage = cell(row, columns.image)
    const image = rawImage.split(/[,|]/)[0].trim() || null

    items.push({
      name: name.slice(0, 200),
      description: cell(row, columns.description).slice(0, 5000) || null,
      price: toMinorUnits(price),
      /* السعر المشطوب لازم يكون أعلى — الأقل بيرسم خصمًا بالسالب */
      compareAtPrice: compareAt !== null && compareAt > price ? toMinorUnits(compareAt) : null,
      costPrice: cost !== null && cost > 0 ? toMinorUnits(cost) : null,
      sku: cell(row, columns.sku).slice(0, 80) || null,
      stock: stock !== null && stock > 0 ? Math.trunc(stock) : 0,
      category: cell(row, columns.category).slice(0, 80) || null,
      brand: cell(row, columns.brand).slice(0, 60) || null,
      image: image && /^https?:\/\//i.test(image) ? image.slice(0, 600) : null,
    })
  })

  return { items, issues }
}
