'use server'

import { revalidatePath } from 'next/cache'
import { Resolver } from 'node:dns/promises'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { stores } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { isEmailConfigured, safeReplyTo, sendEmail } from '@/lib/email'
import {
  abandonedCartEmail,
  customerCodeEmail,
  merchantMessageEmail,
  newOrderNotificationEmail,
  orderInvoiceEmail,
  orderStatusEmail,
} from '@/lib/store-emails'
import { publicStoreUrl } from '@/lib/domain'
import { getStoreTheme } from '@/lib/storefront'
import { lastDnsError, platformDnsReady } from '@/lib/platform-dns'
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
  /**
   * حالة التوثيق التلقائي.
   *
   * من غير السطر ده، «النطاق لسه معلّق» بيبقى طريقًا مسدودًا: مفيش
   * وسيلة تعرف مفتاح ناقص من نطاق تحت فريق تاني من صلاحية غلط،
   * والتلاتة علاجهم مختلف تمامًا.
   */
  autoDns: { ready: boolean; error: string | null }
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
  const rootDomain = base.split('@')[1] ?? ''

  /* نفس منطق `fromHeader` بالظبط — عنوان مجرّد بلا اسم ظاهر */
  const from = own || (rootDomain ? `info@${rootDomain}` : base)
  const sendingDomain = own ? (row?.emailDomain ?? rootDomain) : rootDomain

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
    autoDns: { ready: platformDnsReady(), error: lastDnsError() },
  }
}

/**
 * رسالة تجريبية بنفس مسار رسايل العملاء بالظبط.
 *
 * **نفس القالب ونفس الترويسات** — رسالة اختبار بمسار مختلف بتوصل
 * الوارد وتخلّي التاجر يفتكر إن المشكلة اتحلّت، وهي لسه مكانها.
 */
export async function sendDeliveryTestAction(
  to: string,
): Promise<{ ok: boolean; message: string; from: string }> {
  const { store } = await getDashboardContext()

  const address = to.trim().toLowerCase()
  if (!address.includes('@')) return { ok: false, message: 'اكتب بريدًا صحيحًا', from: '' }

  const theme = await getStoreTheme(store.id)
  const own = await storeSenderAddress(store.id)

  const mail = customerCodeEmail(
    {
      name: store.name,
      logo: store.logoLight,
      primary: theme.custom.identity.primary,
      slug: store.slug,
      email: store.email,
    },
    '123456',
    10,
  )

  const res = await sendEmail({
    to: address,
    ...mail,
    senderAddress: own,
    replyTo: safeReplyTo(store.email),
    log: { storeId: store.id, event: 'delivery_test' },
  })

  const diag = await emailDiagnosticsAction()

  return res.ok
    ? {
        ok: true,
        message: 'اتبعتت. شوف الوارد والسبام — ولو لقيتها في السبام دوس «ليست غير مرغوب فيها».',
        from: diag.from,
      }
    : { ok: false, message: `المزوّد رفض: ${res.error}`, from: diag.from }
}

/**
 * تجربة كل رسالة في المنصة مرة واحدة.
 *
 * ## ليه الكل مش واحدة
 * «الميل بيروح السبام» مش حالة واحدة. رمز الدخول ممكن يوصل والفاتورة
 * تروح السبام، أو العكس — وده حصل فعلًا. اختبار رسالة واحدة بيدّي
 * إجابة عن رسالة واحدة، وإحنا بنستنتج منها على الباقي غلط.
 *
 * الدالة دي بتبعت **كل** قالب: الرمز، الفاتورة بمرفقها، الست حالات
 * للطلب، السلة المتروكة، إشعار التاجر، ورسالة التاجر اليدوية. تفتح
 * الوارد والسبام مرة واحدة وتشوف كل واحدة راحت فين.
 *
 * ## المهلة بين الرسايل
 * المزوّد بيقبل رسالتين في الثانية. من غير المهلة نص القايمة بترجع
 * ٤٢٩ وتتحسب «فشلت» وهي ما اتبعتتش أصلًا.
 */
