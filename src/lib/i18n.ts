/**
 * لغة المتجر — عربي وإنجليزي.
 *
 * ## مش `server-only` عن قصد
 * نص الزرار بيتكتب في مكوّن خادم ومكوّن عميل الاتنين. لو القاموس
 * اتقفل على الخادم، كل مكوّن عميل كان هيحتاج نصوصه تتبعتله كخصائص
 * من الأب — يعني كل زرار في المتجر بيتحوّل لخاصية في تخطيط، وأول
 * نص يتنسى بيطلع عربي في نص صفحة إنجليزي.
 *
 * ## والنوع هو الضمانة
 * `EN` نوعها `Record<keyof typeof AR, string>`. المفتاح اللي
 * اتكتب بالعربي وما اتكتبش بالإنجليزي **ما بيتبنيش**. ده الفرق
 * بين ترجمة كاملة وترجمة نُصّها ظهر للعميل — واللي نُصّها ظهر
 * أسوأ من اللي ما بدأتش، لأن العميل بيفتكر الموقع بايظ.
 */

export type Locale = 'ar' | 'en'

export const LOCALES: Locale[] = ['ar', 'en']

export const LOCALE_META: Record<
  Locale,
  { label: string; labelEn: string; dir: 'rtl' | 'ltr'; intl: string; flag: string }
> = {
  ar: { label: 'العربية', labelEn: 'Arabic', dir: 'rtl', intl: 'ar-EG', flag: '🇪🇬' },
  en: { label: 'الإنجليزية', labelEn: 'English', dir: 'ltr', intl: 'en-US', flag: '🇬🇧' },
}

export function isLocale(v: unknown): v is Locale {
  return v === 'ar' || v === 'en'
}

/* ══════════════════════════════════════════════════════════════
   القاموس
   ══════════════════════════════════════════════════════════════ */

