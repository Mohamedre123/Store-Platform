import 'server-only'
import type { ActiveStore } from '@/lib/store-context'
import { loadProductDetail, loadProductsList } from '@/lib/products-data'
import { publicStoreUrl } from '@/lib/domain'

/**
 * شكل المنتجات اللي تطبيق الموبايل بيستلمه.
 *
 * المبالغ بالوحدة الصغرى زي باقي المنصة. «قربت تخلص» بنفس حد اللوحة
 * (٥ قطع) عشان الرقم يبقى واحد في المكانين.
 */

export async function productsListPayload(store: ActiveStore) {
  const { rows, active, lowStock } = await loadProductsList(store)

  return {
    currency: store.currency,
    total: rows.length,
    active,
    lowStock,
    products: rows.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      compareAtPrice: p.compareAtPrice,
      stock: p.stock,
      trackInventory: p.trackInventory,
      status: p.status,
      image: p.images[0] ?? null,
      category: p.categoryName,
    })),
  }
}

/** الوصف مكتوب في محرّر نص عادي — بنشيل أي وسوم لو اتلزقت من مكان تاني */
function plainText(value: string | null): string | null {
  if (!value) return null
  const text = value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  return text || null
}

export async function productDetailPayload(store: ActiveStore, productId: string) {
  const detail = await loadProductDetail(store, productId)
  if (!detail) return null

  const { product: p, categoryName, variants } = detail
  const activeVariants = variants.variants.filter((v) => v.isActive)

  return {
    currency: store.currency,
    product: {
      id: p.id,
      name: p.name,
      status: p.status,
      price: p.price,
      compareAtPrice: p.compareAtPrice,
      costPrice: p.costPrice,
      sku: p.sku,
      stock: p.stock,
      trackInventory: p.trackInventory,
      images: p.images,
      category: categoryName,
      description: plainText(p.description),
      url: publicStoreUrl(store, `/products/${p.slug}`),
      createdAt: p.createdAt.toISOString(),
    },
    options: variants.options.map((o) => ({ name: o.name, values: o.values.map((v) => ({ value: v.value, hex: v.hex })) })),
    variants: variants.variants.map((v) => ({
      id: v.id,
      title: v.title,
      price: v.price,
      stock: v.stock,
      isActive: v.isActive,
    })),
    /* المنتج اللي ليه مقاسات وألوان مخزونه مجموع التركيبات الشغّالة */
    variantStock: activeVariants.length ? activeVariants.reduce((n, v) => n + v.stock, 0) : null,
  }
}
