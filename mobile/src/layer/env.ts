/**
 * ثوابت التطبيق وأدوات صغيرة بتتشارك بين أجزاء الطبقة.
 */

declare const __ZAWYA_VERSION__: string
declare const __ZAWYA_DEV__: boolean
declare const __ZAWYA_ASSETS__: { mark: string; markWhite: string; typo: string; typoWhite: string }

export const VERSION = __ZAWYA_VERSION__
export const ASSETS = __ZAWYA_ASSETS__

export const SITE_HOST = 'www.zawyaeg.site'
export const SITE_ORIGIN = `https://${SITE_HOST}`
/**
 * المضيفات اللي بتتفتح جوّه التطبيق — أي حاجة غيرها بره.
 * نسخة التطوير (`--dev`) بتقبل localhost عشان صفحة التجربة في `dev/`.
 */
export const APP_HOSTS = new Set([SITE_HOST, 'zawyaeg.site', ...(__ZAWYA_DEV__ ? ['localhost'] : [])])

export const IS_ANDROID = /android/i.test(navigator.userAgent)
export const PLATFORM: 'android' | 'ios' = IS_ANDROID ? 'android' : 'ios'

export const HOME_PATH = '/dashboard'

/**
 * صفحات «أول الطريق»: الرجوع منها بيخرج من التطبيق بدل ما يرجّع لصفحة قبلها.
 *
 * `/login` منهم لأن اللي قبلها في السجل غالبًا صفحة لوحة بعد تسجيل الخروج —
 * والرجوع ليها بيحوّل لتسجيل الدخول تاني، فالتاجر يلفّ في دايرة.
 */
export const ROOT_PATHS = new Set([HOME_PATH, '/login'])

export const prefersReducedMotion = (): boolean =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** نفس منطق المنصة: الاختيار الصريح يغلب تفضيل الجهاز */
export function isDarkTheme(): boolean {
  const chosen = document.documentElement.getAttribute('data-theme')
  if (chosen === 'dark') return true
  if (chosen === 'light') return false
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

/*
  التخزين ممكن يرمي استثناء (وضع خاص، أو مساحة ممتلئة). الطبقة ما يصحّش
  تقع بسببه — أسوأ نتيجة إن التعريف بالتطبيق يظهر مرة زيادة.
*/
function safeStore(kind: 'localStorage' | 'sessionStorage') {
  return {
    get(key: string): string | null {
      try {
        return window[kind].getItem(key)
      } catch {
        return null
      }
    },
    set(key: string, value: string): void {
      try {
        window[kind].setItem(key, value)
      } catch {
        /* تجاهل */
      }
    },
  }
}

export const storage = safeStore('localStorage')
export const session = safeStore('sessionStorage')

export const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export const nextFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))

export function onDomReady(run: () => void): void {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true })
  else run()
}
