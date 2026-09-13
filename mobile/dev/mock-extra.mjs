/**
 * بيانات تجربة لشاشتي التحليلات والشحنات — نفس شكل `/api/app/analytics`
 * و`/api/app/shipments` بالظبط. للتطوير بس.
 */

const now = Date.now()
const hoursAgo = (h) => new Date(now - h * 3600e3).toISOString()

export function analytics() {
  const values = [42000, 0, 68000, 91000, 55000, 120000, 76000, 0, 133000, 98000, 64000, 152000, 87000, 110500]
  return {
    currency: 'EGP',
    kpis: [
      { key: 'revenue', label: 'إيرادات ٣٠ يوم', value: 2455000, money: true, change: 18 },
      { key: 'orders', label: 'الطلبات', value: 64, money: false, change: 9 },
      { key: 'aov', label: 'متوسط قيمة الطلب', value: 38359, money: true, change: -4 },
      { key: 'net', label: 'صافي الربح', value: 712000, money: true, change: 12 },
    ],
    expensesMissing: true,
    series: values.map((value, i) => {
      const d = new Date(now - (13 - i) * 86400e3)
      return { label: `${d.getDate()}/${d.getMonth() + 1}`, value }
    }),
    statuses: [
      { key: 'delivered', label: 'اتسلّم', n: 31, pct: 48, color: 'var(--color-success)' },
      { key: 'shipped', label: 'اتشحن', n: 12, pct: 19, color: 'var(--color-info)' },
      { key: 'confirmed', label: 'مؤكّد', n: 9, pct: 14, color: 'var(--primary)' },
      { key: 'pending', label: 'قيد الانتظار', n: 7, pct: 11, color: 'var(--color-info)' },
      { key: 'cancelled', label: 'ملغي', n: 5, pct: 8, color: 'var(--color-danger)' },
    ],
    top: [
      { name: 'فستان سهرة ستان', sold: 42, pct: 100 },
      { name: 'بلوزة قطن مطرّزة', sold: 31, pct: 74 },
      { name: 'شنطة جلد يد', sold: 18, pct: 43 },
      { name: 'طرحة شيفون', sold: 11, pct: 26 },
    ],
    funnel: {
      dayCount: 30,
      steps: [
        { label: 'زوّار', value: 4820 },
        { label: 'شافوا منتج', value: 2310 },
        { label: 'ضافوا للسلة', value: 402 },
        { label: 'بدأوا الشيك أوت', value: 151 },
        { label: 'أتمّوا الطلب', value: 64 },
      ],
    },
  }
}

const STATUS = {
  created: ['اتسجّلت', 'var(--color-info-soft)', 'var(--color-info)'],
  in_transit: ['في الطريق', 'var(--primary-soft)', 'var(--primary)'],
  out_for_delivery: ['خرجت للتسليم', 'var(--color-warning-soft)', 'var(--color-warning)'],
  delivered: ['اتسلّمت', 'var(--color-success-soft)', 'var(--color-success)'],
  failed: ['فشل التسليم', 'var(--color-danger-soft)', 'var(--color-danger)'],
}

const NEXT = { created: 'picked_up', picked_up: 'in_transit', in_transit: 'out_for_delivery', out_for_delivery: 'delivered' }

export function shipments() {
  const rows = [
    ['o5', '1038', 'يوسف سمير', 'طنطا', 'in_transit', 33000, false, 'بوسطة', 'BST-22841'],
    ['o6', '1037', 'نور الهدى', 'القاهرة', 'out_for_delivery', 99000, false, 'بوسطة', 'BST-22790'],
    ['o7', '1036', 'محمد عادل', 'الجيزة', 'delivered', 152000, false, 'مندوب المتجر', null],
    ['o8', '1035', 'هبة سامي', 'أسيوط', 'delivered', 64000, true, 'أرامكس', 'ARX-99812'],
    ['o10', '1033', 'ليلى مصطفى', 'القاهرة', 'failed', 43000, false, 'بوسطة', 'BST-22101'],
    ['o11', '1032', 'شريف ناصر', 'بورسعيد', 'created', 0, false, 'بوسطة', 'BST-22950'],
  ]
  return {
    currency: 'EGP',
    autoCarrier: 'بوسطة',
    carriers: [
      { key: 'bosta', label: 'بوسطة' },
      { key: 'mylerz', label: 'مايلرز' },
      { key: 'jt', label: 'J&T Express' },
      { key: 'aramex', label: 'أرامكس' },
      { key: 'internal', label: 'مندوب المتجر' },
      { key: 'other', label: 'شركة تانية' },
    ],
    statuses: Object.entries(STATUS).map(([key, [label, bg, fg]]) => ({ key, label, bg, fg })),
    stats: { inTransit: 3, failed: 1, outstandingAmount: 152000, outstandingCount: 1 },
    pending: [
      { orderId: 'o2', orderNumber: '1041', customerName: 'سارة محمود', city: 'الجيزة', total: 120000, cod: true, paid: false, codDefault: 120000 },
      { orderId: 'o4', orderNumber: '1039', customerName: 'منى إبراهيم', city: 'المنصورة', total: 210000, cod: false, paid: true, codDefault: 0 },
    ],
    shipments: rows.map(([orderId, orderNumber, customerName, city, status, codAmount, collected, carrierLabel, trackingNumber], i) => ({
      id: `s${i + 1}`,
      orderId,
      orderNumber,
      customerName,
      customerPhone: `0100${String(2345671 + i * 1117).slice(0, 7)}`,
      city,
      carrierLabel,
      trackingNumber,
      trackingUrl: trackingNumber ? `https://example.com/track/${trackingNumber}` : null,
      status,
      statusLabel: STATUS[status][0],
      bg: STATUS[status][1],
      fg: STATUS[status][2],
      codAmount,
      collected,
      nextStatus: NEXT[status] ?? null,
      nextLabel: NEXT[status] ? (STATUS[NEXT[status]]?.[0] ?? 'المندوب استلمها') : null,
      createdAt: hoursAgo(i * 9 + 3),
    })),
  }
}
