'use client'

import { useEffect, useState } from 'react'
import { BellOff, Mail, MessageCircle, Wand2 } from 'lucide-react'
import {
  CHANNEL_KEY,
  NOTIFY_CHANNELS,
  normalizeChannel,
  type NotifyChannel,
} from '@/lib/notify-channel'
import { cn } from '@/lib/utils'

/**
 * «الإشعار يروح فين؟» — شريط فوق أزرار الإجراء.
 *
 * الاختيار بيتحفظ في المتصفح لا في قاعدة البيانات: ده تفضيل شخص
 * قاعد يشتغل دلوقتي، مش إعداد متجر. التاجر اللي بيرتّب طلبات قديمة
 * بيقفل الإشعارات لنص ساعة ويرجّعها — ده مش قرار يتحفظ للفريق كله.
 *
 * وبيتحفظ أصلًا (مش بيرجع لـ«الاتنين» مع كل صفحة) لأن اللي بيغيّر
 * عشرين حالة ورا بعض ما ينفعش يختار كل مرة.
 */
export function useNotifyChannel(): [NotifyChannel, (c: NotifyChannel) => void] {
  const [channel, setChannel] = useState<NotifyChannel>('auto')

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CHANNEL_KEY)
      if (saved) setChannel(normalizeChannel(saved))
    } catch {}
  }, [])

  const update = (c: NotifyChannel) => {
    setChannel(c)
    try {
      localStorage.setItem(CHANNEL_KEY, c)
    } catch {}
  }

  return [channel, update]
}

const ICONS: Record<NotifyChannel, React.ComponentType<{ className?: string }>> = {
  auto: Wand2,
  both: MessageCircle,
  whatsapp: MessageCircle,
  email: Mail,
  none: BellOff,
}

export function ChannelPicker({
  value,
  onChange,
  /** نص فوق الشريط — بيتغيّر حسب المكان (حالة الطلب / رسالة استرداد) */
  label = 'الإشعار يروح فين؟',
}: {
  value: NotifyChannel
  onChange: (c: NotifyChannel) => void
  label?: string
}) {
  const active = NOTIFY_CHANNELS.find((c) => c.key === value) ?? NOTIFY_CHANNELS[0]

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-[var(--fg-muted)]">{label}</span>

      {/*
        شبكة عمودين على الفون وصف واحد على الشاشة الواسعة: أربع
        خيارات بأسمائها العربية ما بتدخلش في ٣٤٣ بكسل.
      */}
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {NOTIFY_CHANNELS.map((c) => {
          const Icon = ICONS[c.key]
          const on = c.key === value
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => onChange(c.key)}
              aria-pressed={on}
              title={c.hint}
              className={cn(
                'flex min-h-10 items-center justify-center gap-1.5 rounded-lg border px-2 text-[11px] font-medium transition-colors',
                on
                  ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]'
                  : 'border-[var(--border-strong)] text-[var(--fg-muted)] hover:bg-[var(--surface-2)]',
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{c.label}</span>
            </button>
          )
        })}
      </div>

      <p className="text-[11px] leading-relaxed text-[var(--fg-subtle)]">{active.hint}</p>
    </div>
  )
}
