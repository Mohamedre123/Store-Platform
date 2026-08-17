import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * كل المبالغ مخزَّنة بالوحدة الصغرى (قرش). هذه الدالة هي الطريق
 * الوحيد لعرضها — لا تُنسَّق الأرقام يدويًا في أي مكان آخر.
 */
export function formatMoney(
  minorUnits: number,
  currency = 'EGP',
  locale = 'ar-EG',
  options: { withSymbol?: boolean; decimals?: boolean } = {},
) {
  const { withSymbol = true, decimals = true } = options
  const value = minorUnits / 100

  try {
    return new Intl.NumberFormat(locale, {
      style: withSymbol ? 'currency' : 'decimal',
      currency,
      minimumFractionDigits: decimals && value % 1 !== 0 ? 2 : 0,
      maximumFractionDigits: decimals ? 2 : 0,
    }).format(value)
  } catch {
    // احتياطي لو المتصفح ما يعرفش العملة أو اللغة
    return `${value.toFixed(decimals ? 2 : 0)} ${withSymbol ? currency : ''}`.trim()
  }
}

/** يحوّل مبلغًا كتبه المستخدم (490.5) إلى وحدات صغرى (49050) */
export function toMinorUnits(input: string | number): number {
  const n = typeof input === 'number' ? input : Number(String(input).replace(/[^\d.-]/g, ''))
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100)
}

export function fromMinorUnits(minorUnits: number): number {
  return Math.round(minorUnits) / 100
}

/** نقاط الأساس → نسبة مئوية للعرض (1400 → "14%") */
export function formatBps(bps: number, locale = 'ar-EG') {
  const pct = bps / 100
  try {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(pct) + '%'
  } catch {
    return `${pct}%`
  }
}

export function applyBps(amount: number, bps: number): number {
  return Math.round((amount * bps) / 10000)
}

/**
 * يحوّل نصًا عربيًا أو إنجليزيًا إلى slug صالح للروابط.
 * العربية تُبقى كما هي (URL-encoded) لأن جوجل يفهمها ويفضّلها للسيو المحلي.
 */
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

/** توحيد أرقام الهواتف المصرية: 01012345678 → +201012345678 */
export function normalizePhone(input: string, countryCode = '20'): string {
  let digits = input.replace(/[^\d+]/g, '')
  // تحويل الأرقام العربية الهندية
  digits = digits.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
  if (digits.startsWith('+')) return digits
  if (digits.startsWith('00')) return `+${digits.slice(2)}`
  if (digits.startsWith('0')) return `+${countryCode}${digits.slice(1)}`
  if (digits.startsWith(countryCode)) return `+${digits}`
  return `+${countryCode}${digits}`
}

export function isValidPhone(input: string): boolean {
  const normalized = normalizePhone(input)
  return /^\+\d{10,15}$/.test(normalized)
}

export function formatDate(date: Date | string, locale = 'ar-EG') {
  const d = typeof date === 'string' ? new Date(date) : date
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(d)
  } catch {
    return d.toISOString().slice(0, 10)
  }
}

export function formatDateTime(date: Date | string, locale = 'ar-EG') {
  const d = typeof date === 'string' ? new Date(date) : date
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(d)
  } catch {
    return d.toISOString()
  }
}
