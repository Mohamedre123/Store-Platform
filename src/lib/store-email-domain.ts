import 'server-only'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { stores } from '@/db/schema'

/**
 * نطاق بريد المتجر — التاجر بيبعت من نطاقه هو.
 *
 * ## المشكلة اللي بيحلّها
 * كل رسايل المتاجر كانت بتخرج من نطاق المنصة. وده بيكسر حاجتين:
 *
 * ١. **السمعة مشتركة.** جيميل بيقيّم النطاق، فتاجر واحد عملاؤه
 *    بيبلّغوا سبام بيأذي كل تاجر تاني على المنصة. ومحدّش يقدر
 *    يصلّح سمعة مش بتاعته.
 * ٢. **الاسم بيناقض العنوان.** رسالة باسم «متجر س» جاية من نطاق
 *    «زاوية» بتبان انتحال هوية — وده بالظبط اللي كان بيوديها السبام.
 *
 * لما التاجر يوثّق نطاقه، الاسم والعنوان والعلامة بيبقوا بتوعه، وهو
 * بيبني سمعته هو.
 *
 * ## نطاق فرعي `mail.` لا الجذر
 * التاجر ممكن يكون عنده بريد شغّال على نطاقه (Google Workspace
 * مثلًا). التوثيق على الجذر بيحطّ سجل MX ممكن يتعارض مع بريده —
 * والنطاق الفرعي بيعزل الإرسال تمامًا عن بريده الشخصي.
 *
 * ## المفتاح بتاعنا لا بتاع التاجر
 * التاجر بيوثّق نطاقه عندنا؛ الإرسال بيفضل بحساب المنصة. لو خلّيناه
 * يحطّ مفتاح مزوّد بنفسه، كل تاجر هيحتاج حساب ويدفع اشتراك — ودي
 * حاجز دخول مالوش لازمة لتاجر لسه بيبدأ.
 */

const API = 'https://api.resend.com'

export type DnsRecord = {
  type: string
  name: string
  value: string
  priority?: number
  status?: string
}

export type DomainState = {
  domain: string | null
  status: 'none' | 'pending' | 'verified' | 'failed'
  records: DnsRecord[]
  verifiedAt: Date | null
}

function key(): string | null {
  return process.env.RESEND_API_KEY || null
}

/** «mail.example.com» من «example.com» أو من «www.example.com» */
export function mailSubdomain(customDomain: string): string {
  const clean = customDomain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '')
  return `mail.${clean}`
}

type ResendDomain = {
  id: string
  name: string
  status: string
  records?: Array<{
    record: string
    name: string
    type: string
    value: string
    priority?: number
    status?: string
  }>
}

/**
 * بيحوّل رد المزوّد لسجلات التاجر بيلزقها زي ما هي.
 *
 * المزوّد بيرجّع الاسم كامل أحيانًا («mail.example.com») وأحيانًا
 * جزئي («resend._domainkey»). بنسيبه زي ما هو: أي «تصحيح» من عندنا
 * بيخلّي التاجر يلزق قيمة غلط ويقعد يدوّر ليه التحقق مش بينجح.
 */
function toRecords(d: ResendDomain): DnsRecord[] {
  return (d.records ?? []).map((r) => ({
    type: r.type,
    name: r.name,
    value: r.value,
    ...(r.priority !== undefined ? { priority: r.priority } : {}),
    ...(r.status ? { status: r.status } : {}),
  }))
}

async function call(
  path: string,
  init?: RequestInit,
): Promise<{ ok: true; data: ResendDomain } | { ok: false; error: string }> {
  const apiKey = key()
  if (!apiKey) return { ok: false, error: 'خدمة البريد مش مضبوطة على المنصة' }

  try {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(20_000),
    })

    const body = await res.text()
    if (!res.ok) {
      /*
        نص المزوّد بيتقال زي ما هو: هو اللي بيفرّق بين «النطاق
        مسجّل قبل كده» و«الاسم غلط» — وكل واحدة ليها تصرّف مختلف.
      */
      let reason = body.slice(0, 200)
      try {
        reason = (JSON.parse(body) as { message?: string }).message ?? reason
      } catch {}
      return { ok: false, error: reason }
    }

    return { ok: true, data: JSON.parse(body) as ResendDomain }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'فشل الاتصال بخدمة البريد' }
  }
}

/**
 * بيبدأ توثيق نطاق المتجر ويرجّع السجلات اللي التاجر يضيفها.
 *
 * النطاق بيتسجّل عند المزوّد أول مرة بس؛ لو اتسجّل قبل كده بنقرا
 * حالته بدل ما نعمل واحدًا تاني — التكرار بيخلّي التاجر يشوف سجلات
 * جديدة كل مرة يفتح الصفحة، ويفضل يضيف ويشيل.
 */
