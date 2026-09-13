/**
 * بيانات شاشات العملاء — نفس أسلوب الطلبات والمنتجات.
 */
import type { TrustLevel } from './orders-api'

export type ListCustomer = {
  id: string
  name: string | null
  phone: string | null
  email: string | null
  ordersCount: number
  totalSpent: number
  lastOrderAt: string | null
  tier: string
  tierLabel: string | null
  whatsappText: string
}

export type CustomersPayload = {
  currency: string
  filter: 'all' | 'subscribers'
  totals: { count: number; subscribers: number; average: number; repeatRate: number }
  customers: ListCustomer[]
}

export type CustomerDetail = {
  currency: string
  customer: {
    id: string
    name: string | null
    phone: string | null
    email: string | null
    tier: string
    tierLabel: string
    points: number
    ordersCount: number
    totalSpent: number
    averageOrder: number
    lastOrderAt: string | null
    createdAt: string
    acceptsMarketing: boolean
    tags: string[]
    note: string | null
    isBlocked: boolean
  }
  orders: Array<{ id: string; number: string; status: string; statusLabel: string; total: number; createdAt: string }>
  trust: { level: TrustLevel; label: string; score: number | null; reasons: string[]; networkStores: number } | null
  whatsappText: string
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

const PREFIX = 'zw-customers:v1:'

export function readCustomersCache(filter: string): { at: number; data: CustomersPayload } | null {
  try {
    const raw = localStorage.getItem(PREFIX + filter)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearCustomersCache(): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (key?.startsWith(PREFIX)) localStorage.removeItem(key)
    }
  } catch {
    /* تجاهل */
  }
  customerPreviews.clear()
  customerDetails.clear()
}

export async function fetchCustomers(filter: string): Promise<Result<CustomersPayload>> {
  const res = await getJson<CustomersPayload>(filter === 'subscribers' ? '/api/app/customers?filter=subscribers' : '/api/app/customers')
  if (res.kind === 'ok') {
    try {
      localStorage.setItem(PREFIX + filter, JSON.stringify({ at: res.at, data: res.data }))
    } catch {
      /* الشاشة شغّالة من غير كاش */
    }
  }
  return res
}

export const customerPreviews = new Map<string, ListCustomer & { currency: string }>()
export const customerDetails = new Map<string, CustomerDetail>()

export function fetchCustomer(id: string): Promise<Result<CustomerDetail>> {
  return getJson<CustomerDetail>(`/api/app/customers/${encodeURIComponent(id)}`)
}
