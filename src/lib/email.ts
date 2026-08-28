import 'server-only'
import { db } from '@/db'
import { messageLog } from '@/db/schema'
import { toPlainText } from './email-plain'

/**
 * إرسال البريد.
 *
 * المزوّد الحالي Resend عبر واجهته المباشرة — بدون أي حزمة إضافية.
 * الدالة مكتوبة بحيث يُضاف مزوّد تاني (SMTP مثلًا) بإضافة فرع واحد
 * هنا، من غير ما يتغيّر أي كود بيستدعيها.
 *
 * لو مافيش مزوّد مضبوط، بنطبع الرسالة في السجل بدل ما نفشل — عشان
 * التطوير المحلي يمشي، ويفضل صاحب المنصة قادر يدخل حتى لو الإيميل
 * لسه ما اتظبطش.
 */

export type SendResult = { ok: true; id?: string } | { ok: false; error: string }

type EmailProvider = 'resend' | 'postmark' | 'brevo'

function emailProvider(): EmailProvider {
  const provider = process.env.EMAIL_PROVIDER?.trim().toLowerCase()
  if (provider === 'postmark' || provider === 'brevo') return provider
  return 'resend'
}

export function isEmailConfigured(): boolean {
  const provider = emailProvider()
  const hasProviderKey = provider === 'postmark'
    ? Boolean(process.env.POSTMARK_SERVER_TOKEN)
    : provider === 'brevo'
      ? Boolean(process.env.BREVO_API_KEY)
      : Boolean(process.env.RESEND_API_KEY)
  return Boolean(hasProviderKey && process.env.EMAIL_FROM)
}

/** بريد إلغاء الاشتراك — بيتقرا من عنوان المرسل نفسه */
function unsubscribeAddress(): string {
  const from = process.env.EMAIL_FROM ?? ''
  return from.match(/<([^>]+)>/)?.[1] ?? (from.trim() || 'no-reply@localhost')
}

/**
 * ترميز الاسم الظاهر لو فيه حروف مش لاتينية.
 *
 * ترويسات البريد ASCII بالأصل. اسم متجر بالعربي بيتبعت خام بيوصل
 * محارف مكسّرة عند بعض المستقبِلين، وبيتحسب ترويسة غير سليمة عند
 * الفلاتر. `RFC 2047` هو الشكل اللي كل عميل بريد بيفهمه.
 */
function encodeDisplayName(name: string): string {
  /*
    الترتيب هنا مقصود: الشرطة المايلة آخر حاجة في المجموعة.
    كتابتها في النص كانت بتخلّي القارئ يدمج الهروب مع اللي بعده
    ويشيل حرف الـr من كل اسم — «Nour Shop» بقت «Nou Shop».
  */
  const clean = name.replace(/[\r\n"\\]/g, ' ').trim()
  if (!/[^ -~]/.test(clean)) return `"${clean}"`
  return `=?UTF-8?B?${Buffer.from(clean, 'utf8').toString('base64')}?=`
}

/** اسم المنصة زي ما هو مكتوب في الإعدادات */
function platformName(): string {
  return process.env.NEXT_PUBLIC_APP_NAME?.trim() || 'زاوية'
}

/**
 * عنوان المرسِل.
 *
 * ## اللي اتعلمناه بالتجربة
 * جرّبنا أربع صيغ على نفس النطاق، ودي نتيجتها الحقيقية:
 *
 * | الاسم الظاهر        | العنوان                    | النتيجة |
 * |---------------------|----------------------------|---------|
 * | `زاوية`             | `onboarding@zawyaeg.site`  | وارد    |
 * | `atlosa`            | `onboarding@zawyaeg.site`  | سبام    |
 * | `atlosa عبر زاوية`  | `onboarding@zawyaeg.site`  | وارد    |
 * | `atlosa`            | `atlosa@zawyaeg.site`      | سبام    |
 *
 * السطر الأخير هو اللي بيحسم التفسير: ظنّينا إن توحيد الجزء الأول
 * مع الاسم هيصلّح التناقض، وما صلّحش. **الفلتر بيقارن الاسم الظاهر
 * بالنطاق لا بالجزء اللي قبل @** — والنطاق لسه بيقول `zawyaeg`.
 *
 * فاسم متجر لوحده على نطاق المنصة بيتقرا: «جهة بتقول إنها atlosa
 * وهي بتبعت من مكان تاني» — وهي بالظبط بصمة انتحال الهوية.
 *
 * ## و«عبر» هي الحل المعياري
 * جيميل نفسه بيكتب «via» تحت أي رسالة اسمها الظاهر ونطاقها مش
 * متطابقين. كتابتها إحنا في الاسم من الأول بتخلّي الترويسة صادقة
 * بدل ما تبان متناقضة: المتجر معروف، والناقل معروف، ومحدّش بيدّعي.
 *
 * وسمعة العنوان الواحد بتتراكم من كل التجّار مع بعض بدل ما كل متجر
 * جديد يبدأ من الصفر.
 */
function fromHeader(_store?: { name?: string | null; slug?: string | null } | null): string {
  const configured = process.env.EMAIL_FROM ?? ''
  const address = configured.match(/<([^>]+)>/)?.[1] ?? configured.trim()
  if (!address.includes('@')) return configured

  return `${encodeDisplayName(platformName())} <${address}>`
}

/** Brevo expects the sender name and address as separate JSON fields. */
function brevoSender(fromOverride?: string | null): { name: string; email: string } {
  const configured = fromOverride || process.env.EMAIL_FROM || ''
  const email = configured.match(/<([^>]+)>/)?.[1]?.trim() ?? configured.trim()
  return { name: platformName(), email }
}


/**
 * مزوّدو البريد المجاني.
 *
 * القايمة دي مش للحجب — هي للتفرقة بين «بريد على نطاق التاجر»
 * و«بريد شخصي على خدمة مجانية». الاتنين شرعيين، بس ترويستهم بتتقرا
 * بشكل مختلف تمامًا عند الفلاتر.
 */
const FREE_MAIL = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'icloud.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'yandex.com',
  'mail.ru',
])

