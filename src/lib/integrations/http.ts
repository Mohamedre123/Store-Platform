import 'server-only'

/**
 * نداءات المزوّدين الخارجيين.
 *
 * ثلاث قواعد لكل نداء بيخرج من الخادم لطرف تالت:
 *
 * ١. **مهلة إجبارية.** بوابة واقعة من غير مهلة بتعلّق الشيك أوت
 *    لحد ما Vercel تقطع الدالة — العميل بيقعد قدام شاشة بتلفّ
 *    وبيسيب السلة. عشرين ثانية وبنرجع بخطأ مفهوم.
 * ٢. **ما بنرميش استثناء.** كل دالة بترجّع نتيجة فيها `ok`، عشان
 *    اللي بينادي يقرّر: يوقف الطلب ولا يكمّله بالدفع عند الاستلام.
 * ٣. **الرد الخام بيترجع كامل.** بيتسجّل في `payment_attempts` أو
 *    `shipments.raw` — لما التاجر يجيلنا يقول «البوابة رافضة»،
 *    الرد بتاعهم هو الحاجة الوحيدة اللي بتقول السبب.
 */

export type ApiResult<T = Record<string, unknown>> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: string; status: number; data?: unknown }

const TIMEOUT_MS = 20_000

export async function apiFetch<T = Record<string, unknown>>(
  url: string,
  init: RequestInit & { form?: Record<string, string>; json?: unknown } = {},
): Promise<ApiResult<T>> {
  const { form, json, headers, ...rest } = init

  const finalHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...((headers as Record<string, string>) ?? {}),
  }

  let body = rest.body
  if (form) {
    finalHeaders['Content-Type'] = 'application/x-www-form-urlencoded'
    body = new URLSearchParams(form).toString()
  } else if (json !== undefined) {
    finalHeaders['Content-Type'] = 'application/json'
    body = JSON.stringify(json)
  }

  let res: Response
  try {
    res = await fetch(url, {
      ...rest,
      headers: finalHeaders,
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (e) {
    const timedOut = e instanceof Error && e.name === 'TimeoutError'
    return {
      ok: false,
      status: 0,
      error: timedOut ? 'المزوّد ما ردّش في الوقت المحدّد' : 'ما قدرناش نوصل للمزوّد',
    }
  }

  const text = await res.text()

  let data: unknown = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    // بعض المزوّدين (فوري) بيرجّعوا الرابط نصًّا خامًا لا JSON
    data = text
  }

  if (!res.ok) {
    return { ok: false, status: res.status, error: errorFrom(data, res.status), data }
  }

  return { ok: true, status: res.status, data: data as T }
}

/**
 * رسالة الخطأ من رد المزوّد.
 *
 * بندوّر على الحقول اللي بيستخدموها فعلًا قبل ما نقع على «خطأ 400»:
 * التاجر اللي بيقرا «Integration ID غير صحيح» بيصلّحه في دقيقة،
 * واللي بيقرا رقم حالة بيبعتلنا رسالة ويستنى يومين.
 */
function errorFrom(data: unknown, status: number): string {
  if (typeof data === 'string' && data.trim()) return data.slice(0, 300)

  if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>
    const candidates = [
      o.message,
      o.Message,
      o.error_description,
      o.detail,
      o.statusDescription,
      (o.error as Record<string, unknown> | undefined)?.message,
      (o.error as Record<string, unknown> | undefined)?.description,
      Array.isArray(o.errors) ? JSON.stringify(o.errors) : undefined,
      typeof o.errors === 'object' ? JSON.stringify(o.errors) : undefined,
      typeof o.error === 'string' ? o.error : undefined,
    ]
    for (const c of candidates) {
      if (typeof c === 'string' && c.trim()) return c.slice(0, 300)
    }
  }

  return `المزوّد رفض الطلب (${status})`
}

/** المبلغ بالوحدة الكبرى — أغلب البوابات بتطلبه كده لا بالقرش */
export function toMajor(minor: number): string {
  return (minor / 100).toFixed(2)
}

/** يفصل الاسم لأول وآخر — شركات الشحن بتطلبهم منفصلين */
export function splitName(full: string | null): { first: string; last: string } {
  const parts = (full ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first: 'عميل', last: '-' }
  if (parts.length === 1) return { first: parts[0], last: '-' }
  return { first: parts[0], last: parts.slice(1).join(' ') }
}

/** رقم بصيغة دولية من غير علامة زائد — أغلب المزوّدين بيرفضوا الـ+ */
export function digits(phone: string | null): string {
  return (phone ?? '').replace(/\D/g, '')
}