export const AR = {
  /* ── الهيدر والتنقّل ───────────────────────────────────── */
  'nav.home': 'الرئيسية',
  'nav.products': 'كل المنتجات',
  'nav.productsShort': 'المنتجات',
  'nav.menu': 'القائمة',
  'nav.close': 'إغلاق',
  'nav.search': 'بحث',
  'nav.account': 'حسابي',
  'nav.cart': 'السلة',
  'nav.wishlist': 'المفضّلة',
  'nav.quick': 'تنقّل سريع',
  'nav.blog': 'المدوّنة',
  'nav.categories': 'الأقسام',

  /* ── البحث ────────────────────────────────────────────── */
  'search.placeholder': 'ابحث في المنتجات',
  'search.placeholderLong': 'ابحث في المنتجات…',
  'search.title': 'نتايج البحث',
  'search.resultsFor': 'نتايج البحث عن «{q}»',
  'search.empty': 'مفيش نتايج للي بتدوّر عليه.',
  'search.hint': 'جرّب كلمة أقصر أو اتفرّج على كل المنتجات.',

  /* ── بطاقة المنتج ─────────────────────────────────────── */
  'product.details': 'شوف التفاصيل',
  'product.options': 'الخيارات',
  'product.soldOut': 'خلص من المخزن',
  'product.addToCart': 'ضيف للسلة',
  'product.buyNow': 'اشتري دلوقتي',
  'product.qtyIncrease': 'زيادة الكمية',
  'product.qtyDecrease': 'تقليل الكمية',
  'product.quantity': 'الكمية',
  'product.description': 'الوصف',
  'product.relatedTitle': 'ممكن يعجبك كمان',
  'product.share': 'شارك المنتج',
  'product.sku': 'كود المنتج',
  'product.inStock': 'متوفّر',
  'product.lowStock': 'فاضل {n} بس',
  'product.chooseOption': 'اختار {name}',
  'product.orderWhatsapp': 'اطلب على واتساب',

  /* ── السلة ────────────────────────────────────────────── */
  'cart.title': 'السلة',
  'cart.empty': 'سلتك فاضية',
  'cart.emptyHint': 'اتفرّج على المنتجات وضيف اللي يعجبك.',
  'cart.checkout': 'أكمل طلبك',
  'cart.continue': 'كمّل تسوّق',
  'cart.subtotal': 'المجموع',
  'cart.remove': 'شيل',
  'cart.increase': 'زيادة',
  'cart.decrease': 'تقليل',
  'cart.notes': 'ملاحظات على الطلب',
  'cart.notesPlaceholder': 'مثال: اتصل قبل التوصيل',
  'cart.freeShippingLeft': 'فاضل {amount} وتاخد شحن مجاني',
  'cart.freeShippingDone': 'شحنك مجاني 🎉',

  /* ── الشيك أوت ────────────────────────────────────────── */
  'checkout.title': 'إتمام الطلب',
  'checkout.contact': 'بياناتك',
  'checkout.name': 'الاسم',
  'checkout.namePlaceholder': 'محمد أحمد',
  'checkout.phone': 'رقم التليفون',
  'checkout.countryCode': 'كود الدولة',
  'checkout.email': 'البريد الإلكتروني',
  'checkout.address': 'العنوان',
  'checkout.addressPlaceholder': 'شارع ٩، عمارة ١٢',
  'checkout.city': 'المدينة',
  'checkout.cityPlaceholder': 'المعادي',
  'checkout.governorate': 'المحافظة',
  'checkout.chooseGovernorate': 'اختار المحافظة',
  'checkout.method': 'طريقة الاستلام',
  'checkout.delivery': 'توصيل لعندك',
  'checkout.deliveryHint': 'بنوصّله للعنوان اللي تكتبه',
  'checkout.pickup': 'أستلم من الفرع',
  'checkout.pickupHint': 'من غير مصاريف شحن',
  'checkout.summary': 'ملخص الطلب',
  'checkout.shipping': 'الشحن',
  'checkout.free': 'مجاني',
  'checkout.discount': 'الخصم',
  'checkout.vat': 'ضريبة القيمة المضافة',
  'checkout.total': 'الإجمالي',
  'checkout.coupon': 'كود الخصم',
  'checkout.couponApply': 'طبّق',
  'checkout.couponApplied': 'الكود اتطبّق',
  'checkout.freeShippingApplied': 'شحن مجاني اتطبّق',
  'checkout.payment': 'طريقة الدفع',
  'checkout.cod': 'الدفع عند الاستلام',
  'checkout.transfer': 'تحويل بنكي أو محفظة',
  'checkout.place': 'أكّد الطلب',
  'checkout.placing': 'بنأكّد طلبك…',
  'checkout.emptyCart': 'سلتك فاضية',
  'checkout.emptyCartHint': 'ضيف منتجات الأول وبعدين كمّل طلبك.',
  'checkout.notes': 'ملاحظات على الطلب',
  'checkout.notesPlaceholder': 'أي تفاصيل تحب نعرفها',
  'checkout.phoneHint': 'هنكلّمك عليه لتأكيد الطلب',
  'checkout.emailHint': 'هنبعتلك عليه الفاتورة وتأكيد الطلب',
  'checkout.pickupWhere': 'تستلم من فين',
  'checkout.deliveryAddress': 'عنوان التوصيل',
  'checkout.building': 'المبنى / الشقة',
  'checkout.shippingMethod': 'طريقة الشحن',
  'checkout.items': 'المنتجات',
  'checkout.apply': 'تطبيق',
  'checkout.preparingPayment': 'بنجهّز صفحة الدفع…',
  'checkout.confirming': 'جاري تأكيد الطلب…',
  'checkout.confirm': 'تأكيد الطلب',

  /* ── أخطاء الشيك أوت ──────────────────────────────────── */
  'err.phone': 'اكتب رقم تليفون صحيح',
  'err.phoneOrEmail': 'اكتب رقم تليفون صحيح أو بريد إلكتروني',
  'err.email': 'اكتب بريدًا إلكترونيًا صحيح',
  'err.emailInvoice': 'اكتب بريدًا إلكترونيًا صحيح — الفاتورة هتوصلك عليه',
  'err.cartEmpty': 'السلة فاضية',
  'err.storeMissing': 'المتجر مش موجود',
  'err.missingFields': 'فيه بيانات ناقصة',
  'err.generic': 'حصلت مشكلة. جرّب تاني.',
  'err.crash':
    'حصلت مشكلة عندنا. كلّم المتجر وهو هيشوف طلبك — ما تطلبش تاني عشان ما يتكررش.',
  'err.storeClosed': 'المتجر مش متاح للطلب دلوقتي',
  'err.storeNotAccepting':
    'المتجر مش بيستقبل طلبات جديدة دلوقتي. كلّم المتجر مباشرة عشان يساعدك.',
  'err.loginFirst': 'لازم تسجّل دخول الأول عشان طلبك يتحفظ في حسابك',
  'err.loginRequired': 'لازم تسجّل دخول',
  'err.unavailable': 'فيه منتجات ما بقتش متاحة',
  'err.outOfStock': 'فيه منتجات نفدت كميتها',
  'err.belowMinimum': 'الطلب أقل من الحد الأدنى',
  'err.belowMinimumLong': 'الطلب أقل من الحد الأدنى المسموح',
  'err.needsOption': 'فيه منتج محتاج تختار مقاسه أو لونه — حدّده من السلة',
  'err.needsOptionSummary': 'فيه منتج محتاج تحدّد مقاسه أو لونه — حدّده من ملخّص الطلب',
  'err.cannotComplete': 'مش قادرين نكمّل الطلب ده. كلّم المتجر مباشرة وهو هيساعدك.',
  'err.verifyPhone': 'لازم تتحقق من رقمك الأول',
  'err.badLink': 'الرابط مش صحيح',

  /* ── الطلب ────────────────────────────────────────────── */
  'order.title': 'طلبك',
  'order.number': 'رقم الطلب',
  'order.placedAt': 'اتعمل في',
  'order.status': 'حالة الطلب',
  'order.items': 'المنتجات',
  'order.invoice': 'الفاتورة',
  'order.print': 'اطبع',
  'order.pay': 'ادفع دلوقتي',
  'order.track': 'تتبّع الشحنة',
  'order.thanks': 'شكرًا لطلبك!',
  'order.received': 'تم استلام الطلب',
  'order.completedAfterIncomplete': 'اكتمل الطلب بعد ما كان ناقصًا',
  'order.returnRequest': 'اطلب إرجاع',
  'order.returnReason': 'سبب الإرجاع',
  'order.returnSend': 'ابعت الطلب',

  /* ── الحساب ───────────────────────────────────────────── */
  'account.title': 'حسابي',
  'account.yours': 'حسابك',
  'account.orders': 'طلباتي',
  'account.noOrders': 'لسه ماطلبتش حاجة.',
  'account.wishlist': 'المحفوظات',
  'account.noWishlist': 'مفيش منتجات محفوظة. اضغط على القلب في أي منتج عشان تحفظه.',
  'account.addresses': 'عناويني',
  'account.noAddresses': 'مفيش عناوين محفوظة. العنوان بيتحفظ تلقائيًا مع أول طلب.',
  'account.logout': 'تسجيل خروج',
  'account.login': 'تسجيل الدخول',
  'account.loginHint': 'اكتب رقمك وهنبعتلك رمز تأكيد',
  'account.sendCode': 'ابعت الرمز',
  'account.code': 'رمز التأكيد',
  'account.verify': 'أكّد',
  'account.rewards': 'نقاطي',
  'account.tickets': 'الشكاوى',

  /* ── الشكاوى ──────────────────────────────────────────── */
  'ticket.new': 'شكوى جديدة',
  'ticket.subject': 'الموضوع',
  'ticket.body': 'اشرح المشكلة',
  'ticket.send': 'ابعت',
  'ticket.reply': 'ردّك',
  'ticket.errSubject': 'اكتب الموضوع',
  'ticket.errBody': 'اشرح المشكلة',
  'ticket.errMessage': 'اكتب رسالتك',
  'ticket.errMissing': 'الشكوى مش موجودة',
  'ticket.errLogin': 'سجّل دخولك الأول',

  /* ── عام ──────────────────────────────────────────────── */
  'common.loading': 'بنحمّل…',
  'common.retry': 'جرّب تاني',
  'common.back': 'رجوع',
  'common.next': 'التالي',
  'common.prev': 'السابق',
  'common.save': 'احفظ',
  'common.cancel': 'إلغاء',
  'common.language': 'اللغة',
  'common.currency': 'العملة',
  'common.category': 'القسم',
  'common.article': 'مقال',
  'common.blog': 'المدوّنة',
  'common.sortBy': 'ترتيب',
  'common.filter': 'تصفية',

  /* ── قوايم فاضية ──────────────────────────────────────── */
  'empty.products': 'مافيش منتجات معروضة دلوقتي.',
  'empty.category': 'مافيش منتجات في القسم ده لسه.',
  'empty.store': 'لسه مافيش منتجات',

  /* ── الترتيب والتصفية ─────────────────────────────────── */
  'sort.label': 'ترتيب المنتجات',
  'sort.newest': 'الأحدث',
  'sort.best': 'الأكثر مبيعًا',
  'sort.priceAsc': 'الأرخص أولًا',
  'sort.priceDesc': 'الأغلى أولًا',
  'filter.all': 'الكل',

  /* ── الفوتر ───────────────────────────────────────────── */
  'footer.links': 'روابط',
  'footer.contact': 'كلّمنا',
  'footer.follow': 'تابعنا',
  'footer.poweredBy': 'مدعوم بـ',

  /* ── زرار الإضافة ─────────────────────────────────────── */
  'add.soldOut': 'نفدت الكمية',
  'add.chooseOptions': 'اختار الخيارات',
  'add.toCart': 'أضف للسلة',
  'add.added': 'اتضاف',
} as const

