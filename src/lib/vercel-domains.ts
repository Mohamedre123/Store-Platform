import 'server-only'
import { isApexDomain } from './custom-domain'

/**
 * تسجيل نطاق التاجر على مشروع Vercel.
 *
 * ## المشكلة اللي بيحلّها
 * كنا بنطلب من التاجر يوجّه نطاقه لسيرفراتنا، وبنقرا الـDNS ونقول
 * «تمام، شغّال». والـDNS كان بيبقى مضبوط فعلًا — بس **Vercel نفسه
 * ما كانش يعرف إن النطاق ده تبع مشروعنا**. فالزائر بيوصل لسيرفرات
 * Vercel، وVercel يبص في قايمة نطاقاته ما يلاقيهوش، فيرد
 * `DEPLOYMENT_NOT_FOUND` — نطاق موجّه صح وواقف على 404.
 *
 * توجيه الـDNS نص الحكاية بس. النص التاني إن النطاق يتسجّل على
 * المشروع، وده اللي بيخلّي Vercel يوجّه الطلب **ويصدر شهادة SSL**.
 * من غيره حتى https مش هيشتغل.
 *
 * ## متغيّرات البيئة
 * `VERCEL_API_TOKEN` و`VERCEL_PROJECT_ID` (و`VERCEL_TEAM_ID` لو
 * المشروع تحت فريق). من غيرهم الدوال دي بترجّع سبب واضح بالعربي بدل
 * ما تسكت — التاجر لازم يعرف إن الربط ما تمّش وليه.
 */

const API = 'https://api.vercel.com'

function token(): string | null {
  return process.env.VERCEL_API_TOKEN?.trim() || null
}

/**
 * معرّف المشروع.
 *
 * Vercel بيحقن `VERCEL_PROJECT_ID` لوحده في بيئة النشر لما تكون
 * «متغيّرات النظام» مفعّلة، فالغالب إنه موجود من غير ما حد يضيفه.
 * وسيبنا الضبط اليدوي كبديل عشان البيئات اللي مش مفعّلة فيها.
 */
function projectId(): string | null {
  return (process.env.VERCEL_PROJECT_ID || process.env.VERCEL_PROJECT || '').trim() || null
}

function query(extra = ''): string {
  const team = process.env.VERCEL_TEAM_ID?.trim()
  const parts = [team ? `teamId=${encodeURIComponent(team)}` : '', extra].filter(Boolean)
  return parts.length ? `?${parts.join('&')}` : ''
}

/** الربط التلقائي متاح؟ لو لأ، الرسالة بتقول الناقص إيه بالظبط */
export function vercelDomainsReady(): { ok: true } | { ok: false; reason: string } {
  if (!token()) return { ok: false, reason: 'VERCEL_API_TOKEN مش مضبوط في متغيّرات البيئة' }
  if (!projectId()) return { ok: false, reason: 'VERCEL_PROJECT_ID مش مضبوط في متغيّرات البيئة' }
  return { ok: true }
}

type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string }

async function api<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  const key = token()
  if (!key) return { ok: false, status: 0, error: 'VERCEL_API_TOKEN مش مضبوط' }

  try {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    })

    const body = await res.text()

    if (!res.ok) {
      let message = body.slice(0, 300)
      let code = ''
      try {
        const parsed = JSON.parse(body) as { error?: { message?: string; code?: string } }
        message = parsed.error?.message ?? message
        code = parsed.error?.code ?? ''
      } catch {
        /* الرد مش JSON — بنسيب النص زي ما هو */
      }
      console.error('Vercel domains:', res.status, code, message)
      return { ok: false, status: res.status, error: code || message }
    }

    return { ok: true, data: (body ? JSON.parse(body) : {}) as T }
  } catch (e) {
    const error = e instanceof Error ? e.message : 'فشل الاتصال بـVercel'
    console.error('Vercel domains:', error)
    return { ok: false, status: 0, error }
  }
}

export type DomainStatus = {
  /** النطاق متسجّل على المشروع؟ */
  registered: boolean
  /** Vercel أكّد ملكيته؟ (بيبقى false لو محتاج سجل تحقق منه هو) */
  verified: boolean
  /** تحديات التحقق اللي Vercel طالبها — نادرًا بتظهر للنطاقات الجديدة */
  challenges: Array<{ type: string; domain: string; value: string }>
  /** سبب الفشل لو في — بيتعرض للتاجر */
  error: string | null
}

