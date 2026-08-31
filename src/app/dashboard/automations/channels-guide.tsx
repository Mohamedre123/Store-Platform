'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Loader2,
  Mail,
  MessageCircle,
  Send,
  Smartphone,
} from 'lucide-react'
import { saveTelegramTokenAction } from './telegram-actions'
import { Card, Input } from '@/components/ui'

/**
 * دليل قنوات الإشعارات.
 *
 * ## ليه بيقول «مش شغّالة» بصراحة
 * قايمة المستقبلين بتعرض أربع قنوات، واتنين منهم `notify-team`
 * بيتخطّاهم من غير إرسال. التاجر كان بيختار «رسالة نصية»، يحطّ رقمه،
 * ويستنى إشعار مش جاي — ويفتكر إن المنصة بايظة. القناة اللي مش
 * شغّالة لازم تقول كده قبل ما يختارها، مش بعد ما يستنى.
 */
export function ChannelsGuide({
  telegramReady,
  whatsappReady,
}: {
  telegramReady: boolean
  whatsappReady: boolean
}) {
  const [open, setOpen] = useState<string | null>(null)

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div>
        <h2 className="font-semibold">قنوات الإشعار — كل واحدة بتشتغل إزاي</h2>
        <p className="mt-0.5 text-sm text-[var(--fg-muted)]">
          دي إشعارات <strong className="text-[var(--fg)]">ليك ولفريقك</strong>، مش رسايل العملاء.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Channel
          id="email"
          icon={Mail}
          name="البريد"
          state="ready"
          summary="شغّال على طول — مش محتاج أي إعداد."
          open={open === 'email'}
          onToggle={() => setOpen(open === 'email' ? null : 'email')}
        >
          <p>
            ضيف مستقبِل جديد تحت، اختار «بريد»، واكتب الإيميل اللي عايز الإشعار يوصله. خلاص.
            الإرسال من نظام بريد المنصة، فمفيش حاجة تربطها.
          </p>
        </Channel>

        <TelegramChannel
          ready={telegramReady}
          open={open === 'telegram'}
          onToggle={() => setOpen(open === 'telegram' ? null : 'telegram')}
        />

        <Channel
          id="whatsapp"
          icon={MessageCircle}
          name="واتساب"
          state={whatsappReady ? 'partial' : 'off'}
          summary={
            whatsappReady
              ? 'مربوط لرسايل العملاء — إشعارات الفريق عليه لسه بنجهّزها.'
              : 'محتاج تربط واتساب الأول.'
          }
          open={open === 'whatsapp'}
          onToggle={() => setOpen(open === 'whatsapp' ? null : 'whatsapp')}
        >
          <p>
            ربط الواتساب بيشتغل دلوقتي على <strong>رسايل عملائك</strong>: رمز الدخول، تأكيد
            الطلب، وحالة الشحن — وكمان إجراءات الأتمتة اللي بتبعت للعميل.
          </p>
          <p className="mt-2">
            <strong>إشعارات الفريق</strong> على واتساب لسه مش بتتبعت. لحد ما تخلص، استخدم
            البريد أو تيليجرام لإشعاراتك إنت.
          </p>
          {!whatsappReady && (
            <Link
              href="/dashboard/plugins"
              className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-fg)]"
            >
              اربط واتساب
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}
        </Channel>

        <Channel
          id="sms"
          icon={Smartphone}
          name="رسالة نصية"
          state="off"
          summary="لسه مش متاحة — محتاجة مزوّد رسايل متعاقد عليه."
          open={open === 'sms'}
          onToggle={() => setOpen(open === 'sms' ? null : 'sms')}
        >
          <p>
            الرسايل النصية محتاجة مزوّدًا مدفوعًا لسه ما اتربطش بالمنصة. تقدر تضيف المستقبِل
            دلوقتي، بس الإشعار مش هيتبعت لحد ما نفعّلها — فالأفضل تستخدم البريد أو تيليجرام.
          </p>
        </Channel>
      </div>
    </Card>
  )
}

/* ────────────────────────── تيليجرام ────────────────────────── */

