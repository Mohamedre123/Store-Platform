/** بيانات شاشات العرض المباشر والتقارير المفصّلة وجودة إشارة التحويل */
import { cachedResource } from './http'

type Count = { key: string; n: number }

export type LivePayload = {
  activeNow: number
  sessionsHour: number
  activeCarts: number
  checkoutsHour: number
  ordersHour: number
  revenueHour: number
  byDevice: Count[]
  byCity: Count[]
  bySource: Count[]
  topPages: Array<{ path: string; n: number }>
  feed: Array<{ type: string; at: string; path: string | null; city: string | null; device: string | null; value: number | null; productName: string | null }>
  currency: string
  showMoney: boolean
}

export type ReportsPayload = {
  currency: string
  showMoney: boolean
  channels: Array<{ label: string; orders: number; revenue: number | null; refused: number }>
  sources: Array<{ label: string; visits: number; orders: number; revenue: number | null; rate: number | null }>
  carriers: Array<{ label: string; shipments: number; rate: number; failed: number; avgDays: number | null; codTotal: number | null; codSettled: number | null }>
  team: Array<{ name: string; ordersCreated: number; revenue: number | null; statusChanges: number }>
}

export type SignalPayload = {
  configured: boolean
  purchases: number
  delivered: number
  skipped: number
  failed: number
  avgMatchKeys: number
  score: number | null
  coverage: Array<{ key: string; label: string; hint: string; pct: number }>
  errors: Array<{ message: string; count: number }>
}

export const liveData = cachedResource<LivePayload>('zw-live:v1', '/api/app/live')
export const reportsData = cachedResource<ReportsPayload>('zw-reports:v1', '/api/app/reports')
export const signalData = cachedResource<SignalPayload>('zw-signal:v1', '/api/app/signal')

export function clearReportsCaches(): void {
  liveData.clear()
  reportsData.clear()
  signalData.clear()
}
