/**
 * بيانات تجربة لشاشات الحظر والمندوبين والحجوزات وتعديل المنتج — نفس شكل
 * `/api/app/blocked|couriers|bookings|products/:id/edit`. للتطوير بس.
 */

const now = Date.now()
const hoursAgo = (h) => new Date(now - h * 3600e3).toISOString()
const at = (dayOffset, hour, minute = 0) => {
  const d = new Date()
  d.setDate(d.getDate() + dayOffset)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

export function blocked() {
  return {
    matches: [
      { key: 'phone', label: 'رقم موبايل' },
      { key: 'email', label: 'بريد' },
      { key: 'ip', label: 'عنوان IP' },
      { key: 'name', label: 'اسم' },
    ],
    rows: [
      { id: 'b1', match: 'phone', matchLabel: 'رقم موبايل', value: '+201001234567', action: 'reject', reason: 'رفض الاستلام ٣ مرات', hits: 4, lastHitAt: hoursAgo(30) },
      { id: 'b2', match: 'name', matchLabel: 'اسم', value: 'تجربة تجربة', action: 'flag', reason: null, hits: 0, lastHitAt: null },
    ],
    risky: [
      { id: 'c1', name: 'أحمد سعيد', phone: '01112223334', refused: 3, delivered: 1, isBlocked: false },
      { id: 'c2', name: null, phone: '01001234567', refused: 2, delivered: 0, isBlocked: true },
    ],
  }
}

export function couriers() {
  return {
    currency: 'EGP',
    vehicles: [
      { key: 'motorcycle', label: 'موتوسيكل' },
      { key: 'car', label: 'عربية' },
      { key: 'van', label: 'ونش / فان' },
      { key: 'foot', label: 'مشي' },
    ],
    cities: ['القاهرة', 'الجيزة', 'مدينة نصر', 'المعادي', 'التجمع الخامس', '٦ أكتوبر'],
    stats: { active: 2, open: 5, waiting: 2, due: 245000 },
    waiting: [
      { id: 'o9', orderNumber: 1044, orderLabel: '#1044', customerName: 'منة الله طارق', total: 89000, isPaid: false, city: 'المعادي', createdAt: hoursAgo(5) },
      { id: 'o8', orderNumber: 1043, orderLabel: '#1043', customerName: 'عمر خالد', total: 45000, isPaid: true, city: 'الجيزة', createdAt: hoursAgo(9) },
    ],
    couriers: [
      { id: 'k1', name: 'محمود حسن', phone: '+201001112223', vehicle: 'motorcycle', vehicleLabel: 'موتوسيكل', zones: ['المعادي', 'مدينة نصر'], feePerOrder: 3000, isActive: true, note: 'بيبدأ من ١١ الصبح', openCount: 3, deliveredCount: 41, failedCount: 2, dueAmount: 185000, feesDue: 21000, link: 'https://www.zawyaeg.site/mandoub/abcdefghijklmnopqrstuvwxyz123456' },
      { id: 'k2', name: 'كريم عادل', phone: '01223334455', vehicle: 'car', vehicleLabel: 'عربية', zones: [], feePerOrder: 0, isActive: true, note: null, openCount: 2, deliveredCount: 12, failedCount: 0, dueAmount: 60000, feesDue: 0, link: 'https://www.zawyaeg.site/mandoub/zyxwvutsrqponmlkjihgfedcba654321' },
      { id: 'k3', name: 'سيد إبراهيم', phone: '01550001122', vehicle: 'foot', vehicleLabel: 'مشي', zones: ['الجيزة'], feePerOrder: 2000, isActive: false, note: null, openCount: 0, deliveredCount: 7, failedCount: 1, dueAmount: 0, feesDue: 0, link: 'https://www.zawyaeg.site/mandoub/qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq' },
    ],
  }
}

const BS = {
  pending: ['مستنّي تأكيد', 'var(--color-warning-soft)', 'var(--color-warning)'],
  confirmed: ['مؤكّد', 'var(--color-info-soft)', 'var(--color-info)'],
  completed: ['تم', 'var(--color-success-soft)', 'var(--color-success)'],
  cancelled: ['ملغي', 'var(--surface-2)', 'var(--fg-muted)'],
  no_show: ['ما جاش', 'var(--color-danger-soft)', 'var(--color-danger)'],
}

export function bookings() {
  const rows = [
    ['bk1', 'جلسة تصوير منتجات', 'ريم أشرف', '01007778889', at(0, 14), at(0, 15), 'confirmed', 'عايزة خلفية بيضا', '1039'],
    ['bk2', 'قص شعر', 'مصطفى علي', '01112223344', at(0, 18, 30), at(0, 19), 'pending', null, null],
    ['bk3', 'جلسة تصوير منتجات', 'دينا حسام', null, at(1, 11), at(1, 12), 'confirmed', null, '1042'],
    ['bk4', 'قص شعر', 'ياسر محمد', '01009990000', at(-1, 17), at(-1, 17, 30), 'completed', null, null],
    ['bk5', 'استشارة', 'هالة سمير', '01234567890', at(-2, 12), at(-2, 13), 'no_show', null, null],
  ]
  return {
    enabled: true,
    hours: { days: [6, 0, 1, 2, 3, 4], from: '10:00', to: '22:00', slotMinutes: 60 },
    dayNames: ['الأحد', 'الاتنين', 'التلات', 'الأربع', 'الخميس', 'الجمعة', 'السبت'],
    statuses: Object.entries(BS).map(([key, [label, bg, fg]]) => ({ key, label, bg, fg })),
    bookings: rows.map(([id, productName, customerName, customerPhone, startsAt, endsAt, status, notes, order]) => ({
      id, productName, customerName, customerPhone, startsAt, endsAt, status,
      statusLabel: BS[status][0], bg: BS[status][1], fg: BS[status][2], notes, orderLabel: order ? `#${order}` : null,
    })),
  }
}

/** فورم التعديل من تفاصيل المنتج الوهمية (mock-api.mjs) */
export function productEdit(detail) {
  const p = detail.product
  return {
    currency: detail.currency ?? 'EGP',
    hasVariants: (detail.options ?? []).length > 0,
    product: {
      id: p.id,
      name: p.name,
      price: String(p.price / 100),
      compareAtPrice: p.compareAtPrice ? String(p.compareAtPrice / 100) : '',
      stock: String(p.stock),
      trackInventory: p.trackInventory,
      categoryId: '',
      description: p.description ?? '',
      status: p.status === 'active' ? 'active' : 'draft',
      images: p.images ?? [],
    },
  }
}
