/**
 * إطار الشاشة الأصلية — نفس سلوك الرئيسية لأي شاشة جديدة.
 *
 * - شاشة رئيسية (`root`): عنوان كبير جوّه المحتوى، وشريط صغير بيظهر
 *   مع التمرير.
 * - شاشة تفاصيل (`detail`): شريط علوي ثابت بزرار رجوع، والعنوان بيظهر
 *   فيه لما العنوان الكبير يتمرّر لفوق. بتدخل من الشمال زي أي تطبيق
 *   عربي.
 *
 * والسحب للتحديث بيحدّث البيانات بس — مش الصفحة.
 */
import type { ComponentChildren, RefObject } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { haptic } from '../bridge'
import { icons } from '../icons'
import { registerBackHandler } from '../navigation'
import { Icon } from './ui'

export function usePullToRefresh(
  scroller: RefObject<HTMLElement>,
  indicator: RefObject<HTMLElement>,
  onRefresh: (() => Promise<unknown>) | undefined,
): void {
  const refresh = useRef(onRefresh)
  refresh.current = onRefresh

  useEffect(() => {
    const el = scroller.current
    const ind = indicator.current
    if (!el || !ind) return
    let startY = 0
    let tracking = false
    let armed = false
    let refreshing = false
    let dist = 0

    const paint = () => {
      ind.style.opacity = String(Math.min(1, dist / 36))
      ind.style.transform = `translate3d(-50%, ${dist - 48}px, 0) rotate(${dist * 3}deg)`
    }
    const onStart = (e: TouchEvent) => {
      if (!refresh.current || refreshing || el.scrollTop > 0 || e.touches.length !== 1) return
      tracking = true
      armed = false
      dist = 0
      startY = e.touches[0].clientY
      ind.classList.remove('hptr--settle')
    }
    const onMove = (e: TouchEvent) => {
      if (!tracking) return
      const dy = e.touches[0].clientY - startY
      if (dy <= 0 || el.scrollTop > 0) {
        if (dist) {
          dist = 0
          paint()
        }
        return
      }
      dist = Math.min(112, dy * 0.5)
      paint()
      if (dist >= 70 && !armed) {
        armed = true
        haptic('MEDIUM')
      } else if (dist < 62) armed = false
    }
    const onEnd = async () => {
      if (!tracking) return
      tracking = false
      ind.classList.add('hptr--settle')
      if (!armed || !refresh.current) {
        dist = 0
        paint()
        return
      }
      refreshing = true
      ind.classList.add('hptr--spin')
      dist = 66
      paint()
      await refresh.current()
      refreshing = false
      ind.classList.remove('hptr--spin')
      dist = 0
      paint()
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: true })
    el.addEventListener('touchend', onEnd, { passive: true })
    el.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [])
}

export function Screen({
  visible,
  kind = 'root',
  title,
  onBack,
  actions,
  onRefresh,
  resetKey,
  children,
}: {
  visible: boolean
  kind?: 'root' | 'detail'
  title: string
  onBack?: () => void
  actions?: ComponentChildren
  onRefresh?: () => Promise<unknown>
  /** لما يتغيّر (طلب تاني مثلًا) الشاشة بترجع لأولها */
  resetKey?: string | null
  children: ComponentChildren
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const indicator = useRef<HTMLDivElement>(null)
  const [compact, setCompact] = useState(false)
  usePullToRefresh(scroller, indicator, onRefresh)

  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 0
    setCompact(false)
  }, [resetKey])

  return (
    <div class={`home screen screen--${kind}${visible ? '' : ' home--hidden'}`} aria-hidden={!visible}>
      {kind === 'detail' ? (
        <div class={`appbar${compact ? ' appbar--scrolled' : ''}`}>
          <button type="button" class="appbar-btn press" aria-label="رجوع" onClick={onBack}>
            <Icon svg={icons.chevronRight()} />
          </button>
          <span class={`appbar-title${compact ? ' appbar-title--on' : ''}`}>{title}</span>
          <span class="appbar-actions">{actions}</span>
        </div>
      ) : (
        <div class={`home-bar${compact ? ' home-bar--on' : ''}`}>{title}</div>
      )}
      <div ref={indicator} class={`hptr${kind === 'detail' ? ' hptr--below-bar' : ''}`} aria-hidden="true">
        <Icon svg={icons.refresh()} />
      </div>
      <div
        ref={scroller}
        class={`home-scroll${kind === 'detail' ? ' home-scroll--bar' : ''}`}
        onScroll={(e) => {
          const next = (e.currentTarget as HTMLElement).scrollTop > (kind === 'detail' ? 72 : 64)
          if (next !== compact) setCompact(next)
        }}
      >
        {children}
      </div>
    </div>
  )
}

/**
 * لوحة من تحت — بديل القوايم المنسدلة في التطبيقات الأصلية.
 *
 * زرار الرجوع في أندرويد بيقفلها قبل ما يرجع لصفحة تانية، والضغط على
 * الخلفية بيقفلها.
 */
export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean
  title?: string
  onClose: () => void
  children: ComponentChildren
}) {
  const close = useRef(onClose)
  close.current = onClose

  useEffect(() => {
    if (!open) return
    return registerBackHandler(() => {
      close.current()
      return true
    })
  }, [open])

  return (
    <div class={`sheet${open ? ' sheet--open' : ''}`} aria-hidden={!open}>
      <div class="sheet-backdrop" onClick={onClose} />
      <div class="sheet-panel" role="dialog" aria-modal="true" aria-label={title}>
        <span class="sheet-grip" aria-hidden="true" />
        {title && <h3 class="sheet-title">{title}</h3>}
        {children}
      </div>
    </div>
  )
}
