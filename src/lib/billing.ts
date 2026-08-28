/**
 * بيانات تحصيل الاشتراك.
 *
 * المكان الوحيد اللي الأرقام دي مكتوبة فيه. لو الرقم اتغيّر، بيتغيّر
 * هنا وبس — صفحة الاشتراك ورسالة واتساب ولوحة الإدارة كلهم بيقروا منه.
 *
 * **الرقمين مختلفين عن قصد**: التحويل بيروح لرقم المحفظة/إنستا باي،
 * والتأكيد بيتبعت على رقم واتساب تاني. خلطهم كان هيخلّي التاجر يبعت
 * صورة التحويل على رقم ما حدّش بيقراه.
 */
export const billing = {
  /** رقم المحفظة وإنستا باي — نفس الرقم للاتنين */
  payTo: '01200026457',
  /** رقم واتساب الدعم اللي بيوصله تأكيد الدفع وصورة التحويل */
  whatsapp: '01281762540',
  /** كود الدولة للروابط الدولية — wa.me بيرفض الرقم المحلي */
  countryCode: '20',
} as const

/** الرقم المحلي بصيغة دولية من غير + ولا صفر بادئ — الشكل اللي wa.me بيقبله */
export function intlNumber(local: string, code: string = billing.countryCode): string {
  const digits = local.replace(/\D/g, '')
  return code + digits.replace(/^0+/, '')
}

/**
 * رسالة تأكيد الدفع الجاهزة.
 *
 * فيها **معرّف الحساب واسم المتجر** لأن دول اللي بندوّر بيهم في لوحة
 * الإدارة. من غيرهم الرسالة بتبقى «حوّلت، فعّلّي» من رقم مش معروف —
 * وده اللي بيخلّي التفعيل تبادل أسئلة بدل ضغطة زرار.
 */
export function paymentMessage(input: {
  accountId: string
  storeName: string
  planName: string
  amount: string
  method: 'wallet' | 'instapay'
}): string {
  return [
    'السلام عليكم 👋',
    'حوّلت اشتراك زاوية وعايز أفعّل المميزات.',
    '',
    `• معرّف الحساب: ${input.accountId}`,
    `• اسم المتجر: ${input.storeName}`,
    `• الباقة: ${input.planName}`,
    `• المبلغ: ${input.amount}`,
    `• طريقة التحويل: ${input.method === 'instapay' ? 'إنستا باي' : 'محفظة'}`,
    '',
    'ومرفق صورة إيصال التحويل 👇',
  ].join('\n')
}

/** رابط واتساب برسالة جاهزة */
export function whatsappLink(message: string): string {
  return `https://wa.me/${intlNumber(billing.whatsapp)}?text=${encodeURIComponent(message)}`
}
