/**
 * أسماء أنواع الرسايل وحالاتها بالعربي — صفحة «سجل الرسايل» وتطبيق الموبايل.
 *
 * المفتاح إنجليزي في قاعدة البيانات (`message_log.event` و`status`).
 * أي نوع رسالة جديد يتضاف هنا عشان يظهر باسمه في الاتنين.
 */

export const MESSAGE_EVENT_LABELS: Record<string, string> = {
  order_confirmation: 'تأكيد طلب',
  merchant_new_order: 'إشعار طلب جديد',
  abandoned_cart: 'تذكير سلة متروكة',
  order_otp: 'رمز تحقق',
  order_confirmed: 'الطلب اتأكّد',
  order_processing: 'الطلب بيتجهّز',
  order_shipped: 'الطلب اتشحن',
  order_delivered: 'الطلب اتسلّم',
  order_cancelled: 'الطلب اتلغى',
  automation: 'أتمتة',
  team_notify: 'إشعار للفريق',
  team_test: 'تجربة إشعار الفريق',
  subscription_trial_started: 'بداية التجربة المجانية',
  subscription_activated: 'تفعيل الاشتراك',
  subscription_renewed: 'تجديد الاشتراك',
  subscription_reminder_7: 'تذكير: فاضل ٧ أيام',
  subscription_reminder_3: 'تذكير: فاضل ٣ أيام',
  subscription_reminder_1: 'تذكير: فاضل يوم',
  subscription_expired: 'انتهاء الاشتراك',
  subscription_trial_ended: 'انتهاء التجربة',
  subscription_cancelled: 'إيقاف الاشتراك',
}

export const MESSAGE_STATUS_META: Record<string, { label: string; bg: string; fg: string }> = {
  queued: { label: 'في الطابور', bg: 'var(--surface-2)', fg: 'var(--fg-muted)' },
  sent: { label: 'اتبعتت', bg: 'var(--color-success-soft)', fg: 'var(--color-success)' },
  delivered: { label: 'وصلت', bg: 'var(--color-success-soft)', fg: 'var(--color-success)' },
  read: { label: 'اتقرت', bg: 'var(--color-success-soft)', fg: 'var(--color-success)' },
  failed: { label: 'فشلت', bg: 'var(--color-danger-soft)', fg: 'var(--color-danger)' },
}
