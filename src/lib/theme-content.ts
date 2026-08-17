import type { Section } from '@/db/schema'
import type { HeroSlide } from './customization'

/**
 * المحتوى الجاهز لكل ثيم.
 *
 * التاجر ما بيبدأش من صفحة فاضية. كل ثيم بييجي بأقسامه مرتّبة
 * ومحتواها مكتوب ومناسب لنشاطه، وهو بيعدّل أو يمسح أو يزوّد —
 * وده الفرق بين إنه يخلّص متجره في ساعة أو يقعد يومين يبني من الصفر.
 */

type ThemeContent = {
  sections: Section[]
  slides: HeroSlide[]
  announcement: { text: string }
  trustLines: string[]
  aboutFooter: string
}

const section = (type: string, enabled: boolean, settings: Record<string, unknown> = {}): Section => ({
  id: type,
  type,
  enabled,
  settings,
})

const slide = (
  id: string,
  title: string,
  subtitle: string,
  ctaLabel = 'تسوّق دلوقتي',
): HeroSlide => ({
  id,
  imageDesktop: null,
  imageMobile: null,
  title,
  subtitle,
  ctaLabel,
  ctaUrl: '/products',
  textPosition: 'start',
  overlay: 35,
})

const BASE_SECTIONS = (titles: {
  categories: string
  featured: string
  latest: string
  sale: string
}): Section[] => [
  section('announcement', true),
  section('hero', true),
  section('categories', true, { title: titles.categories }),
  section('featured_products', true, { title: titles.featured }),
  section('promo_banners', false),
  section('new_arrivals', true, { title: titles.latest }),
  section('sale_products', true, { title: titles.sale }),
  section('all_products', false, { title: 'كل المنتجات' }),
  section('testimonials', false, { title: 'آراء عملائنا' }),
  section('trust_badges', true),
  section('newsletter', false, { title: 'اشترك في النشرة' }),
]

