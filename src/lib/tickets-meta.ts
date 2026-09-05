import type { TicketCategory, TicketStatus } from '@/db/schema'

/**
 * أسماء الشكاوى وحالاتها — للجهتين.
 *
 * ملف مستقل عن `tickets.ts` لأن ده `server-only`، والشاشتين
 * (لوحة التاجر وحساب العميل في المتجر) محتاجين نفس الأسماء. نفس
 * نمط `returns-meta` و`blocklist-meta`.
 */

export const TICKET_CATEGORIES: Array<{ key: TicketCategory; label: string; hint: string }> = [
  { key: 'order', label: 'طلب معيّن', hint: 'مشكلة في طلب اشتريته' },
  { key: 'shipping', label: 'الشحن والتوصيل', hint: 'الطلب اتأخر أو العنوان غلط' },
  { key: 'product', label: 'المنتج نفسه', hint: 'وصل مكسور، أو مش زي الوصف' },
  { key: 'payment', label: 'الدفع والفلوس', hint: 'اتخصم مرتين، أو استرداد' },
  { key: 'other', label: 'حاجة تانية', hint: 'استفسار أو اقتراح' },
]

export function categoryLabel(key: string): string {
  return TICKET_CATEGORIES.find((c) => c.key === key)?.label ?? 'حاجة تانية'
}

/**
 * حالات الشكوى.
 *
 * `answered` معناها «التاجر رد والعميل لسه ما ردّش» — مش «خلصت».
 * الفرق ده هو اللي بيخلّي التاجر يعرف دور مين من غير ما يفتح.
 */
export const TICKET_STATUSES: Array<{
  key: TicketStatus
  label: string
  bg: string
  fg: string
}> = [
  {
    key: 'open',
    label: 'مستنية ردّك',
    bg: 'var(--color-warning-soft)',
    fg: 'var(--color-warning)',
  },
  { key: 'answered', label: 'ردّيت', bg: 'var(--color-info-soft)', fg: 'var(--color-info)' },
  {
    key: 'resolved',
    label: 'اتحلّت',
    bg: 'var(--color-success-soft)',
    fg: 'var(--color-success)',
  },
  { key: 'closed', label: 'مقفولة', bg: 'var(--surface-2)', fg: 'var(--fg-muted)' },
]

export function ticketStatusMeta(status: string) {
  return TICKET_STATUSES.find((s) => s.key === status) ?? TICKET_STATUSES[0]
}

/** الحالة زي ما العميل بيشوفها — «مستنية ردّك» بتاعت التاجر مش بتاعته */
export const CUSTOMER_STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'مستنية رد المتجر',
  answered: 'المتجر رد',
  resolved: 'اتحلّت',
  closed: 'مقفولة',
}

export type TicketRow = {
  id: string
  ticketNumber: number
  subject: string
  category: TicketCategory
  status: TicketStatus
  customerName: string | null
  customerPhone: string | null
  customerEmail: string | null
  orderId: string | null
  orderNumber: number | null
  lastMessageBy: 'customer' | 'merchant'
  lastMessageAt: string
  createdAt: string
  messageCount: number
}

export type TicketMessage = {
  id: string
  body: string
  author: 'customer' | 'merchant'
  authorName: string | null
  images: string[]
  createdAt: string
}
