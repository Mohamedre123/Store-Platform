/**
 * هيكل الصفحة الفوري — لحظة الضغطة على رابط في المنصة.
 *
 * ## المشكلة
 * صفحات اللوحة ديناميكية، وNext ما بيغيّرش الصفحة غير لما الخادم يرد (نص
 * ثانية لتانيتين). طول الوقت ده الصفحة القديمة واقفة وشريط رفيع فوق —
 * فالتاجر بيحس إن التطبيق تقيل أو إن الضغطة ما اتسجّلتش.
 *
 * ## الحل (للتطبيق بس)
 * في نفس الفريم اللي بيضغط فيه، بيظهر هيكل الصفحة الجاية: عنوانها الحقيقي
 * وكتل رمادية بتنبض مكان محتواها — زي أي تطبيق أصلي. أول ما المنصة ترسم
 * الصفحة الجديدة، الهيكل بيتلاشى فوقها.
 *
 * - بيظهر بعد ٧٠ms بس: لو الخادم رد أسرع من كده، مفيش وميض.
 * - شريط اللوحة العلوي بيفضل ظاهر (الهيكل بيبدأ تحته) — نفس اللي هيفضل بعد التحميل.
 * - الشاشات الأصلية مش محتاجاه (`native-paths.ts`).
 */
import { el, layer } from './dom'
import { NAV } from './shell/nav-data'

const CSS = `
.pgph{position:fixed;left:0;right:0;bottom:0;z-index:4;pointer-events:auto;overflow:hidden;background:var(--bg,#f6f6f9);direction:rtl;color:var(--fg,#222540);font-family:var(--font-plex-arabic),'IBM Plex Sans Arabic','Segoe UI',Tahoma,system-ui,sans-serif;-webkit-font-smoothing:antialiased;opacity:0;transition:opacity .14s ease}
.pgph--on{opacity:1}
.pgph--out{opacity:0;transition:opacity .22s ease;pointer-events:none}
.pgph-body{max-width:720px;margin:0 auto;padding:20px 16px}
.pgph-title{display:block;margin:0 2px 10px;font-size:22px;font-weight:700;line-height:1.4;animation:pgph-in .28s cubic-bezier(.16,1,.3,1) both}
.pgph-sk{display:block;border-radius:18px;background:var(--surface-2,#eceef4);animation:pgph-pulse 1s ease-in-out infinite alternate}
.pgph-line{height:13px;width:58%;margin:0 2px 22px;border-radius:8px}
.pgph-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
.pgph-grid .pgph-sk{height:86px}
.pgph-card{height:150px;margin-bottom:12px}
.pgph-card--short{height:96px}
@keyframes pgph-pulse{from{opacity:1}to{opacity:.45}}
@keyframes pgph-in{from{opacity:0;transform:translate3d(0,8px,0)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.pgph-sk,.pgph-title{animation:none!important}}
`

let styled = false
let node: HTMLElement | null = null
let showTimer = 0
let safetyTimer = 0

function titleFor(href: string): string {
  let url: URL
  try {
    url = new URL(href, location.origin)
  } catch {
    return ''
  }
  const full = url.pathname + url.search
  for (const section of NAV) {
    for (const child of section.children ?? []) if (child.href === full) return child.label
  }
  for (const section of NAV) {
    if (section.href === url.pathname) return section.label
    for (const child of section.children ?? []) if (child.href.split('?')[0] === url.pathname) return child.label
  }
  return ''
}

/** بداية المحتوى: تحت شريط اللوحة العلوي لو ظاهر */
function topOffset(): number {
  const bar = document.querySelector('.safe-top')
  if (!bar) return 0
  const rect = bar.getBoundingClientRect()
  return rect.bottom > 0 && rect.bottom < 140 ? Math.round(rect.bottom) : 0
}

export function showPagePlaceholder(href: string, label?: string | null): void {
  hidePagePlaceholder(true)
  if (!styled) {
    const style = document.createElement('style')
    style.textContent = CSS
    layer().appendChild(style)
    styled = true
  }

  /* اسم القسم من قايمة المنصة الأول — نص الرابط ممكن يكون فيه عدّاد أو سهم */
  const title = titleFor(href) || (label ?? '').replace(/\s+/g, ' ').trim().slice(0, 40)
  const view = el(
    'div',
    'pgph',
    `<div class="pgph-body">
       ${title ? '<b class="pgph-title"></b>' : '<span class="pgph-sk pgph-line" style="height:24px;width:40%"></span>'}
       <span class="pgph-sk pgph-line"></span>
       <div class="pgph-grid"><span class="pgph-sk"></span><span class="pgph-sk"></span></div>
       <span class="pgph-sk pgph-card"></span>
       <span class="pgph-sk pgph-card pgph-card--short"></span>
       <span class="pgph-sk pgph-card"></span>
     </div>`,
  )
  const titleNode = view.querySelector('.pgph-title')
  if (titleNode) titleNode.textContent = title
  view.style.top = `${topOffset()}px`
  view.setAttribute('aria-hidden', 'true')
  layer().appendChild(view)
  node = view

  showTimer = window.setTimeout(() => view.classList.add('pgph--on'), 70)
  /* الخادم ما ردّش أو التنقّل اتلغى — ما يفضلش مغطّي الصفحة */
  safetyTimer = window.setTimeout(() => hidePagePlaceholder(), 12_000)
}

export function hidePagePlaceholder(immediate = false): void {
  clearTimeout(showTimer)
  clearTimeout(safetyTimer)
  const view = node
  node = null
  if (!view) return
  if (immediate || !view.classList.contains('pgph--on')) {
    view.remove()
    return
  }
  view.classList.add('pgph--out')
  window.setTimeout(() => view.remove(), 240)
}

export const placeholderShown = () => node !== null
