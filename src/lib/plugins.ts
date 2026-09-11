/**
 * كتالوج الإضافات.
 *
 * كل إضافة هنا لازم يكون ليها أثر حقيقي في المتجر — نفس قاعدة التخصيص.
 * البكسلات دي اللي التاجر يقدر يشغّلها بنفسه دلوقتي: بيلصق المعرّف
 * وتشتغل فورًا من غير أي عقد أو موافقة.
 */

export type PluginField = {
  key: string
  label: string
  placeholder?: string
  hint?: string
}

export type PluginDef = {
  slug: string
  name: string
  desc: string
  /** المجموعة في الواجهة */
  group: 'pixels' | 'analytics' | 'ai' | 'messaging'
  fields: PluginField[]
  /** إزاي التاجر يجيب المعرّف — بيوفّر عليه بحث */
  where?: string
  /**
   * إضافة ليها شاشة إعداد خاصة بدل حقول النص العادية.
   *
   * إضافات الذكاء الاصطناعي محتاجة تحقّق من المفتاح واختيار موديل
   * ووصف للمتجر — ده مش «الصق معرّفًا واقفل».
   */
  custom?: 'gemini' | 'gemini_pro' | 'claude' | 'whatsapp'
  /**
   * الإضافة ليها شاشة كاملة في اللوحة.
   *
   * الإعداد بتاعها مش «الصق معرّفًا» — دي أداة بتتفتح وبتتشغّل.
   * الزرار بيبان بعد التفعيل بس: قبله بيودّي على شاشة بتقول
   * «الإضافة مش مفعّلة»، وده طريق مسدود بيرجّع التاجر من حيث بدأ.
   */
  openHref?: string
  openLabel?: string
  /** بيتحفظ في العمود المشفّر لا في config — مفتاح API مش معرّف عام */
  secretFields?: string[]
}

