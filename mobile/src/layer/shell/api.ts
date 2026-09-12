/**
 * بيانات الشاشات الأصلية.
 *
 * ## الكاش هو اللي بيخلّي الشاشة «تطبيق»
 * آخر رد بيتحفظ على الجهاز، والشاشة بتترسم منه في نفس اللحظة اللي
 * التطبيق بيفتح فيها — وبعدين بتتحدّث بهدوء. التاجر ما بيشوفش أبدًا
 * شاشة فاضية مستنية النت، زي أي تطبيق بنك أو توصيل.
 *
 * ## والكاش بيتمسح مع الخروج
 * لو الموبايل اتسلّم لحد تاني وسجّل بحسابه، ما يصحّش يشوف أرقام متجر
 * اللي قبله ولو لثانية.
 */
import { SITE_HOST } from '../env'

export type DayPoint = {
  day: string
  label: string
  sessions: number
  revenue: number
  orders: number
  conversion: number
}

export type Totals = { sessions: number; revenue: number; orders: number; conversionBps: number }

export type SetupIconKey = 'product' | 'logo' | 'shipping' | 'payment' | 'theme' | 'publish'

export type HomePayload = {
  store: { id: string; name: string; currency: string; logo: string | null; url: string; published: boolean }
  user: { name: string | null }
  subscription: {
    active: boolean
    isAdmin: boolean
    onTrial: boolean
    expired: boolean
    daysLeft: number | null
    endsAt: string | null
    planName: string
    periodDays: number
    quota: { used: number; limit: number | null; blocked: boolean }
  }
  counts: { pending: number; incomplete: number; products: number; customers: number }
  stats: { series: DayPoint[]; current: Totals; previous: Totals }
  setup: Array<{ key: string; label: string; hint: string; href: string; done: boolean; icon: SetupIconKey }>
  notices: Array<{
    id: string
    title: string
    body: string
    ctaLabel: string | null
    ctaHref: string | null
    tone: 'offer' | 'praise' | 'info'
    rewardKind: 'none' | 'free_days' | 'link'
    redeemed: boolean
  }>
  latestOrders: Array<{ id: string; number: string; name: string | null; total: number; status: string; statusLabel: string }>
  topProducts: Array<{ productId: string | null; name: string; image: string | null; sold: number }>
  generatedAt: string
}

const CACHE_KEY = 'zw-home:v1'

export type CachedHome = { at: number; data: HomePayload }

export function readHomeCache(): CachedHome | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as CachedHome) : null
  } catch {
    return null
  }
}

export function clearHomeCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {
    /* تجاهل */
  }
}

export type HomeResult =
  | { kind: 'ok'; data: HomePayload; at: number }
  | { kind: 'unauthorized' }
  /** المسار لسه ما اتنشرش على الموقع — الشاشة بترجع لنسخة المنصة */
  | { kind: 'unavailable' }
  | { kind: 'error' }

export async function fetchHome(): Promise<HomeResult> {
  try {
    const res = await fetch('/api/app/home', {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { accept: 'application/json' },
    })
    if (res.status === 401) {
      clearHomeCache()
      return { kind: 'unauthorized' }
    }
    if (res.status === 404) return { kind: 'unavailable' }
    if (!res.ok) return { kind: 'error' }
    if (!(res.headers.get('content-type') ?? '').includes('application/json')) return { kind: 'unavailable' }

    const data = (await res.json()) as HomePayload
    const at = Date.now()
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ at, data }))
    } catch {
      /* مساحة ممتلئة — الشاشة شغّالة من غير كاش */
    }
    return { kind: 'ok', data, at }
  } catch {
    return { kind: 'error' }
  }
}

/** صور المنتجات: الروابط النسبية بتتحل على المنصة */
export function assetUrl(src: string | null): string | null {
  if (!src) return null
  if (/^https?:\/\//.test(src)) return src
  return `https://${SITE_HOST}${src.startsWith('/') ? '' : '/'}${src}`
}
