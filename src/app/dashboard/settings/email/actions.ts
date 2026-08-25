'use server'

import { revalidatePath } from 'next/cache'
import { Resolver } from 'node:dns/promises'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { stores } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { isEmailConfigured, safeReplyTo, sendEmail } from '@/lib/email'
import { customerCodeEmail } from '@/lib/store-emails'
import { getStoreTheme } from '@/lib/storefront'
import {
  refreshEmailDomain,
  removeEmailDomain,
  startEmailDomain,
  storeSenderAddress,
  type DnsRecord,
} from '@/lib/store-email-domain'

/**
 * تشخيص تسليم البريد.
 *
 * ## ليه صفحة كاملة مش سطر في الإعدادات
 * «الرسايل بتروح السبام» أكتر شكوى بتتقال، وأصعب واحدة تتشخّص —
 * لأن كل حاجة فيها **مخفية**: الترويسة اللي بتخرج، سجلات النطاق،
 * ونتيجة الفلتر. التاجر بيغيّر إعدادات على أمل إن حاجة تتحسّن، وإحنا
 * بنخمّن معاه.
 *
 * الصفحة دي بتوري اللي بيحصل فعلًا: العنوان اللي هيخرج بالظبط،
 * وسجلات DNS بحالتها الحقيقية دلوقتي، وزرار بيبعت رسالة تجريبية
 * لأي عنوان عشان يتأكد بنفسه.
 *
 * التخمين بيتحوّل لمعاينة.
 */

export type EmailDiagnostics = {
  configured: boolean
  /** العنوان اللي الرسالة هتخرج منه بالظبط */
  from: string
  replyTo: string | null
  replyToDropped: boolean
  ownDomain: {
    domain: string | null
    status: 'none' | 'pending' | 'verified' | 'failed'
    records: DnsRecord[]
  }
  /** سجلات النطاق اللي بيتبعت منه دلوقتي — من DNS مباشرةً */
  dns: Array<{ label: string; name: string; found: string | null }>
}

/** بيقرا سجل TXT/MX من خوادم عامة — مش من كاش النظام */
async function lookup(name: string, type: 'TXT' | 'MX'): Promise<string | null> {
  const r = new Resolver()
  r.setServers(['8.8.8.8', '1.1.1.1'])
  try {
    if (type === 'MX') {
      const rows = await r.resolveMx(name)
      return rows.map((m) => `${m.priority} ${m.exchange}`).join(' | ') || null
    }
    const rows = await r.resolveTxt(name)
    return rows.map((t) => t.join('')).join(' | ') || null
  } catch {
    return null
  }
}

export async function emailDiagnosticsAction(): Promise<EmailDiagnostics> {
  const { store } = await getDashboardContext()

  const [row] = await db
    .select({
      emailDomain: stores.emailDomain,
      emailDomainStatus: stores.emailDomainStatus,
      emailDnsRecords: stores.emailDnsRecords,
      email: stores.email,
      name: stores.name,
      slug: stores.slug,
    })
    .from(stores)
    .where(eq(stores.id, store.id))
    .limit(1)

  const own = await storeSenderAddress(store.id)

  /*
    نفس منطق `fromHeader` بالظبط — لو اتفرّقوا، الصفحة بتوري حاجة
    والرسالة بتخرج بحاجة تانية، وده أسوأ من غياب الصفحة أصلًا.
  */
  const configured = process.env.EMAIL_FROM ?? ''
  const base = configured.match(/<([^>]+)>/)?.[1] ?? configured.trim()
  const domain = base.split('@')[1] ?? ''
  const slug = (row?.slug ?? '').toLowerCase()
  const address = own
    ? own
    : /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/.test(slug) && domain
      ? `${slug}@${domain}`
      : base

  const from = `${row?.name ?? store.name} <${address}>`

  const sendingDomain = own ? (row?.emailDomain ?? domain) : domain

  const dns = await Promise.all([
    lookup(sendingDomain, 'TXT').then((found) => ({
      label: 'SPF على نطاق الإرسال',
      name: sendingDomain,
      found,
    })),
    lookup(`send.${sendingDomain}`, 'TXT').then((found) => ({
      label: 'SPF على نطاق البصمة',
      name: `send.${sendingDomain}`,
      found,
    })),
    lookup(`send.${sendingDomain}`, 'MX').then((found) => ({
      label: 'MX للملاحظات (ارتداد وشكاوى)',
      name: `send.${sendingDomain}`,
      found,
    })),
    lookup(`resend._domainkey.${sendingDomain}`, 'TXT').then((found) => ({
      label: 'DKIM (توقيع الرسالة)',
      name: `resend._domainkey.${sendingDomain}`,
      found: found ? `${found.slice(0, 40)}…` : null,
    })),
    lookup(`_dmarc.${sendingDomain}`, 'TXT').then((found) => ({
      label: 'DMARC (سياسة الحماية)',
      name: `_dmarc.${sendingDomain}`,
      found,
    })),
  ])

  const reply = safeReplyTo(row?.email)

  return {
    configured: isEmailConfigured(),
    from,
    replyTo: reply ?? null,
    /* بريد مجاني اتشال — التاجر لازم يعرف ليه مش موجود */
    replyToDropped: Boolean(row?.email) && !reply,
    ownDomain: {
      domain: row?.emailDomain ?? null,
      status: (row?.emailDomainStatus as EmailDiagnostics['ownDomain']['status']) ?? 'none',
      records: row?.emailDnsRecords ?? [],
    },
    dns,
  }
}

