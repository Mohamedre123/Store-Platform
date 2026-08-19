'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { AnnouncementSettings } from '@/lib/customization'

/**
 * شريط الإعلان.
 *
 * لو التاجر سمح بالإغلاق، العميل يقفله والقفل يفضل طول الجلسة —
 * إعلان بيرجع مع كل صفحة بيتحوّل من رسالة لإزعاج.
 *
 * بيستخدم sessionStorage لا localStorage: التاجر بيغيّر الإعلان مع كل
 * حملة، ولو القفل دائم العميل مش هيشوف الحملة الجديدة أبدًا.
 */
export function AnnouncementBar({ settings }: { settings: AnnouncementSettings }) {
  const [closed, setClosed] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!settings.dismissible) {
      setReady(true)
      return
    }
    try {
      setClosed(sessionStorage.getItem('zw_ann_closed') === '1')
    } catch {}
    setReady(true)
  }, [settings.dismissible])

  if (!settings.enabled || closed) return null

  const content = settings.link ? (
    <a href={settings.link} className="hover:underline" data-sf="announcement-text">
      {settings.text}
    </a>
  ) : (
    <span data-sf="announcement-text">{settings.text}</span>
  )

  return (
    <div
      data-sf="announcement"
      style={{
        background: settings.background,
        color: settings.color,
        // نخفيه لحد ما نقرا حالة القفل — وإلا بيومض للي قافله
        visibility: ready ? undefined : 'hidden',
      }}
      className={`relative px-4 py-2 text-center text-sm ${settings.sticky ? 'sticky top-0 z-50' : ''}`}
    >
      {content}

      {settings.dismissible && (
        <button
          type="button"
          onClick={() => {
            setClosed(true)
            try {
              sessionStorage.setItem('zw_ann_closed', '1')
            } catch {}
          }}
          aria-label="إغلاق الإعلان"
          className="absolute end-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md opacity-70 transition-opacity hover:opacity-100"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
