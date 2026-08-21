'use client'

import { useEffect, useState } from 'react'
import { ArrowUp, MessageCircle } from 'lucide-react'
import type { ToolbarSettings } from '@/lib/customization'
import { StoreBot } from './store-bot'
import { normalizePhone } from '@/lib/utils'

/**
 * الأدوات العائمة: زر واتساب وزر الرجوع لأعلى.
 *
 * زر واتساب بيفتح محادثة مباشرة برقم التاجر ورسالة جاهزة — من أقوى
 * أدوات البيع في السوق المصري. زر الرجوع لأعلى بيظهر بعد التمرير بس.
 */
export function StoreToolbar({
  toolbar,
  bot,
}: {
  toolbar: ToolbarSettings
  /** مساعد المتجر — بيتحط فوق الواتساب لو مفعّل */
  bot?: { storeIdentifier: string; greeting: string; accent: string } | null
}) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    if (!toolbar.backToTop) return
    const onScroll = () => setScrolled(window.scrollY > 400)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [toolbar.backToTop])

  const side = toolbar.position === 'start' ? 'start-4' : 'end-4'
  const waHref =
    toolbar.whatsappEnabled && toolbar.whatsappNumber
      ? `https://wa.me/${normalizePhone(toolbar.whatsappNumber).replace(/[^\d]/g, '')}?text=${encodeURIComponent(
          toolbar.whatsappMessage || '',
        )}`
      : null

  return (
    <div
      data-sf="whatsapp-float"
      className={`fixed bottom-4 z-40 flex flex-col gap-2 ${side}`}
      style={{ display: toolbar.whatsappEnabled || toolbar.backToTop || bot ? undefined : 'none' }}
    >
      {toolbar.backToTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="الرجوع لأعلى"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--sf-text)]/15 bg-[var(--sf-surface)] text-[var(--sf-text)] shadow-lg transition-all hover:scale-105"
          style={{ opacity: scrolled ? 1 : 0, pointerEvents: scrolled ? 'auto' : 'none' }}
        >
          <ArrowUp className="h-5 w-5" aria-hidden="true" />
        </button>
      )}

      {bot && (
        <StoreBot
          storeIdentifier={bot.storeIdentifier}
          greeting={bot.greeting}
          accent={bot.accent}
          whatsappHref={waHref}
        />
      )}

      {waHref && (
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="تواصل على واتساب"
          title="كلّمنا على واتساب"
          /*
            حلقة بيضا رفيعة حوالين الزرار عشان يفضل باين على أي خلفية
            — الأخضر على صورة بانر خضرا بيختفي، والعميل اللي عنده
            سؤال بيسيب المتجر بدل ما يسأل.
          */
          className={`flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg ring-2 ring-white/70 transition-transform hover:scale-105 active:scale-95 ${
            toolbar.showOnMobile ? 'flex' : 'hidden'
          } ${toolbar.showOnDesktop ? 'md:flex' : 'md:hidden'}`}
          style={{ background: '#25D366' }}
        >
          <MessageCircle className="h-7 w-7" aria-hidden="true" />
        </a>
      )}
    </div>
  )
}
