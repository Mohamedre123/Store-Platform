/* بيانات وهمية لشاشات العرض المباشر والتقارير وجودة الإشارة — العرض المباشر بيتغيّر مع كل طلب عشان النبضة تبان */

const minsAgo = (m) => new Date(Date.now() - m * 60_000).toISOString()
let tick = 0

export function live() {
  tick += 1
  return {
    activeNow: 3 + (tick % 3),
    sessionsHour: 42,
    activeCarts: 9,
    checkoutsHour: 5,
    ordersHour: 3,
    revenueHour: 184500,
    byDevice: [{ key: 'mobile', n: 34 }, { key: 'desktop', n: 7 }, { key: 'tablet', n: 1 }],
    byCity: [{ key: 'القاهرة', n: 18 }, { key: 'الجيزة', n: 11 }, { key: 'الإسكندرية', n: 6 }],
    bySource: [{ key: 'فيسبوك', n: 20 }, { key: 'مباشر', n: 14 }, { key: 'إنستجرام', n: 8 }],
    topPages: [
      { path: '/s/zawya/products/%D9%81%D8%B3%D8%AA%D8%A7%D9%86-%D8%B5%D9%8A%D9%81%D9%8A', n: 16 },
      { path: '/s/zawya', n: 12 },
      { path: '/s/zawya/cart', n: 5 },
    ],
    feed: [
      { type: 'purchase', at: minsAgo(0.3), path: '/checkout', city: 'الجيزة', device: 'mobile', value: 90000, productName: null },
      { type: 'add_to_cart', at: minsAgo(2), path: '/p', city: 'القاهرة', device: 'mobile', value: null, productName: 'فستان صيفي' },
      { type: 'begin_checkout', at: minsAgo(4), path: '/checkout', city: null, device: 'desktop', value: null, productName: null },
      { type: 'product_view', at: minsAgo(70), path: '/p', city: 'الإسكندرية', device: 'mobile', value: null, productName: 'شنطة جلد' },
    ],
    currency: 'EGP',
    showMoney: true,
  }
}

export function reports() {
  return {
    currency: 'EGP',
    showMoney: true,
    channels: [
      { label: 'الشيك أوت العادي', orders: 48, revenue: 2150000, refused: 3 },
      { label: 'الدفع السريع', orders: 21, revenue: 870000, refused: 0 },
    ],
    sources: [
      { label: 'فيسبوك · إعلان مدفوع', visits: 1200, orders: 30, revenue: 1350000, rate: 2.5 },
      { label: 'مباشر', visits: 0, orders: 12, revenue: 520000, rate: null },
    ],
    carriers: [
      { label: 'بوسطة', shipments: 60, rate: 88, failed: 2, avgDays: 2.4, codTotal: 2400000, codSettled: 1900000 },
      { label: 'مندوب المتجر', shipments: 15, rate: 64, failed: 5, avgDays: null, codTotal: 500000, codSettled: 500000 },
    ],
    team: [],
  }
}

export function signal() {
  return {
    configured: false,
    purchases: 14,
    delivered: 9,
    skipped: 3,
    failed: 2,
    avgMatchKeys: 4.2,
    score: 5.8,
    coverage: [
      { key: 'ph', label: 'التليفون', hint: 'أقوى مفتاح في السوق المصري.', pct: 100 },
      { key: 'em', label: 'البريد', hint: 'خانة البريد في الشيك أوت بتزوّده.', pct: 35 },
      { key: 'fbp', label: 'كوكي البكسل', hint: 'غيابها معناه إن البكسل مش شغّال عنده.', pct: 62 },
    ],
    errors: [{ message: 'Invalid parameter: event_time is too old', count: 2 }],
  }
}
