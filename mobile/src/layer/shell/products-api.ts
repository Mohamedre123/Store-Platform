/**
 * بيانات شاشات المنتجات — نفس أسلوب الطلبات: القايمة محفوظة على الجهاز
 * فبتفتح فورًا، والتفاصيل بتبدأ من «معاينة» سطر القايمة.
 */

export type ListProduct = {
  id: string
  name: string
  price: number
  compareAtPrice: number | null
  stock: number
  trackInventory: boolean
  status: 'draft' | 'active' | 'archived'
  image: string | null
  category: string | null
}

export type ProductsPayload = {
  currency: string
  total: number
  active: number
  lowStock: number
  products: ListProduct[]
}

export type ProductDetail = {
  currency: string
  product: {
    id: string
    name: string
    status: 'draft' | 'active' | 'archived'
    price: number
    compareAtPrice: number | null
    costPrice: number | null
    sku: string | null
    stock: number
    trackInventory: boolean
    images: string[]
    category: string | null
    description: string | null
    url: string
    createdAt: string
  }
  options: Array<{ name: string; values: Array<{ value: string; hex: string | null }> }>
  variants: Array<{ id: string; title: string; price: number; stock: number; isActive: boolean }>
  variantStock: number | null
}

type Result<T> =
  | { kind: 'ok'; data: T; at: number }
  | { kind: 'unauthorized' }
  | { kind: 'unavailable' }
  | { kind: 'notFound' }
  | { kind: 'error' }

async function getJson<T>(url: string): Promise<Result<T>> {
  try {
    const res = await fetch(url, { credentials: 'same-origin', cache: 'no-store', headers: { accept: 'application/json' } })
    const isJson = (res.headers.get('content-type') ?? '').includes('application/json')
    if (res.status === 401) return { kind: 'unauthorized' }
    if (res.status === 404) return isJson ? { kind: 'notFound' } : { kind: 'unavailable' }
    if (!res.ok) return { kind: 'error' }
    if (!isJson) return { kind: 'unavailable' }
    return { kind: 'ok', data: (await res.json()) as T, at: Date.now() }
  } catch {
    return { kind: 'error' }
  }
}

const LIST_KEY = 'zw-products:v1'

export function readProductsCache(): { at: number; data: ProductsPayload } | null {
  try {
    const raw = localStorage.getItem(LIST_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearProductsCache(): void {
  try {
    localStorage.removeItem(LIST_KEY)
  } catch {
    /* تجاهل */
  }
  productPreviews.clear()
  productDetails.clear()
}

export async function fetchProducts(): Promise<Result<ProductsPayload>> {
  const res = await getJson<ProductsPayload>('/api/app/products')
  if (res.kind === 'ok') {
    try {
      localStorage.setItem(LIST_KEY, JSON.stringify({ at: res.at, data: res.data }))
    } catch {
      /* الشاشة شغّالة من غير كاش */
    }
  }
  return res
}

let staleVersion = 0
export const productsVersion = () => staleVersion
export const markProductsStale = () => {
  staleVersion++
}

export const productPreviews = new Map<string, ListProduct & { currency: string }>()
export const productDetails = new Map<string, ProductDetail>()

export function fetchProduct(id: string): Promise<Result<ProductDetail>> {
  return getJson<ProductDetail>(`/api/app/products/${encodeURIComponent(id)}`)
}

export async function postProductAction(
  id: string,
  action: 'status' | 'delete',
): Promise<{ ok: true; detail: ProductDetail | null } | { ok: false; error: string }> {
  try {
    const res = await fetch(`/api/app/products/${encodeURIComponent(id)}/${action}`, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: '{}',
    })
    const data = (await res.json().catch(() => null)) as { ok?: boolean; detail?: ProductDetail; error?: string } | null
    if (res.ok && data?.ok) {
      markProductsStale()
      if (data.detail) productDetails.set(id, data.detail)
      else productDetails.delete(id)
      return { ok: true, detail: data.detail ?? null }
    }
    if (res.status === 401) return { ok: false, error: 'الجلسة خلصت — سجّل دخول تاني' }
    if (res.status === 403) return { ok: false, error: 'ماعندكش صلاحية تعدّل المنتجات' }
    return { ok: false, error: data?.error && data.error.length > 3 ? data.error : 'ما قدرناش نكمّل — جرّب تاني' }
  } catch {
    return { ok: false, error: 'مفيش اتصال — جرّب تاني لما النت يرجع' }
  }
}
