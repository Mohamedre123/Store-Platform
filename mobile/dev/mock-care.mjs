/**
 * بيانات تجربة لشاشات منتج جديد والمراجعات والمرتجعات والشكاوى — نفس شكل
 * `/api/app/products/form|reviews|returns|complaints`. للتطوير بس.
 */

const now = Date.now()
const hoursAgo = (h) => new Date(now - h * 3600e3).toISOString()

export function productForm() {
  return { currency: 'EGP', categories: [{ id: 'c1', name: 'فساتين' }, { id: 'c2', name: 'شنط' }, { id: 'c3', name: 'إكسسوارات' }] }
}

export function reviews() {
  return {
    waiting: 2,
    reviews: [
      { id: 'r1', authorName: 'سارة محمود', rating: 5, body: 'الفستان تحفة والخامة ممتازة، ووصل في يومين 😍', verified: true, approved: false, reply: null, productName: 'فستان سهرة ستان', createdAt: hoursAgo(3) },
      { id: 'r2', authorName: 'كريم حسن', rating: 2, body: 'المقاس جه صغير شوية عن الجدول', verified: true, approved: false, reply: null, productName: 'بلوزة قطن مطرّزة', createdAt: hoursAgo(20) },
      { id: 'r3', authorName: 'منى إبراهيم', rating: 4, body: 'حلوة جدًا بس اللون أغمق من الصورة', verified: false, approved: true, reply: 'شكرًا يا منى — هنحدّث الصور عشان اللون يبان مظبوط 🙏', productName: 'شنطة جلد يد', createdAt: hoursAgo(72) },
    ],
  }
}

const RS = {
  requested: ['طلب جديد', 'var(--color-warning-soft)', 'var(--color-warning)'],
  approved: ['اتوافق عليه', 'var(--color-info-soft)', 'var(--color-info)'],
  picked_up: ['اتستلم من العميل', 'var(--primary-soft)', 'var(--primary)'],
  received: ['وصل المتجر', 'var(--primary-soft)', 'var(--primary)'],
  completed: ['اكتمل', 'var(--color-success-soft)', 'var(--color-success)'],
  rejected: ['مرفوض', 'var(--color-danger-soft)', 'var(--color-danger)'],
}

export function returns() {
  const rows = [
    ['rt1', '12', 'استرداد فلوس', 'requested', 'المقاس مش مظبوط', 'محتاجة مقاس أكبر بس مفيش، فعايزة فلوسي', null, '١٬٢٠٠ ج.م.', '1041', 'سارة محمود', '01002345671'],
    ['rt2', '11', 'استبدال', 'approved', 'المنتج وصل تالف', 'السوستة مقطوعة', 'المندوب هيستلم الخميس', null, '1037', 'نور الهدى', '01223334444'],
    ['rt3', '10', 'استرداد فلوس', 'completed', 'غيّرت رأيي', null, null, '٤٣٠ ج.م.', '1033', 'ليلى مصطفى', null],
  ]
  return {
    open: 2,
    statuses: Object.entries(RS).map(([key, [label, bg, fg]]) => ({ key, label, bg, fg })),
    returns: rows.map(([id, number, typeLabel, status, reason, customerNote, merchantNote, refundLabel, orderLabel, customerName, customerPhone], i) => ({
      id, number, typeLabel, status, statusLabel: RS[status][0], bg: RS[status][1], fg: RS[status][2],
      reason, customerNote, merchantNote, refundLabel, orderLabel, customerName, customerPhone, createdAt: hoursAgo(i * 30 + 2),
    })),
  }
}

export function complaints() {
  return {
    canReply: true,
    open: 1,
    statuses: [
      { key: 'open', label: 'مستنية ردّك' },
      { key: 'answered', label: 'ردّيت' },
      { key: 'resolved', label: 'اتحلّت' },
      { key: 'closed', label: 'مقفولة' },
    ],
    tickets: [
      { id: 't1', number: '7', subject: 'الطلب اتأخر أسبوع', categoryLabel: 'الشحن والتوصيل', status: 'open', statusLabel: 'مستنية ردّك', bg: 'var(--color-warning-soft)', fg: 'var(--color-warning)', customerName: 'يوسف سمير', customerPhone: '01112223334', orderId: 'o5', orderLabel: '1038', lastMessageBy: 'customer', lastMessageAt: hoursAgo(1), messageCount: 2 },
      { id: 't2', number: '6', subject: 'اتخصم مرتين', categoryLabel: 'الدفع والفلوس', status: 'resolved', statusLabel: 'اتحلّت', bg: 'var(--color-success-soft)', fg: 'var(--color-success)', customerName: 'هبة سامي', customerPhone: null, orderId: null, orderLabel: null, lastMessageBy: 'merchant', lastMessageAt: hoursAgo(50), messageCount: 3 },
    ],
  }
}

export function thread() {
  return {
    messages: [
      { id: 'm1', body: 'طلبت من أسبوع ولسه ما وصلش، ورقم البوليصة مش شغّال', author: 'customer', authorName: 'يوسف سمير', images: [], createdAt: hoursAgo(26) },
      { id: 'm2', body: 'وممكن أعرف هيوصل إمتى؟', author: 'customer', authorName: 'يوسف سمير', images: [], createdAt: hoursAgo(1) },
    ],
  }
}
