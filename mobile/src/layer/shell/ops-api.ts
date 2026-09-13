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

export type Reward = {
  id: string
  name: string
  description: string | null
  type: string
  typeLabel: string
  value: number
  pointsCost: number
  minTier: string | null
  minTierLabel: string | null
  stock: number | null
  redeemedCount: number
  isActive: boolean
}

export type LoyaltySettings = {
  pointsPerPound: number
  pointValue: number
  minPointsToRedeem: number
  welcomePoints: number
  reviewPoints: number
  referralPoints: number
}

export type WheelPrize = { label: string; color: string; type: string; value: string; chance: string }

export type LoyaltyPayload = {
  currency: string
  enabled: boolean
  settings: LoyaltySettings
  tiers: Array<{ key: string; name: string; minPoints: number; color: string; discountBps: number }>
  stats: { members: number; outstanding: number }
  rewardTypes: Array<{ key: string; label: string; unit: string | null }>
  tierOptions: Array<{ key: string; label: string }>
  rewards: Reward[]
  wheel: {
    enabled: boolean
    title: string
    prizes: Array<{ label: string; color: string; chance: number }>
    subtitle?: string
    triggerAfterSeconds?: number
    freeSpinsPerDay?: number
    prizeInputs?: WheelPrize[]
  }
  editsTiers?: boolean
  recent: Array<{ id: string; points: number; reason: string | null; customerName: string | null; createdAt: string }>
}

export type Affiliate = {
  id: string
  name: string
  phone: string | null
  email: string | null
  code: string
  commissionType: 'percent' | 'fixed'
  commissionInput: string
  commissionLabel: string
  balance: number
  totalEarned: number
  totalPaid: number
  clicks: number
  conversions: number
  isActive: boolean
  link: string
}

export type AffiliatesPayload = {
  currency: string
  stats: { balance: number; earned: number; conversions: number }
  affiliates: Affiliate[]
}

export type ReferralsPayload = {
  storeName: string
  link: string
  code: string
  signups: number
  subscribed: number
  deliveredOrders: number
}

export type MediaItem = {
  id: string
  url: string
  name: string
  folder: string
  folderLabel: string
  sizeBytes: number
  createdAt: string
  usedIn: number
}

export type MediaPayload = {
  synced: number
  totalBytes: number
  folders: Array<{ key: string; label: string }>
  items: MediaItem[]
}

export type BlogPost = {
  id: string
  title: string
  slug: string
  excerpt: string
  content: string
  cover: string | null
  author: string
  isPublished: boolean
  publishedAt: string | null
  views: number
  url: string
}

export type BlogPayload = { posts: BlogPost[] }

export const mediaData = cachedResource<MediaPayload>('zw-media:v1', '/api/app/media')
export const blogData = cachedResource<BlogPayload>('zw-blog:v1', '/api/app/blog')

export const loyaltyData = cachedResource<LoyaltyPayload>('zw-loyalty:v1', '/api/app/loyalty')
export const affiliatesData = cachedResource<AffiliatesPayload>('zw-affiliates:v1', '/api/app/affiliates')
export const referralsData = cachedResource<ReferralsPayload>('zw-referrals:v1', '/api/app/referrals')

export const COPY_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>'
export const WALLET_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/></svg>'

/** نسخ نص مع رسالة — ولو المتصفح رفض، النص نفسه بيظهر في الرسالة */
export async function copyText(text: string, done: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    const { toast } = await import('../dom')
    toast(done, { tone: 'success', duration: 1800 })
  } catch {
    const { toast } = await import('../dom')
    toast(text)
  }
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
  loyaltyData.clear()
  affiliatesData.clear()
  referralsData.clear()
  mediaData.clear()
  blogData.clear()
}

/** «١٫٢ ميجا» — حجم ملف بالعربي */
export function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toLocaleString('ar-EG', { maximumFractionDigits: 1 })} ميجا`
  return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString('ar-EG')} ك.ب`
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
