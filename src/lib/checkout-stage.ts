import type { CheckoutStage } from '@/db/schema'

/**
 * مراحل الشيك أوت — وإيه اللي التاجر يقوله في كل واحدة.
 *
 * ## المشكلة
 * السلة المتروكة كانت بتوصل للتاجر كسطر واحد: «العميل كتب رقمه
 * وما كمّلش». طيب وقف فين؟ حطّ في السلة وخرج؟ ولا كتب عنوانه
 * ووقف عند الدفع؟ الاتنين مسافتهم من الشرا مختلفة تمامًا، واللي
 * وقف عند الدفع محتاج جملة واحدة عشان يرجع — واللي لسه بيتفرّج
 * محتاج كلام تاني خالص.
 *
 * ## ليه الرسايل هنا مش في الواجهة
 * التاجر مش كاتب. سيبناه يفكّر في الصياغة معناه إنه ما يكلّمش —
 * والسلة اللي محدّش كلّم صاحبها بتضيع بالكامل. فبنديله الجملة
 * جاهزة على الواتساب بضغطة، وله إنه يعدّلها قبل ما يبعت.
 *
 * ## ملف مشترك مش `server-only`
 * اللوحة بتعرض الرسايل في مكوّن عميل (زرار بينسخ ويفتح واتساب)،
 * والشيك أوت بيحدّد المرحلة من المتصفح. نفس التعريف للاتنين — لو
 * اتفرّق، مرحلة تتسجّل باسم والرسالة تتبني على اسم تاني.
 */

export type StageMeta = {
  key: CheckoutStage
  /** الترتيب — الأعلى معناه أقرب للشرا */
  rank: number
  label: string
  /** اللي حصل فعلًا، بلغة التاجر */
  detail: string
}

export const CHECKOUT_STAGES: StageMeta[] = [
  {
    key: 'cart',
    rank: 0,
    label: 'حطّ في السلة',
    detail: 'دخل صفحة إتمام الطلب وما كتبش أي بيانات.',
  },
  {
    key: 'contact',
    rank: 1,
    label: 'كتب بياناته',
    detail: 'كتب اسمه ورقمه ووقف قبل العنوان.',
  },
  {
    key: 'address',
    rank: 2,
    label: 'كتب العنوان',
    detail: 'ملا عنوان التوصيل ووقف قبل ما يختار الدفع.',
  },
  {
    key: 'payment',
    rank: 3,
    label: 'وصل للدفع',
    detail: 'اختار طريقة الدفع وما ضغطش «تأكيد الطلب». دي أقرب سلة للشرا.',
  },
]

export function stageMeta(stage: CheckoutStage | null | undefined): StageMeta {
  return CHECKOUT_STAGES.find((s) => s.key === stage) ?? CHECKOUT_STAGES[0]
}

/** المرحلة الأبعد بين اتنين — المرحلة ما بترجعش لورا أبدًا */
export function furthestStage(
  current: CheckoutStage | null | undefined,
  next: CheckoutStage,
): CheckoutStage {
  if (!current) return next
  return stageMeta(current).rank >= stageMeta(next).rank ? current : next
}

/** نصّ الحدث اللي بيتسجّل في المسار الزمني وقت ما المرحلة تتقدّم */
export const STAGE_EVENT: Record<CheckoutStage, string> = {
  cart: 'العميل فتح صفحة إتمام الطلب ومعاه منتجات في السلة',
  contact: 'كتب اسمه ورقم تليفونه',
  address: 'كتب عنوان التوصيل',
  payment: 'اختار طريقة الدفع — ووقف قبل تأكيد الطلب',
}

export type ReadyMessage = {
  id: string
  /** اسم الزرار في اللوحة */
  label: string
  /** ليه الرسالة دي بالذات في المرحلة دي */
  why: string
  /** النص اللي هيتبعت — التاجر يقدر يعدّله قبل ما يبعت */
  text: string
  /** الأولى في المرحلة دي */
  primary?: boolean
}

