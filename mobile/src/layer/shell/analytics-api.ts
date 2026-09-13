/**
 * بيانات شاشة التحليلات — نفس شكل `/api/app/analytics` (src/lib/app-analytics.ts).
 */

export type AnalyticsPayload = {
  currency: string
  kpis: Array<{ key: string; label: string; value: number; money: boolean; change: number | null }>
  expensesMissing: boolean
  series: Array<{ label: string; value: number }>
  statuses: Array<{ key: string; label: string; n: number; pct: number; color: string }>
  top: Array<{ name: string; sold: number; pct: number }>
  funnel: { dayCount: number; steps: Array<{ label: string; value: number }> }
}

type Result<T> =
  | { kind: 'ok'; data: T; at: number }
  | { kind: 'unauthorized' }
  | { kind: 'unavailable' }
  | { kind: 'error' }

const KEY = 'zw-analytics:v1'

export async function getAppJson<T>(url: string): Promise<Result<T>> {
  try {
    const res = await fetch(url, { credentials: 'same-origin', cache: 'no-store', headers: { accept: 'application/json' } })
    const isJson = (res.headers.get('content-type') ?? '').includes('application/json')
    if (res.status === 401) return { kind: 'unauthorized' }
    /* 404 مش JSON = المسار لسه مش منشور على الموقع — الشاشة بترجع لصفحة المنصة */
    if (res.status === 404 && !isJson) return { kind: 'unavailable' }
    if (!res.ok || !isJson) return { kind: isJson ? 'error' : 'unavailable' }
    return { kind: 'ok', data: (await res.json()) as T, at: Date.now() }
  } catch {
    return { kind: 'error' }
  }
}

export function readAnalyticsCache(): { at: number; data: AnalyticsPayload } | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearAnalyticsCache(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* تجاهل */
  }
}

export async function fetchAnalytics(): Promise<Result<AnalyticsPayload>> {
  const res = await getAppJson<AnalyticsPayload>('/api/app/analytics')
  if (res.kind === 'ok') {
    try {
      localStorage.setItem(KEY, JSON.stringify({ at: res.at, data: res.data }))
    } catch {
      /* الشاشة شغّالة من غير كاش */
    }
  }
  return res
}