export const PLUGINS: PluginDef[] = [
  {
    slug: 'whatsapp',
    name: 'واتساب المتجر',
    desc:
      'رمز دخول العميل، وتأكيد الطلب، وكل تغيير في حالة الشحن — بتوصل على واتساب باسم متجرك ومن رقمك إنت. اربط بمسح كود زي واتساب ويب، واكتب نصوص الرسايل بصوتك.',
    group: 'messaging',
    custom: 'whatsapp',
    secretFields: ['accessToken'],
    fields: [],
    where:
      'محتاج حساب على wasenderapi.com (فيه تجربة مجانية) — تنسخ منه Personal Access Token وتلزقه هنا مرة واحدة، وبعدها كل حاجة من لوحتك. أو اربط واتساب بزنس الرسمي من ميتا لو عندك.',
  },

  {
    slug: 'facebook_pixel',
    name: 'بكسل فيسبوك وإنستجرام',
    desc:
      'بيقيس زيارات متجرك ومبيعاتك من إعلانات ميتا، وبيبني جمهور إعادة الاستهداف. ' +
      'ومع توكن التحويلات، حدث الشرا بيخرج من الخادم كمان — فبيوصل حتى لو مانع ' +
      'الإعلانات أو iOS وقّفوا البكسل في متصفح العميل.',
    group: 'pixels',
    secretFields: ['accessToken'],
    fields: [
      { key: 'pixelId', label: 'معرّف البكسل', placeholder: '1234567890123456' },
      {
        key: 'accessToken',
        label: 'توكن واجهة التحويلات (اختياري)',
        placeholder: 'EAAxxxxxxxxxxxx',
      },
    ],
    where:
      'المعرّف من Meta Events Manager ← Data Sources ← البكسل بتاعك ← الرقم فوق الاسم. ' +
      'والتوكن من نفس الصفحة ← Settings ← Conversions API ← Generate access token.',
  },
  {
    slug: 'tiktok_pixel',
    name: 'بكسل تيك توك',
    desc:
      'بيقيس نتايج إعلانات تيك توك ويحسّن استهدافها. ومع توكن الأحداث، ' +
      'الشرا بيتبعت من الخادم كمان.',
    group: 'pixels',
    secretFields: ['accessToken'],
    fields: [
      { key: 'pixelId', label: 'معرّف البكسل', placeholder: 'C4XXXXXXXXXXXXXXXXXX' },
      { key: 'accessToken', label: 'توكن واجهة الأحداث (اختياري)', placeholder: 'xxxxxxxx' },
    ],
    where:
      'المعرّف من TikTok Ads Manager ← Assets ← Events ← Web Events. ' +
      'والتوكن من نفس الصفحة ← Settings ← Events API ← Generate Access Token.',
  },
  {
    slug: 'snapchat_pixel',
    name: 'بكسل سناب شات',
    desc: 'بيقيس إعلانات سناب — مهم لجمهور الشباب في مصر والخليج.',
    group: 'pixels',
    fields: [{ key: 'pixelId', label: 'معرّف البكسل', placeholder: 'xxxxxxxx-xxxx-xxxx' }],
    where: 'من Snapchat Ads Manager ← Events Manager.',
  },
  {
    slug: 'google_analytics',
    name: 'جوجل أناليتكس (GA4)',
    desc: 'تقارير تفصيلية عن زوّار متجرك: منين جم، وإيه اللي بصّوا عليه.',
    group: 'analytics',
    fields: [{ key: 'measurementId', label: 'معرّف القياس', placeholder: 'G-XXXXXXXXXX' }],
    where: 'من Google Analytics ← Admin ← Data Streams ← الويب.',
  },
  {
    slug: 'google_ads',
    name: 'جوجل أدز',
    desc: 'بيتابع التحويلات من إعلانات جوجل والشوبينج.',
    group: 'pixels',
    fields: [
      { key: 'conversionId', label: 'معرّف التحويل', placeholder: 'AW-XXXXXXXXX' },
      { key: 'conversionLabel', label: 'ليبل التحويل (اختياري)', placeholder: 'abcDEF123' },
    ],
    where: 'من Google Ads ← Tools ← Conversions.',
  },

  {
    slug: 'gemini',
    name: 'الردّ على عملائك — Gemini وChatGPT',
    desc:
      'بوت في متجرك بيرد على أسئلة الزوّار: عندكم إيه، السعر كام، الشحن بيوصل امتى — ' +
      'من بيانات متجرك الحقيقية. ومعاه زرار «تحسين» جنب كل حقل نص في لوحتك. ' +
      '**بيشتغل بـGemini أو ChatGPT** — حط مفتاح واحد أو الاتنين وإنت تختار مين يكلّم عملاءك. ' +
      'ولو وقف أو خلص رصيده، بيحوّل العميل على واتسابك بدل ما يسيبه.',
    group: 'ai',
    custom: 'gemini',
    secretFields: ['apiKey', 'openaiKey'],
    fields: [
      { key: 'apiKey', label: 'مفتاح Gemini (Google)', placeholder: 'مفتاحك من Google AI Studio' },
      { key: 'openaiKey', label: 'مفتاح ChatGPT (OpenAI)', placeholder: 'sk-…' },
    ],
    where:
      'Gemini من aistudio.google.com ← Get API key، وChatGPT من platform.openai.com ← API keys. ' +
      'بنتحقق من كل مفتاح بنداء حقيقي مش بشكله. **الاتنين محتاجين رصيد أو فوترة** عشان البوت ما يقفش ' +
      'قدام عميل بيسأل — وأي اشتراك في تطبيق ChatGPT (مجاني أو Go أو Plus أو Pro) منفصل عن رصيد الـAPI.',
  },

  {
    slug: 'gemini_pro',
    name: 'مساعدك في إدارة المتجر — Gemini وChatGPT',
    desc:
      'مش بيكتب بس — بيعمل. اسأله «أعمل خصم إزاي» يشرحلك ويعملهولك. ابعتله صور منتج ' +
      'وسعره يضيفه. غيّر حالة طلب، اعمل قسم، انشر المتجر — كل ده من الشات. ' +
      'وبيدّيك «حدّد واسأل»: حدّد أي نص في لوحتك واكتب اللي عايزه فيه. ' +
      'وكل إجراء بيغيّر حاجة بيتعرض عليك بالعربي وما بيتنفّذش غير لما توافق. ' +
      '**بيشتغل بـGemini أو ChatGPT** وتبدّل بينهم من جوّه الشات.',
    group: 'ai',
    custom: 'gemini_pro',
    secretFields: ['apiKey', 'openaiKey'],
    fields: [
      { key: 'apiKey', label: 'مفتاح Gemini (اختياري)', placeholder: 'سيبه فاضي عشان يستخدم مفتاح البوت' },
      { key: 'openaiKey', label: 'مفتاح ChatGPT (اختياري)', placeholder: 'سيبه فاضي عشان يستخدم مفتاح البوت' },
    ],
    where:
      'سيب المفاتيح فاضية عشان يستخدم مفاتيح «الردّ على عملائك». ' +
      '**المساعد محتاج مفتاح عليه رصيد**: هو بيقرا بيانات متجرك في كل سؤال وبيعدّل الصور، ' +
      'فاستهلاكه أعلى بكتير من البوت.',
  },

  {
    slug: 'claude',
    name: 'مصمّم الثيمات وصفحات الهبوط — Claude وGemini وChatGPT',
    desc:
      'مش عاجبك ولا ثيم من اللي عندنا؟ اوصف اللي في دماغك — الألوان والشكل والتخطيط — ' +
      'وهيعملهولك، وتقدر تعدّله بعدين من محرّر التخصيص زي أي ثيم. ' +
      'ونفس الحكاية في صفحات الهبوط. ' +
      '**بيشتغل بـClaude أو Gemini أو ChatGPT** — حطّ اللي معاك، أو أكتر من واحد واختار الموديل.',
    group: 'ai',
    custom: 'claude',
    secretFields: ['apiKey', 'geminiKey', 'openaiKey'],
    fields: [{ key: 'apiKey', label: 'مفتاح Anthropic API', placeholder: 'مفتاحك من console.anthropic.com' }],
    where:
      'Claude من console.anthropic.com ← API Keys، وGemini من aistudio.google.com ← Get API key، ' +
      'وChatGPT من platform.openai.com ← API keys. **التلاتة محتاجين رصيد**: Anthropic وOpenAI ' +
      'مفيهمش خطة مجانية للـAPI، وحصّة Gemini المجانية بتقف بسرعة مع التوليد الطويل.',
  },

  {
    slug: 'studio',
    name: 'استوديو المحتوى والنشر التلقائي',
    desc:
      'بيعمل صور إعلانية وبوستات لمنتجاتك — وهو عارف بضاعتك بأسمائها وأسعارها ' +
      'ووصفها، مش بيخمّن. تختار المنتج من متجرك وتقوله عايز إيه، وتعدّل على الصورة ' +
      'بالكلام لحد ما تعجبك. ' +
      'واللي بيفرق فعلًا: تقوله «كل يوم الساعة ٩» وهو بيعمل البوست وينشره لوحده ' +
      'على صفحتك — فيسبوك وإنستجرام وتيك توك.',
    group: 'ai',
    openHref: '/dashboard/studio',
    openLabel: 'افتح الاستوديو',
    secretFields: [],
    fields: [],
    where:
      'بيشتغل بمفتاح Gemini أو ChatGPT اللي حاططه في «الردّ على عملائك» أو «مساعدك في إدارة المتجر» — ' +
      'مش محتاج مفتاح تالت، ولو الاتنين موجودين بتختار. **بس لازم يكون عليه رصيد**: توليد الصور ' +
      'أغلى بكتير من النص. ' +
      'والربط بصفحاتك مجاني تمامًا — مفيش رسوم على فيسبوك ولا تيك توك.',
  },
]

export function getPlugin(slug: string) {
  return PLUGINS.find((p) => p.slug === slug)
}

/** الإعدادات اللي المتجر بيحتاجها لحقن السكربتات */
export type ActivePixels = {
  facebookPixelId?: string
  tiktokPixelId?: string
  snapchatPixelId?: string
  gaMeasurementId?: string
  googleAdsId?: string
}
