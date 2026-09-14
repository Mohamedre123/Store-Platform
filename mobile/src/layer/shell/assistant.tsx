/**
 * زرار «مساعد المتجر» فوق شاشات التطبيق.
 *
 * المساعد نفسه (المحادثة، الموافقة على الإجراءات، الصور، اختيار الموديل)
 * جوّه صفحة المنصة، والشاشات الأصلية بتترسم فوق الصفحة فأيقونته كانت
 * بتختفي. الزرار ده بيضغط زرار المنصة نفسه، ولوحة المحادثة بتترفع فوق
 * الطبقة وهي مفتوحة (`html.zw-assist-open` في `PAGE_CSS`) — نفس المساعد
 * بكل مميزاته، مش نسخة تانية تختلف عنه.
 *
 * بيظهر بس لو المنصة رسمت زرارها (يعني المساعد مفعّل وجاهز للمتجر).
 */
import { useEffect, useState } from 'preact/hooks'
import { haptic } from '../bridge'
import { layer } from '../dom'
import { icons } from '../icons'
import { overlayOpen } from './tabbar'
import { Icon } from './ui'

const PAGE_BUTTON = 'button[aria-label="افتح مساعد المتجر"], button[aria-label="إغلاق المساعد"]'
const PANEL = '[role="dialog"][aria-label="مساعد المتجر"]'

export function AssistantButton({ active, raised }: { active: boolean; raised: boolean }) {
  const [, rerender] = useState(0)
  const [keyboard, setKeyboard] = useState(false)

  useEffect(() => {
    let timer = 0
    const schedule = () => {
      if (timer) return
      timer = window.setTimeout(() => {
        timer = 0
        rerender((n) => n + 1)
      }, 120)
    }
    const page = new MutationObserver(schedule)
    const start = () => {
      page.observe(document.body, { childList: true, subtree: true })
      schedule()
    }
    if (document.body) start()
    else document.addEventListener('DOMContentLoaded', start, { once: true })
    /* لوحات التطبيق (sheet) بتتفتح بتغيير كلاس جوّه الطبقة */
    const shell = new MutationObserver(schedule)
    shell.observe(layer(), { subtree: true, attributes: true, attributeFilter: ['class'] })

    let tallest = window.innerHeight
    const onResize = () => {
      tallest = Math.max(tallest, window.innerHeight)
      setKeyboard(window.innerHeight < tallest * 0.78)
    }
    window.addEventListener('resize', onResize)
    return () => {
      page.disconnect()
      shell.disconnect()
      window.removeEventListener('resize', onResize)
      clearTimeout(timer)
    }
  }, [])

  const pageButton = document.querySelector<HTMLElement>(PAGE_BUTTON)
  const panelOpen = Boolean(document.querySelector(PANEL))

  useEffect(() => {
    document.documentElement.classList.toggle('zw-assist-open', panelOpen)
  }, [panelOpen])

  if (!pageButton) return null

  const sheetOpen = Boolean(layer().querySelector('.sheet--open'))
  const hidden = !active || panelOpen || keyboard || sheetOpen || overlayOpen()

  return (
    <button
      type="button"
      class={`assist-fab${raised ? ' assist-fab--raised' : ''}${hidden ? ' assist-fab--hidden' : ''}`}
      aria-label="مساعد المتجر"
      aria-hidden={hidden}
      tabIndex={hidden ? -1 : 0}
      onClick={() => {
        haptic('LIGHT')
        pageButton.click()
      }}
    >
      <span class="assist-fab-ping" aria-hidden="true" />
      <Icon svg={icons.sparkles()} />
    </button>
  )
}
