import 'server-only'
import type { ImportRow } from '@/lib/product-csv'
import type { ImportSourceKey } from '@/lib/import-sources'

/**
 * جلب الكتالوج من منصة تانية.
 *
 * ## ليه ده مش «CSV تاني»
 * الاستيراد بـCSV بيطلب من التاجر يفتح لوحة منصته، يلاقي التصدير،
 * يستنى الملف، ينزّله، يرفعه، ويربط أعمدته. خمس خطوات، وكل واحدة
 * فيها مكان يقف عنده. ده الحاجز اللي بيمنع الانضمام أصلًا — التاجر
 * اللي عنده تلتمية منتج على منصة تانية مش هيدخّلهم بإيده، ومش
 * هيفضل يحارب ملفًا.
 *
 * بالمفاتيح: بيلزق مفتاحين ويدوس زرار.
 *
 * ## والنتيجة بتدخل نفس المواسير
 * الدوال هنا بترجّع `ImportRow[]` — نفس الشكل اللي `mapRows` بترجّعه
 * من الملف بالظبط. يعني الكتابة والأقسام والتخطّي والمسوّدات كلها
 * `importProducts` زي ما هي، من غير أي فرع جديد. لو عملنا مسارًا
 * مستقلًا، أول تغيير في قواعد الاستيراد كان هيتطبّق على واحد بس.
 *
 * ## والمفاتيح مش بتتخزّن
 * الاستيراد بيحصل مرة. تخزين مفتاح شوبيفاي بعد ما نستعمله معناه
 * إننا ماسكين وصولًا لكتالوج التاجر على منصة تانية للأبد، من غير أي
 * سبب. بيتبعت مع الطلب، بيتستعمل، وبيتنسى.
 */

export type CatalogFetch =
  | { ok: true; items: ImportRow[]; total: number }
  | { ok: false; error: string }

/** المهلة — المنصة البطيئة ما تعلّقش دالتنا لحد ما تموت */
const TIMEOUT_MS = 20_000

/** أقصى عدد بيتجاب في المرة — نفس حد الاستيراد من الملف */
const MAX_ITEMS = 1000

async function fetchJson(
  url: string,
  init: RequestInit,
): Promise<{ ok: true; data: unknown } | { ok: false; error: string; status?: number }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const res = await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' })

    if (!res.ok) {
      /*
        الرد بيتقرا نصًّا عشان رسالة الرفض توصل للتاجر بسببها.

        «فشل الاستيراد» لوحدها بتخلّيه يجرّب نفس المفتاح الغلط
        عشر مرات. «401 Unauthorized» بتقوله إن المفتاح غلط.
      */
      const body = await res.text().catch(() => '')
      return {
        ok: false,
        status: res.status,
        error: body.slice(0, 300) || `${res.status} ${res.statusText}`,
      }
    }

    return { ok: true, data: await res.json() }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('aborted') || msg.includes('abort')) {
      return { ok: false, error: 'المنصة ما ردّتش في الوقت — جرّب تاني' }
    }
    return { ok: false, error: msg.slice(0, 200) }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * السعر من نص عشري لقرش.
 *
 * المنصتين بيرجّعوا الأسعار نصًّا عشريًّا («199.00»). الضرب في مية
 * على `float` بيدّي `19899.999…` وبعدين `Math.round` بيصلّحها —
 * بس القيم الكبيرة بتفلت. القراءة على جزئين بتخلّي الحساب صحيحًا
 * دايمًا، وهي نفس قاعدة «كل المبالغ integer بالقرش» في PLAN.
 */
function toMinor(value: unknown): number {
  if (value === null || value === undefined) return 0
  const s = String(value).trim()
  if (!s) return 0

  const m = s.match(/^(-?\d+)(?:[.,](\d{1,2}))?/)
  if (!m) return 0

  const whole = Number(m[1])
  const frac = m[2] ? Number(m[2].padEnd(2, '0')) : 0
  if (!Number.isFinite(whole)) return 0

  return whole * 100 + (whole < 0 ? -frac : frac)
}

function clean(s: unknown, max: number): string | null {
  if (typeof s !== 'string') return null
  const t = s.trim()
  if (!t) return null
  return t.slice(0, max)
}

/** يشيل وسوم HTML من الوصف — المنصتين بيرجّعوه HTML كامل */
function stripHtml(html: unknown): string | null {
  if (typeof html !== 'string') return null
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
  return text ? text.slice(0, 5000) : null
}

/* ────────────────────────── Shopify ────────────────────────── */