export async function startEmailDomain(
  storeId: string,
  customDomain: string,
): Promise<{ ok: true; state: DomainState } | { ok: false; error: string }> {
  const domain = mailSubdomain(customDomain)

  const [store] = await db
    .select({ id: stores.id, emailDomainId: stores.emailDomainId, emailDomain: stores.emailDomain })
    .from(stores)
    .where(eq(stores.id, storeId))
    .limit(1)

  if (!store) return { ok: false, error: 'المتجر مش موجود' }

  /* نفس النطاق ومسجّل خلاص — بنقرا حالته بس */
  if (store.emailDomainId && store.emailDomain === domain) {
    return refreshEmailDomain(storeId)
  }

  const res = await call('/domains', {
    method: 'POST',
    /*
      المنطقة الأوروبية: أقرب سيرفر لمصر والخليج، والتأخير في
      الإرسال بيفرق في رمز الدخول بالذات — العميل قاعد مستنّيه.
    */
    body: JSON.stringify({ name: domain, region: 'eu-west-1' }),
  })

  if (!res.ok) return { ok: false, error: res.error }

  const records = toRecords(res.data)

  await db
    .update(stores)
    .set({
      emailDomain: domain,
      emailDomainId: res.data.id,
      emailDomainStatus: 'pending',
      emailDnsRecords: records,
      emailDomainVerifiedAt: null,
    })
    .where(eq(stores.id, storeId))

  return {
    ok: true,
    state: { domain, status: 'pending', records, verifiedAt: null },
  }
}

/**
 * بيسأل المزوّد عن حالة التحقق ويحدّثها.
 *
 * بيتنادى لما التاجر يدوس «تحقّق دلوقتي». **مش بيتنادى تلقائيًا مع
 * كل صفحة**: انتشار سجلات DNS بياخد دقايق لساعات، والسؤال المتكرر
 * بيستهلك حصّة المزوّد على حاجة ما اتغيّرتش.
 */
export async function refreshEmailDomain(
  storeId: string,
): Promise<{ ok: true; state: DomainState } | { ok: false; error: string }> {
  const [store] = await db
    .select({ id: stores.id, emailDomain: stores.emailDomain, emailDomainId: stores.emailDomainId })
    .from(stores)
    .where(eq(stores.id, storeId))
    .limit(1)

  if (!store?.emailDomainId) return { ok: false, error: 'مفيش نطاق بريد مسجّل' }

  /* الطلب ده بيخلّي المزوّد يعيد فحص السجلات دلوقتي */
  await call(`/domains/${store.emailDomainId}/verify`, { method: 'POST' })

  const res = await call(`/domains/${store.emailDomainId}`)
  if (!res.ok) return { ok: false, error: res.error }

  const verified = res.data.status === 'verified'
  const records = toRecords(res.data)

  await db
    .update(stores)
    .set({
      emailDomainStatus: verified ? 'verified' : res.data.status === 'failed' ? 'failed' : 'pending',
      emailDnsRecords: records,
      emailDomainVerifiedAt: verified ? new Date() : null,
    })
    .where(eq(stores.id, storeId))

  return {
    ok: true,
    state: {
      domain: store.emailDomain,
      status: verified ? 'verified' : res.data.status === 'failed' ? 'failed' : 'pending',
      records,
      verifiedAt: verified ? new Date() : null,
    },
  }
}

/** بيفصل نطاق البريد — الرسايل بترجع لنطاق المنصة */
export async function removeEmailDomain(storeId: string): Promise<void> {
  const [store] = await db
    .select({ emailDomainId: stores.emailDomainId })
    .from(stores)
    .where(eq(stores.id, storeId))
    .limit(1)

  if (store?.emailDomainId) {
    await call(`/domains/${store.emailDomainId}`, { method: 'DELETE' })
  }

  await db
    .update(stores)
    .set({
      emailDomain: null,
      emailDomainId: null,
      emailDomainStatus: null,
      emailDnsRecords: null,
      emailDomainVerifiedAt: null,
    })
    .where(eq(stores.id, storeId))
}

/**
 * بيحاول يوثّق النطاق لوحده لو لسه معلّق.
 *
 * **التاجر ما يصحّش يدوس زرار «تحقّق».** هو ضاف السجلات خلاص؛
 * الانتشار بياخد وقت، وإحنا اللي المفروض نشوف امتى خلص. الدالة دي
 * بتتنادى في الخلفية لما يفتح لوحته، وبتسكت لو مفيش حاجة تتعمل.
 *
 * بتتخطّى نفسها لو النطاق موثّق خلاص أو لسه ما اتسجّلش — عشان ما
 * نستهلكش حصّة المزوّد على حاجة ما اتغيّرتش.
 */
export async function autoVerifyEmailDomain(storeId: string): Promise<void> {
  const [store] = await db
    .select({ id: stores.emailDomainId, status: stores.emailDomainStatus })
    .from(stores)
    .where(eq(stores.id, storeId))
    .limit(1)

  if (!store?.id || store.status === 'verified') return

  try {
    await refreshEmailDomain(storeId)
  } catch (e) {
    console.error('فشل التحقق التلقائي من نطاق البريد:', e)
  }
}

/**
 * عنوان الإرسال بتاع المتجر — لو نطاقه موثّق.
 *
 * بيرجّع `null` لو لسه ما وثّقش، والإرسال بيرجع لنطاق المنصة.
 * **الفحص على `verified` لا على وجود النطاق**: الإرسال من نطاق
 * لسه ما اتوثّقش بيترفض من المزوّد، والرسالة بتضيع بدل ما توصل
 * من نطاقنا.
 */
export async function storeSenderAddress(storeId: string): Promise<string | null> {
  const [store] = await db
    .select({
      domain: stores.emailDomain,
      status: stores.emailDomainStatus,
    })
    .from(stores)
    .where(and(eq(stores.id, storeId)))
    .limit(1)

  if (!store?.domain || store.status !== 'verified') return null
  return `no-reply@${store.domain}`
}