export type MsgKey = keyof typeof AR

/**
 * الإنجليزي.
 *
 * النوع `Record<MsgKey, string>` مقصود: المفتاح الناقص هنا بيوقّع
 * البناء. مفيش طريقة تانية تضمن إن كل نص شافه العميل العربي ليه
 * مقابل — والمراجعة بالعين على تلتمية مفتاح بتفوّت.
 */
export const EN: Record<MsgKey, string> = {
  'nav.home': 'Home',
  'nav.products': 'All products',
  'nav.productsShort': 'Products',
  'nav.menu': 'Menu',
  'nav.close': 'Close',
  'nav.search': 'Search',
  'nav.account': 'My account',
  'nav.cart': 'Cart',
  'nav.wishlist': 'Wishlist',
  'nav.quick': 'Quick nav',
  'nav.blog': 'Blog',
  'nav.categories': 'Categories',

  'search.placeholder': 'Search products',
  'search.placeholderLong': 'Search products…',
  'search.title': 'Search results',
  'search.resultsFor': 'Results for “{q}”',
  'search.empty': 'Nothing matched your search.',
  'search.hint': 'Try a shorter word, or browse all products.',

  'product.details': 'View details',
  'product.options': 'Options',
  'product.soldOut': 'Sold out',
  'product.addToCart': 'Add to cart',
  'product.buyNow': 'Buy now',
  'product.qtyIncrease': 'Increase quantity',
  'product.qtyDecrease': 'Decrease quantity',
  'product.quantity': 'Quantity',
  'product.description': 'Description',
  'product.relatedTitle': 'You may also like',
  'product.share': 'Share product',
  'product.sku': 'SKU',
  'product.inStock': 'In stock',
  'product.lowStock': 'Only {n} left',
  'product.chooseOption': 'Choose {name}',
  'product.orderWhatsapp': 'Order on WhatsApp',

  'cart.title': 'Cart',
  'cart.empty': 'Your cart is empty',
  'cart.emptyHint': 'Browse the products and add what you like.',
  'cart.checkout': 'Checkout',
  'cart.continue': 'Continue shopping',
  'cart.subtotal': 'Subtotal',
  'cart.remove': 'Remove',
  'cart.increase': 'Increase',
  'cart.decrease': 'Decrease',
  'cart.notes': 'Order notes',
  'cart.notesPlaceholder': 'e.g. call before delivery',
  'cart.freeShippingLeft': '{amount} away from free shipping',
  'cart.freeShippingDone': 'You get free shipping 🎉',

  'checkout.title': 'Checkout',
  'checkout.contact': 'Your details',
  'checkout.name': 'Full name',
  'checkout.namePlaceholder': 'Mohamed Ahmed',
  'checkout.phone': 'Phone number',
  'checkout.countryCode': 'Country code',
  'checkout.email': 'Email',
  'checkout.address': 'Address',
  'checkout.addressPlaceholder': '9 Street, Building 12',
  'checkout.city': 'City',
  'checkout.cityPlaceholder': 'Maadi',
  'checkout.governorate': 'Governorate',
  'checkout.chooseGovernorate': 'Choose a governorate',
  'checkout.method': 'Delivery method',
  'checkout.delivery': 'Deliver to me',
  'checkout.deliveryHint': 'We deliver to the address you enter',
  'checkout.pickup': 'Pick up from the store',
  'checkout.pickupHint': 'No shipping fees',
  'checkout.summary': 'Order summary',
  'checkout.shipping': 'Shipping',
  'checkout.free': 'Free',
  'checkout.discount': 'Discount',
  'checkout.vat': 'VAT',
  'checkout.total': 'Total',
  'checkout.coupon': 'Discount code',
  'checkout.couponApply': 'Apply',
  'checkout.couponApplied': 'Code applied',
  'checkout.freeShippingApplied': 'Free shipping applied',
  'checkout.payment': 'Payment method',
  'checkout.cod': 'Cash on delivery',
  'checkout.transfer': 'Bank transfer or wallet',
  'checkout.place': 'Place order',
  'checkout.placing': 'Placing your order…',
  'checkout.emptyCart': 'Your cart is empty',
  'checkout.emptyCartHint': 'Add products first, then come back to check out.',
  'checkout.notes': 'Order notes',
  'checkout.notesPlaceholder': 'Anything we should know',
  'checkout.phoneHint': 'We’ll call you to confirm the order',
  'checkout.emailHint': 'We’ll send your invoice and confirmation here',
  'checkout.pickupWhere': 'Where you’ll pick up',
  'checkout.deliveryAddress': 'Delivery address',
  'checkout.building': 'Building / apartment',
  'checkout.shippingMethod': 'Shipping method',
  'checkout.items': 'Items',
  'checkout.apply': 'Apply',
  'checkout.preparingPayment': 'Opening the payment page…',
  'checkout.confirming': 'Placing your order…',
  'checkout.confirm': 'Place order',

  'err.phone': 'Enter a valid phone number',
  'err.phoneOrEmail': 'Enter a valid phone number or email',
  'err.email': 'Enter a valid email address',
  'err.emailInvoice': 'Enter a valid email — your invoice goes there',
  'err.cartEmpty': 'Your cart is empty',
  'err.storeMissing': 'Store not found',
  'err.missingFields': 'Some details are missing',
  'err.generic': 'Something went wrong. Please try again.',
  'err.crash':
    'Something broke on our side. Contact the store — they can see your order. Please don’t reorder, so it isn’t placed twice.',
  'err.storeClosed': 'This store isn’t taking orders right now',
  'err.storeNotAccepting':
    'This store isn’t accepting new orders right now. Contact them directly and they’ll help you.',
  'err.loginFirst': 'Sign in first so your order is saved to your account',
  'err.loginRequired': 'You need to sign in',
  'err.unavailable': 'Some products are no longer available',
  'err.outOfStock': 'Some products are out of stock',
  'err.belowMinimum': 'Order is below the minimum',
  'err.belowMinimumLong': 'Order is below the minimum allowed',
  'err.needsOption': 'A product still needs a size or colour — pick it in the cart',
  'err.needsOptionSummary':
    'A product still needs a size or colour — pick it in the order summary',
  'err.cannotComplete': 'We can’t complete this order. Contact the store and they’ll help you.',
  'err.verifyPhone': 'Verify your phone number first',
  'err.badLink': 'That link isn’t valid',

  'order.title': 'Your order',
  'order.number': 'Order number',
  'order.placedAt': 'Placed on',
  'order.status': 'Order status',
  'order.items': 'Items',
  'order.invoice': 'Invoice',
  'order.print': 'Print',
  'order.pay': 'Pay now',
  'order.track': 'Track shipment',
  'order.thanks': 'Thanks for your order!',
  'order.received': 'Order received',
  'order.completedAfterIncomplete': 'Order completed after being incomplete',
  'order.returnRequest': 'Request a return',
  'order.returnReason': 'Reason for return',
  'order.returnSend': 'Send request',

  'account.title': 'My account',
  'account.yours': 'Your account',
  'account.orders': 'My orders',
  'account.noOrders': 'You haven’t ordered anything yet.',
  'account.wishlist': 'Saved items',
  'account.noWishlist': 'No saved products. Tap the heart on any product to save it.',
  'account.addresses': 'My addresses',
  'account.noAddresses': 'No saved addresses. Your address is saved with your first order.',
  'account.logout': 'Sign out',
  'account.login': 'Sign in',
  'account.loginHint': 'Enter your number and we’ll send you a code',
  'account.sendCode': 'Send code',
  'account.code': 'Verification code',
  'account.verify': 'Verify',
  'account.rewards': 'My points',
  'account.tickets': 'Support',

  'ticket.new': 'New request',
  'ticket.subject': 'Subject',
  'ticket.body': 'Describe the problem',
  'ticket.send': 'Send',
  'ticket.reply': 'Your reply',
  'ticket.errSubject': 'Enter a subject',
  'ticket.errBody': 'Describe the problem',
  'ticket.errMessage': 'Write your message',
  'ticket.errMissing': 'Request not found',
  'ticket.errLogin': 'Sign in first',

  'common.loading': 'Loading…',
  'common.retry': 'Try again',
  'common.back': 'Back',
  'common.next': 'Next',
  'common.prev': 'Previous',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.language': 'Language',
  'common.currency': 'Currency',
  'common.category': 'Category',
  'common.article': 'Article',
  'common.blog': 'Blog',
  'common.sortBy': 'Sort by',
  'common.filter': 'Filter',

  'empty.products': 'No products on display right now.',
  'empty.category': 'Nothing in this category yet.',
  'empty.store': 'No products yet',

  'sort.label': 'Sort products',
  'sort.newest': 'Newest',
  'sort.best': 'Best selling',
  'sort.priceAsc': 'Price: low to high',
  'sort.priceDesc': 'Price: high to low',
  'filter.all': 'All',

  'footer.links': 'Links',
  'footer.contact': 'Contact us',
  'footer.follow': 'Follow us',
  'footer.poweredBy': 'Powered by ',

  'add.soldOut': 'Out of stock',
  'add.chooseOptions': 'Choose options',
  'add.toCart': 'Add to cart',
  'add.added': 'Added',
}

