import type { BlockMatch } from '@/db/schema'

/**
 * أسماء أنواع الحظر بالعربي.
 *
 * ملف مستقل عن `blocklist.ts` لأن ده `server-only`: الفحص بيقرا من
 * قاعدة البيانات، والشاشة محتاجة الأسماء بس. نفس النمط اللي في
 * `returns-meta` و`bookings-meta` — المعاني في مكان تقدر تستورده
 * من الجهتين، والقراءة في مكان الخادم وحده.
 */
export const BLOCK_MATCH_LABELS: Record<BlockMatch, string> = {
  phone: 'رقم موبايل',
  email: 'بريد',
  ip: 'عنوان IP',
  name: 'اسم',
}
