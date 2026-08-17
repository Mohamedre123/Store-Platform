'use client'

import { useEffect } from 'react'
import { FONT_STACKS, RADIUS_PX, type Customization } from '@/lib/customization'

/**
 * جسر المعاينة الحيّة.
 *
 * لما المتجر مفتوح جوّه محرّر الثيم، بيستقبل مسوّدة التاجر ويطبّقها
 * على متغيّرات CSS فورًا — من غير حفظ ومن غير إعادة تحميل. فالتاجر
 * بيشوف أثر كل تعديل وهو بيعمله، وعملاؤه ما بيشوفوش تجاربه.
 *
 * بيشتغل فقط جوّه إطار (window !== parent) وبرسالة معروفة الشكل،
 * فصفحة تانية ما تقدرش تغيّر شكل المتجر على العملاء.
 */
export function PreviewBridge() {
  useEffect(() => {
    if (window.parent === window) return

    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; customization?: Customization } | null
      if (!data || data.type !== 'zawya:preview' || !data.customization) return

      const c = data.customization
      const root = document.documentElement.querySelector<HTMLElement>('[data-zawya-store]')
      if (!root) return

      root.style.setProperty('--sf-primary', c.identity.primary)
      root.style.setProperty('--sf-accent', c.identity.accent)
      root.style.setProperty('--sf-bg', c.identity.background)
      root.style.setProperty('--sf-surface', c.identity.surface)
      root.style.setProperty('--sf-text', c.identity.text)
      root.style.setProperty('--sf-radius', RADIUS_PX[c.identity.radius])
      root.style.setProperty('--sf-font-heading', FONT_STACKS[c.identity.fontHeading])
      root.style.setProperty('--sf-font-body', FONT_STACKS[c.identity.fontBody])

      // العناصر اللي بتظهر وتختفي بالإعدادات — نبدّلها بسمات بدل إعادة تصيير
      const toggle = (selector: string, on: boolean) => {
        document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
          el.style.display = on ? '' : 'none'
        })
      }

      toggle('[data-sf="announcement"]', c.announcement.enabled)
      toggle('[data-sf="search"]', c.header.showSearch)
      toggle('[data-sf="cart-button"]', c.header.showCart)
      toggle('[data-sf="categories-bar"]', c.header.showCategoriesBar)
      toggle('[data-sf="hero"]', c.hero.style !== 'none')
      toggle('[data-sf="related"]', c.productPage.showRelated)
      toggle('[data-sf="trust"]', c.productPage.showShippingNote || c.productPage.showReturnNote)
      toggle('[data-sf="powered-by"]', c.footer.showPoweredBy)
      toggle('[data-sf="whatsapp-float"]', c.toolbar.whatsappEnabled)

      const bar = document.querySelector<HTMLElement>('[data-sf="announcement"]')
      if (bar) {
        bar.style.background = c.announcement.background
        bar.style.color = c.announcement.color
        const text = bar.querySelector<HTMLElement>('[data-sf="announcement-text"]')
        if (text) text.textContent = c.announcement.text
      }
    }

    window.addEventListener('message', onMessage)
    // نُعلم المحرّر أن الإطار جاهز لاستقبال المسوّدة
    window.parent.postMessage({ type: 'zawya:preview-ready' }, '*')

    return () => window.removeEventListener('message', onMessage)
  }, [])

  return null
}