/**
 * `Reply-To` — بس لما ما يبقاش بيناقض المرسِل.
 *
 * ## المشكلة اللي اكتشفناها
 * الرسالة كانت بتخرج كده:
 *
 * ```
 * From:     atlosa <no-reply@zawyaeg.site>
 * Reply-To: something@gmail.com
 * ```
 *
 * علامة تجارية على نطاق، والرد بيروح لبريد مجاني على نطاق تاني
 * خالص. **دي بصمة تصيّد كلاسيكية** — نفس الشكل اللي بيستخدمه اللي
 * بينتحل شخصية شركة عشان الرد يوصله هو. وفلاتر جيميل بتعاقب عليها
 * بالذات، وده بيفسّر إن الرسايل بدأت تروح السبام من غير ما الكود
 * يتغيّر: أول ما التاجر حطّ بريده الشخصي في إعدادات المتجر.
 *
 * ## الحل من غير ما نخسر الرد
 * بريد التاجر لو على **نطاقه هو** بيتحط عادي — مفيش تناقض ساعتها.
 * ولو على خدمة مجانية بنشيل الترويسة، والعميل بيلاقي بريد التاجر
 * مكتوبًا في نص الرسالة نفسها فيقدر يكلّمه.
 *
 * الحل النهائي إن التاجر يوثّق نطاقه — ساعتها المرسِل والرد
 * والعلامة كلهم على نطاق واحد.
 */
export function safeReplyTo(email?: string | null): string | undefined {
  const value = email?.trim().toLowerCase()
  if (!value || !value.includes('@')) return undefined

  const domain = value.split('@')[1] ?? ''
  if (FREE_MAIL.has(domain)) return undefined

  /*
    النطاق لازم يبقى بتاع التاجر لا بتاع حد تالت. أي نطاق غير مجاني
    بنقبله: النطاق المدفوع بيتقرا كجهة ليها كيان، والفلتر مش بيشوف
    فيه التناقض اللي بيشوفه في البريد المجاني.
  */
  return value
}

export type MessageContext = {
  storeId: string
  /** نوع الرسالة: order_confirmation | abandoned_cart | otp … */
  event: string
  orderId?: string
  customerId?: string
}

