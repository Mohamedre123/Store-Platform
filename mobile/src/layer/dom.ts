/**
 * طبقة العرض الخاصة بالتطبيق — عنصر واحد بـShadow DOM.
 *
 * ## ليه ابن مباشر لـ<html> مش جوّه <body>
 * React بيعمل hydration لمحتوى الـbody. أي عنصر غريب جوّاه ممكن يتمسح
 * أو يطلّع تحذير عدم تطابق. الـ<html> نفسه React بيوصل لأبنائه (head و
 * body) بالمرجع مباشرة، فعنصر جنبهم ما بيتلمسش.
 *
 * والـShadow DOM بيعزل تنسيقنا عن تنسيق المنصة في الاتجاهين: Tailwind
 * ما يغيّرش شكل شاشة الافتتاح، وتنسيقنا ما يسرّبش على صفحات التاجر.
 */
import { LAYER_CSS, PAGE_CSS } from './styles'
import { hapticNotify } from './bridge'
import { icons } from './icons'

let shadow: ShadowRoot | null = null

export function layer(): ShadowRoot {
  if (shadow) return shadow
  const host = document.createElement('zawya-app-layer')
  host.style.cssText =
    'position:fixed;top:0;right:0;bottom:0;left:0;z-index:2147483000;pointer-events:none;display:block;'
  shadow = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = LAYER_CSS
  shadow.appendChild(style)
  document.documentElement.appendChild(host)
  return shadow
}

export function injectPageStyles(): void {
  const style = document.createElement('style')
  style.setAttribute('data-zawya-app', '')
  style.textContent = PAGE_CSS
  document.documentElement.appendChild(style)
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  html = '',
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  node.className = className
  if (html) node.innerHTML = html
  return node
}

/* ─────────────── الإشعارات الصغيرة ─────────────── */

type ToastOptions = {
  tone?: 'default' | 'success' | 'danger'
  duration?: number
  action?: { label: string; run: () => void }
}

let toastStack: HTMLElement | null = null

export function toast(text: string, options: ToastOptions = {}): () => void {
  const root = layer()
  if (!toastStack) {
    toastStack = el('div', 'toasts')
    root.appendChild(toastStack)
  }

  const tone = options.tone ?? 'default'
  const icon = tone === 'success' ? icons.check('toast-icon') : tone === 'danger' ? icons.alert('toast-icon') : ''
  const node = el('div', `toast toast--${tone}`)
  node.setAttribute('role', 'status')
  node.innerHTML = `${icon}<span class="toast-text"></span>`
  ;(node.querySelector('.toast-text') as HTMLElement).textContent = text

  if (options.action) {
    const btn = el('button', 'toast-action')
    btn.type = 'button'
    btn.textContent = options.action.label
    const run = options.action.run
    btn.addEventListener('click', () => {
      run()
      dismiss()
    })
    node.appendChild(btn)
  }

  toastStack.appendChild(node)
  if (tone === 'success') hapticNotify('SUCCESS')
  if (tone === 'danger') hapticNotify('ERROR')

  let gone = false
  function dismiss() {
    if (gone) return
    gone = true
    node.classList.add('toast--out')
    setTimeout(() => node.remove(), 260)
  }
  setTimeout(dismiss, options.duration ?? (options.action ? 5000 : 2600))
  return dismiss
}
