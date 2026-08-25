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
  if (!/[^ -~]/.test(name)) return `"${name}"`
  return `=?UTF-8?B?${Buffer.from(name, 'utf8').toString('base64')}?=`
}

/**
 * اسم المرسل.
 *
 * **رسايل العميل بتيجي باسم متجره لا باسمنا.**
 *
 * العميل اشترى من «أتلوسا» مش من «زاوية» — ورسالة جاية باسم منصة
 * ما يعرفهاش بتبان مشبوهة. إحنا البنية التحتية، والواجهة للتاجر.
 *
 * العنوان نفسه بيفضل بتاعنا (هو المتحقَّق منه في DNS)، والاسم
 * الظاهر بس هو اللي بيتغيّر.
 *
 * والحل النهائي إن التاجر يوثّق نطاقه ويبعت من عليه — ساعتها الاسم
 * والنطاق بتوعه هو.
 */
/**
 * أسلوب هوية المرسِل — مفتاح بيئة، مش نشر جديد.
 *
 * ## ليه إعداد
 * التسليم مش بيتحدّد بمنطق نقدر نستنتجه: SPF وDKIM وDMARC كلهم
 * بينجحوا والرسالة بتروح السبام برضو. الباقي سلوك فلتر ما بيتشافش
 * من برّه، وطريقة معرفته الوحيدة إننا نجرّب ونشوف.
 *
 * فالأسلوب بيتغيّر بمفتاح: التاجر يجرّب التلاتة من صفحة البريد،
 * ويتحطّ اللي وصل — من غير انتظار نشر ولا تعديل كود.
 *
 * - `platform` — كل حاجة باسم المنصة وعنوانها. أضمن هوية لأنها
 *   الوحيدة اللي بتراكم سمعة، بس التاجر بيخسر اسمه على الرسالة.
 * - `store-name` — اسم المتجر على عنوان المنصة. برانده ظاهر، والعنوان
 *   محتفظ بسمعة موحّدة.
 * - `store-address` — اسم المتجر على عنوانه هو. أوضح هوية، بس كل
 *   متجر بيبدأ سمعته من الصفر.
 */
type SenderStyle = 'platform' | 'store-name' | 'store-address'

function senderStyle(): SenderStyle {
  const v = process.env.EMAIL_SENDER_STYLE
  return v === 'platform' || v === 'store-name' || v === 'store-address' ? v : 'store-name'
}

