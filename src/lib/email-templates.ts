import { brand } from './brand'
import { ROOT_DOMAIN } from './domain'

/**
 * قوالب البريد.
 *
 * ثلاث قيود تحكم كل حرف هنا، وكلها بسبب عملاء البريد لا المتصفحات:
 *
 * 1. Outlook وجيميل بيتجاهلوا معظم CSS الحديث — فالتخطيط بجداول
 *    والأنماط مضمّنة في كل عنصر، مفيش ملف أنماط ولا كلاسات.
 * 2. أغلب العملاء بيحجبوا الصور افتراضيًا — فالرسالة لازم تُقرأ
 *    كاملة والشعار مش ظاهر، والرمز نفسه نص مش صورة.
 * 3. مفيش وضع داكن يُعتمد عليه — فالبطاقة بيضا دايمًا والشعار
 *    الملوّن هو المناسب.
 */

const SITE = ROOT_DOMAIN.startsWith('localhost') ? 'http://' + ROOT_DOMAIN : 'https://' + ROOT_DOMAIN

/** الصور في البريد لازم روابط مطلقة — المسارات النسبية مش بتتحمّل */
const LOGO_URL = `${SITE}${brand.mark}`
const WORDMARK_URL = `${SITE}${brand.wordmark}`

const COLORS = {
  ink: '#222540',
  muted: '#5c6890',
  subtle: '#8a92ad',
  primary: '#634b9a',
  primarySoft: '#f0ecf8',
  border: '#e2e4ec',
  page: '#f4f3f9',
}

/*
  مفيش نص مخفي في الرسالة.

  كان فيه سطر معاينة متخبّي بتلات طرق مع بعض — `display:none`
  و`opacity:0` و`max-height:0` — في **كل** رسالة بعتناها من أول يوم.
  والتكديس ده بالذات هو اللي الفلاتر بتسمّيه إخفاء محتوى: نص موجود
  في الرسالة والمستقبِل ما بيشوفهوش. الحيلة دي أصلها إعلانات بتخبّي
  كلمات عشان تعدّي من الفحص، فالفلاتر بتسجّل عليها مباشرةً.

  ومكسبه كان سطر المعاينة في قايمة الوارد. وجيميل بياخد السطر ده من
  أول كلام ظاهر في الرسالة لو ما لقاش واحدًا مخصّصًا — يعني كنا
  بندفع تهمة إخفاء محتوى تمن حاجة بتحصل لوحدها.
*/
function layout(inner: string, _preheader: string) {
  return `<!doctype html>
<html lang="ar" dir="rtl" xmlns:v="urn:schemas-microsoft-com:vml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${brand.name}</title>
</head>
<body style="margin:0;padding:0;background-color:${COLORS.page};">

<!-- نص المعاينة: يظهر في قائمة الرسائل جنب العنوان -->

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${COLORS.page};">
  <tr>
    <td align="center" style="padding:32px 16px;">

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">

        <!-- الشعار -->
        <tr>
          <td align="center" style="padding-bottom:24px;">
            <img src="${LOGO_URL}" width="48" height="48" alt=""
                 style="display:block;width:48px;height:48px;border:0;outline:none;margin:0 auto 10px;">
            <img src="${WORDMARK_URL}" height="24" alt="${brand.name}"
                 style="display:block;height:24px;width:auto;border:0;outline:none;margin:0 auto;">
          </td>
        </tr>

        <!-- البطاقة -->
        <tr>
          <td style="background-color:#ffffff;border:1px solid ${COLORS.border};border-radius:16px;padding:32px 28px;font-family:'Segoe UI',Tahoma,Arial,sans-serif;color:${COLORS.ink};">
            ${inner}
          </td>
        </tr>

        <!-- التذييل -->
        <tr>
          <td align="center" style="padding-top:20px;font-family:'Segoe UI',Tahoma,Arial,sans-serif;font-size:12px;line-height:1.8;color:${COLORS.subtle};">
            ${brand.name} — ${brand.tagline}<br>
            <a href="${SITE}" style="color:${COLORS.subtle};text-decoration:underline;">${ROOT_DOMAIN}</a>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`
}

export function verificationEmail(code: string, name?: string) {
  const greeting = name ? `أهلًا ${name}،` : 'أهلًا،'

  const inner = `
    <p style="margin:0 0 14px;font-size:16px;line-height:1.9;font-weight:600;">${greeting}</p>

    <p style="margin:0 0 24px;font-size:15px;line-height:1.9;color:${COLORS.muted};">
      ده رمز تأكيد بريدك. اكتبه في صفحة التأكيد عشان تكمّل تفعيل حسابك وتدخل لوحة متجرك.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="center" style="background-color:${COLORS.primarySoft};border:1px solid #d8cfec;border-radius:12px;padding:22px 12px;">
          <div style="font-size:12px;letter-spacing:1px;color:${COLORS.muted};margin-bottom:10px;">رمز التأكيد</div>
          <div dir="ltr" style="font-family:'Courier New',Consolas,monospace;font-size:34px;font-weight:700;letter-spacing:6px;color:${COLORS.primary};line-height:1;">${code}</div>
        </td>
      </tr>
    </table>

    <p style="margin:22px 0 0;font-size:14px;line-height:1.9;color:${COLORS.muted};">
      الرمز صالح لمدة <strong style="color:${COLORS.ink};">١٠ دقايق</strong> من وقت وصول الرسالة دي.
    </p>

    <hr style="border:0;border-top:1px solid ${COLORS.border};margin:24px 0;">

    <p style="margin:0;font-size:13px;line-height:1.9;color:${COLORS.subtle};">
      لو مش إنت اللي طلبت الرمز ده، تجاهل الرسالة. محدش يقدر يوصل لحسابك من غير الرمز،
      وهينتهي لوحده بعد شوية.
    </p>
  `

  return {
    subject: `رمز تأكيد حسابك في ${brand.name}`,
    html: layout(inner, `رمز التأكيد: ${code} — صالح ١٠ دقايق`),
    text: [
      greeting,
      '',
      `رمز تأكيد بريدك في ${brand.name}: ${code}`,
      'الرمز صالح لمدة ١٠ دقائق.',
      '',
      'لو مش إنت اللي طلبته، تجاهل الرسالة.',
      '',
      `${brand.name} — ${brand.tagline}`,
      SITE,
    ].join('\n'),
  }
}

