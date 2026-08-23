import 'server-only'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { marketplaceConnections, products, stores } from '@/db/schema'
import { storeUrl } from './domain'
import { MARKETPLACES, marketplaceDef, type Connection } from './marketplace-meta'

/*
  التعريفات المشتركة في marketplace-meta — الملف ده server-only،
  وكروت اللوحة محتاجة نفس الأسماء والألوان والمسارات.
*/
export * from './marketplace-meta'

/**
 * ربط الكتالوج بمنصات الإعلانات والأسواق.
 *
 * **إحنا مش بنتعاقد مع حد، وما بنطلبش من التاجر يتعاقد معانا.**
 *
 * القرار ده هو اللي شكّل الحتة دي كلها. الربط المباشر بـAPI ميتا
 * أو جوجل بيحتاج مراجعة تطبيق وشراكة رسمية — يعني شهور، والتاجر
 * مستنّي. الطريق اللي بيشتغل النهارده: **مِلَفّ كتالوج على رابط
 * عام**، التاجر بيلزقه في حسابه هو عند ميتا أو جوجل، وهما بيجيبوا
 * منه لوحدهم كل يوم.
 *
 * نفس النتيجة بالظبط — منتجاتك في كتالوج الإعلانات وأسعارها
 * ومخزونها بيتحدّثوا لوحدهم — من غير أي تعاقد ولا انتظار موافقة.
 *
 * والمِلَفّ **عام بالضرورة**: ميتا وجوجل بيجيبوه من سيرفراتهم من
 * غير أي مصادقة. عشان كده مفيش فيه أي بيانات عملاء — منتجات
 * وأسعار بس، وكلها ظاهرة في المتجر أصلًا لأي زائر.
 */

export async function readConnections(storeId: string): Promise<Record<string, Connection>> {
  const rows = await db
    .select()
    .from(marketplaceConnections)
    .where(eq(marketplaceConnections.storeId, storeId))

  const out: Record<string, Connection> = {}
  for (const def of MARKETPLACES) {
    const row = rows.find((r) => r.platform === def.platform)
    out[def.platform] = {
      platform: def.platform,
      enabled: row?.enabled ?? false,
      syncPrices: row?.syncPrices ?? true,
      syncStock: row?.syncStock ?? true,
      lastSyncAt: row?.lastSyncAt ?? null,
      lastError: row?.lastError ?? null,
      syncedCount: row?.syncedCount ?? 0,
    }
  }
  return out
}

export async function saveConnection(
  storeId: string,
  platform: string,
  input: { enabled: boolean; syncPrices: boolean; syncStock: boolean },
): Promise<{ ok?: boolean; error?: string }> {
  if (!marketplaceDef(platform)) return { error: 'المنصة دي مش موجودة' }

  const [row] = await db
    .select({ id: marketplaceConnections.id })
    .from(marketplaceConnections)
    .where(
      and(
        eq(marketplaceConnections.storeId, storeId),
        eq(marketplaceConnections.platform, platform),
      ),
    )
    .limit(1)

  if (row) {
    await db.update(marketplaceConnections).set(input).where(eq(marketplaceConnections.id, row.id))
  } else {
    await db.insert(marketplaceConnections).values({ ...input, storeId, platform })
  }

  return { ok: true }
}

/** يسجّل إن المنصة جابت الملف — بيظهر للتاجر كـ«آخر مزامنة» */
export async function touchCatalogFeed(
  storeId: string,
  platform: string,
  count?: number,
): Promise<void> {
  await db
    .update(marketplaceConnections)
    .set({
      lastSyncAt: new Date(),
      lastError: null,
      ...(count === undefined ? {} : { syncedCount: count }),
    })
    .where(
      and(
        eq(marketplaceConnections.storeId, storeId),
        eq(marketplaceConnections.platform, platform),
      ),
    )
    .catch(() => undefined)
}

export type FeedItem = {
  id: string
  title: string
  description: string
  link: string
  image: string | null
  price: number
  salePrice: number | null
  currency: string
  available: boolean
  brand: string | null
  condition: string
}

/**
 * منتجات الملف.
 *
 * المنشور بس (`active`) واللي ليه صورة: ميتا وجوجل بيرفضوا المنتج
 * من غير صورة، والمنتج المرفوض بيتعدّ في نسبة أخطاء الحساب —
 * ونسبة أخطاء عالية بتوقف الكتالوج كله. فبنستبعده من عندنا بدل
 * ما نبعته ويترفض عندهم.
 */
