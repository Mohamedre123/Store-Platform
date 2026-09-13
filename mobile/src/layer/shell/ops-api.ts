/**
 * بيانات شاشات الحظر والمندوبين والحجوزات — نفس شكل
 * `/api/app/blocked|couriers|bookings` (src/lib/app-blocked.ts و app-couriers.ts و app-bookings.ts).
 */
import { cachedResource } from './http'

export type BlockedPayload = {
  matches: Array<{ key: string; label: string }>
  rows: Array<{
    id: string
    match: string
    matchLabel: string
    value: string
    action: 'reject' | 'flag'
    reason: string | null
    hits: number
    lastHitAt: string | null
  }>
  risky: Array<{ id: string; name: string | null; phone: string | null; refused: number; delivered: number; isBlocked: boolean }>
}

export type Courier = {
  id: string
  name: string
  phone: string
  vehicle: string
  vehicleLabel: string
  zones: string[]
  feePerOrder: number
  isActive: boolean
  note: string | null
  openCount: number
  deliveredCount: number
  failedCount: number
  dueAmount: number
  feesDue: number
  link: string
}

export type WaitingOrder = {
  id: string
  orderNumber: number
  orderLabel: string
  customerName: string | null
  total: number
  isPaid: boolean
  city: string | null
  createdAt: string
}

export type CouriersPayload = {
  currency: string
  vehicles: Array<{ key: string; label: string }>
  cities: string[]
  stats: { active: number; open: number; waiting: number; due: number }
  waiting: WaitingOrder[]
  couriers: Courier[]
}

export type Booking = {
  id: string
  productName: string | null
  customerName: string | null
  customerPhone: string | null
  startsAt: string
  endsAt: string
  status: string
  statusLabel: string
  bg: string
  fg: string
  notes: string | null
  orderLabel: string | null
}

export type BookingsPayload = {
  enabled: boolean
  hours: { days: number[]; from: string; to: string; slotMinutes: number }
  dayNames: string[]
  statuses: Array<{ key: string; label: string; bg: string; fg: string }>
  bookings: Booking[]
}

export type ExpenseItem = {
  id: string
  title: string
  category: string
  categoryLabel: string
  color: string
  amount: number
  spentAt: string
  note: string | null
  isRecurring: boolean
}

export type ExpensesPayload = {
  currency: string
  categories: Array<{ key: string; label: string; hint: string; color: string }>
  profit: { revenue: number; cogs: number; expenses: number; net: number; marginBps: number; shippingCollected: number }
  monthTotal: number
  totals: Array<{ category: string; label: string; color: string; total: number }>
  expenses: ExpenseItem[]
}

export type Supplier = {
  id: string
  name: string
  phone: string | null
  email: string | null
  marginPercent: number
  isActive: boolean
  productCount: number
}

export type SuppliersPayload = {
  currency: string
  unlinkedCount: number
  reorderCount: number
  reorder: Array<{
    supplierId: string | null
    name: string | null
    phone: string | null
    items: Array<{ id: string; name: string; sku: string | null; stock: number; costPrice: number | null }>
  }>
  suppliers: Supplier[]
  products: Array<{ id: string; name: string; supplierId: string | null }>
}

export type Category = {
  id: string
  name: string
  description: string | null
  image: string | null
  isActive: boolean
  parentId: string | null
  parentName: string | null
  productCount: number
}

export type CategoriesPayload = { categories: Category[] }

export type TrashPayload = {
  currency: string
  products: Array<{ id: string; name: string; price: number; image: string | null; deletedAt: string }>
}

export const blockedData = cachedResource<BlockedPayload>('zw-blocked:v1', '/api/app/blocked')
export const couriersData = cachedResource<CouriersPayload>('zw-couriers:v1', '/api/app/couriers')
export const bookingsData = cachedResource<BookingsPayload>('zw-bookings:v1', '/api/app/bookings')
export const expensesData = cachedResource<ExpensesPayload>('zw-expenses:v1', '/api/app/expenses')
export const suppliersData = cachedResource<SuppliersPayload>('zw-suppliers:v1', '/api/app/suppliers')
export const categoriesData = cachedResource<CategoriesPayload>('zw-categories:v1', '/api/app/categories')
export const trashData = cachedResource<TrashPayload>('zw-trash:v1', '/api/app/trash')

export function clearOpsCaches(): void {
  blockedData.clear()
  couriersData.clear()
  bookingsData.clear()
  expensesData.clear()
  suppliersData.clear()
  categoriesData.clear()
  trashData.clear()
}

/** أرقام عربي وفواصل ← أرقام لاتيني بنقطة عشرية */
export const toLatin = (s: string) => s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[٫,]/g, '.')

/** رقم واتساب دولي من رقم مصري محلي — «01001234567» ← «201001234567» */
export function waNumber(phone: string): string {
  let d = phone.replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  if (d.startsWith('0') && d.length === 11) d = `20${d.slice(1)}`
  return d
}
