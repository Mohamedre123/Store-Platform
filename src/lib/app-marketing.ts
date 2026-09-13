import 'server-only'
import type { ActiveStore } from '@/lib/store-context'
import { loadMarketing } from '@/lib/marketing-data'
import { formatDate, formatMoney } from '@/lib/utils'

/** شكل التسويق اللي تطبيق الموبايل بيستلمه — النصوص جاهزة للعرض */

const ELIGIBILITY: Record<string, string> = {
  all: 'لكل العملاء',
  first_order: 'لأول طلب بس',
  tier: 'لمستوى ولاء معيّن',
  specific_customers: 'لعملاء محدّدين',
}

const n = (v: number) => v.toLocaleString('ar-EG')

export async function marketingPayload(store: ActiveStore) {
  const data = await loadMarketing(store)
  const money = (v: number) => formatMoney(v, store.currency)
  const productName = new Map(data.products.map((p) => [p.id, p.name]))
  const now = Date.now()

  return {
    currency: store.currency,
    stats: { active: data.active, totalUses: data.totalUses, total: data.coupons.length },
    coupons: data.coupons.map((c) => {
      const conditions: string[] = []
      if (c.minOrder > 0) conditions.push(`للطلبات من ${money(c.minOrder)}`)
      if (c.type === 'percent' && c.maxDiscount > 0) conditions.push(`بحد أقصى ${money(c.maxDiscount)}`)
      if (c.appliesTo === 'products') conditions.push(`على ${n(c.targetIds.length)} منتج`)
      if (c.appliesTo === 'categories') conditions.push(`على ${n(c.targetIds.length)} قسم`)
      conditions.push(ELIGIBILITY[c.eligibility] ?? ELIGIBILITY.all)
      const starts = c.startsAt ? new Date(c.startsAt) : null
      const ends = c.endsAt ? new Date(c.endsAt) : null
      if (starts && starts.getTime() > now) conditions.push(`بيبدأ ${formatDate(starts)}`)
      if (ends && ends.getTime() > now) conditions.push(`لحد ${formatDate(ends)}`)

      return {
        id: c.id,
        code: c.code,
        description: c.description,
        valueLabel:
          c.type === 'percent'
            ? `خصم ${n(c.value / 100)}٪`
            : c.type === 'fixed'
              ? `خصم ${money(c.value)}`
              : 'شحن مجاني',
        conditions,
        usedLabel:
          c.usageLimit !== null
            ? `استُخدم ${n(c.usedCount)} من ${n(c.usageLimit)}`
            : `استُخدم ${n(c.usedCount)} مرة`,
        isActive: c.isActive,
        expired: Boolean(ends && ends.getTime() <= now) || (c.usageLimit !== null && c.usedCount >= c.usageLimit),
        /* خانات فورم التعديل في التطبيق — نفس `rowToForm` في فورم اللوحة */
        form: {
          type: c.type,
          value: c.type === 'free_shipping' ? '' : String(c.value / 100),
          maxDiscount: c.maxDiscount ? String(c.maxDiscount / 100) : '',
          minOrder: c.minOrder ? String(c.minOrder / 100) : '',
          appliesTo: c.appliesTo,
          targetIds: c.targetIds,
          eligibility: c.eligibility,
          usageLimit: c.usageLimit ? String(c.usageLimit) : '',
          usageLimitPerCustomer: String(c.usageLimitPerCustomer),
          startsAt: starts ? starts.toISOString().slice(0, 10) : '',
          endsAt: ends ? ends.toISOString().slice(0, 10) : '',
        },
      }
    }),
    /* للاختيار في «ينطبق على» */
    pickProducts: data.products.map((p) => ({ id: p.id, name: p.name })),
    pickCategories: data.categories,
    offers: data.quantityOffers.map((o) => ({
      id: o.id,
      name: o.name,
      badge: o.badge,
      tiersLabel: (o.config.tiers ?? [])
        .map((t) => `${n(t.qty)} قطع: خصم ${n(t.discountBps / 100)}٪`)
        .join(' · '),
      productsLabel: o.productIds.length ? `على ${n(o.productIds.length)} منتج` : 'على كل المنتجات',
      isActive: o.isActive,
    })),
    bundles: data.bundles.map((b) => {
      const ids = b.config.productIds ?? []
      const names = ids.map((id) => productName.get(id)).filter(Boolean) as string[]
      return {
        id: b.id,
        name: b.name,
        badge: b.badge,
        productsLabel: names.length ? names.join(' + ') : `${n(ids.length)} منتجات`,
        priceLabel: b.config.bundlePrice ? money(b.config.bundlePrice) : '',
        isActive: b.isActive,
      }
    }),
  }
}