export type MessageContext = {
  storeName: string
  customerName: string | null
  /** أول منتج في السلة — الرسالة اللي بتسمّي المنتج بترد أكتر */
  productName: string | null
  itemCount: number
  total: string
  /** رابط يرجّعه لسلّته زي ما سابها */
  resumeUrl: string
  /** فيه منتج لسه محتاج مقاس أو لون؟ */
  missingOptions: boolean
}

const hi = (name: string | null) => (name ? `أهلًا ${name}` : 'أهلًا بيك')

/**
 * الرسايل الجاهزة للمرحلة.
 *
 * الترتيب مقصود: الأولى هي اللي التاجر هيبعتها في ٩٠٪ من الحالات،
 * والباقي بدايل ليها سبب. وكلها بتنتهي برابط بيرجّعه لسلّته
 * بالظبط — «ارجع للموقع ودوّر تاني» بتفقد نُص اللي بيحاولوا.
 */
export function readyMessages(
  stage: CheckoutStage | null | undefined,
  ctx: MessageContext,
): ReadyMessage[] {
  const link = `\n\n${ctx.resumeUrl}`
  const what = ctx.productName
    ? ctx.itemCount > 1
      ? `${ctx.productName} و${ctx.itemCount - 1} منتج تاني`
      : ctx.productName
    : 'طلبك'

  /*
    المنتج اللي محتاج مقاس بيسبق أي رسالة تانية مهما كانت المرحلة:
    ده سبب وقوف معروف وله حل بجملة واحدة، والباقي تخمين.
  */
  const optionFirst: ReadyMessage[] = ctx.missingOptions
    ? [
        {
          id: 'options',
          label: 'اسأله عن المقاس',
          why: 'وقف عند اختيار المقاس أو اللون — ده سبب معروف وله حل بضغطة',
          primary: true,
          text: `${hi(ctx.customerName)} 👋 معاك ${ctx.storeName}\n\nشُفت إنك كنت بتطلب ${what} وفضل تحدّد المقاس/اللون بس.\nقولّي المقاس اللي بتلبسه وأنا أظبّطهولك وأبعتلك الطلب جاهز.${link}`,
        },
      ]
    : []

  const byStage: Record<CheckoutStage, ReadyMessage[]> = {
    cart: [
      {
        id: 'cart-check',
        label: 'اطمن عليه',
        why: 'لسه ما كتبش بياناته — السؤال المفتوح بيخلّيه يرد ويقول وقف ليه',
        primary: true,
        text: `${hi(ctx.customerName)} 👋 معاك ${ctx.storeName}\n\nلقيت ${what} مستنيّك في سلّتك. فيه حاجة وقفتك؟ لو محتاج تعرف حاجة عن المنتج أو الشحن قولّي وأنا تحت أمرك.${link}`,
      },
      {
        id: 'cart-stock',
        label: 'الكمية بتخلص',
        why: 'الاستعجال بيشتغل مع اللي لسه ما استثمرش وقتًا في الطلب',
        text: `${hi(ctx.customerName)}، ${what} اللي في سلّتك الكمية منه بتقل.\nلو حابب تحجزه، السلة لسه محفوظة بالظبط زي ما سبتها.${link}`,
      },
      {
        id: 'cart-help',
        label: 'ساعده يختار',
        why: 'اللي لسه بيقارن محتاج نصيحة مش عرض',
        text: `${hi(ctx.customerName)}، معاك ${ctx.storeName}.\nلو مش متأكد من الاختيار ابعتلي مقاسك أو اللي بتدوّر عليه وأنا أرشّحلك الأنسب.${link}`,
      },
    ],

    contact: [
      {
        id: 'contact-finish',
        label: 'فاضل العنوان بس',
        why: 'كتب بياناته يعني نيّته جادّة — فكّره إن الباقي خطوة واحدة',
        primary: true,
        text: `${hi(ctx.customerName)} 👋 معاك ${ctx.storeName}\n\nطلبك (${what}) بإجمالي ${ctx.total} محفوظ ومستنّي عنوان التوصيل بس.\nكمّله من هنا في أقل من دقيقة، أو ابعتلي عنوانك هنا وأنا أسجّله لك.${link}`,
      },
      {
        id: 'contact-whatsapp',
        label: 'أكمله أنا بدالك',
        why: 'اللي بيكسل من ملء النماذج بيكمّل على الواتساب في ثانية',
        text: `${hi(ctx.customerName)}، لو النموذج طويل عليك مش مشكلة.\nابعتلي عنوانك بالكامل هنا على الواتساب وأنا أسجّل الطلب بنفسي وأبعتلك التأكيد.${link}`,
      },
      {
        id: 'contact-cod',
        label: 'طمّنه على الدفع',
        why: 'أكتر سبب للوقوف بعد البيانات هو الخوف من الدفع مقدّمًا',
        text: `${hi(ctx.customerName)}، حبّيت أطمّنك إن الدفع عندنا عند الاستلام — تشوف الطلب الأول وتدفع للمندوب.\nطلبك لسه محفوظ.${link}`,
      },
    ],

    address: [
      {
        id: 'address-finish',
        label: 'فاضل الدفع بس',
        why: 'ملا عنوانه — يعني وصل لآخر خطوة. الجملة دي بترجّع أعلى نسبة',
        primary: true,
        text: `${hi(ctx.customerName)} 👋 معاك ${ctx.storeName}\n\nطلبك (${what}) بإجمالي ${ctx.total} جاهز وعنوانك متسجّل. فاضل تختار طريقة الدفع وتأكّد بس.${link}`,
      },
      {
        id: 'address-shipping',
        label: 'اشرحله الشحن',
        why: 'الوقوف بعد العنوان غالبًا سببه سعر الشحن أو مدّة التوصيل',
        text: `${hi(ctx.customerName)}، بخصوص طلبك من ${ctx.storeName} — التوصيل لعندك بيوصل خلال ٢–٤ أيام، والإجمالي بالشحن ${ctx.total}.\nلو ده مناسب كمّل من هنا وأنا أجهّزه النهاردة.${link}`,
      },
      {
        id: 'address-confirm',
        label: 'أكّده أنا بدالك',
        why: 'موافقة برسالة أسرع من إنه يرجع للموقع',
        text: `${hi(ctx.customerName)}، أقدر أسجّل الطلب بنفسي دلوقتي وأبعتهولك بالدفع عند الاستلام.\nرد بـ«تمام» وأنا أأكّده على طول.${link}`,
      },
    ],

    payment: [
      {
        id: 'payment-retry',
        label: 'الدفع وقف معاك؟',
        why: 'وصل للدفع ووقف — أغلب الحالات دي عطل تقني مش تراجع',
        primary: true,
        text: `${hi(ctx.customerName)} 👋 معاك ${ctx.storeName}\n\nشُفت إن طلبك (${what}) بإجمالي ${ctx.total} وقف عند خطوة الدفع.\nلو حصلت مشكلة في الدفع، قولّي وأنا أظبّطهالك أو أحوّلك للدفع عند الاستلام.${link}`,
      },
      {
        id: 'payment-cod',
        label: 'حوّله لدفع عند الاستلام',
        why: 'الحل الأسرع لمن وقف عند بوابة الدفع',
        text: `${hi(ctx.customerName)}، لو مش مرتاح للدفع أونلاين تقدر تدفع عند الاستلام عادي.\nرد بـ«عند الاستلام» وأنا أأكّد طلبك (${ctx.total}) على طول.${link}`,
      },
      {
        id: 'payment-hold',
        label: 'حجزتلك الطلب',
        why: 'الطمأنة إن اللي اختاره متحجّز بتقفل الموضوع',
        text: `${hi(ctx.customerName)}، حجزتلك ${what} لحد بكرة عشان ما يخلصش.\nكمّل الدفع من هنا وقت ما تحب.${link}`,
      },
    ],
  }

  return [...optionFirst, ...(byStage[stageMeta(stage).key] ?? byStage.cart)]
}
