import 'server-only'
import { headers } from 'next/headers'
import { db } from '@/db'
import { auditLog } from '@/db/schema'

/**
 * سجل التدقيق.
 *
 * التاجر اللي معاه موظفين محتاج يعرف مين غيّر السعر، ومين حذف المنتج،
 * ومين صرف المرتجع. من غير السجل ده، أي خلاف بين اتنين في اللوحة
 * بيتحل بالكلام لا بالدليل.
 *
 * بنسجّل الإجراءات الحسّاسة بس — اللي بتغيّر فلوس أو مخزون أو صلاحيات.
 * لو سجّلنا كل ضغطة، الجدول بيتملى ضجيجًا والمهم بيضيع فيه.
 *
 * التسجيل ما بيرميش أبدًا: فشل التوثيق ما يصحّش يلغي إجراء التاجر —
 * تاجر خصم سعرًا وشاف خطأ هيدوس تاني ويخصمه مرتين.
 */

export type AuditAction =
  | 'product.delete'
  | 'product.price_change'
  | 'order.status_change'
  | 'order.cancel'
  | 'return.status_change'
  | 'coupon.create'
  | 'coupon.delete'
  | 'shipment.delete'
  | 'shipment.cod_settled'
  | 'supplier.delete'
  | 'reward.delete'
  | 'store.publish'
  | 'store.unpublish'
  | 'theme.publish'
  | 'settings.update'
  | 'domain.update'
  | 'apikey.create'
  | 'apikey.revoke'
  | 'member.role_change'

/** أسماء الإجراءات بالعربي — المفتاح إنجليزي في قاعدة البيانات */
export const AUDIT_LABELS: Record<string, string> = {
  'product.delete': 'حذف منتج',
  'product.price_change': 'تغيير سعر',
  'order.status_change': 'تغيير حالة طلب',
  'order.cancel': 'إلغاء طلب',
  'return.status_change': 'تغيير حالة مرتجع',
  'coupon.create': 'إنشاء كوبون',
  'coupon.delete': 'حذف كوبون',
  'shipment.delete': 'حذف شحنة',
  'shipment.cod_settled': 'تحصيل دفع عند الاستلام',
  'supplier.delete': 'حذف مورّد',
  'reward.delete': 'حذف مكافأة',
  'store.publish': 'نشر المتجر',
  'store.unpublish': 'إيقاف نشر المتجر',
  'theme.publish': 'نشر تصميم',
  'settings.update': 'تعديل إعدادات',
  'domain.update': 'تغيير النطاق',
  'apikey.create': 'إنشاء مفتاح API',
  'apikey.revoke': 'إلغاء مفتاح API',
  'member.role_change': 'تغيير صلاحية موظف',
}

export function auditLabel(action: string): string {
  return AUDIT_LABELS[action] ?? action
}

export async function recordAudit(input: {
  storeId: string
  /** null لما اللي عمل الإجراء نظام خارجي — بوابة دفع أو شركة شحن */
  userId: string | null
  action: AuditAction
  /** نوع العنصر: product | order | coupon … */
  resource?: string
  resourceId?: string
  /** القيمة قبل وبعد — للتغييرات اللي الرقم فيها هو الحكاية */
  before?: Record<string, unknown>
  after?: Record<string, unknown>
}): Promise<void> {
  try {
    const h = await headers()

    await db.insert(auditLog).values({
      storeId: input.storeId,
      userId: input.userId ?? null,
      action: input.action,
      resource: input.resource ?? null,
      resourceId: input.resourceId ?? null,
      before: input.before ?? null,
      after: input.after ?? null,
      /*
        وراء وكيل، عنوان العميل الحقيقي في x-forwarded-for والأول في
        القايمة هو بتاعه. العنوان المباشر بيبقى بتاع الوكيل نفسه —
        يعني كل الأسطر بنفس العنوان ومفيش فايدة.
      */
      ip: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: h.get('user-agent')?.slice(0, 500) ?? null,
    })
  } catch (e) {
    console.error('فشل تسجيل التدقيق:', e)
  }
}
