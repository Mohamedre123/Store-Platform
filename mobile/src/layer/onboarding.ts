/**
 * التعريف بالتطبيق — أول مرة بس، ولحد مالوش حساب مفتوح.
 *
 * اللي فاتح اللوحة على طول (عنده جلسة) عارف المنصة، فالتعريف بيتعلّم
 * عليه إنه اتشاف من غير ما يظهر.
 */
import { ASSETS, isDarkTheme, storage } from './env'
import { el, layer } from './dom'
import { icons } from './icons'
import { haptic } from './bridge'
import { setChromeOverride } from './chrome'
import { registerBackHandler } from './navigation'

const KEY = 'zw-onboarded'

export function markOnboarded(): void {
  storage.set(KEY, '1')
}

export function needsOnboarding(): boolean {
  if (storage.get(KEY) === '1') return false
  const path = location.pathname
  if (path.startsWith('/dashboard') || path.startsWith('/mandoub')) {
    markOnboarded()
    return false
  }
  return path === '/login' || path === '/signup'
}

type Slide = { icon: string; title: string; body: string; chipA: string; chipB: string }

const slides: Slide[] = [
  {
    icon: icons.store(),
    title: 'متجرك في جيبك',
    body: 'افتح متجرك وديره من موبايلك: منتجات وطلبات وشحن ودفع — كله في مكان واحد.',
    chipA: `${icons.bag()}طلب جديد #1042`,
    chipB: `${icons.trending()}مبيعات النهارده ↑`,
  },
  {
    icon: icons.bell(),
    title: 'كل طلب لحظة ما يوصل',
    body: 'أكّد واشحن وتابع أرباحك الحقيقية بالأرقام، من غير ما تفتح لابتوب.',
    chipA: `${icons.truck()}الشحنة في الطريق`,
    chipB: `${icons.check()}اتدفع أونلاين`,
  },
  {
    icon: icons.sparkles(),
    title: 'ذكاء اصطناعي شغّال معاك',
    body: 'صور إعلانات وكلام بيع ونشر تلقائي على السوشيال — بضغطة واحدة.',
    chipA: `${icons.image()}صورة إعلان جاهزة`,
    chipB: `${icons.sparkles()}بوست اتنشر`,
  },
]

export function mountOnboarding(): void {
  const dark = isDarkTheme()
  const root = el('div', `ob${dark ? '' : ' ob--light'}`)
  root.setAttribute('role', 'dialog')
  root.setAttribute('aria-modal', 'true')
  root.setAttribute('aria-label', 'التعريف بزاوية')

  root.innerHTML = `
    <div class="ob-orb ob-orb--a"></div>
    <div class="ob-orb ob-orb--b"></div>
    <div class="ob-top">
      <img class="ob-brand" src="${dark ? ASSETS.typoWhite : ASSETS.typo}" alt="زاوية">
      <button class="ob-skip" type="button">تخطّي</button>
    </div>
    <div class="ob-track">
      ${slides
        .map(
          (s, i) => `
        <section class="ob-slide${i === 0 ? ' is-active' : ''}" aria-roledescription="شريحة" aria-label="${i + 1} من ${slides.length}">
          <div class="ob-art">
            <div class="ob-ring"></div>
            <div class="ob-ring ob-ring--in"></div>
            <div class="ob-core">${s.icon}</div>
            <div class="ob-chip ob-chip--a">${s.chipA}</div>
            <div class="ob-chip ob-chip--b${i > 0 ? ' ob-chip--good' : ''}">${s.chipB}</div>
          </div>
          <h2>${s.title}</h2>
          <p>${s.body}</p>
        </section>`,
        )
        .join('')}
    </div>
    <div class="ob-bottom">
      <div class="ob-dots">${slides.map((_, i) => `<span class="ob-dot${i === 0 ? ' on' : ''}"></span>`).join('')}</div>
      <button class="ob-btn" type="button"></button>
      <button class="ob-link" type="button" hidden>عندك حساب؟ <b>سجّل دخول</b></button>
    </div>`

  layer().appendChild(root)
  setChromeOverride(dark ? '#1f1b3c' : '#f5f4fb')

  const track = root.querySelector('.ob-track') as HTMLElement
  const slideNodes = Array.from(root.querySelectorAll<HTMLElement>('.ob-slide'))
  const dots = Array.from(root.querySelectorAll<HTMLElement>('.ob-dot'))
  const primary = root.querySelector('.ob-btn') as HTMLButtonElement
  const secondary = root.querySelector('.ob-link') as HTMLButtonElement
  const skip = root.querySelector('.ob-skip') as HTMLButtonElement

  let index = 0
  const last = slides.length - 1

  function render() {
    slideNodes.forEach((s, i) => s.classList.toggle('is-active', i === index))
    dots.forEach((d, i) => d.classList.toggle('on', i === index))
    primary.innerHTML = index === last ? 'افتح متجرك مجانًا' : `التالي${icons.arrowNext()}`
    secondary.hidden = index !== last
    skip.style.visibility = index === last ? 'hidden' : 'visible'
  }

  /*
    الشرائح بتتحرك بالسحب (scroll-snap) مش بـJS — عشان تبقى بنفس نعومة
    وفيزياء التمرير الأصلية للجهاز. الـJS بس بيعرف احنا فين.
    في RTL قيمة scrollLeft بتبقى سالبة، فبنستخدم القيمة المطلقة.
  */
  function goTo(i: number) {
    index = Math.max(0, Math.min(last, i))
    track.scrollTo({ left: -index * track.clientWidth, behavior: 'smooth' })
    render()
  }

  let scrollTimer = 0
  track.addEventListener(
    'scroll',
    () => {
      window.clearTimeout(scrollTimer)
      scrollTimer = window.setTimeout(() => {
        const i = Math.round(Math.abs(track.scrollLeft) / Math.max(1, track.clientWidth))
        if (i !== index) {
          index = Math.max(0, Math.min(last, i))
          haptic('LIGHT')
          render()
        }
      }, 60)
    },
    { passive: true },
  )

  const unregisterBack = registerBackHandler(() => {
    if (index > 0) goTo(index - 1)
    /* في أول شريحة الرجوع ما بيعملش حاجة — التعريف لازم يتقفل بقرار */
    return true
  })

  function finish(target: '/signup' | '/login' | null) {
    markOnboarded()
    unregisterBack()
    haptic('MEDIUM')
    if (target && target !== location.pathname) {
      /* الصفحة الحالية بتفضل ظاهرة لحد ما الجديدة ترسم — مفيش وميض */
      location.assign(target)
      return
    }
    root.classList.add('ob--out')
    setChromeOverride(null)
    setTimeout(() => root.remove(), 450)
  }

  primary.addEventListener('click', () => (index === last ? finish('/signup') : goTo(index + 1)))
  secondary.addEventListener('click', () => finish('/login'))
  skip.addEventListener('click', () => finish(null))

  render()
}
