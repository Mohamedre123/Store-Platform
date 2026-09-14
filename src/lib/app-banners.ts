import 'server-only'
import type { ActiveStore } from '@/lib/store-context'
import { loadBanners } from '@/lib/banners-data'

const PLACEMENT_LABEL: Record<string, string> = {
  hero: 'البانر الرئيسي',
  promo: 'شريط ترويجي',
  category: 'بانر قسم',
  popup: 'نافذة منبثقة',
}

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '')

/** شكل شاشة البانرات اللي تطبيق الموبايل بيستلمه — التواريخ بخانة `YYYY-MM-DD` زي فورم اللوحة */
export async function bannersPayload(store: ActiveStore) {
  const rows = await loadBanners(store.id)
  const now = Date.now()
  return {
    placements: Object.entries(PLACEMENT_LABEL).map(([key, label]) => ({ key, label })),
    banners: rows.map((b) => ({
      id: b.id,
      placement: b.placement,
      placementLabel: PLACEMENT_LABEL[b.placement] ?? b.placement,
      title: b.title ?? '',
      subtitle: b.subtitle ?? '',
      imageDesktop: b.imageDesktop,
      imageMobile: b.imageMobile,
      ctaLabel: b.ctaLabel ?? '',
      ctaUrl: b.ctaUrl ?? '',
      startsAt: day(b.startsAt),
      endsAt: day(b.endsAt),
      isActive: b.isActive,
      expired: Boolean(b.endsAt && b.endsAt.getTime() < now),
    })),
  }
}
