/**
 * تنسيق الأرقام — نفس دوال المنصة (`src/lib/utils.ts`) بالحرف.
 *
 * الرئيسية في التطبيق وفي الويب لازم تكتب نفس الرقم بنفس الشكل: «٢٬٤٥٠ ج.م.»
 * في مكان و«2450 EGP» في التاني بيخلّي التاجر يسأل أنهي فيهم الصح.
 */

export function formatMoney(minorUnits: number, currency = 'EGP'): string {
  const value = minorUnits / 100
  try {
    return new Intl.NumberFormat('ar-EG', {
      style: 'currency',
      currency,
      minimumFractionDigits: value % 1 !== 0 ? 2 : 0,
      maximumFractionDigits: 2,
    }).format(value)
  } catch {
    return `${value.toFixed(2)} ${currency}`
  }
}

export function formatNumber(n: number): string {
  try {
    return new Intl.NumberFormat('ar-EG').format(n)
  } catch {
    return String(n)
  }
}

export function formatBps(bps: number): string {
  const pct = bps / 100
  try {
    return new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 2 }).format(pct) + '%'
  } catch {
    return `${pct}%`
  }
}

/** نفس `pctChange` في المنصة: `null` لما المدة اللي فاتت صفر */
export function pctChange(cur: number, prev: number): number | null {
  if (prev === 0) return null
  return Math.round(((cur - prev) / prev) * 100)
}

/** التحية بتوقيت الجهاز — الخادم على UTC ومايعرفش التاجر فين */
export function greeting(date = new Date()): string {
  const hour = date.getHours()
  if (hour < 5) return 'مساء الخير'
  if (hour < 12) return 'صباح الخير'
  if (hour < 17) return 'نهارك سعيد'
  return 'مساء الخير'
}

/** نفس `formatDateTime` في المنصة: «١٣ سبتمبر ٢٠٢٦، ٣:٤٠ م» */
export function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function initials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '؟'
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
}

export function timeAgo(at: number): string {
  const seconds = (Date.now() - at) / 1000
  if (seconds < 45) return 'دلوقتي'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `من ${formatNumber(minutes)} دقيقة`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `من ${formatNumber(hours)} ساعة`
  return `من ${formatNumber(Math.round(hours / 24))} يوم`
}

export function daysWord(days: number): string {
  if (days === 1) return 'يوم'
  if (days === 2) return 'يومين'
  return `${formatNumber(days)} أيام`
}