const NOT_READY = (reason: string): DomainStatus => ({
  registered: false,
  verified: false,
  challenges: [],
  error: reason,
})

type VercelDomain = {
  name: string
  verified?: boolean
  verification?: Array<{ type: string; domain: string; value: string; reason?: string }>
}

/**
 * بيسجّل النطاق على المشروع، وبيرجّع حالته الحقيقية.
 *
 * **بيعتبر «موجود قبل كده» نجاحًا.** التاجر بيدوس «تحقّق» أكتر من
 * مرة، والمحاولة التانية بترجّع 409 — ولو حسبناها فشلًا كان هيشوف
 * خطأ على نطاق شغّال تمامًا.
 */
export async function registerDomain(domain: string): Promise<DomainStatus> {
  const ready = vercelDomainsReady()
  if (!ready.ok) return NOT_READY(ready.reason)

  const id = projectId()!
  const added = await api<VercelDomain>(`/v10/projects/${encodeURIComponent(id)}/domains${query()}`, {
    method: 'POST',
    body: JSON.stringify({ name: domain }),
  })

  if (!added.ok) {
    const taken = added.status === 409 || /already|exists|conflict/i.test(added.error)
    if (!taken) {
      /*
        النطاق مربوط بمشروع أو حساب تاني على Vercel هو أشهر سبب
        فشل هنا، ورسالة Vercel الإنجليزية ما بتقولهاش لتاجر مصري.
      */
      const friendly = /domain_already_in_use|is already in use/i.test(added.error)
        ? 'النطاق ده مربوط بمشروع تاني على Vercel — شيله من هناك الأول.'
        : `Vercel رفض الربط: ${added.error}`
      return NOT_READY(friendly)
    }
  }

  /*
    www مع النطاق الجذر.

    تعليماتنا بتطلب من التاجر يضيف CNAME لـwww، فلو ما سجّلناهوش
    على المشروع بيبقى عندنا سجل DNS موجّه لنطاق مش متسجّل —
    يعني نفس الـ404 بالظبط، بس على www بس. والزائر اللي بيكتب
    www.متجره من عادته مش هيفهم إن ده «نطاق تاني».

    بيتسجّل كتحويل للجذر عشان يبقى عنوان واحد لا اتنين — أحسن
    للأرشفة وللروابط اللي بيتشاركها.
  */
  if (isApexDomain(domain)) {
    await api(`/v10/projects/${encodeURIComponent(id)}/domains${query()}`, {
      method: 'POST',
      body: JSON.stringify({ name: `www.${domain}`, redirect: domain }),
    })
  }

  return statusOf(domain)
}

/** حالة النطاق على المشروع من غير ما نضيف حاجة */
export async function statusOf(domain: string): Promise<DomainStatus> {
  const ready = vercelDomainsReady()
  if (!ready.ok) return NOT_READY(ready.reason)

  const id = projectId()!
  const res = await api<VercelDomain>(
    `/v9/projects/${encodeURIComponent(id)}/domains/${encodeURIComponent(domain)}${query()}`,
  )

  if (!res.ok) {
    if (res.status === 404) {
      return { registered: false, verified: false, challenges: [], error: null }
    }
    return NOT_READY(`Vercel: ${res.error}`)
  }

  return {
    registered: true,
    verified: res.data.verified !== false,
    challenges: (res.data.verification ?? []).map((v) => ({
      type: v.type,
      domain: v.domain,
      value: v.value,
    })),
    error: null,
  }
}

/**
 * بيشيل النطاق من المشروع.
 *
 * بيسكت لو مش موجود أو لو المفاتيح ناقصة: التاجر بيشيل الربط عشان
 * يخلص منه، ورسالة خطأ عن مفتاح API في وشّه ساعتها بتوقّفه عند
 * حاجة مالهاش حل عنده.
 */
export async function unregisterDomain(domain: string): Promise<void> {
  if (!vercelDomainsReady().ok) return

  const id = projectId()!
  const drop = (name: string) =>
    api(`/v9/projects/${encodeURIComponent(id)}/domains/${encodeURIComponent(name)}${query()}`, {
      method: 'DELETE',
    })

  await drop(domain)
  /* وwww معاه — اتسجّل مع الجذر فبيتشال معاه */
  if (isApexDomain(domain)) await drop(`www.${domain}`)
}
