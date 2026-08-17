/**
 * هوية المنصة — المكان الوحيد الذي يُذكر فيه الاسم والشعار.
 *
 * «زاوية» اسم مؤقت. لما يتقرر الاسم النهائي، التغيير هنا وفي ملف
 * الصورة فقط — ولا يُلمس أي ملف آخر في المشروع.
 */
export const brand = {
  name: 'زاوية',
  nameEn: 'Zawya',
  tagline: 'منصة متاجر متكاملة',
  taglineEn: 'Complete commerce platform',
  description:
    'أنشئ متجرك الإلكتروني وابدأ البيع في دقائق. إدارة طلبات ومنتجات وشحن ودفع وتسويق — في مكان واحد.',
  logo: '/brand/zawya-logo.png',
  logoDark: '/brand/zawya-logo-white.png',
  /** لون العلامة — مأخوذ من الشعار */
  color: '#634b9a',
  supportEmail: 'support@zawya.cc',
  supportWhatsapp: '',
} as const

export type Brand = typeof brand
