import 'server-only'
import type { DnsRecord } from '@/lib/store-email-domain'

/**
 * سجلات DNS لنطاق المنصة — بتتكتب لوحدها.
 *
 * ## المشكلة
 * كل متجر بياخد نطاق إرسال خاص بيه (`atlosa.zawyaeg.site`)، والمزوّد
 * بيطلب سجلات توقيع لكل نطاق على حدة. لو سبنا التاجر يضيفها بإيده،
 * إحنا رجّعنا خطوة إعداد فنية لواحد جاي يفتح متجر — وأغلبهم مش
 * هيعملوها، فرسايلهم هتفضل خارجة من نطاق المنصة العام.
 *
 * ## الحل
 * نطاق المنصة نفسه على Vercel DNS، يعني **إحنا** مالكين المنطقة.
 * فبدل ما نطلب من التاجر يضيف، بنضيف إحنا بالـAPI: المتجر بيتسجّل،
 * السجلات بتتكتب، والتوثيق بيخلص في ثواني — والتاجر ما شافش حاجة.
 *
 * محتاج `VERCEL_API_TOKEN` (و`VERCEL_TEAM_ID` لو النطاق تحت فريق).
 * من غيرهم الدالة بتسكت والإرسال بيرجع لنطاق المنصة العام — مفيش
 * كسر، بس مفيش عزل سمعة.
 */

const API = 'https://api.vercel.com'

function token(): string | null {
  return process.env.VERCEL_API_TOKEN?.trim() || null
}

/** نطاق المنصة الجذر — المنطقة اللي بنكتب فيها */
export function platformRoot(): string | null {
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim().toLowerCase()
  return root && !root.startsWith('localhost') ? root : null
}

/** بيقول هل الكتابة التلقائية شغّالة أصلًا */
export function platformDnsReady(): boolean {
  return Boolean(token() && platformRoot())
}

function query(): string {
  const team = process.env.VERCEL_TEAM_ID?.trim()
  return team ? `?teamId=${encodeURIComponent(team)}` : ''
}

async function api<T>(path: string, init?: RequestInit): Promise<T | null> {
  const key = token()
  if (!key) return null

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
      /*
        سجل موجود قبل كده بيرجّع خطأ — ودي مش مشكلة، ده اللي احنا
        عايزينه أصلًا. باقي الأخطاء بتتسجّل عشان نشوفها في اللوج.
      */
      if (!/already exists|conflict/i.test(body)) {
        console.error('Vercel DNS:', res.status, body.slice(0, 200))
      }
      return null
    }

    return JSON.parse(body) as T
  } catch (e) {
    console.error('Vercel DNS:', e instanceof Error ? e.message : e)
    return null
  }
}

/**
 * بيحوّل اسم السجل لاسم نسبي للمنطقة.
 *
 * المزوّد بيرجّع الاسم كامل مرة («send.atlosa.zawyaeg.site») وجزئي
 * مرة («resend._domainkey»). Vercel بياخد النسبي بس، فلازم نتعامل
 * مع الشكلين — غير كده السجل بيتكتب في مكان غلط ويفضل التوثيق
 * معلّق للأبد من غير ما حد يعرف ليه.
 */
function relativeName(name: string, sendingDomain: string, root: string): string {
  const n = name.trim().toLowerCase().replace(/\.$/, '')
  const sub = sendingDomain.endsWith(`.${root}`)
    ? sendingDomain.slice(0, -(root.length + 1))
    : ''

  if (!n || n === '@') return sub
  if (n === root) return ''
  if (n.endsWith(`.${root}`)) return n.slice(0, -(root.length + 1))
  return sub ? `${n}.${sub}` : n
}

type VercelRecord = { id: string; name: string; type: string; value: string }

/**
 * بيكتب سجلات المزوّد في منطقة المنصة.
 *
 * بيقرا الموجود الأول ويتخطّى المتطابق: الاستدعاء بيتكرّر (كل مرة
 * التاجر يفتح صفحته)، ومن غير الفحص ده المنطقة بتمتلي نسخ مكرّرة —
 * وسجل SPF مكرّر بيبطّل الـSPF كله.
 *
 * بيرجّع عدد السجلات اللي اتكتبت دلوقتي.
 */
export async function ensurePlatformDns(
  sendingDomain: string,
  records: DnsRecord[],
): Promise<number> {
  const root = platformRoot()
  if (!root || !token()) return 0

  /* نطاق التاجر الخاص مش منطقتنا — مش بنكتب فيها */
  if (sendingDomain !== root && !sendingDomain.endsWith(`.${root}`)) return 0

  const list = await api<{ records: VercelRecord[] }>(
    `/v4/domains/${encodeURIComponent(root)}/records${query() ? `${query()}&limit=200` : '?limit=200'}`,
  )
  if (!list) return 0

  const existing = new Set(
    list.records.map((r) => `${r.type.toUpperCase()}|${r.name.toLowerCase()}|${strip(r.value)}`),
  )

  let written = 0
  for (const rec of records) {
    const name = relativeName(rec.name, sendingDomain, root)
    const type = rec.type.toUpperCase()
    const key = `${type}|${name}|${strip(rec.value)}`
    if (existing.has(key)) continue

    const res = await api<{ uid: string }>(
      `/v2/domains/${encodeURIComponent(root)}/records${query()}`,
      {
        method: 'POST',
        body: JSON.stringify({
          name,
          type,
          value: rec.value,
          ttl: 60,
          ...(rec.priority !== undefined ? { mxPriority: rec.priority } : {}),
        }),
      },
    )
    if (res) written++
  }

  return written
}

/** قيمة TXT بتيجي بعلامات تنصيص أحيانًا — المقارنة لازم تتجاهلها */
function strip(value: string): string {
  return value.trim().replace(/^"|"$/g, '').toLowerCase()
}