function fromHeader(
  senderName?: string | null,
  senderSlug?: string | null,
  /**
   * عنوان على نطاق التاجر الموثّق.
   *
   * لما يكون موجود، الرسالة بتخرج من نطاقه بالكامل — الاسم والعنوان
   * والتوقيع كلهم بتوعه، وسمعته بتبقى بتاعته لوحده مش مشتركة مع
   * باقي التجّار على المنصة.
   */
  ownAddress?: string | null,
): string {
  const configured = process.env.EMAIL_FROM ?? ''
  const name = senderName?.trim()
  if (!name) return configured

  const style = senderStyle()

  /*
    هوية المنصة بالكامل: الرسالة بتخرج زي رسايل زاوية نفسها — نفس
    الاسم ونفس العنوان. اسم المتجر بيفضل في الموضوع وفي الرسالة
    وفي الشعار، اللي بيتغيّر هو الترويسة بس.
  */
  if (style === 'platform') return configured

  const useOwn = style === 'store-address'
  const base = (useOwn ? ownAddress?.trim() : '') || configured.match(/<([^>]+)>/)?.[1] || configured.trim()

  /* نطاق التاجر الموثّق بيتستخدم زي ما هو — مفيش سلَج ولا تعديل */
  if (useOwn && ownAddress?.trim()) {
    const cleanName = name.replace(/["<>]/g, '').trim().slice(0, 50)
    return `${encodeDisplayName(cleanName)} <${ownAddress.trim()}>`
  }

  /**
   * العنوان يطابق الاسم — دي كانت المشكلة كلها.
   *
   * ## الدليل
   * رسايل زاوية نفسها (تسجيل التاجر، استعادة كلمة السر) بتوصل
   * الوارد عادي. ورسايل المتاجر بتروح السبام. **نفس النطاق، نفس
   * المفتاح، نفس المزوّد، نفس اللحظة.** الفرق الوحيد في الكود إن
   * رسايل المتجر بتغيّر الاسم الظاهر:
   *
   * ```
   * زاوية    <no-reply@zawyaeg.site>   ← وارد
   * atlosa   <no-reply@zawyaeg.site>   ← سبام
   * ```
   *
   * الاسم بيدّعي علامة، والعنوان مالوش أي علاقة بيها. ودي بصمة
   * انتحال هوية — نفس شكل الرسالة اللي بتدّعي إنها من بنك وعنوانها
   * على نطاق تاني.
   *
   * ## الحل
   * سلَج المتجر بيبقى الجزء الأول من العنوان: `atlosa@zawyaeg.site`.
   * دلوقتي الاسم والعنوان متسقين، والنطاق بتاعنا وموقّع منه فعلًا.
   *
   * ده اللي بتعمله المنصات الكبيرة بالظبط — وما بيحتاجش من التاجر
   * يوثّق نطاقًا ولا يضيف كلمة «عبر» على علامته.
   */
  /* السلَج بيتحوّل لعنوان في وضع «عنوان المتجر» بس */
  const local = useOwn ? (senderSlug ?? '').trim().toLowerCase() : ''
  const domain = base.split('@')[1] ?? ''

  const address =
    /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/.test(local) && domain
      ? `${local}@${domain}`
      : base

  /*
    الاقتباس المزدوج والأقواس بيكسروا الترويسة — اسم متجر فيه
    علامة اقتباس كان هيخلّي الرسالة كلها تترفض.
  */
  const clean = name.replace(/["<>]/g, '').trim().slice(0, 50)

  /**
   * اسم المتجر لوحده — من غير أي إضافة من عندنا.
   *
   * جرّبنا نكتب «عبر زاوية» جنب الاسم على أمل إنه يهدّي فلاتر
   * انتحال الهوية. مافرقش في التسليم (الرسايل فضلت زي ما هي)، ومعناه
   * إن كل تاجر بينسب نفسه لمنصة عملاؤه ما يعرفوهاش — ودي مشكلة
   * علامة تجارية حقيقية مقابل مكسب وهمي.
   *
   * وجيميل بيعرض «via» بنفسه لما يشوف الفرق بين الاسم والنطاق،
   * فالإضافة اليدوية كانت بتتكرر مرتين قدام العميل.
   *
   * الحل الحقيقي للاسم والنطاق مع بعض إن التاجر يوثّق نطاقه ويبعت
   * من عليه.
   */
  return `${encodeDisplayName(clean)} <${address}>`
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
   * اسم المرسل الظاهر — اسم المتجر.
   *
   * سيبه فاضي لرسايل المنصة نفسها (تأكيد حساب التاجر، استعادة كلمة
   * سرّه) — دي جاية مننا فعلًا وباسمنا صح.
   */
  senderName?: string | null
  /**
   * سلَج المتجر — بيبقى الجزء الأول من عنوان المرسِل.
   *
   * من غيره الرسالة بتخرج «اسم المتجر <no-reply@نطاقنا>» — اسم
   * علامة على عنوان مالوش علاقة بيها، ودي بصمة انتحال هوية عند
   * الفلاتر. سيبه فاضي لرسايل المنصة نفسها.
   */
  senderSlug?: string | null
  /**
   * عنوان المتجر على نطاقه الموثّق.
   *
   * لما يبقى موجود، الرسالة بتخرج من نطاق التاجر بالكامل — وسمعته
   * بتبقى بتاعته لوحده، مالهاش دعوة بباقي التجّار على المنصة.
   */
  senderAddress?: string | null
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
    senderName,
    senderSlug,
    senderAddress,
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
        from: fromHeader(senderName, senderSlug, senderAddress),
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