export async function sendEmail(options: {
  to: string
  subject: string
  html: string
  text?: string
  log?: MessageContext
  /** الرد يروح لمين — بريد التاجر عشان العميل يقدر يرد فعلًا */
  replyTo?: string
  /**
   * رسالة تسويقية بتتبعت لمجموعة (سلة متروكة، حملة، نشرة).
   *
   * **الافتراضي عكسها.** أغلب رسايلنا واحد-لواحد ردًا على فعل من
   * العميل: رمز دخول، تأكيد طلب، إشعار شحن. الرسايل دي مالهاش
   * «إلغاء اشتراك» — العميل هو اللي طلبها دلوقتي، وترويسة إلغاء
   * الاشتراك عليها بتناقض نوعها. وفلاتر البريد بتقرا التناقض ده
   * على إنه إرسال جماعي مقنّع في شكل معاملة، وبتوديها السبام.
   *
   * الافتراضي معاملاتي عن قصد: أي رسالة جديدة تتضاف بعدين بتاخد
   * السلوك الصح من غير ما حد يفتكر يحطّ العلامة، والنشرة هي اللي
   * بتعلن عن نفسها.
   */
  bulk?: boolean
  /**
   * المتجر اللي الرسالة بتخرج باسمه.
   *
   * بيحدّد الاسم الظاهر والجزء الأول من العنوان — «atlosa
   * <atlosa@zawyaeg.site>». سيبه فاضي لرسايل المنصة نفسها (تأكيد
   * حساب التاجر، استعادة كلمة سرّه): دي جاية مننا فعلًا، وبتخرج
   * من `info@` باسم المنصة.
   */
  sender?: { name?: string | null; slug?: string | null } | null
  /**
   * ترويسة مرسِل جاهزة — **للتشخيص وحده**.
   *
   * بتخلّي إحنا نبعت نفس الرسالة بالظبط من نطاقين مختلفين ونقارن
   * راحت فين. من غير المقارنة دي، «القالب ولا النطاق؟» بيفضل سؤالًا
   * بنجاوبه بالتخمين ونغيّر على أساسه.
   *
   * ما تستخدمهاش في أي مسار حقيقي: العنوان هنا بيتخطّى منطق
   * `fromHeader` كله.
   */
  fromOverride?: string | null
  /**
   * مرفقات — الفاتورة PDF مثلًا.
   *
   * **بايتات لا رابط.** Resend بيقبل الاتنين، بس الرابط معناه إنه
   * هيروح يجيب الملف من عندنا وقت الإرسال — وأي تقطّع لحظتها بيبعت
   * الرسالة بلا مرفق من غير ما حد يعرف. البايتات بتضمن إن اللي
   * اتبعت هو اللي إحنا ولّدناه.
   */
  attachments?: Array<{ filename: string; content: Buffer }>
  /** رابط إلغاء الاشتراك بضغطة — للرسايل التسويقية بس */
  unsubscribeUrl?: string | null
}): Promise<SendResult> {
  const {
    to,
    subject,
    html,
    text,
    log,
    replyTo,
    sender,
    fromOverride,
    bulk,
    attachments,
    unsubscribeUrl,
  } = options

  if (!isEmailConfigured()) {
    console.warn(
      `[البريد غير مضبوط] كان المفروض تُرسل رسالة إلى ${to} بعنوان: ${subject}\n` +
        (text ?? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()),
    )
    await record(log, to, subject, 'failed', { error: 'المزوّد مش مضبوط' })
    return { ok: false, error: 'not_configured' }
  }

  if (emailProvider() === 'postmark') {
    try {
      const headers = bulk
        ? [
            {
              Name: 'List-Unsubscribe',
              Value: unsubscribeUrl
                ? `<${unsubscribeUrl}>, <mailto:${unsubscribeAddress()}?subject=unsubscribe>`
                : `<mailto:${unsubscribeAddress()}?subject=unsubscribe>`,
            },
            ...(unsubscribeUrl ? [{ Name: 'List-Unsubscribe-Post', Value: 'List-Unsubscribe=One-Click' }] : []),
          ]
        : undefined

      const res = await fetch('https://api.postmarkapp.com/email', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Postmark-Server-Token': process.env.POSTMARK_SERVER_TOKEN!,
        },
        body: JSON.stringify({
          From: fromOverride || fromHeader(sender),
          To: to,
          Subject: subject,
          HtmlBody: html,
          TextBody: text ?? toPlainText(html),
          MessageStream: process.env.POSTMARK_MESSAGE_STREAM?.trim() || 'outbound',
          TrackOpens: false,
          TrackLinks: 'None',
          ...(replyTo ? { ReplyTo: replyTo } : {}),
          ...(log?.event ? { Tag: log.event.slice(0, 1000) } : {}),
          ...(attachments?.length
            ? {
                Attachments: attachments.map((a) => ({
                  Name: a.filename,
                  Content: a.content.toString('base64'),
                  ContentType: a.filename.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream',
                })),
              }
            : {}),
          ...(headers ? { Headers: headers } : {}),
        }),
      })

      if (!res.ok) {
        const body = await res.text()
        console.error('فشل إرسال البريد عبر Postmark:', res.status, body)
        await record(log, to, subject, 'failed', { error: `${res.status}: ${body.slice(0, 300)}` }, 'postmark')
        return { ok: false, error: `provider_${res.status}` }
      }

      const data = (await res.json()) as { MessageID?: string }
      await record(log, to, subject, 'sent', { providerRef: data.MessageID }, 'postmark')
      return { ok: true, id: data.MessageID }
    } catch (err) {
      console.error('خطأ في إرسال البريد عبر Postmark:', err)
      await record(log, to, subject, 'failed', { error: String(err).slice(0, 300) }, 'postmark')
      return { ok: false, error: 'network' }
    }
  }

  if (emailProvider() === 'brevo') {
    try {
      const headers = bulk
        ? {
            'List-Unsubscribe': unsubscribeUrl
              ? `<${unsubscribeUrl}>, <mailto:${unsubscribeAddress()}?subject=unsubscribe>`
              : `<mailto:${unsubscribeAddress()}?subject=unsubscribe>`,
            ...(unsubscribeUrl ? { 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } : {}),
          }
        : undefined

      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'api-key': process.env.BREVO_API_KEY!,
        },
        body: JSON.stringify({
          sender: brevoSender(fromOverride),
          to: [{ email: to }],
          subject,
          htmlContent: html,
          textContent: text ?? toPlainText(html),
          ...(replyTo ? { replyTo: { email: replyTo } } : {}),
          ...(log?.event ? { tags: [log.event.slice(0, 100)] } : {}),
          ...(attachments?.length
            ? {
                attachment: attachments.map((a) => ({
                  name: a.filename,
                  content: a.content.toString('base64'),
                })),
              }
            : {}),
          ...(headers ? { headers } : {}),
        }),
      })

      if (!res.ok) {
        const body = await res.text()
        console.error('فشل إرسال البريد عبر Brevo:', res.status, body)
        await record(log, to, subject, 'failed', { error: `${res.status}: ${body.slice(0, 300)}` }, 'brevo')
        return { ok: false, error: `provider_${res.status}` }
      }

      const data = (await res.json()) as { messageId?: string }
      await record(log, to, subject, 'sent', { providerRef: data.messageId }, 'brevo')
      return { ok: true, id: data.messageId }
    } catch (err) {
      console.error('خطأ في إرسال البريد عبر Brevo:', err)
      await record(log, to, subject, 'failed', { error: String(err).slice(0, 300) }, 'brevo')
      return { ok: false, error: 'network' }
    }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      /**
       * الترويسات اللي بتفرق بين «وارد» و«سبام».
       *
       * فلاتر البريد بتقيّم الرسالة على حاجات محدّدة، وإحنا كنا
       * ناقصين تلاتة منها:
       *
       * ١. **نسخة نصّية.** الرسالة HTML بس علامة كلاسيكية على
       *    الإرسال الآلي المجهول. بنولّدها من الـHTML لو مش متوفّرة
       *    بدل ما نبعت من غيرها.
       * ٢. **`Reply-To` حقيقي.** الرسالة اللي مالهاش رد ممكن بتبان
       *    كإشعار من روبوت. بنحطّ بريد التاجر عشان العميل يرد عليه.
       * ٣. **`List-Unsubscribe` — للنشرات بس.** على رسالة معاملاتية
       *    بتقول للفلتر «دي رسالة جماعية» فبتوديها السبام. اتأكدنا
       *    من ده عمليًا: رمز الدخول لما اتشالت منه وصل، ورسايل الطلب
       *    اللي فضلت شايلاها راحت السبام.
       *
       * **الباقي عند صاحب النطاق لا عندنا:** SPF وDKIM وDMARC لازم
       * تتظبط في سجلات DNS، ومن غيرها أي رسالة هتفضل مشكوك فيها
       * مهما عملنا في الكود.
       */
      body: JSON.stringify({
        from: fromOverride || fromHeader(sender),
        to: [to],
        subject,
        html,
        text: text ?? toPlainText(html),
        ...(replyTo ? { reply_to: replyTo } : {}),
        ...(attachments?.length
          ? {
              attachments: attachments.map((a) => ({
                filename: a.filename,
                content: a.content.toString('base64'),
              })),
            }
          : {}),
        /*
          `List-Unsubscribe-Post` اتشال قبل كده: «إلغاء بضغطة واحدة»
          بيوعد بعنوان https بيستقبل POST وإحنا مالناش، والوعد اللي
          مش وراه تنفيذ بيتحسب عيبًا عند فلاتر جيميل.

          والترويسة نفسها بتتشال من الرسايل المعاملاتية: رمز الدخول
          مش نشرة، والعميل هو اللي طلبه دلوقتي.
        */
        /**
         * إلغاء بضغطة — على الرسايل التسويقية بس.
         *
         * **جيميل بيشترط `List-Unsubscribe-Post` على المرسلين.**
         * وكنا شايلينها لأننا كنا بنوعد بعنوان بيستقبل POST وإحنا
         * مالناش — والوعد اللي مش وراه تنفيذ بيتحسب عيبًا. دلوقتي
         * `/api/unsubscribe` بيشتغل فعلًا، فالوعد بقى صادق.
         *
         * وبتفضل مشالة تمامًا من الرسايل المعاملاتية: رمز الدخول
         * وتأكيد الطلب مش نشرة، والعميل هو اللي طلبهم دلوقتي —
         * وترويسة إلغاء اشتراك عليهم بتقول للفلتر «دي رسالة جماعية».
         */
        ...(bulk
          ? {
              headers: {
                'List-Unsubscribe': unsubscribeUrl
                  ? `<${unsubscribeUrl}>, <mailto:${unsubscribeAddress()}?subject=unsubscribe>`
                  : `<mailto:${unsubscribeAddress()}?subject=unsubscribe>`,
                ...(unsubscribeUrl
                  ? { 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }
                  : {}),
              },
            }
          : {}),
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error('فشل إرسال البريد:', res.status, body)
      await record(log, to, subject, 'failed', {
        // نص المزوّد بيتحفظ زي ما هو: هو ده اللي بيقول للتاجر إيه
        // الغلط بالظبط (نطاق مش متحقَّق، مفتاح باطل، حد الإرسال)
        error: `${res.status}: ${body.slice(0, 300)}`,
      })
      return { ok: false, error: `provider_${res.status}` }
    }

    const data = (await res.json()) as { id?: string }
    await record(log, to, subject, 'sent', { providerRef: data.id })
    return { ok: true, id: data.id }
  } catch (err) {
    console.error('خطأ في إرسال البريد:', err)
    await record(log, to, subject, 'failed', { error: String(err).slice(0, 300) })
    return { ok: false, error: 'network' }
  }
}

/**
 * قيد الرسالة في السجل.
 *
 * مالوش أي تأثير على نتيجة الإرسال: لو الكتابة نفسها فشلت، الرسالة
 * تكون اتبعتت فعلًا والتاجر ما يصحّش يشوف فشلًا مش حقيقي.
 */
async function record(
  ctx: MessageContext | undefined,
  recipient: string,
  subject: string,
  status: 'sent' | 'failed',
  extra: { providerRef?: string; error?: string },
  provider: EmailProvider = 'resend',
) {
  if (!ctx) return
  try {
    await db.insert(messageLog).values({
      storeId: ctx.storeId,
      channel: 'email',
      event: ctx.event,
      recipient,
      body: subject,
      status,
      provider,
      providerRef: extra.providerRef ?? null,
      errorMessage: extra.error ?? null,
      orderId: ctx.orderId ?? null,
      customerId: ctx.customerId ?? null,
      sentAt: status === 'sent' ? new Date() : null,
    })
  } catch (e) {
    console.error('فشل تسجيل الرسالة:', e)
  }
}

export { verificationEmail, welcomeEmail } from './email-templates'