export async function sendFullSuiteAction(
  to: string,
): Promise<{ ok: boolean; from: string; results: Array<{ label: string; ok: boolean; note: string }> }> {
  const { store } = await getDashboardContext()

  const address = to.trim().toLowerCase()
  const diag = await emailDiagnosticsAction()
  if (!address.includes('@')) return { ok: false, from: diag.from, results: [] }

  const theme = await getStoreTheme(store.id)
  const own = await storeSenderAddress(store.id)
  const brand = {
    name: store.name,
    logo: store.logoLight,
    primary: theme.custom.identity.primary,
    slug: store.slug,
    email: store.email,
  }

  const home = publicStoreUrl({ slug: store.slug })
  const trackUrl = `${home}/order/1001`
  const order = {
    orderNumber: 1001,
    customerName: 'عميل تجريبي',
    lines: [{ name: 'منتج تجريبي', quantity: 1, total: 250, options: [{ name: 'المقاس', value: 'L' }] }],
    subtotal: 250,
    shipping: 40,
    discount: 0,
    total: 290,
    currency: store.currency,
    address: 'القاهرة — مدينة نصر',
    phone: '+201000000000',
    trackUrl,
    paymentLabel: 'الدفع عند الاستلام',
    placedAt: new Date(),
  }

  const jobs: Array<{ label: string; mail: { subject: string; html: string; text?: string }; attach?: boolean }> = [
    { label: 'رمز الدخول', mail: customerCodeEmail(brand, '123456', 10) },
    { label: 'الفاتورة (تأكيد الطلب)', mail: orderInvoiceEmail(brand, order) },
    { label: 'إشعار التاجر بطلب جديد', mail: newOrderNotificationEmail(brand, order, `${home}`) },
    {
      label: 'السلة المتروكة',
      mail: abandonedCartEmail(brand, {
        customerName: order.customerName,
        lines: order.lines,
        total: order.total,
        currency: order.currency,
        resumeUrl: `${home}/checkout`,
        stageLine: 'وصلت لخطوة الدفع وما كمّلتش',
      }),
    },
    {
      label: 'رسالة يدوية من التاجر',
      mail: merchantMessageEmail(brand, {
        subject: `رسالة من ${store.name}`,
        body: 'ده نص تجريبي.\n\nالرسالة دي بتتبعت من صفحة الطلب لما التاجر يكتب للعميل.',
        actionUrl: trackUrl,
        actionLabel: 'افتح الطلب',
      }),
    },
  ]

  for (const status of ['confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned'] as const) {
    jobs.push({
      label: `حالة الطلب: ${status}`,
      mail: orderStatusEmail(brand, status, {
        orderNumber: 1001,
        customerName: order.customerName,
        total: order.total,
        currency: order.currency,
        trackUrl,
        trackingNumber: status === 'shipped' ? 'EG123456789' : null,
        carrier: status === 'shipped' ? 'بوسطة' : null,
      }),
    })
  }

  const results: Array<{ label: string; ok: boolean; note: string }> = []

  for (const [i, job] of jobs.entries()) {
    /* رسالتين في الثانية عند المزوّد — المهلة بتمنع ٤٢٩ كاذبة */
    if (i > 0) await new Promise((r) => setTimeout(r, 700))

    const res = await sendEmail({
      to: address,
      ...job.mail,
      senderAddress: own,
      replyTo: safeReplyTo(store.email),
      log: { storeId: store.id, event: 'delivery_test' },
    })

    results.push({
      label: job.label,
      ok: res.ok,
      note: res.ok ? job.mail.subject : `المزوّد رفض: ${res.error}`,
    })
  }

  return { ok: results.every((r) => r.ok), from: diag.from, results }
}

/* ────────────────────── نطاق المتجر ────────────────────── */

export async function startEmailDomainAction(): Promise<
  | { ok: true; records: DnsRecord[]; domain: string; status: string; dnsError: string | null }
  | { ok: false; error: string }
> {
  const { store } = await getDashboardContext()

  const res = await startEmailDomain(store.id)
  if (!res.ok) return { ok: false, error: res.error }

  revalidatePath('/dashboard/settings/email')
  return {
    ok: true,
    records: res.state.records,
    domain: res.state.domain ?? '',
    status: res.state.status,
    /*
      سبب فشل الكتابة بيرجع مع النجاح مش بدله: النطاق **اتسجّل**
      فعلًا عند المزوّد، اللي فشل هو كتابة سجلاته. الاتنين حالتين
      مختلفتين، ودمجهم في «فشل» بيخلّي التاجر يعيد التسجيل بلا فايدة.
    */
    dnsError: lastDnsError(),
  }
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