const DICTS: Record<Locale, Record<MsgKey, string>> = { ar: AR, en: EN }

/* ══════════════════════════════════════════════════════════════
   المترجم
   ══════════════════════════════════════════════════════════════ */

export type Translator = {
  (key: MsgKey, vars?: Record<string, string | number>): string
  locale: Locale
  dir: 'rtl' | 'ltr'
  /** أرقام وتواريخ وفلوس بلغة العميل — لا بالعربي دايمًا */
  intl: string
  /**
   * نص المحتوى اللي التاجر كتبه — إنجليزي لو موجود، وعربي غير كده.
   *
   * الرجوع للعربي مقصود: التاجر اللي ترجم عشرة منتجات من مية
   * المفروض يعرض التسعين الباقيين بأسمائهم لا بخانات فاضية.
   */
  pick: (ar: string, en?: string | null) => string
}

/**
 * مترجم مربوط بلغة.
 *
 * بيتعمل مرة في التخطيط وبيتمرّر — مش بيتبني في كل مكوّن، عشان
 * `Intl.NumberFormat` غالية والصفحة الواحدة فيها عشرات الأسعار.
 */
export function makeT(locale: Locale): Translator {
  const dict = DICTS[locale] ?? AR
  const meta = LOCALE_META[locale] ?? LOCALE_META.ar

  const fn = ((key: MsgKey, vars?: Record<string, string | number>) => {
    /*
      الرجوع للعربي لو المفتاح ضاع.

      النوع بيمنع ده وقت البناء، لكن المفتاح ممكن ييجي من بيانات
      محفوظة في نسخة أقدم. النص العربي أحسن من مفتاح خام في وش
      العميل.
    */
    let out: string = dict[key] ?? AR[key] ?? key

    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        out = out.replaceAll('{' + k + '}', String(v))
      }
    }
    return out
  }) as Translator

  fn.locale = locale
  fn.dir = meta.dir
  fn.intl = meta.intl
  fn.pick = (ar, en) => (locale === 'en' ? (en?.trim() || ar) : ar)

  return fn
}

