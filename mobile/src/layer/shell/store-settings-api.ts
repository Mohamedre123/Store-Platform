/** بيانات شاشات إعدادات الطلبات والشيك أوت وواتساب وبريد المتجر */
import { cachedResource } from './http'

export type FieldMode = 'required' | 'optional' | 'hidden'

export type OrderSettingsValues = {
  manualOrdersEnabled: boolean
  manualOversell: boolean
  manualCustomPricing: boolean
  manualDepositEnabled: boolean
  orderPrefix: string
  orderSuffix: string
  nextOrderNumber: number
}

export type CheckoutValues = {
  fieldName: FieldMode
  fieldPhone: FieldMode
  fieldEmail: FieldMode
  fieldCity: FieldMode
  fieldArea: FieldMode
  fieldStreet: FieldMode
  fieldBuilding: FieldMode
  fieldPostalCode: FieldMode
  fieldCountry: FieldMode
  fieldNotes: FieldMode
  addressMode: 'structured' | 'simple' | 'hidden'
  deliveryMode: 'delivery_pickup' | 'delivery' | 'pickup'
  showCountryCodePicker: boolean
  smartMode: boolean
  showPaymentSelector: boolean
  showCouponField: boolean
  quickCheckoutEnabled: boolean
  quickCheckoutStyle: 'inline' | 'drawer'
  quickCheckoutShowItems: boolean
  whatsappOrderEnabled: boolean
  cartUpsellEnabled: boolean
  cartUpsellProductIds: string[]
  minOrderEnabled: boolean
  /** بالقرش */
  minOrderAmount: number
  otpEnabled: boolean
  captureIncompleteOrders: boolean
  autoConfirmEnabled: boolean
  autoConfirmDelay: number
}

export type PickProduct = { id: string; name: string; image: string | null; price: number; status: string }

export type CheckoutPayload = {
  values: CheckoutValues
  currency: string
  whatsappReady: boolean
  storeWhatsapp: string | null
  picked: PickProduct[]
}

export type WhatsappProvider = 'off' | 'wasender' | 'cloud'

export type WhatsappPayload = {
  settings: { provider: WhatsappProvider; hasKey: boolean; hasAccessToken: boolean; phoneId: string | null }
  storePhone: string | null
  hasPlatformToken: boolean
  account: { name: string; email: string }
  templates: Record<string, string>
  templateKeys: Array<{ key: string; label: string; vars: string[]; fallback: string }>
}

export type EmailPayload = {
  configured: boolean
  from: string
  replyTo: string | null
  replyToDropped: boolean
  dns: Array<{ label: string; name: string; found: string | null }>
}

export const orderSettingsData = cachedResource<{ values: OrderSettingsValues }>('zw-order-settings:v1', '/api/app/order-settings')
export const checkoutSettingsData = cachedResource<CheckoutPayload>('zw-checkout-settings:v1', '/api/app/checkout-settings')
export const whatsappData = cachedResource<WhatsappPayload>('zw-whatsapp-settings:v1', '/api/app/whatsapp')
export const emailData = cachedResource<EmailPayload>('zw-email-settings:v1', '/api/app/email')

export function clearStoreSettingsCaches(): void {
  orderSettingsData.clear()
  checkoutSettingsData.clear()
  whatsappData.clear()
  emailData.clear()
}
