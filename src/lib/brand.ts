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
  /** الشعار الكامل — علامة واسم وشعار فرعي. للأماكن الواسعة */
  logo: '/brand/zawya-logo.png',
  logoDark: '/brand/zawya-logo-white.png',
  /** العلامة وحدها — للأيقونات والمساحات الضيقة */
  mark: '/brand/zawya-mark.png',
  markDark: '/brand/zawya-mark-white.png',
  /**
   * «زاوية» بالتايبوجرافي المصمَّمة للعلامة — صورة لا خط.
   * تُستخدم في كل مكان بدل كتابة الاسم بخط عادي، فيظهر الاسم
   * بنفس الشكل بالضبط على كل جهاز ومتصفح مهما كانت خطوطه.
   */
  wordmark: '/brand/zawya-typo.png',
  wordmarkDark: '/brand/zawya-typo-white.png',
  /** نسبة أبعاد كلمة «زاوية» — لحجز مكانها قبل تحميل الصورة */
  wordmarkRatio: 377 / 192,
  /** لون العلامة — مأخوذ من الشعار */
  color: '#634b9a',
  supportEmail: 'support@zawya.cc',
  supportWhatsapp: '',
} as const

export type Brand = typeof brand