export const THEME_CONTENT: Record<string, ThemeContent> = {
  zawya: {
    sections: BASE_SECTIONS({
      categories: 'تسوّق حسب القسم',
      featured: 'منتجات مختارة',
      latest: 'وصل حديثًا',
      sale: 'التخفيضات',
    }),
    slides: [
      slide('s1', 'كل اللي بتدوّر عليه', 'تشكيلة واسعة بأسعار مناسبة والتوصيل لباب البيت'),
      slide('s2', 'عروض الأسبوع', 'خصومات على منتجات مختارة لفترة محدودة', 'شوف العروض'),
    ],
    announcement: { text: 'شحن مجاني للطلبات فوق ١٠٠٠ جنيه' },
    trustLines: ['التوصيل لكل المحافظات · الدفع عند الاستلام متاح', 'إرجاع سهل لو المنتج مش زي ما توقّعت'],
    aboutFooter: 'متجر إلكتروني بيوصلك اللي محتاجه بسرعة وبثقة.',
  },

  atlas: {
    sections: BASE_SECTIONS({
      categories: 'تصفّح المجموعات',
      featured: 'القطع المختارة',
      latest: 'الوصول الجديد',
      sale: 'آخر القطع',
    }),
    slides: [
      slide('s1', 'مجموعة الموسم', 'قصّات نظيفة وخامات تفضل معاك', 'اكتشف المجموعة'),
      slide('s2', 'الأساسيات', 'القطع اللي بتلبسها كل يوم'),
    ],
    announcement: { text: 'الشحن مجاني على كل الطلبات هذا الأسبوع' },
    trustLines: ['شحن لكل المحافظات خلال ٢–٥ أيام', 'استبدال المقاس مجانًا خلال ١٤ يوم'],
    aboutFooter: 'أزياء بخامات مختارة وتفاصيل مشغولة بعناية.',
  },

  noor: {
    sections: BASE_SECTIONS({
      categories: 'العناية حسب احتياجك',
      featured: 'الأكثر مبيعًا',
      latest: 'وصل حديثًا',
      sale: 'عروض التوفير',
    }),
    slides: [
      slide('s1', 'روتين يليق ببشرتك', 'منتجات أصلية مختارة بعناية', 'ابدئي التسوّق'),
    ],
    announcement: { text: 'منتجات أصلية ١٠٠٪ · شحن سريع' },
    trustLines: ['منتجات أصلية بضمان', 'تغليف آمن يحفظ المنتج'],
    aboutFooter: 'منتجات عناية وتجميل أصلية بأسعار حقيقية.',
  },

  tayyar: {
    sections: BASE_SECTIONS({
      categories: 'تصفّح حسب الفئة',
      featured: 'الأجهزة المميّزة',
      latest: 'أحدث المنتجات',
      sale: 'عروض محدودة',
    }),
    slides: [
      slide('s1', 'أجهزة أصلية بضمان', 'مواصفات واضحة وأسعار مقارنة', 'قارن الأسعار'),
      slide('s2', 'عروض الإكسسوارات', 'شواحن وسماعات وكفرات', 'شوف العروض'),
    ],
    announcement: { text: 'ضمان الوكيل على كل الأجهزة' },
    trustLines: ['ضمان معتمد على كل جهاز', 'فحص قبل الشحن وتغليف مقاوم للصدمات'],
    aboutFooter: 'أجهزة وإلكترونيات أصلية بضمان ودعم بعد البيع.',
  },

  dar: {
    sections: BASE_SECTIONS({
      categories: 'تسوّق حسب الغرفة',
      featured: 'قطع مختارة لبيتك',
      latest: 'وصل حديثًا',
      sale: 'تخفيضات الموسم',
    }),
    slides: [
      slide('s1', 'بيتك على ذوقك', 'قطع تجمع بين الشكل والراحة', 'شوف المجموعة'),
    ],
    announcement: { text: 'تركيب مجاني داخل القاهرة والجيزة' },
    trustLines: ['توصيل ورفع للشقة', 'ضمان سنة على التصنيع'],
    aboutFooter: 'أثاث ومفروشات بخامات تدوم وتصميم مريح.',
  },

  sufra: {
    sections: [
      section('announcement', true),
      section('categories', true, { title: 'القائمة' }),
      section('featured_products', true, { title: 'الأكثر طلبًا' }),
      section('all_products', true, { title: 'كل الأصناف' }),
      section('sale_products', false, { title: 'عروض اليوم' }),
      section('trust_badges', true),
      section('hero', false),
      section('new_arrivals', false, { title: 'جديد' }),
      section('promo_banners', false),
      section('testimonials', false, { title: 'آراء العملاء' }),
      section('newsletter', false),
    ],
    slides: [],
    announcement: { text: 'التوصيل خلال ٤٥ دقيقة · اطلب دلوقتي' },
    trustLines: ['تحضير طازج عند الطلب', 'توصيل سريع للمناطق القريبة'],
    aboutFooter: 'أكل بيتي طازة يتحضّر عند الطلب.',
  },

  sadaf: {
    sections: BASE_SECTIONS({
      categories: 'المجموعات',
      featured: 'قطع مميّزة',
      latest: 'وصل حديثًا',
      sale: 'عروض خاصة',
    }),
    slides: [
      slide('s1', 'لمعة تليق بالمناسبة', 'قطع مشغولة بعناية وتفاصيل دقيقة', 'اكتشف المجموعة'),
    ],
    announcement: { text: 'شهادة ضمان مع كل قطعة' },
    trustLines: ['شهادة ضمان وفاتورة رسمية', 'تغليف هدايا مجاني'],
    aboutFooter: 'مجوهرات وإكسسوارات مختارة بذوق.',
  },

  sarie: {
    sections: [
      section('announcement', true),
      section('hero', true),
      section('featured_products', true, { title: 'العرض' }),
      section('testimonials', true, { title: 'اللي جرّبوه بيقولوا' }),
      section('trust_badges', true),
      section('categories', false),
      section('new_arrivals', false),
      section('sale_products', false),
      section('promo_banners', false),
      section('all_products', false),
      section('newsletter', false),
    ],
    slides: [
      slide('s1', 'العرض ينتهي قريب', 'اطلب دلوقتي والدفع عند الاستلام', 'اطلب دلوقتي'),
    ],
    announcement: { text: 'الكمية محدودة · الدفع عند الاستلام' },
    trustLines: ['الدفع عند الاستلام — ما تدفعش غير لما يوصلك', 'استرجاع خلال ١٤ يوم'],
    aboutFooter: '',
  },
}

export function contentFor(themeSlug: string): ThemeContent {
  return THEME_CONTENT[themeSlug] ?? THEME_CONTENT.zawya
}
