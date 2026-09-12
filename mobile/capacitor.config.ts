import type { CapacitorConfig } from '@capacitor/cli'

/**
 * تطبيق زاوية — أندرويد وiOS.
 *
 * ## ليه التطبيق بيشغّل المنصة الحيّة لا نسخة منها
 * المنصة كلها منطق على الخادم: جلسات، أفعال خادم، قاعدة بيانات، ومفاتيح
 * مشفّرة ما يصحّش تنزل على موبايل حد. نسخة «مستقلة» كانت هتبقى تطبيقًا
 * تاني بيتكتب من الأول وبيتأخر عن الويب في كل ميزة جديدة.
 *
 * هنا كل ميزة بتنزل على الموقع بتظهر في التطبيق في نفس اللحظة من غير
 * تحديث من المتجر، وطبقة التطبيق (`src/`) بتضيف فوقها اللي الويب ما
 * يقدرش يعمله: شاشة افتتاح، تنقّل بحركة، لمسات اهتزاز، مشاركة وتنزيل
 * وطباعة أصلية، زرار الرجوع، والشغل من غير نت.
 */
const SITE_HOST = 'www.zawyaeg.site'

const config: CapacitorConfig = {
  appId: 'site.zawyaeg.app',
  appName: 'زاوية',
  webDir: 'www',

  /* لون الخلفية قبل أول رسم — نفس خلفية الوضع الداكن عشان ما يبانش وميض أبيض */
  backgroundColor: '#14162a',

  /* الموقع بيعرف إنه جوّه التطبيق من هنا لو احتاج في يوم */
  appendUserAgent: 'ZawyaApp/1.0',

  server: {
    url: `https://${SITE_HOST}`,
    /*
      التطبيق للتاجر: بيفتح على اللوحة، والخادم بيحوّل لتسجيل الدخول
      لو مفيش جلسة. الصفحة التعريفية مالهاش لازمة لحد نزّل التطبيق.
    */
    appStartPath: 'dashboard',
    /* بتظهر لو أول تحميل فشل (مفيش نت مثلًا) */
    errorPath: 'offline.html',
    /*
      المنصة بس. نطاقات المتاجر (الفرعية والمخصّصة) **مش** هنا عن قصد:
      المتجر بيحمّل أكواد التاجر في رأس الصفحة، وأي صفحة في القايمة
      دي بتوصل لجسر التطبيق. المتاجر بتفتح في متصفح داخل التطبيق.
    */
    allowNavigation: [SITE_HOST, 'zawyaeg.site'],
  },

  android: {
    allowMixedContent: false,
    /* لوحة المفاتيح بتدفع المحتوى لفوق بدل ما تغطّي الحقل */
    captureInput: false,
  },

  ios: {
    /*
      المحتوى بيبدأ تحت شريط الحالة لا وراه — والشريط نفسه بيتلوّن
      بلون الصفحة من الطبقة الأصلية. التفاصيل في ZawyaViewController.
    */
    contentInset: 'always',
    allowsLinkPreview: false,
    preferredContentMode: 'mobile',
    limitsNavigationsToAppBoundDomains: false,
  },

  plugins: {
    SplashScreen: {
      /*
        الطبقة بتخفي الشاشة الأصلية أول ما شاشة الافتتاح المتحركة ترسم.
        المدة هنا احتياطي بس — لو الصفحة ما حمّلتش، ما تفضلش واقفة.
      */
      launchAutoHide: true,
      launchShowDuration: 3500,
      launchFadeOutDuration: 250,
      backgroundColor: '#171633',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    SystemBars: {
      /*
        الطبقة بتلغي viewport-fit=cover جوّه التطبيق، فالمحتوى بيتحط بين
        شريط الحالة وشريط التنقّل، والشريطين بياخدوا لون الصفحة.
      */
      insetsHandling: 'css',
    },
  },
}

export default config
