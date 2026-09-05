import { notFound } from 'next/navigation'
import type { MemberRole } from '@/db/schema'

/*
  الملف ده **مش** `server-only` عن قصد.

  الشاشة محتاجة نفس قايمة الصلاحيات ونفس الأسماء العربية عشان
  ترسم محرّر الصلاحيات — ولو كان عندها نسخة تانية، أول صلاحية
  تتضاف بتظهر في مكان وتغيب في التاني. فالمصدر واحد، وما فيهوش
  أي سرّ ولا أي قراءة من قاعدة البيانات: قايمة ثابتة ودالة نقيّة.

  الحسم نفسه بيفضل على الخادم: `guard()` في الصفحة و`assertCan()`
  في الفعل، والاتنين بيتنادوا من كود خادم بس.
*/

/**
 * صلاحيات الفريق.
 *
 * ## المشكلة اللي بيحلّها الملف ده
 * التاجر اللي معاه موظفين محتاج يدخّلهم اللوحة من غير ما يفتح لهم
 * كل حاجة: اللي بيرد على الطلبات مالوش دعوة بأسعار التكلفة ولا
 * بالمصروفات ولا بمفاتيح بوابة الدفع. من غير الفصل ده، التاجر إما
 * بيدّي حسابه لموظفه (وساعتها مفيش سجل يقول مين عمل إيه)، أو
 * بيفضل هو الوحيد اللي بيدخل اللوحة.
 *
 * ## الصلاحية بتتفحص على الخادم لا في الشاشة
 * إخفاء بند من القايمة راحة مش حماية: المسار نفسه بيتكتب في شريط
 * العنوان، وفعل الخادم بيتنادى من غير ما الصفحة تتفتح أصلًا.
 * عشان كده في بوابتين:
 *
 * - `guard()` في أول كل صفحة — بترجّع 404 لا 403، فالموظف ما يعرفش
 *   إن فيه قسم مقفول عليه ويفضل يحاول.
 * - `assertCan()` في كل فعل بيغيّر حاجة.
 *
 * ## المالك فوق النظام ده
 * `owner` عنده كل حاجة دايمًا وما ينفعش يتقيّد. لو قيّدناه، تاجر
 * يقدر يقفل على نفسه لوحته بغلطة وما يقدرش يفتحها تاني.
 */

export type Permission =
  | 'orders.view'
  | 'orders.manage'
  | 'products.view'
  | 'products.manage'
  | 'customers.view'
  | 'inventory.manage'
  | 'marketing.manage'
  | 'storefront.manage'
  /** التقارير والتحليلات — من غير أرقام التكلفة والربح */
  | 'reports.view'
  /** التكلفة والمصروفات والربح — بند لوحده لأنه أخطر بيانات في اللوحة */
  | 'finance.view'
  | 'settings.manage'
  /** الفوترة والاشتراك وأعضاء الفريق — للمالك وحده افتراضيًا */
  | 'team.manage'

export const PERMISSIONS: Array<{ key: Permission; label: string; hint: string }> = [
  { key: 'orders.view', label: 'يشوف الطلبات', hint: 'القايمة وتفاصيل كل طلب' },
  { key: 'orders.manage', label: 'يشتغل على الطلبات', hint: 'يغيّر الحالة، يسجّل طلب، يعمل شحنة' },
  { key: 'products.view', label: 'يشوف المنتجات', hint: 'الكتالوج من غير تعديل' },
  { key: 'products.manage', label: 'يعدّل المنتجات', hint: 'يضيف ويعدّل ويحذف ويغيّر الأسعار' },
  { key: 'inventory.manage', label: 'يدير المخزون', hint: 'الكميات والفروع والموردين' },
  { key: 'customers.view', label: 'يشوف العملاء', hint: 'بياناتهم وطلباتهم' },
  { key: 'marketing.manage', label: 'يدير التسويق', hint: 'الكوبونات والعروض وصفحات الهبوط والأتمتة' },
  { key: 'storefront.manage', label: 'يعدّل شكل المتجر', hint: 'الثيم والبانرات والصفحات والمدوّنة' },
  { key: 'reports.view', label: 'يشوف التقارير', hint: 'المبيعات والزيارات — من غير التكلفة والربح' },
  {
    key: 'finance.view',
    label: 'يشوف الفلوس',
    hint: 'التكلفة والمصروفات وصافي الربح. ده أخطر بند — افتحه لمن تثق فيه بس.',
  },
  { key: 'settings.manage', label: 'يغيّر الإعدادات', hint: 'الشيك أوت والشحن والدفع والنطاق' },
  { key: 'team.manage', label: 'يدير الفريق والاشتراك', hint: 'يضيف موظفين ويغيّر صلاحياتهم' },
]

/**
 * صلاحيات كل دور.
 *
 * `staff` بيبدأ بأقل حاجة تخلّيه يشتغل: يشوف الطلبات ويشتغل عليها
 * ويشوف المنتجات. أي حاجة زيادة قرار من التاجر — والافتراضي الواسع
 * بيخلّي كل موظف يتضاف بصلاحيات محدّش قصدها.
 */
