/**
 * تعريفات ربط الكتالوج المشتركة بين الخادم والمتصفح.
 *
 * منفصلة عن marketplace.ts لأن ده server-only: كارت المنصة في
 * اللوحة محتاج الاسم واللون والمسار، ولو قراهم من ملف الخادم كان
 * البناء بيقع — نفس فصل providers.ts عن provider-store.ts.
 */

export type FeedFormat = 'google' | 'meta'

export type MarketplaceDef = {
  platform: string
  name: string
  brand: string
  desc: string
  color: string
  format: FeedFormat
  /** فين التاجر بيلزق الرابط عندهم */
  where: string
  signupUrl: string
}

export const MARKETPLACES: MarketplaceDef[] = [
  {
    platform: 'meta',
    name: 'كتالوج ميتا',
    brand: 'Meta Commerce',
    desc: 'منتجاتك تظهر في إعلانات فيسبوك وإنستجرام وفي متجر صفحتك، وبتتحدّث لوحدها.',
    color: '#0866ff',
    format: 'meta',
    signupUrl: 'https://business.facebook.com/commerce',
    where:
      'من Commerce Manager ← Catalogue ← Data Sources ← Scheduled Feed، والزق الرابط واختار تحديث يومي.',
  },
  {
    platform: 'google',
    name: 'جوجل ميرشانت',
    brand: 'Google Merchant Center',
    desc: 'منتجاتك في نتايج جوجل شوبينج وإعلانات الأداء الأقصى.',
    color: '#4285f4',
    format: 'google',
    signupUrl: 'https://merchants.google.com/',
    where: 'من Merchant Center ← Products ← Feeds ← Add feed، واختار Scheduled fetch والزق الرابط.',
  },
  {
    platform: 'tiktok',
    name: 'كتالوج تيك توك',
    brand: 'TikTok Catalog',
    desc: 'كتالوج منتجات لإعلانات تيك توك الديناميكية.',
    color: '#010101',
    format: 'meta',
    signupUrl: 'https://ads.tiktok.com/',
    where: 'من TikTok Ads ← Assets ← Catalog ← Add products ← Scheduled feed.',
  },
]

export function marketplaceDef(platform: string): MarketplaceDef | undefined {
  return MARKETPLACES.find((m) => m.platform === platform)
}

/** مسار الملف العام لمتجر ومنصة */
export function feedPath(storeId: string, platform: string): string {
  const def = marketplaceDef(platform)
  const ext = def?.format === 'google' ? 'xml' : 'csv'
  return `/api/feeds/${platform}/${storeId}.${ext}`
}

export type Connection = {
  platform: string
  enabled: boolean
  syncPrices: boolean
  syncStock: boolean
  lastSyncAt: Date | null
  lastError: string | null
  syncedCount: number
}

