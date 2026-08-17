import 'server-only'
import { ROOT_DOMAIN } from './domain'

/**
 * ربط نطاق التاجر الخاص بمتجره.
 *
 * الفكرة: التاجر بيوجّه نطاقه لسيرفراتنا بسجل DNS، وإحنا بنتأكد
 * إن السجل اتضبط فعلًا قبل ما نفعّل الربط — عشان ما يبقاش عندنا
 * نطاقات مربوطة على الورق ومش شغالة.
 *
 * التحقق بيتم بقراءة الـDNS العام لا بزيارة الموقع: لو زُرنا الموقع
 * ممكن نلاقيه شغال من استضافته القديمة ونظن إن الربط نجح.
 */

/** السجلات اللي التاجر لازم يضيفها في لوحة نطاقه */
export type DnsRecord = {
  type: 'A' | 'CNAME' | 'TXT'
  host: string
  value: string
  note: string
}

/** IP سيرفراتنا للنطاقات الجذرية — النطاق الجذر لا يقبل CNAME */
const APEX_IP = process.env.PLATFORM_APEX_IP || '216.198.79.1'
const CNAME_TARGET = process.env.PLATFORM_CNAME || 'cname.vercel-dns.com'

export function isApexDomain(domain: string): boolean {
  // نطاق جذري = جزأين فقط (example.com)، وأي زيادة تعني نطاقًا فرعيًا
  const parts = domain.split('.').filter(Boolean)
  if (parts.length <= 2) return true
  // نطاقات مثل example.com.eg جذرية أيضًا
  const twoPartTlds = ['com.eg', 'net.eg', 'org.eg', 'com.sa', 'com.kw', 'co.uk']
  return parts.length === 3 && twoPartTlds.includes(parts.slice(-2).join('.'))
}

export function dnsRecordsFor(domain: string, token: string): DnsRecord[] {
  const apex = isApexDomain(domain)

  const records: DnsRecord[] = apex
    ? [
        {
          type: 'A',
          host: '@',
          value: APEX_IP,
          note: 'النطاق الأساسي. لو فيه سجل A قديم امسحه — ما ينفعش اتنين.',
        },
        {
          type: 'CNAME',
          host: 'www',
          value: CNAME_TARGET,
          note: 'عشان النطاق يشتغل مع www وبدونها.',
        },
      ]
    : [
        {
          type: 'CNAME',
          host: domain.split('.')[0],
          value: CNAME_TARGET,
          note: 'النطاق الفرعي بيتوجّه لسيرفراتنا.',
        },
      ]

  records.push({
    type: 'TXT',
    host: `_zawya-verify${apex ? '' : '.' + domain.split('.')[0]}`,
    value: token,
    note: 'يثبت إنك صاحب النطاق. تقدر تمسحه بعد ما الربط يتفعّل.',
  })

  return records
}

export type DomainCheck = {
  ownershipVerified: boolean
  pointingCorrectly: boolean
  found: { txt: string[]; target: string[] }
  message: string
}

/**
 * قراءة سجلات DNS عبر DNS-over-HTTPS.
 * بنستخدم Cloudflare لأنه متاح من بيئات التشغيل بلا مكتبات نظام.
 */
async function resolve(name: string, type: 'A' | 'CNAME' | 'TXT'): Promise<string[]> {
  try {
    const res = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
      { headers: { accept: 'application/dns-json' }, cache: 'no-store' },
    )
    if (!res.ok) return []
    const data = (await res.json()) as { Answer?: Array<{ data: string; type: number }> }
    return (data.Answer ?? []).map((a) => a.data.replace(/^"|"$/g, '').replace(/\.$/, ''))
  } catch {
    return []
  }
}

export async function checkDomain(domain: string, token: string): Promise<DomainCheck> {
  const apex = isApexDomain(domain)
  const sub = domain.split('.')[0]
  const txtHost = apex ? `_zawya-verify.${domain}` : `_zawya-verify.${sub}.${domain.split('.').slice(1).join('.')}`

  const [txt, a, cname] = await Promise.all([
    resolve(txtHost, 'TXT'),
    resolve(domain, 'A'),
    resolve(domain, 'CNAME'),
  ])

  const ownershipVerified = txt.some((t) => t.trim() === token)
  const pointingCorrectly = apex
    ? a.includes(APEX_IP)
    : cname.some((c) => c.includes('vercel-dns')) || a.includes(APEX_IP)

  let message: string
  if (ownershipVerified && pointingCorrectly) {
    message = 'النطاق متحقَّق منه وموجَّه صح. هيشتغل خلال دقايق بعد إصدار الشهادة.'
  } else if (!ownershipVerified && !pointingCorrectly) {
    message = 'لسه ما لقيناش السجلات. لو ضفتها للتو، انتظر — الانتشار بياخد من دقايق لساعات.'
  } else if (!ownershipVerified) {
    message = `التوجيه صح، بس سجل التحقق (TXT) لسه ما ظهرش على ${txtHost}.`
  } else {
    message = apex
      ? `التحقق تمّ، بس النطاق لسه مش مُوجَّه لـ${APEX_IP}. راجع سجل A.`
      : 'التحقق تمّ، بس النطاق لسه مش مُوجَّه لسيرفراتنا. راجع سجل CNAME.'
  }

  return { ownershipVerified, pointingCorrectly, found: { txt, target: [...a, ...cname] }, message }
}

/** تحقّق من صيغة النطاق ومنع نطاقاتنا نفسها */
export function validateDomain(input: string): { ok: true; domain: string } | { ok: false; error: string } {
  const domain = input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/\.$/, '')

  if (!domain) return { ok: false, error: 'اكتب النطاق' }
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(domain)) {
    return { ok: false, error: 'صيغة النطاق مش صحيحة. مثال: mystore.com' }
  }
  const root = ROOT_DOMAIN.split(':')[0].toLowerCase()
  if (domain === root || domain.endsWith(`.${root}`)) {
    return { ok: false, error: 'ده نطاق المنصة نفسه. اكتب نطاقك الخاص اللي اشتريته.' }
  }
  if (domain.endsWith('.vercel.app')) {
    return { ok: false, error: 'ما ينفعش تربط نطاق vercel.app' }
  }
  return { ok: true, domain }
}