/**
 * اختبار مقارنة — تلات رسايل بتلات هويات مرسِل.
 *
 * ## ليه مقارنة مش رسالة واحدة
 * الترويسة أثبتت إن SPF وDKIM وDMARC كلهم بينجحوا، والرسالة بتروح
 * السبام برضو. يعني السبب مش في المصادقة — والباقي احتمالات إحنا
 * بنخمّنها. والتخمين في التسليم بيضيّع أسابيع.
 *
 * التلات رسايل بتخرج **في نفس اللحظة، لنفس العنوان، بنفس المحتوى**،
 * والفرق الوحيد بينهم هوية المرسِل. اللي هيوصل الوارد بيقول لنا
 * الجواب من غير أي اجتهاد:
 *
 * - **أ** — هوية المنصة: `زاوية <no-reply@نطاقنا>`
 *   دي اللي كانت شغّالة قبل ٢٤ أغسطس، لما اسم المتجر اتحطّ على الرسايل.
 * - **ب** — اسم المتجر على عنوان المنصة: `atlosa <no-reply@نطاقنا>`
 *   ده اللي اتعمل يوم ٢٤ وبدأت السبام بعده.
 * - **ج** — اسم المتجر على عنوانه: `atlosa <atlosa@نطاقنا>`
 *   ده الوضع الحالي.
 *
 * وكل رسالة بتقول رقمها في الموضوع عشان التاجر يعرف مين وصل فين.
 */
export type TestVariant = { key: 'a' | 'b' | 'c'; label: string; from: string; sent: boolean; error?: string }

export async function sendDeliveryTestAction(
  to: string,
): Promise<{ ok: boolean; message: string; variants: TestVariant[] }> {
  const { store } = await getDashboardContext()

  const address = to.trim().toLowerCase()
  if (!address.includes('@')) {
    return { ok: false, message: 'اكتب بريدًا صحيحًا', variants: [] }
  }

  const theme = await getStoreTheme(store.id)
  const own = await storeSenderAddress(store.id)

  const brand = {
    name: store.name,
    logo: store.logoLight,
    primary: theme.custom.identity.primary,
    slug: store.slug,
    email: store.email,
  }

  const configured = process.env.EMAIL_FROM ?? ''
  const base = configured.match(/<([^>]+)>/)?.[1] ?? configured.trim()
  const platformName = process.env.NEXT_PUBLIC_APP_NAME ?? 'زاوية'

  const setups: Array<{
    key: TestVariant['key']
    label: string
    from: string
    opts: { senderName?: string | null; senderSlug?: string | null; senderAddress?: string | null }
  }> = [
    {
      key: 'a',
      label: 'هوية المنصة (اللي كانت شغّالة قبل ٢٤ أغسطس)',
      from: configured,
      opts: {},
    },
    {
      key: 'b',
      label: 'اسم المتجر على عنوان المنصة',
      from: `${store.name} <${base}>`,
      opts: { senderName: store.name },
    },
    {
      key: 'c',
      label: 'اسم المتجر على عنوانه (الوضع الحالي)',
      from: `${store.name} <${own ?? `${store.slug}@${base.split('@')[1] ?? ''}`}>`,
      opts: { senderName: store.name, senderSlug: store.slug, senderAddress: own },
    },
  ]

  const variants: TestVariant[] = []

  for (const s of setups) {
    const mail = customerCodeEmail(brand, '123456', 10)
    const res = await sendEmail({
      to: address,
      ...mail,
      /* رقم التجربة في الموضوع — عشان يعرف مين وصل فين */
      subject: `[تجربة ${s.key.toUpperCase()}] ${mail.subject}`,
      ...s.opts,
      replyTo: safeReplyTo(store.email),
      log: { storeId: store.id, event: `delivery_test_${s.key}` },
    })

    variants.push({
      key: s.key,
      label: s.label,
      from: s.from,
      sent: res.ok,
      ...(res.ok ? {} : { error: res.error }),
    })
  }

  const okCount = variants.filter((v) => v.sent).length

  return {
    ok: okCount > 0,
    message:
      okCount === 0
        ? 'مفيش ولا رسالة اتبعتت — شوف الأخطاء تحت.'
        : 'اتبعتت تلات رسايل. افتح بريدك وشوف كل واحدة راحت الوارد ولا السبام، وقولّنا الحرف اللي وصل — هنخلّي الإعداد بتاعه هو الافتراضي.',
    variants,
  }
}

/* ────────────────────── نطاق المتجر ────────────────────── */

export async function startEmailDomainAction(): Promise<
  { ok: true; records: DnsRecord[]; domain: string } | { ok: false; error: string }
> {
  const { store } = await getDashboardContext()

  if (!store.customDomain) {
    return {
      ok: false,
      error: 'اربط نطاقك للمتجر الأول من صفحة النطاق، وبعدين فعّل البريد عليه.',
    }
  }

  const res = await startEmailDomain(store.id, store.customDomain)
  if (!res.ok) return { ok: false, error: res.error }

  revalidatePath('/dashboard/settings/email')
  return { ok: true, records: res.state.records, domain: res.state.domain ?? '' }
}

export async function verifyEmailDomainAction(): Promise<
  { ok: true; status: string; records: DnsRecord[] } | { ok: false; error: string }
> {
  const { store } = await getDashboardContext()
  const res = await refreshEmailDomain(store.id)
  if (!res.ok) return { ok: false, error: res.error }

  revalidatePath('/dashboard/settings/email')
  return { ok: true, status: res.state.status, records: res.state.records }
}

export async function removeEmailDomainAction(): Promise<{ ok: boolean }> {
  const { store } = await getDashboardContext()
  await removeEmailDomain(store.id)
  revalidatePath('/dashboard/settings/email')
  return { ok: true }
}
