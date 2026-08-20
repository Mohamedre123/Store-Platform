/**
 * وصف إجراءات المساعد بالعربي.
 *
 * منفصل عن `agent-tools.ts` (اللي بيلمس قاعدة البيانات فهو
 * server-only): لوحة الشات مكوّن متصفح ومحتاجة توصف الإجراء للتاجر
 * قبل ما يوافق. الاستيراد من الملف التاني بيوقّع الصفحة وقت التشغيل،
 * وفحص الأنواع مش بيمسك النوع ده من الأخطاء.
 *
 * والوصف ده هو **الحاجز الحقيقي**: التاجر بيوافق على اللي مكتوب هنا،
 * فأي غموض فيه معناه موافقة على حاجة مش فاهمها.
 */

const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const n = (v: unknown) => {
  const x = Number(v)
  return Number.isFinite(x) ? x : NaN
}

export const TOOL_LABELS: Record<string, (args: Record<string, unknown>) => string> = {
  get_store_overview: () => 'قراءة حالة المتجر',
  search_products: (a) => `بحث عن «${s(a.query)}»`,
  list_recent_orders: () => 'قراءة آخر الطلبات',
  list_categories: () => 'قراءة الأقسام',

  create_product: (a) =>
    `إضافة منتج «${s(a.name)}» بسعر ${n(a.price)} ج${a.publish === false ? ' (مسوّدة)' : ''}`,

  update_product: (a) => {
    const parts: string[] = []
    if (a.name) parts.push(`الاسم → «${s(a.name)}»`)
    if (a.price !== undefined) parts.push(`السعر → ${n(a.price)} ج`)
    if (a.stock !== undefined) parts.push(`الكمية → ${n(a.stock)}`)
    if (a.description) parts.push('الوصف')
    if (a.status) parts.push(`الحالة → ${a.status === 'active' ? 'نشط' : 'مسوّدة'}`)
    return `تعديل منتج: ${parts.join('، ') || 'من غير تغيير'}`
  },

  create_category: (a) => `إضافة قسم «${s(a.name)}»`,

  create_coupon: (a) => {
    const t =
      a.type === 'percent'
        ? `${n(a.value)}٪`
        : a.type === 'fixed'
          ? `${n(a.value)} ج`
          : 'شحن مجاني'
    return `كوبون «${s(a.code)}» — ${t}`
  },

  update_order_status: (a) => {
    const labels: Record<string, string> = {
      confirmed: 'مؤكّد',
      processing: 'بيتجهّز',
      shipped: 'اتشحن',
      delivered: 'اتسلّم',
      cancelled: 'ملغي',
    }
    return `تغيير حالة الطلب #${n(a.orderNumber)} لـ«${labels[s(a.status)] ?? s(a.status)}»`
  },

  set_store_published: (a) => (a.published ? 'نشر المتجر للعملاء' : 'إيقاف نشر المتجر'),

  update_store_info: (a) => {
    const names: Record<string, string> = {
      name: 'الاسم',
      tagline: 'الجملة التعريفية',
      email: 'البريد',
      phone: 'التليفون',
    }
    const parts = Object.entries(a)
      .filter(([, v]) => v)
      .map(([k]) => names[k] ?? k)
    return `تعديل بيانات المتجر: ${parts.join('، ')}`
  },
}
