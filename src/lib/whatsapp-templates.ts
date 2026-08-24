/**
 * نصوص رسايل واتساب — التاجر بيكتبها بنفسه.
 *
 * النص الجاهز بتاعنا بيوصّل المعلومة، بس صوته مش صوت التاجر. اللي
 * بيبيع عطور بيكلّم عملاءه غير اللي بيبيع قطع غيار، والمتجر اللي كل
 * رسايله بنفس نصّ المنصة بيبان قالبًا.
 *
 * ## المتغيّرات
 * التاجر بيكتب `{{اسم_المتجر}}` وإحنا بنملاها. أي متغيّر مش معروف
 * بيتشال بدل ما يظهر للعميل زي ما هو — العميل ما يصحّش يشوف
 * `{{كود}}` مكتوبة في رسالته.
 *
 * ## الرمز مش اختياري
 * قالب رمز الدخول لازم يكون فيه `{{كود}}`. من غيره العميل بياخد
 * رسالة مالهاش لازمة ومش قادر يدخل — عشان كده الحفظ بيرفضه.
 */

export type TemplateKey =
  | 'otp'
  | 'order_placed'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'returned'

export type Templates = Partial<Record<TemplateKey, string>>

/** المتغيّرات المتاحة لكل قالب — بتتعرض للتاجر كأزرار يلزقها */
export const TEMPLATE_VARS: Record<TemplateKey, string[]> = {
  otp: ['اسم_المتجر', 'كود', 'دقايق'],
  order_placed: ['اسم_المتجر', 'اسم_العميل', 'رقم_الطلب', 'الإجمالي', 'طريقة_الدفع', 'الرابط'],
  confirmed: ['اسم_المتجر', 'اسم_العميل', 'رقم_الطلب', 'الرابط'],
  processing: ['اسم_المتجر', 'اسم_العميل', 'رقم_الطلب', 'الرابط'],
  shipped: ['اسم_المتجر', 'اسم_العميل', 'رقم_الطلب', 'الرابط'],
  delivered: ['اسم_المتجر', 'اسم_العميل', 'رقم_الطلب', 'الرابط'],
  cancelled: ['اسم_المتجر', 'اسم_العميل', 'رقم_الطلب', 'الرابط'],
  returned: ['اسم_المتجر', 'اسم_العميل', 'رقم_الطلب', 'الرابط'],
}

export const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  otp: 'رمز الدخول',
  order_placed: 'استلمنا طلبك',
  confirmed: 'الطلب اتأكد',
  processing: 'تحت التجهيز',
  shipped: 'اتشحن',
  delivered: 'اتسلّم',
  cancelled: 'اتلغى',
  returned: 'إرجاع',
}

export const DEFAULT_TEMPLATES: Record<TemplateKey, string> = {
  otp: 'رمز دخولك على {{اسم_المتجر}}: {{كود}}\nصالح {{دقايق}} دقايق. لو مش إنت اللي طلبته، تجاهل الرسالة.',
  order_placed:
    'أهلًا {{اسم_العميل}} 👋 استلمنا طلبك من {{اسم_المتجر}}\n\nرقم الطلب: #{{رقم_الطلب}}\nالإجمالي: {{الإجمالي}}\nالدفع: {{طريقة_الدفع}}\n\nتابع طلبك من هنا:\n{{الرابط}}',
  confirmed: 'طلبك #{{رقم_الطلب}} اتأكد وبنجهّزه دلوقتي ✅\n\n{{الرابط}}',
  processing: 'طلبك #{{رقم_الطلب}} تحت التجهيز 📦\n\n{{الرابط}}',
  shipped: 'طلبك #{{رقم_الطلب}} خرج مع المندوب 🚚 — استنّى مكالمته\n\n{{الرابط}}',
  delivered: 'طلبك #{{رقم_الطلب}} اتسلّم ✅ شكرًا إنك اشتريت من {{اسم_المتجر}}',
  cancelled: 'طلبك #{{رقم_الطلب}} اتلغى. لو ده مش صح كلّمنا وهنظبّطها',
  returned: 'طلب الإرجاع للطلب #{{رقم_الطلب}} اتسجّل',
}

/** النص اللي هيتبعت فعلًا — بتاع التاجر لو كتبه، وإلا الافتراضي */
export function templateFor(templates: Templates | null | undefined, key: TemplateKey): string {
  const custom = templates?.[key]?.trim()
  return custom || DEFAULT_TEMPLATES[key]
}

/**
 * يملا المتغيّرات.
 *
 * أي متغيّر مش في الخريطة بيتشال: التاجر ممكن يكتب `{{حاجة}}` بالغلط،
 * والعميل ما يصحّش يشوف الأقواس دي في رسالته.
 */
export function fillTemplate(text: string, vars: Record<string, string>): string {
  return text
    .replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, key: string) => vars[key.trim()] ?? '')
    /* سطرين فاضيين ورا بعض بيحصلوا لما متغيّر يتشال — بنلمّهم */
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export type TemplateIssue = { key: TemplateKey; message: string }

/**
 * فحص قبل الحفظ.
 *
 * قالب الرمز من غير `{{كود}}` بيخلّي العميل ياخد رسالة مالهاش لازمة
 * ومش قادر يدخل — ودي حاجة التاجر ما بيكتشفهاش غير لما حد يشتكي.
 */
export function checkTemplates(templates: Templates): TemplateIssue[] {
  const issues: TemplateIssue[] = []

  const otp = templates.otp?.trim()
  if (otp && !/\{\{\s*كود\s*\}\}/.test(otp)) {
    issues.push({ key: 'otp', message: 'قالب رمز الدخول لازم يكون فيه {{كود}}' })
  }

  for (const [key, value] of Object.entries(templates) as Array<[TemplateKey, string]>) {
    if (value && value.length > 900) {
      issues.push({ key, message: `${TEMPLATE_LABELS[key]}: النص طويل أوي (٩٠٠ حرف بحد أقصى)` })
    }
  }

  return issues
}
