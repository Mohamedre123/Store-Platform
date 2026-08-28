/**
 * حسابات إدارة المنصة.
 *
 * ## ليه بريد مكتوب في الكود
 * الصلاحية دي بتفتح لوحة فيها كل التجّار وأزرار بتفعّل اشتراكات.
 * لو مصدرها الوحيد عمود في قاعدة البيانات، أي حد يوصل للقاعدة يقدر
 * يدّي نفسه الصلاحية — والعمود ده بيتضبط من نفس القاعدة. البريد
 * المكتوب هنا مرساة تانية: بيتغيّر بنشر جديد لا بصفّ في جدول.
 *
 * العمود `is_platform_admin` لسه شغّال ومعتبر — الاتنين بيتجمعوا،
 * فتقدر تدّي الصلاحية لحساب تاني من غير نشر.
 *
 * ## دي مش «تجسّس على العملاء»
 * اللوحة بتعرض بيانات الاشتراك بس: اسم المتجر، معرّف الحساب، الحالة،
 * وعدد الطلبات. مش بتفتح طلبات ولا عملاء ولا محتوى أي متجر — العزل
 * في `getDashboardContext` ما اتلمسش.
 */

/** بريد يتضاف من متغيّر بيئة — مفصولين بفاصلة */
function fromEnv(): string[] {
  return (process.env.PLATFORM_ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

const BUILT_IN = ['iaomn8406@gmail.com']

/** كل بريد بيتعامل كإدارة منصة — دايمًا بحروف صغيرة */
export function adminEmails(): string[] {
  return [...new Set([...BUILT_IN, ...fromEnv()])]
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return adminEmails().includes(email.trim().toLowerCase())
}