/**
 * رمز استعادة كلمة المرور.
 *
 * منفصل عن رسالة التأكيد عن قصد: الاتنين رمز في بريد، لكن ده بيوصل
 * لحد **مش** طالبه في أغلب حالات إساءة الاستخدام. فالرسالة لازم
 * تقول بوضوح إن حد طلب تغيير كلمة السر وإن التجاهل بيكفي — وإلا
 * صاحب الحساب يفتكر إن حسابك اخترق ويفزع.
 */
export function passwordResetEmail(code: string, name?: string) {
  const greeting = name ? `أهلًا ${name}،` : 'أهلًا،'

  const inner = `
    <p style="margin:0 0 14px;font-size:16px;line-height:1.9;font-weight:600;">${greeting}</p>

    <p style="margin:0 0 24px;font-size:15px;line-height:1.9;color:${COLORS.muted};">
      وصلنا طلب لتغيير كلمة السر بتاعة حسابك. اكتب الرمز ده في صفحة الاستعادة
      وبعدها اختار كلمة سر جديدة.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="center" style="background-color:${COLORS.primarySoft};border:1px solid #d8cfec;border-radius:12px;padding:22px 12px;">
          <div style="font-size:12px;letter-spacing:1px;color:${COLORS.muted};margin-bottom:10px;">رمز الاستعادة</div>
          <div dir="ltr" style="font-family:'Courier New',Consolas,monospace;font-size:34px;font-weight:700;letter-spacing:6px;color:${COLORS.primary};line-height:1;">${code}</div>
        </td>
      </tr>
    </table>

    <p style="margin:22px 0 0;font-size:14px;line-height:1.9;color:${COLORS.muted};">
      الرمز صالح لمدة <strong style="color:${COLORS.ink};">١٠ دقايق</strong>.
    </p>

    <hr style="border:0;border-top:1px solid ${COLORS.border};margin:24px 0;">

    <p style="margin:0;font-size:13px;line-height:1.9;color:${COLORS.subtle};">
      <strong style="color:${COLORS.ink};">لو مش إنت اللي طلبت ده، تجاهل الرسالة.</strong>
      كلمة سرّك زي ما هي، ومحدش يقدر يغيّرها من غير الرمز اللي فوق.
    </p>
  `

  return {
    subject: `استعادة كلمة السر في ${brand.name}`,
    html: layout(inner, `رمز الاستعادة: ${code} — صالح ١٠ دقايق`),
    text: [
      greeting,
      '',
      `رمز استعادة كلمة السر في ${brand.name}: ${code}`,
      'الرمز صالح لمدة ١٠ دقائق.',
      '',
      'لو مش إنت اللي طلبته، تجاهل الرسالة — كلمة سرّك زي ما هي.',
      '',
      `${brand.name} — ${brand.tagline}`,
      SITE,
    ].join('\n'),
  }
}

/** ترحيب بعد تأكيد الحساب */
export function welcomeEmail(name: string, storeName: string, storeLink: string) {
  const inner = `
    <p style="margin:0 0 14px;font-size:16px;line-height:1.9;font-weight:600;">مبروك ${name} 🎉</p>

    <p style="margin:0 0 24px;font-size:15px;line-height:1.9;color:${COLORS.muted};">
      متجر <strong style="color:${COLORS.ink};">${storeName}</strong> بقى جاهز. فاضل تضيف منتجاتك
      وتظبّط الشحن والدفع، وتبدأ تستقبل طلبات.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
      <tr>
        <td align="center" style="background-color:${COLORS.primary};border-radius:10px;">
          <a href="${storeLink}" style="display:inline-block;padding:13px 26px;font-family:'Segoe UI',Tahoma,Arial,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">
            افتح لوحة متجرك
          </a>
        </td>
      </tr>
    </table>

    <p style="margin:24px 0 0;font-size:13px;line-height:1.9;color:${COLORS.subtle};">
      لو احتجت أي حاجة، رُد على الرسالة دي وهنساعدك.
    </p>
  `

  return {
    subject: `متجرك ${storeName} جاهز على ${brand.name}`,
    html: layout(inner, `متجر ${storeName} بقى جاهز — ابدأ ضيف منتجاتك`),
    text: `مبروك ${name}!\n\nمتجر ${storeName} بقى جاهز على ${brand.name}.\nافتح لوحة متجرك: ${storeLink}`,
  }
}
