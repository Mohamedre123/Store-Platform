/**
 * اللمس: اهتزاز خفيف مع الضغط، والسحب لتحت للتحديث.
 */
import { haptic } from './bridge'
import { el, layer } from './dom'
import { icons } from './icons'

/* ─────────────── الاهتزاز ─────────────── */

const TAPPABLE =
  'button, [role="button"], [role="tab"], [role="switch"], [role="menuitem"], nav a, summary, input[type="checkbox"], input[type="radio"]'

function installHaptics(): void {
  /*
    على `click` مش `pointerdown`: الإصبع اللي بيبدأ تمرير من فوق زرار
    كان هيهزّ الموبايل مع كل سحبة. الـclick بيحصل بس لما الضغطة تكمل.
  */
  document.addEventListener(
    'click',
    (event) => {
      const target = (event.target as Element | null)?.closest?.(TAPPABLE) as HTMLButtonElement | null
      if (!target || target.disabled || target.getAttribute('aria-disabled') === 'true') return
      haptic('LIGHT')
    },
    { capture: true, passive: true },
  )
}

/* ─────────────── السحب للتحديث ─────────────── */

const THRESHOLD = 78
const MAX_PULL = 124

const scrollTop = () => Math.max(window.scrollY, document.scrollingElement?.scrollTop ?? 0)

/** طبقة مفتوحة أو حقل بيتكتب فيه — التحديث هنا بيضيّع شغل التاجر */
function blocked(): boolean {
  const active = document.activeElement
  if (active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) return true
  if ((active as HTMLElement | null)?.isContentEditable) return true
  if (document.querySelector('.zw-sheet, [role="dialog"], [aria-modal="true"], dialog[open]')) return true
  const layerHost = document.querySelector('zawya-app-layer')
  if (layerHost?.shadowRoot?.querySelector('.launch, .ob')) return true
  const bodyStyle = document.body ? getComputedStyle(document.body) : null
  return bodyStyle?.overflow === 'hidden' || bodyStyle?.overflowY === 'hidden'
}

/** اللمسة بدأت جوّه عنصر بيتمرّر لوحده ومش في أوله، أو جوّه عنصر ثابت */
function startsInsideScroller(target: EventTarget | null): boolean {
  for (let n = target instanceof Element ? target : null; n && n !== document.body; n = n.parentElement) {
    const style = getComputedStyle(n)
    if (style.position === 'fixed') return true
    if (/(auto|scroll)/.test(style.overflowY) && n.scrollHeight > n.clientHeight && n.scrollTop > 0) return true
  }
  return false
}

function installPullToRefresh(): void {
  const indicator = el('div', 'ptr', icons.refresh())
  indicator.setAttribute('aria-hidden', 'true')
  layer().appendChild(indicator)

  let tracking = false
  let pulling = false
  let armed = false
  let refreshing = false
  let startX = 0
  let startY = 0
  let distance = 0

  const render = () => {
    const progress = Math.min(1, distance / THRESHOLD)
    indicator.style.opacity = String(Math.min(1, distance / 36))
    indicator.style.transform = `translate3d(0, ${distance - 50}px, 0) rotate(${progress * 300}deg) scale(${0.7 + progress * 0.3})`
  }

  const settle = (to: number, opacity: number) => {
    indicator.classList.add('ptr--settle')
    indicator.style.opacity = String(opacity)
    indicator.style.transform = `translate3d(0, ${to}px, 0)`
    setTimeout(() => indicator.classList.remove('ptr--settle'), 340)
  }

  window.addEventListener(
    'touchstart',
    (event) => {
      if (refreshing || event.touches.length !== 1 || scrollTop() > 0) return
      if (blocked() || startsInsideScroller(event.target)) return
      tracking = true
      pulling = false
      armed = false
      startX = event.touches[0].clientX
      startY = event.touches[0].clientY
    },
    { passive: true },
  )

  window.addEventListener(
    'touchmove',
    (event) => {
      if (!tracking) return
      const dx = event.touches[0].clientX - startX
      const dy = event.touches[0].clientY - startY
      if (!pulling) {
        /* لازم الحركة تكون لتحت وبشكل واضح — غير كده ده تمرير أو سحب جانبي */
        if (dy < 8) {
          if (dy < -6 || Math.abs(dx) > 12) tracking = false
          return
        }
        if (Math.abs(dx) > dy || scrollTop() > 0) {
          tracking = false
          return
        }
        pulling = true
        startY = event.touches[0].clientY
      }
      /* مقاومة متزايدة — نفس إحساس السحب في التطبيقات الأصلية */
      const raw = Math.max(0, event.touches[0].clientY - startY)
      distance = Math.min(MAX_PULL, raw * 0.55 - (raw * raw) / 4200)
      render()
      if (distance >= THRESHOLD && !armed) {
        armed = true
        haptic('MEDIUM')
      } else if (distance < THRESHOLD - 6 && armed) {
        armed = false
      }
    },
    { passive: true },
  )

  const end = () => {
    if (!tracking) return
    tracking = false
    if (!pulling) return
    pulling = false
    if (!armed) {
      settle(-60, 0)
      return
    }
    refreshing = true
    indicator.classList.add('ptr--spin')
    settle(THRESHOLD - 44, 1)
    setTimeout(() => location.reload(), 380)
  }

  window.addEventListener('touchend', end, { passive: true })
  window.addEventListener('touchcancel', end, { passive: true })
}

export function installGestures(): void {
  installHaptics()
  installPullToRefresh()
}