function TelegramChannel({
  ready,
  open,
  onToggle,
}: {
  ready: boolean
  open: boolean
  onToggle: () => void
}) {
  const [token, setToken] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()

  return (
    <Channel
      id="telegram"
      icon={Send}
      name="تيليجرام"
      state={ready ? 'ready' : 'setup'}
      summary={ready ? 'البوت مربوط — الإشعارات بتوصل.' : 'محتاج بوت مجاني، دقيقتين وبيتظبط.'}
      open={open}
      onToggle={onToggle}
    >
      <ol className="flex flex-col gap-2">
        <li>
          <strong>١.</strong> افتح تيليجرام ودوّر على{' '}
          <bdi dir="ltr" className="font-mono font-semibold">
            @BotFather
          </bdi>
          .
        </li>
        <li>
          <strong>٢.</strong> ابعتله{' '}
          <bdi dir="ltr" className="font-mono font-semibold">
            /newbot
          </bdi>{' '}
          واختار اسمًا لبوتك. هيبعتلك توكن طويل.
        </li>
        <li>
          <strong>٣.</strong> الصق التوكن هنا تحت واحفظ.
        </li>
        <li>
          <strong>٤.</strong> ابعت أي رسالة للبوت بتاعك من حسابك، وبعدها ضيف مستقبِل «تيليجرام»
          تحت وحطّ فيه معرّف محادثتك (Chat ID).
        </li>
      </ol>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <label htmlFor="tg-token" className="mb-1 block text-xs font-medium text-[var(--fg-muted)]">
            توكن البوت
          </label>
          <Input
            id="tg-token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={ready ? '••••••••  (محفوظ — اكتب توكن جديد عشان تغيّره)' : '123456:ABC-DEF…'}
            dir="ltr"
            className="text-start"
          />
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setMsg(null)
            start(async () => {
              const res = await saveTelegramTokenAction({ token })
              if (res?.error) setMsg({ ok: false, text: res.error })
              else {
                setToken('')
                setMsg({
                  ok: true,
                  text: res?.botName ? `اتربط بالبوت @${res.botName}` : 'اتحفظ',
                })
              }
            })
          }}
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-fg)] transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Check className="h-4 w-4" aria-hidden="true" />
          )}
          احفظ
        </button>
      </div>

      {msg && (
        <p
          className="mt-2 rounded-lg px-3 py-2 text-sm font-medium"
          style={{
            background: msg.ok ? 'var(--color-success-soft)' : 'var(--color-danger-soft)',
            color: msg.ok ? 'var(--color-success)' : 'var(--color-danger)',
          }}
        >
          {msg.text}
        </p>
      )}
    </Channel>
  )
}

/* ────────────────────────── القالب ────────────────────────── */

const STATE_META = {
  ready: { label: 'شغّالة', bg: 'var(--color-success-soft)', fg: 'var(--color-success)' },
  setup: { label: 'محتاجة ربط', bg: 'var(--color-warning-soft)', fg: 'var(--color-warning)' },
  partial: { label: 'جزئيًا', bg: 'var(--color-warning-soft)', fg: 'var(--color-warning)' },
  off: { label: 'لسه مش متاحة', bg: 'var(--surface-2)', fg: 'var(--fg-muted)' },
} as const

function Channel({
  icon: Icon,
  name,
  state,
  summary,
  open,
  onToggle,
  children,
}: {
  id: string
  icon: typeof Send
  name: string
  state: keyof typeof STATE_META
  summary: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  const meta = STATE_META[state]

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-3 text-start transition-colors hover:bg-[var(--surface-2)]"
      >
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ background: meta.bg, color: meta.fg }}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{name}</span>
            <span
              className="rounded-md px-1.5 py-0.5 text-[11px] font-medium"
              style={{ background: meta.bg, color: meta.fg }}
            >
              {meta.label}
            </span>
          </span>
          <span className="mt-0.5 block text-xs leading-relaxed text-[var(--fg-muted)]">
            {summary}
          </span>
        </span>

        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[var(--fg-subtle)] transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="border-t border-[var(--border)] p-4 text-sm leading-relaxed text-[var(--fg-muted)]">
          {children}
        </div>
      )}
    </div>
  )
}
