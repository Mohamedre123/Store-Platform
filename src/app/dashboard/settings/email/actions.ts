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
  /** سجلات نطاق المنصة — من DNS مباشرةً */
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
      email: stores.email,
      name: stores.name,
      slug: stores.slug,
    })
    .from(stores)
    .where(eq(stores.id, store.id))
    .limit(1)

  /*
    نفس منطق `fromHeader` بالظبط — لو اتفرّقوا، الصفحة بتوري حاجة
    والرسالة بتخرج بحاجة تانية، وده أسوأ من غياب الصفحة أصلًا.
  */
  const configured = process.env.EMAIL_FROM ?? ''
  const base = configured.match(/<([^>]+)>/)?.[1] ?? configured.trim()
  const sendingDomain = base.split('@')[1] ?? ''

  const slug = (row?.slug ?? store.slug).trim().toLowerCase()
  const local = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/.test(slug) ? slug : 'info'
  const from = sendingDomain ? `${store.name} <${local}@${sendingDomain}>` : base

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
    dns,
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
    address,
  )

  const res = await sendEmail({
    to: address,
    ...mail,
    sender: { name: store.name, slug: store.slug },
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
    { label: 'رمز الدخول', mail: customerCodeEmail(brand, '123456', 10, address) },
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
      sender: { name: store.name, slug: store.slug },
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

/**
 * نفس الرسالة بتلات صيغ مرسِل — عشان نبطّل تخمين.
 *
 * ## ليه الاختبار ده موجود
 * جرّبنا صيغة ورا صيغة على مدار يوم كامل، وكل مرة نستنتج من رسالة
 * واحدة على الباقي. النسخة اللي قبل دي كانت بتقارن بنطاق المزوّد،
 * و**ما اشتغلتش**: `resend.dev` بيرفض يبعت لغير صاحب الحساب، فالخانة
 * التانية رجعت فاضية والمقارنة ما تمّتش.
 *
 * الصيغ التلاتة دي كلها بتخرج من **نطاقنا الموثّق**، فكلها بتتبعت
 * فعلًا. والمتغيّر بينهم واحد بس في كل خطوة، فالنتيجة بتقول أي
 * جزء بالظبط هو اللي بيفرق.
 *
 * ١. اسم المتجر لوحده + عنوان باسم المتجر
 * ٢. اسم المتجر لوحده + عنوان المنصة
 * ٣. «اسم المتجر عبر المنصة» + عنوان المنصة   ← اللي كان شغّال
 */
export async function sendDomainComparisonAction(
  to: string,
): Promise<{ results: Array<{ label: string; from: string; ok: boolean; note: string }> }> {
  const { store } = await getDashboardContext()

  const address = to.trim().toLowerCase()
  if (!address.includes('@')) return { results: [] }

  const theme = await getStoreTheme(store.id)
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
    address,
  )

  const configured = process.env.EMAIL_FROM ?? ''
  const base = configured.match(/<([^>]+)>/)?.[1] ?? configured.trim()
  const domain = base.split('@')[1] ?? ''
  const platform = process.env.NEXT_PUBLIC_APP_NAME?.trim() || 'زاوية'
  const slug = store.slug.trim().toLowerCase()
  const storeLocal = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/.test(slug) ? slug : 'info'

  /** الاسم العربي لازم يتشفّر — الترويسة ASCII بالأصل */
  const enc = (n: string) =>
    /[^ -~]/.test(n) ? `=?UTF-8?B?${Buffer.from(n, 'utf8').toString('base64')}?=` : `"${n}"`

  const variants = [
    { label: 'اسم المتجر + عنوان المتجر', from: `${enc(store.name)} <${storeLocal}@${domain}>` },
    { label: 'اسم المتجر + عنوان المنصة', from: `${enc(store.name)} <${base}>` },
    { label: 'اسم المتجر عبر المنصة + عنوان المنصة', from: `${enc(`${store.name} عبر ${platform}`)} <${base}>` },
  ]

  const results = []
  for (const [i, v] of variants.entries()) {
    /* رسالتين في الثانية عند المزوّد */
    if (i > 0) await new Promise((r) => setTimeout(r, 700))

    const res = await sendEmail({
      to: address,
      ...mail,
      /*
        الموضوع بيتعلّم برقم عشان تفرّقهم في الصندوق — ده الجزء
        الوحيد اللي بيختلف، وكل حاجة تانية متطابقة حرفيًا.
      */
      subject: `${mail.subject} [${i + 1}]`,
      fromOverride: v.from,
      log: { storeId: store.id, event: 'delivery_test' },
    })

    results.push({
      label: `[${i + 1}] ${v.label}`,
      from: v.from.replace(/=?UTF-8?B?[^?]+?=/, store.name),
      ok: res.ok,
      note: res.ok ? `اتبعتت — دوّر على «[${i + 1}]» في الوارد والسبام` : `المزوّد رفض: ${res.error}`,
    })
  }

  return { results }
}
