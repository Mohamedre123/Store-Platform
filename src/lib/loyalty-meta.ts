import type { TierConfig } from '@/db/schema'

/**
 * مستويات العملاء الافتراضية — اللي بتظهر للتاجر أول مرة يفتح الولاء.
 *
 * ملف من غير `server-only`: فورم اللوحة (متصفح) ومسار التطبيق (خادم) الاتنين
 * محتاجينها، ولازم تبقى واحدة — وإلا التاجر اللي يفعّل النقاط من الموبايل
 * يلاقي مستويات غير اللي كان هيلاقيها من الكمبيوتر.
 */
export const DEFAULT_TIERS: TierConfig[] = [
  { key: 'bronze', name: 'برونزي', minPoints: 0, color: '#a1662f', perks: [], discountBps: 0 },
  { key: 'silver', name: 'فضي', minPoints: 500, color: '#8a8f98', perks: [], discountBps: 300 },
  { key: 'gold', name: 'ذهبي', minPoints: 2000, color: '#c9a227', perks: [], discountBps: 700 },
]
