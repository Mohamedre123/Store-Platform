/**
 * طبقة تطبيق زاوية.
 *
 * بتتحقن من الطبقة الأصلية في أول كل صفحة من المنصة (قبل أي سكربت
 * للموقع)، وبتحوّل الموقع لتجربة تطبيق: افتتاح وتعريف، حركة، رجوع،
 * اهتزاز، ملفات، وحالة اتصال.
 *
 * قاعدة: لا شيء هنا بيغيّر منطق المنصة أو بياناتها. لو الطبقة كلها
 * فشلت، التطبيق بيفضل شغّال كموقع كامل.
 */
import { APP_HOSTS, HOME_PATH, PLATFORM, VERSION, nextFrame, session, wait } from './env'
import { native } from './bridge'
import { injectPageStyles } from './dom'
import { installSystemBars, installViewportFix, requestChromeSync } from './chrome'
import { mountLaunch, pageReady } from './launch'
import { mountOnboarding, needsOnboarding } from './onboarding'
import { installNavigation, onRouteChange } from './navigation'
import { installFileSupport } from './files'
import { installGestures } from './gestures'
import { installNetworkWatch } from './network'

declare global {
  interface Window {
    __zawyaApp?: string
  }
}

function markDocument(): void {
  const html = document.documentElement
  const classes = ['zw-app', `zw-app-${PLATFORM}`]
  const apply = () => classes.forEach((c) => html.classList.contains(c) || html.classList.add(c))
  apply()
  /* لو React أعاد رسم الـ<html> (صفحة خطأ عامة مثلًا) الكلاسات بتتمسح */
  new MutationObserver(apply).observe(html, { attributes: true, attributeFilter: ['class'] })
}

async function launchSequence(cold: boolean): Promise<void> {
  const launch = cold ? mountLaunch() : null

  /* الشاشة الأصلية تتشال أول ما حاجة من عندنا (أو الصفحة) ترسم */
  await nextFrame()
  void native('SplashScreen', 'hide', { fadeOutDuration: launch ? 120 : 220 })

  if (!launch) {
    if (needsOnboarding()) mountOnboarding()
    return
  }

  /* حد أدنى للظهور عشان الحركة تكمل — ومش أكتر من كده */
  await Promise.all([wait(1150), pageReady()])
  if (needsOnboarding()) mountOnboarding()
  await launch.hide()
}

function boot(): void {
  /* إطار معاينة الثيم جوّه اللوحة — الطبقة للصفحة الرئيسية بس */
  if (window.top !== window) return
  if (!APP_HOSTS.has(location.hostname)) return
  if (window.__zawyaApp) return
  window.__zawyaApp = VERSION

  /* الصفحة التعريفية مالهاش لازمة جوّه التطبيق */
  if (location.pathname === '/') {
    location.replace(HOME_PATH + location.search)
    return
  }

  markDocument()
  injectPageStyles()
  installViewportFix()
  installFileSupport()
  installNavigation()
  installSystemBars()
  onRouteChange(() => {
    requestChromeSync(60)
    requestChromeSync(420)
  })

  const cold = session.get('zw-launched') !== '1'
  session.set('zw-launched', '1')
  void launchSequence(cold)

  const start = () => {
    installGestures()
    installNetworkWatch()
  }
  if (document.body) start()
  else document.addEventListener('DOMContentLoaded', start, { once: true })
}

try {
  boot()
} catch (err) {
  console.error('[zawya] layer failed', err)
}