export async function feedItems(storeId: string): Promise<{ items: FeedItem[]; store: { name: string; slug: string; currency: string } | null }> {
  const [store] = await db
    .select({ name: stores.name, slug: stores.slug, currency: stores.currency })
    .from(stores)
    .where(eq(stores.id, storeId))
    .limit(1)

  if (!store) return { items: [], store: null }

  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      shortDescription: products.shortDescription,
      description: products.description,
      images: products.images,
      price: products.price,
      compareAtPrice: products.compareAtPrice,
      stock: products.stock,
      trackInventory: products.trackInventory,
      brand: products.brand,
      sku: products.sku,
    })
    .from(products)
    .where(and(eq(products.storeId, storeId), eq(products.status, 'active')))
    .orderBy(products.name)
    .limit(5000)

  const base = storeUrl(store.slug)

  const items: FeedItem[] = rows
    .filter((p) => (p.images?.length ?? 0) > 0)
    .map((p) => {
      /*
        السعر المشطوب هو «السعر العادي» والحالي هو «سعر العرض».
        العكس بيخلّي المنصة تعرض خصمًا وهمي، ودي مخالفة بتوقف
        الحساب لا مجرد منتج.
      */
      const hasSale = Boolean(p.compareAtPrice && p.compareAtPrice > p.price)

      return {
        id: p.sku || p.id,
        title: p.name.slice(0, 150),
        description: (p.shortDescription || p.description || p.name)
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 5000),
        link: `${base}/products/${p.slug}`,
        image: p.images?.[0] ?? null,
        price: hasSale ? p.compareAtPrice! : p.price,
        salePrice: hasSale ? p.price : null,
        currency: store.currency,
        available: !p.trackInventory || p.stock > 0,
        brand: p.brand,
        condition: 'new',
      }
    })

  return { items, store }
}

const money = (minor: number, currency: string) => `${(minor / 100).toFixed(2)} ${currency}`

const escapeXml = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** ملف جوجل ميرشانت — RSS 2.0 بامتداد g: */
export function googleFeed(items: FeedItem[], storeName: string, storeLink: string): string {
  const entries = items
    .map((i) =>
      [
        '    <item>',
        `      <g:id>${escapeXml(i.id)}</g:id>`,
        `      <g:title>${escapeXml(i.title)}</g:title>`,
        `      <g:description>${escapeXml(i.description)}</g:description>`,
        `      <g:link>${escapeXml(i.link)}</g:link>`,
        i.image ? `      <g:image_link>${escapeXml(i.image)}</g:image_link>` : '',
        `      <g:availability>${i.available ? 'in_stock' : 'out_of_stock'}</g:availability>`,
        `      <g:price>${money(i.price, i.currency)}</g:price>`,
        i.salePrice !== null ? `      <g:sale_price>${money(i.salePrice, i.currency)}</g:sale_price>` : '',
        `      <g:condition>${i.condition}</g:condition>`,
        i.brand ? `      <g:brand>${escapeXml(i.brand)}</g:brand>` : '',
        `      <g:identifier_exists>no</g:identifier_exists>`,
        '    </item>',
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escapeXml(storeName)}</title>
    <link>${escapeXml(storeLink)}</link>
    <description>${escapeXml(`كتالوج منتجات ${storeName}`)}</description>
${entries}
  </channel>
</rss>
`
}

/** ملف ميتا وتيك توك — CSV بأعمدتهم المعتمدة */
export function metaFeed(items: FeedItem[]): string {
  const header = [
    'id',
    'title',
    'description',
    'availability',
    'condition',
    'price',
    'sale_price',
    'link',
    'image_link',
    'brand',
  ]

  /*
    الاقتباس المزدوج داخل الخانة بيتضاعف — ده معيار CSV، ومن غيره
    اسم منتج فيه علامة اقتباس بيكسر الصف كله واللي بعده.
  */
  const cell = (v: string | null) => `"${String(v ?? '').replace(/"/g, '""')}"`

  const lines = items.map((i) =>
    [
      cell(i.id),
      cell(i.title),
      cell(i.description),
      cell(i.available ? 'in stock' : 'out of stock'),
      cell(i.condition),
      cell(money(i.price, i.currency)),
      cell(i.salePrice !== null ? money(i.salePrice, i.currency) : ''),
      cell(i.link),
      cell(i.image),
      cell(i.brand ?? ''),
    ].join(','),
  )

  // BOM عشان إكسل يقرا العربي صح لو التاجر فتح الملف بنفسه
  return '﻿' + [header.join(','), ...lines].join('\n') + '\n'
}

/** عدد المنتجات المؤهّلة — بيظهر للتاجر قبل ما يربط */
export async function eligibleCount(storeId: string): Promise<{ total: number; eligible: number }> {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      /*
        `jsonb_typeof` قبل `jsonb_array_length`.

        العمود مكتوب كمصفوفة في المخطط، بس أي صف قديم أو مستورد
        ممكن يكون فيه قيمة مفردة — و`jsonb_array_length` بترمي خطأ
        على القيمة المفردة وبتوقّع الصفحة كلها. الحارس بيخلّي الصف
        الغلط يتعدّ صفرًا بدل ما يكسر العدّ.
      */
      eligible: sql<number>`count(*) filter (
        where jsonb_typeof(${products.images}) = 'array'
          and jsonb_array_length(${products.images}) > 0
      )::int`,
    })
    .from(products)
    .where(and(eq(products.storeId, storeId), eq(products.status, 'active')))

  return { total: row?.total ?? 0, eligible: row?.eligible ?? 0 }
}
