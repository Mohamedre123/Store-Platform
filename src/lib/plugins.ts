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
  group: 'pixels' | 'analytics'
  fields: PluginField[]
  /** إزاي التاجر يجيب المعرّف — بيوفّر عليه بحث */
  where?: string
}

export const PLUGINS: PluginDef[] = [
  {
    slug: 'facebook_pixel',
    name: 'بكسل فيسبوك وإنستجرام',
    desc: 'بيقيس زيارات متجرك ومبيعاتك من إعلانات ميتا، وبيبني جمهور إعادة الاستهداف.',
    group: 'pixels',
    fields: [{ key: 'pixelId', label: 'معرّف البكسل', placeholder: '1234567890123456' }],
    where: 'من Meta Events Manager ← Data Sources ← البكسل بتاعك ← الرقم فوق الاسم.',
  },
  {
    slug: 'tiktok_pixel',
    name: 'بكسل تيك توك',
    desc: 'بيقيس نتايج إعلانات تيك توك ويحسّن استهدافها.',
    group: 'pixels',
    fields: [{ key: 'pixelId', label: 'معرّف البكسل', placeholder: 'C4XXXXXXXXXXXXXXXXXX' }],
    where: 'من TikTok Ads Manager ← Assets ← Events ← Web Events.',
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
