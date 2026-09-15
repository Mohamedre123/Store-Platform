import 'server-only'
import type { DashboardContext } from '@/lib/store-context'
import { loadCheckoutSettings } from '@/lib/checkout-settings-data'
import { readTemplates, readWhatsapp } from '@/lib/whatsapp'
import { platformToken } from '@/lib/whatsapp-onboard'
import { DEFAULT_TEMPLATES, TEMPLATE_LABELS, TEMPLATE_VARS, type TemplateKey } from '@/lib/whatsapp-templates'
import { resolvePickerProducts } from '@/app/dashboard/storefront/picker-actions'

/** شكل شاشة «الشيك أوت» في التطبيق — نفس اللي `CheckoutSettingsForm` بياخده */
export async function checkoutPayload(ctx: DashboardContext) {
  const values = await loadCheckoutSettings(ctx.store.id)
  const whatsapp = await readWhatsapp(ctx.store.id)
  const picked = await resolvePickerProducts(values.cartUpsellProductIds)
  return {
    values,
    currency: ctx.store.currency,
    /* واتساب مربوط؟ التأكيد التلقائي مالوش معنى من غيره */
    whatsappReady: whatsapp.provider !== 'off' && whatsapp.hasKey,
    /* رقم واتساب المتجر — زرار الطلب عبر واتساب مش بيظهر من غيره */
    storeWhatsapp: ctx.store.whatsapp ?? null,
    picked: picked.map((p) => ({ id: p.id, name: p.name, image: p.image, price: p.price, status: p.status })),
  }
}

/* نفس `ORDER` في `settings/whatsapp/templates-editor.tsx` (ملف client) — أي تعديل هناك يتعدّل هنا */
const TEMPLATE_ORDER: TemplateKey[] = ['otp', 'order_placed', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned']

/**
 * شكل شاشة «واتساب» في التطبيق — نفس اللي `WhatsappForm` و`TemplatesEditor` بياخدوه.
 * المفاتيح والتوكن عمرهم ما بيرجعوا — `hasKey`/`hasAccessToken` بس.
 */
export async function whatsappPayload(ctx: DashboardContext) {
  const [settings, templates] = await Promise.all([readWhatsapp(ctx.store.id), readTemplates(ctx.store.id)])
  return {
    settings,
    storePhone: ctx.store.whatsapp ?? ctx.store.phone ?? null,
    hasPlatformToken: Boolean(platformToken()),
    account: { name: ctx.user.name, email: ctx.user.email },
    templates,
    templateKeys: TEMPLATE_ORDER.map((key) => ({
      key,
      label: TEMPLATE_LABELS[key],
      vars: TEMPLATE_VARS[key],
      fallback: DEFAULT_TEMPLATES[key],
    })),
  }
}