const ROLE_DEFAULTS: Record<MemberRole, Permission[]> = {
  owner: PERMISSIONS.map((p) => p.key),
  admin: PERMISSIONS.filter((p) => p.key !== 'team.manage').map((p) => p.key),
  staff: ['orders.view', 'orders.manage', 'products.view'],
}

export function defaultPermissions(role: MemberRole): Permission[] {
  return [...ROLE_DEFAULTS[role]]
}

/**
 * قوالب جاهزة لأدوار شائعة.
 *
 * ## ليه قوالب مش أدوار جديدة
 * دور جديد في القاعدة معناه فرع جديد في كل فحص صلاحية، ومكان تاني
 * ممكن يختلف عن الصلاحيات نفسها. القالب مجرد **مجموعة صلاحيات
 * مختارة** بتتحفظ في نفس العمود — فالفحص فاضل زي ما هو، والتاجر
 * يقدر يعدّل عليها بعدين زي أي حد تاني.
 *
 * ## والميديا باير أهمهم
 * دي حالة حقيقية في السوق: التاجر بيسلّم بيانات إعلاناته لمتخصص
 * برّه. المتخصص محتاج **الأرقام** — الزيارات والتحويل والمصادر —
 * ومالوش دعوة بأرقام تليفونات العملاء ولا بعناوينهم ولا بأرباح
 * التاجر. القالب ده بيرسم الخط ده بالظبط في ضغطة.
 */
export type PermissionPreset = {
  key: string
  label: string
  hint: string
  role: Exclude<MemberRole, 'owner'>
  permissions: Permission[]
}

export const PRESETS: PermissionPreset[] = [
  {
    key: 'media_buyer',
    label: 'ميديا باير',
    hint: 'يشوف أرقام الإعلانات والتحويل — من غير بيانات العملاء ولا أرباحك.',
    role: 'staff',
    /*
      `reports.view` من غير `finance.view` ولا `customers.view`.

      التقارير عندنا بتخفي الأعمدة المالية عن اللي مالوش `finance.view`
      من غير ما تقفل الصفحة — فالميديا باير بيشوف الزيارات والمصادر
      ونسبة التحويل، وما بيشوفش الإيراد ولا التكلفة ولا أرقام العملاء.
    */
    permissions: ['reports.view', 'marketing.manage'],
  },
  {
    key: 'support',
    label: 'خدمة عملاء',
    hint: 'يرد على العملاء ويتابع طلباتهم ويغيّر حالتها.',
    role: 'staff',
    permissions: ['orders.view', 'orders.manage', 'customers.view', 'products.view'],
  },
  {
    key: 'warehouse',
    label: 'مخزن وتجهيز',
    hint: 'يجهّز الطلبات ويحرّك المخزون — من غير أسعار التكلفة ولا العملاء.',
    role: 'staff',
    permissions: ['orders.view', 'orders.manage', 'products.view', 'inventory.manage'],
  },
  {
    key: 'content',
    label: 'محتوى وتصميم',
    hint: 'يعدّل المنتجات وشكل المتجر والمدوّنة.',
    role: 'staff',
    permissions: ['products.view', 'products.manage', 'storefront.manage'],
  },
]

export type Actor = {
  role: string
  permissions: string[]
}

/**
 * الصلاحية دي مفتوحة للعضو ده؟
 *
 * المالك بياخد كل حاجة من غير ما نقرا قايمته: لو صف العضوية بتاعه
 * اتكتب فاضي بغلطة، هو المفروض يفضل قادر يفتح لوحته ويصلّحها.
 *
 * والمدير كمان بياخد افتراضيات دوره لو قايمته فاضية — عشان الحسابات
 * اللي اتعملت قبل ما نظام الصلاحيات يتضاف تفضل شغّالة زي ما كانت.
 */
export function can(actor: Actor, permission: Permission): boolean {
  if (actor.role === 'owner') return true
  if (actor.permissions.length === 0) {
    return ROLE_DEFAULTS[(actor.role as MemberRole) ?? 'staff']?.includes(permission) ?? false
  }
  return actor.permissions.includes(permission)
}

/**
 * حارس الصفحة — **٤٠٤ لا ٤٠٣**.
 *
 * «ممنوع» بتأكّد إن القسم موجود، فالموظف بيفضل يحاول ويسأل زمايله
 * عن اللي جوّاه. «مش موجود» بتخلّي المسار غير مميّز عن أي مسار غلط.
 */
export function guard(actor: Actor, permission: Permission): void {
  if (!can(actor, permission)) notFound()
}

/** رد الرفض في الأفعال — بيرمي، فالفعل بيقف قبل ما يكتب حاجة */
export function assertCan(actor: Actor, permission: Permission): void {
  if (!can(actor, permission)) {
    throw new Error('ماعندكش صلاحية للإجراء ده — كلّم صاحب المتجر.')
  }
}

export const ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'المالك',
  admin: 'مدير',
  staff: 'موظف',
}
