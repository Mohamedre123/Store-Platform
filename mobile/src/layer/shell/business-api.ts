/**
 * بيانات شاشات التسويق والمخزون والرسايل والاشتراك — نفس شكل
 * `/api/app/marketing|inventory|messages|subscription` (src/lib/app-*.ts).
 */
import { cachedResource } from './http'

export type MarketingPayload = {
  currency: string
  stats: { active: number; totalUses: number; total: number }
  coupons: Array<{
    id: string
    code: string
    description: string | null
    valueLabel: string
    conditions: string[]
    usedLabel: string
    isActive: boolean
    expired: boolean
  }>
  offers: Array<{ id: string; name: string; badge: string | null; tiersLabel: string; productsLabel: string; isActive: boolean }>
  bundles: Array<{ id: string; name: string; badge: string | null; productsLabel: string; priceLabel: string; isActive: boolean }>
}

export type InventoryItem = {
  id: string
  name: string
  sku: string | null
  image: string | null
  stock: number
  threshold: number
  variants: Array<{ id: string; title: string; sku: string | null; stock: number }>
}

export type InventoryPayload = {
  currency: string
  stats: { units: number; valueLabel: string; out: number; low: number }
  items: InventoryItem[]
  movements: Array<{ id: string; delta: number; reasonLabel: string; note: string | null; productName: string; createdAt: string }>
}

export type MessagesPayload = {
  emailConfigured: boolean
  counts: { total: number; last7: number; failed: number }
  messages: Array<{
    id: string
    channel: string
    eventLabel: string
    recipient: string
    body: string | null
    status: string
    statusLabel: string
    bg: string
    fg: string
    error: string | null
    orderId: string | null
    createdAt: string
  }>
}

export type SubscriptionPayload = {
  accountId: string | null
  isAdmin: boolean
  active: boolean
  onTrial: boolean
  expired: boolean
  title: string
  text: string
  tone: 'primary' | 'danger' | 'warning' | 'success'
  daysLeft: number | null
  quota: { limit: number | null; used: number; blocked: boolean }
  trial: { state: 'available' | 'running' | 'used' | 'hidden'; name: string; tagline: string }
  plans: Array<{ key: string; name: string; priceLabel: string; tagline: string; features: string[]; highlight: boolean }>
  pendingPlan: string | null
  requests: Array<{ id: string; planName: string; amountLabel: string; dateLabel: string; statusLabel: string; bg: string; fg: string; note: string | null }>
  history: Array<{
    id: string
    planName: string
    intervalLabel: string
    amountLabel: string
    fromLabel: string
    toLabel: string
    daysLeft: number | null
    statusLabel: string
    bg: string
    fg: string
  }>
}

export const marketingData = cachedResource<MarketingPayload>('zw-marketing:v1', '/api/app/marketing')
export const inventoryData = cachedResource<InventoryPayload>('zw-inventory:v1', '/api/app/inventory')
export const messagesData = cachedResource<MessagesPayload>('zw-messages:v1', '/api/app/messages')
export const subscriptionData = cachedResource<SubscriptionPayload>('zw-subscription:v1', '/api/app/subscription')

export function clearBusinessCaches(): void {
  marketingData.clear()
  inventoryData.clear()
  messagesData.clear()
  subscriptionData.clear()
}
