import 'server-only'
import { getStorePixels } from './storefront'
import { readConnections } from './marketplace'
import { readWhatsapp } from './whatsapp'

/**
 * قنوات البيع — **شاشة تشخيص لا شاشة إعداد تانية**.
 *
 * ## المشكلة اللي بتحلّها
 * كل قطعة من ربط القناة موجودة عندنا وشغّالة، بس كل واحدة في مكان:
 * البكسل في «الإضافات»، وملف الكتالوج في «ربط الكتالوج»، ورابط
 * الصفحة في «بيانات المتجر»، والواتساب في إعداداته.
 *
 * التاجر اللي عايز «أبيع على إنستجرام» ما يعرفش إن ده تلات خطوات
 * في تلات شاشات — ولا يعرف إنه خلّص اتنين وفاضل واحدة. الصفحة دي
 * بتجمّع **الحالة** في مكان واحد وبتوديه للخطوة الناقصة بالظبط.
 *
 * ## وما بتخزّنش حاجة
 * مفيش جدول ولا إعداد جديد. كل اللي هنا قراءة من اللي متسجّل أصلًا،
 * فمفيش مصدرين للحقيقة يتفرّقوا مع الوقت — وده بالظبط اللي خلّى
 * المفتاح المكرّر في السلة يبقى مشكلة قبل كده.
 */

export type ChannelStepStatus = 'done' | 'missing'

export type ChannelStep = {
  label: string
  hint: string
  status: ChannelStepStatus
  href: string
}

export type ChannelCard = {
  key: string
  name: string
  color: string
  /** ليه التاجر يهتم بالقناة دي — بلغته هو */
  why: string
  steps: ChannelStep[]
}

const step = (
  label: string,
  hint: string,
  done: boolean,
  href: string,
): ChannelStep => ({ label, hint, status: done ? 'done' : 'missing', href })

export async function loadSalesChannels(input: {
  storeId: string
  socialLinks: Record<string, string>
  storeWhatsapp: string | null
}): Promise<ChannelCard[]> {
  const [pixels, feeds, whatsapp] = await Promise.all([
    getStorePixels(input.storeId),
    readConnections(input.storeId),
    readWhatsapp(input.storeId),
  ])

  const social = input.socialLinks ?? {}

  return [
    {
      key: 'meta',
      name: 'فيسبوك وإنستجرام',
      color: '#0866ff',
      why: 'أكبر مصدر طلبات لأغلب المتاجر في مصر. الكتالوج بيخلّي منتجاتك تظهر في الإعلانات وفي متجر صفحتك، والبكسل بيقيس مين اشترى فعلًا.',
      steps: [
        step(
          'بكسل ميتا',
          'من غيره إعلانك بيصرف على الفاضي — مش عارف مين اشترى',
          Boolean(pixels.facebookPixelId),
          '/dashboard/plugins',
        ),
        step(
          'ملف الكتالوج',
          'منتجاتك بتظهر في الإعلانات وبتتحدّث لوحدها',
          feeds.meta?.enabled ?? false,
          '/dashboard/marketplace',
        ),
        step(
          'رابط صفحتك',
          'بيظهر في فوتر متجرك — والعميل بيتطمّن لما يلاقيك',
          Boolean(social.facebook || social.instagram),
          '/dashboard/settings',
        ),
      ],
    },
    {
      key: 'tiktok',
      name: 'تيك توك',
      color: '#010101',
      why: 'أرخص وصول دلوقتي للجمهور الصغير. البكسل والكتالوج نفس فكرة ميتا بالظبط.',
      steps: [
        step(
          'بكسل تيك توك',
          'بيقيس نتايج إعلاناتك ويحسّن استهدافها',
          Boolean(pixels.tiktokPixelId),
          '/dashboard/plugins',
        ),
        step(
          'ملف الكتالوج',
          'لإعلانات المنتجات الديناميكية',
          feeds.tiktok?.enabled ?? false,
          '/dashboard/marketplace',
        ),
        step(
          'رابط حسابك',
          'بيظهر في فوتر متجرك',
          Boolean(social.tiktok),
          '/dashboard/settings',
        ),
      ],
    },
    {
      key: 'google',
      name: 'جوجل',
      color: '#4285f4',
      why: 'اللي بيدوّر على منتجك بالاسم جاهز يشتري أكتر من اللي شافه في إعلان. الكتالوج بيحطّك في نتايج الشوبينج.',
      steps: [
        step(
          'جوجل ميرشانت',
          'منتجاتك في نتايج شوبينج وإعلانات الأداء الأقصى',
          feeds.google?.enabled ?? false,
          '/dashboard/marketplace',
        ),
        step(
          'تتبّع التحويلات',
          'بيربط الطلب بالإعلان اللي جابه',
          Boolean(pixels.googleAdsId || pixels.gaMeasurementId),
          '/dashboard/plugins',
        ),
        step(
          'الظهور في البحث',
          'عنوان ووصف متجرك في نتايج جوجل',
          true,
          '/dashboard/settings/seo',
        ),
      ],
    },
    {
      key: 'whatsapp',
      name: 'واتساب',
      color: '#25d366',
      why: 'أهم قناة في السوق ده: أغلب العملاء بيسألوا قبل ما يشتروا، والتأكيد على واتساب بيقلّل رفض الاستلام.',
      steps: [
        step(
          'رقم متجرك',
          'زرار واتساب في المتجر — العميل بيسأل قبل ما يشتري',
          Boolean(input.storeWhatsapp),
          '/dashboard/settings',
        ),
        step(
          'إرسال آلي',
          'تأكيد الطلب وتذكير السلة المتروكة بيروحوا لوحدهم',
          whatsapp.provider !== 'off' && whatsapp.hasKey,
          '/dashboard/settings/whatsapp',
        ),
      ],
    },
    {
      key: 'snapchat',
      name: 'سناب شات',
      color: '#fffc00',
      why: 'جمهور أصغر سنًا، ومنافسة أقل على الإعلانات — بيفرق في بعض الفئات زي الموضة والإكسسوارات.',
      steps: [
        step(
          'بكسل سناب',
          'بيقيس إعلاناتك ويبني جمهور مشابه',
          Boolean(pixels.snapchatPixelId),
          '/dashboard/plugins',
        ),
      ],
    },
  ]
}

/** كام خطوة خلصت من كام — للشريط اللي فوق كل كارت */
export function channelProgress(card: ChannelCard): { done: number; total: number } {
  return {
    done: card.steps.filter((s) => s.status === 'done').length,
    total: card.steps.length,
  }
}