type ShopifyNode = {
  title?: string
  description?: string
  vendor?: string
  productType?: string
  totalInventory?: number
  featuredImage?: { url?: string } | null
  priceRange?: { minVariantPrice?: { amount?: string } }
  compareAtPriceRange?: { minVariantPrice?: { amount?: string } }
  variants?: { nodes?: Array<{ sku?: string | null; quantityAvailable?: number | null }> }
}

/**
 * شوبيفاي — Storefront API بـGraphQL.
 *
 * ## ليه Storefront لا Admin
 * Admin API بيدّي وصولًا للطلبات والعملاء والفلوس. الاستيراد محتاج
 * المنتجات المنشورة بس، والمفتاح اللي التاجر بيدّيهولنا المفروض
 * ما يقدرش يعمل حاجة تانية أصلًا — لا لأننا مش هنعملها، لكن عشان
 * لو المفتاح اتسرّب من عندنا ما يبقاش بيفتح متجره كله.
 *
 * ## والترقيم بالمؤشّر لا بالصفحة
 * شوبيفاي بيرجّع `endCursor`، ورقم الصفحة مالوش معنى عنده. بنلفّ
 * لحد ما `hasNextPage` تبقى false أو نوصل للحد.
 */
async function fetchShopify(creds: Record<string, string>): Promise<CatalogFetch> {
  const shop = creds.shop?.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '')
  const token = creds.token?.trim()

  if (!shop || !token) return { ok: false, error: 'الدومين والتوكن مطلوبين' }
  if (!/^[a-zA-Z0-9-]+\.myshopify\.com$/.test(shop)) {
    return { ok: false, error: 'الدومين لازم يبقى بالشكل ده: my-store.myshopify.com' }
  }

  const query = `
    query Products($cursor: String) {
      products(first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          title
          description
          vendor
          productType
          totalInventory
          featuredImage { url }
          priceRange { minVariantPrice { amount } }
          compareAtPriceRange { minVariantPrice { amount } }
          variants(first: 1) { nodes { sku quantityAvailable } }
        }
      }
    }`

  const items: ImportRow[] = []
  let cursor: string | null = null

  for (let page = 0; page < 10 && items.length < MAX_ITEMS; page++) {
    const res = await fetchJson(`https://${shop}/api/2024-10/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': token,
      },
      body: JSON.stringify({ query, variables: { cursor } }),
    })

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return { ok: false, error: 'التوكن مرفوض — اتأكد إنه Storefront API token ومفعّل عليه صلاحية قراءة المنتجات' }
      }
      if (res.status === 404) return { ok: false, error: 'الدومين ده مش لاقيينه على شوبيفاي' }
      return { ok: false, error: `شوبيفاي رفض: ${res.error}` }
    }

    const data = res.data as {
      errors?: Array<{ message?: string }>
      data?: { products?: { pageInfo?: { hasNextPage?: boolean; endCursor?: string }; nodes?: ShopifyNode[] } }
    }

    /*
      GraphQL بيرد 200 حتى لما يرفض.

      الخطأ بيجي في `errors` جوّه جسم ناجح — فمن غير الفحص ده،
      المفتاح الغلط كان هيرجّع «مفيش منتجات» بدل «المفتاح غلط»،
      والتاجر يفتكر إن كتالوجه فاضي.
    */
    if (data.errors?.length) {
      return { ok: false, error: `شوبيفاي رفض: ${data.errors[0]?.message ?? 'خطأ غير معروف'}` }
    }

    const nodes = data.data?.products?.nodes ?? []
    for (const n of nodes) {
      const name = clean(n.title, 200)
      if (!name) continue

      const price = toMinor(n.priceRange?.minVariantPrice?.amount)
      if (price <= 0) continue

      const compare = toMinor(n.compareAtPriceRange?.minVariantPrice?.amount)
      const variant = n.variants?.nodes?.[0]

      items.push({
        name,
        description: clean(n.description, 5000),
        price,
        /* السعر المشطوب بيتشال لو مش أعلى فعلًا — وإلا بيبان خصمًا وهمي */
        compareAtPrice: compare > price ? compare : null,
        costPrice: null,
        sku: clean(variant?.sku, 80),
        stock: Math.max(0, Number(n.totalInventory ?? variant?.quantityAvailable ?? 0) || 0),
        category: clean(n.productType, 80),
        brand: clean(n.vendor, 60),
        image: clean(n.featuredImage?.url, 600),
      })

      if (items.length >= MAX_ITEMS) break
    }

    const info = data.data?.products?.pageInfo
    if (!info?.hasNextPage || !info.endCursor) break
    cursor = info.endCursor
  }

  return { ok: true, items, total: items.length }
}

/* ────────────────────────── WooCommerce ────────────────────────── */

type WooProduct = {
  name?: string
  description?: string
  short_description?: string
  price?: string
  regular_price?: string
  sale_price?: string
  sku?: string
  stock_quantity?: number | null
  categories?: Array<{ name?: string }>
  images?: Array<{ src?: string }>
  status?: string
}

/**
 * ووكومرس — REST v3 بمفتاحين.
 *
 * ## المفاتيح في الترويسة لا في الرابط
 * ووكومرس بيقبل `?consumer_key=…&consumer_secret=…` كمان، وده
 * أسهل — وبيحطّ سرّ التاجر في **سجلات خادمه هو** وفي أي وسيط في
 * الطريق. الترويسة Basic بتوصّل نفس القيم من غير ما تتسجّل.
 *
 * ## والسعر من `regular_price` لا `price`
 * `price` هو السعر السارِي دلوقتي — يعني سعر التخفيض لو فيه
 * تخفيض شغّال. الاستيراد بيه معناه إن تخفيضًا مؤقّتًا على المنصة
 * القديمة بيتحوّل لسعر دايم عندنا، والتاجر بيبيع بخسارة وهو
 * فاكر إنه نقل كتالوجه.
 */
async function fetchWoo(creds: Record<string, string>): Promise<CatalogFetch> {
  const raw = creds.siteUrl?.trim().replace(/\/+$/, '')
  const key = creds.consumerKey?.trim()
  const secret = creds.consumerSecret?.trim()

  if (!raw || !key || !secret) return { ok: false, error: 'العنوان والمفتاحين مطلوبين' }

  let base: URL
  try {
    base = new URL(raw.startsWith('http') ? raw : `https://${raw}`)
  } catch {
    return { ok: false, error: 'عنوان الموقع مش مظبوط' }
  }
  if (base.protocol !== 'https:' && base.protocol !== 'http:') {
    return { ok: false, error: 'عنوان الموقع لازم يبدأ بـhttp أو https' }
  }

  const auth = Buffer.from(`${key}:${secret}`).toString('base64')
  const items: ImportRow[] = []

  for (let page = 1; page <= 10 && items.length < MAX_ITEMS; page++) {
    const url = `${base.origin}/wp-json/wc/v3/products?per_page=100&page=${page}&status=publish`

    const res = await fetchJson(url, { headers: { Authorization: `Basic ${auth}` } })

    if (!res.ok) {
      if (res.status === 401) {
        return { ok: false, error: 'المفتاحين مرفوضين — اتأكد إنهم Consumer key وSecret بصلاحية Read' }
      }
      if (res.status === 404) {
        return {
          ok: false,
          error: 'ما لقيتش REST API على العنوان ده. اتأكد إن الروابط الدائمة (Permalinks) مش «Plain» في ووردبريس.',
        }
      }
      return { ok: false, error: `ووكومرس رفض: ${res.error}` }
    }

    const list = res.data
    if (!Array.isArray(list)) return { ok: false, error: 'رد ووكومرس مش بالشكل المتوقّع' }
    if (list.length === 0) break

    for (const p of list as WooProduct[]) {
      const name = clean(p.name, 200)
      if (!name) continue

      /* السعر الأساسي — لا سعر التخفيض المؤقّت */
      const price = toMinor(p.regular_price || p.price)
      if (price <= 0) continue

      const sale = toMinor(p.sale_price)

      items.push({
        name,
        description: stripHtml(p.description) ?? stripHtml(p.short_description),
        /*
          لو فيه تخفيض شغّال، بنستورده كتخفيض عندنا كمان: السعر
          الحالي هو سعر التخفيض والمشطوب هو الأساسي — فالتاجر بيلاقي
          متجره الجديد بنفس عروض القديم.
        */
        price: sale > 0 && sale < price ? sale : price,
        compareAtPrice: sale > 0 && sale < price ? price : null,
        costPrice: null,
        sku: clean(p.sku, 80),
        stock: Math.max(0, Number(p.stock_quantity ?? 0) || 0),
        category: clean(p.categories?.[0]?.name, 80),
        brand: null,
        image: clean(p.images?.[0]?.src, 600),
      })

      if (items.length >= MAX_ITEMS) break
    }

    if (list.length < 100) break
  }

  return { ok: true, items, total: items.length }
}

/* ────────────────────────── الموزّع ────────────────────────── */

export async function fetchCatalog(
  source: ImportSourceKey,
  creds: Record<string, string>,
): Promise<CatalogFetch> {
  switch (source) {
    case 'shopify':
      return fetchShopify(creds)
    case 'woocommerce':
      return fetchWoo(creds)
    default:
      return { ok: false, error: 'المنصة دي مش مدعومة' }
  }
}
