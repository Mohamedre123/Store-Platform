'use server'

import { revalidatePath } from 'next/cache'
import { Resolver } from 'node:dns/promises'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { stores } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { isEmailConfigured, safeReplyTo, sendEmail } from '@/lib/email'
import { toPlainText } from '@/lib/email-plain'
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
 * رسالة واحدة، كل نسخة فيها فرق واحد بس.
 *
 * ## ليه الاختبار ده
 * جرّبنا نفس المجموعة مرتين وطلعت **نفس النتيجة بالحرف**: نفس التلات
 * رسايل في الوارد ونفس التمنية في السبام. يعني التصنيف حتمي لا
 * عشوائي — نفس المُدخل بياخد نفس الحكم.
 *
 * وده بيفتح باب ما كانش مفتوح: نقدر نغيّر **متغيّرًا واحدًا** ونشوف
 * الحكم بيقلب ولا لأ. كل الجولات اللي فاتت كانت بتغيّر كذا حاجة مرة
 * واحدة، فحتى لما النتيجة تتحسّن ما كناش نعرف مين السبب.
 *
 * ## النسخ
 * كلها نفس الرسالة اللي بتروح السبام دايمًا (تأكيد الطلب)، والفرق
 * بين كل واحدة والأصل حاجة واحدة موصوفة في اسمها.
 *
 * اللي يوصل الوارد بيقول السبب مباشرةً — مش بالاستنتاج.
 */