/**
 * اللغة اللي الزائر يستاهلها.
 *
 * ## الترتيب: اختياره، وبعده متصفحه، وبعده اللي التاجر ظبّطه
 * اللي اختار بإيده بيغلب كل حاجة. واللي ما اختارش، متصفحه بيقول
 * لغته — والمصري اللي فاتح متجر مصري بيلاقيه عربي، والأجنبي
 * بيلاقيه إنجليزي، والاتنين ما عملوش حاجة.
 *
 * ## وكله مقصوص على اللي التاجر فتحه
 * المتجر اللي مفعّلش الإنجليزي بيرجّع عربي مهما كانت الكوكي أو
 * المتصفح: الترجمة موجودة، لكن التاجر اللي ما ترجمش أسماء منتجاته
 * كان هيطلّع صفحة زراريها إنجليزي وبضاعتها عربي.
 */
export function resolveLocale(input: {
  cookie?: string | null
  acceptLanguage?: string | null
  enabled: Locale[]
  fallback: Locale
}): Locale {
  const enabled = input.enabled.filter(isLocale)
  const allowed = enabled.length ? enabled : ['ar' as const]
  const fallback = allowed.includes(input.fallback) ? input.fallback : allowed[0]

  if (allowed.length === 1) return allowed[0]

  if (isLocale(input.cookie) && allowed.includes(input.cookie)) return input.cookie

  /*
    أول لغة في ترويسة المتصفح بس.

    الترويسة بتيجي `en-US,en;q=0.9,ar;q=0.8` — يعني كل متصفح تقريبًا
    بيقول إنه بيفهم عربي بوزن أقل. لو قرينا القايمة كلها، أي متصفح
    إنجليزي كان هياخد عربي لمجرد إنه مذكور.
  */
  const first = input.acceptLanguage?.split(',')[0]?.trim().slice(0, 2).toLowerCase()
  if (isLocale(first) && allowed.includes(first)) return first

  return fallback
}

/** اسم الكوكي — الزائر بيختار لغته وبتفضل معاه */
export const LOCALE_COOKIE = 'zw_lang'
