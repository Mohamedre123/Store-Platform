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

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)
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

/** الجزء اللي قبل @ — من سلَج المتجر، ولاتيني بالإجبار */
function localPart(slug?: string | null): string | null {
  const s = slug?.trim().toLowerCase() ?? ''
  return /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/.test(s) ? s : null
}

/**
 * عنوان المرسِل — **دايمًا على نطاق المنصة**.
 *
 * ## ليه رجعنا لنطاق المنصة
 * جرّبنا نبعت من نطاق كل متجر (`info@atlosa.zawyaeg.site`). المصادقة
 * ظبطت، السجلات اتكتبت، والرسايل فضلت في السبام — لأن نطاقًا عمره
 * ساعة سمعته صفر عند جيميل مهما كانت إعداداته سليمة. وكل متجر جديد
 * كان بيبدأ من الصفر ده تاني.
 *
 * نطاق المنصة عمره أكبر وبيراكم سمعة من كل التجّار مع بعض. السمعة
 * المشتركة ليها عيبها — تاجر وحش بيأذي الباقي — بس تاجر جديد بيركب
 * على سمعة موجودة بدل ما يبني واحدة من الصفر وهو محتاج يبيع دلوقتي.
 *
 * ## بس مش عنوانًا واحدًا للكل
 * كل متجر بياخد الجزء الأول بتاعه: `atlosa@zawyaeg.site`. ده بيخلّي
 * سمعة كل متجر تتحسب على عنوانه هو جوّه النطاق، وبيمنع إن رسايل
 * التجّار كلها تتجمّع في خيط واحد عند العميل.
 *
 * ## والاسم الظاهر اسم المتجر
 * العميل بيستقبل رمز دخول؛ لازم يعرف من مين قبل ما يفتح. والاسم هنا
 * **مش بينقض العنوان**: «atlosa» جنب `atlosa@…` متطابقين، على عكس
 * اسم متجر جنب `no-reply@` — وده الشكل اللي كان بيتقرا انتحال هوية.
 */
function fromHeader(store?: { name?: string | null; slug?: string | null } | null): string {
  const configured = process.env.EMAIL_FROM ?? ''
  const base = configured.match(/<([^>]+)>/)?.[1] ?? configured.trim()
  const domain = base.split('@')[1]
  if (!domain) return base

  const local = localPart(store?.slug) ?? 'info'
  const address = `${local}@${domain}`

  const name = store?.name?.trim()
  return name ? `${encodeDisplayName(name)} <${address}>` : address
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
        from: fromHeader(sender),
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
      provider: 'resend',
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
