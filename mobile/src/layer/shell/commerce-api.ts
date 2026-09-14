/**
 * بيانات شاشتي الدفع والشحن (`/api/app/payments` و`/api/app/shipping`).
 *
 * المبالغ اللي بتتكتب في الفورم جاية بالجنيه كنص (زي فورم اللوحة)، والباقي بالقرش.
 */
import { cachedResource } from './http'

export type ProviderField = {
  key: string
  label: string
  secret: boolean
  placeholder: string
  hint: string
  required: boolean
  /** فاضية دايمًا للخانة السرّية — القيمة عمرها ما بتخرج من الخادم */
  value: string
  saved: boolean
}

export type Provider = {
  slug: string
  name: string
  brand: string
  desc: string
  color: string
  mode: 'api' | 'manual'
  signupUrl: string
  where: string
  docsUrl: string | null
  hasTestMode: boolean
  webhookUrl: string | null
  fields: ProviderField[]
  enabled: boolean
  testMode: boolean
  lastError: string | null
  hasCreds: boolean
  flatRate: string
  freeOver: string
}

export type PaymentMethod = {
  gateway: 'cod' | 'manual'
  title: string
  desc: string
  defaultName: string
  hasFee: boolean
  hasInstructions: boolean
  instructionsLabel: string
  instructionsHint: string
  enabled: boolean
  displayName: string
  instructions: string
  fee: string
}

export type PaymentAttempt = {
  id: string
  gateway: string
  status: string
  statusLabel: string
  tone: 'good' | 'info' | 'muted' | 'bad'
  amount: number
  currency: string
  orderId: string | null
  orderNumber: string | number | null
  error: string | null
  createdAt: string
}

export type PaymentsPayload = {
  currency: string
  codEnabled: boolean
  methods: PaymentMethod[]
  gateways: Provider[]
  attempts: PaymentAttempt[]
}

export type ShippingMethod = {
  id: string
  name: string
  hint: string
  priceDelta: number
  minDays: number | null
  maxDays: number | null
  enabled: boolean
  sortOrder: number
}

export type ShippingPayload = {
  country: string
  currency: string
  codEnabled: boolean
  autoShip: boolean
  carrier: { name: string; canFetch: boolean } | null
  zone: {
    enabled: boolean
    defaultPrice: string
    freeShippingEnabled: boolean
    freeOverAmount: string
    minDays: number
    maxDays: number
  }
  regions: Array<{ name: string; price: string }>
  zones: Array<{ key: string; label: string; hint: string }>
  carriers: Provider[]
  pricedCarriers: string[]
  sampleBase: number
  methods: ShippingMethod[]
}

export const paymentsData = cachedResource<PaymentsPayload>('zw-payments:v1', '/api/app/payments')
export const shippingData = cachedResource<ShippingPayload>('zw-shipping:v1', '/api/app/shipping')

export function clearCommerceCaches(): void {
  paymentsData.clear()
  shippingData.clear()
}
