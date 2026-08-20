'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, useTransition } from 'react'
import {
  Check,
  Download,
  Eye,
  MessageSquarePlus,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { Card } from '@/components/ui'
import {
  applyThemePlanAction,
  deleteThemeChatAction,
  listThemeChatsAction,
  loadThemeChatAction,
  sendThemeRequestAction,
  exportThemePlanAction,
  type ThemeChatMsg,
} from './theme-ai-actions'

type Chat = { id: string; title: string; updatedAt: Date }

/**
 * مصمّم الثيمات بالذكاء الاصطناعي.
 *
 * قرارات:
 *
 * ١. **الخطة بتتعرض قبل ما تتطبّق** — ألوانها كمربّعات والتخطيطات
 *    بالعربي. التاجر يشوف الأول ويوافق، مش يلاقي متجره اتغيّر.
 * ٢. **بتتطبّق على المسوّدة لا على المنشور.** المتجر شغّال وبيبيع؛
 *    ثيم مولّد بيروح للعملاء على طول كارثة لو طلع وحش.
 * ٣. **الجلسات محفوظة** — التاجر بيجرّب النهارده ويكمّل بكرة، وكلود
 *    فاكر اللي اقترحه فيقدر يعدّل عليه بدل ما يبدأ من الأول.
 */
export function ThemeDesigner({ enabled }: { enabled: boolean }) {
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ThemeChatMsg[]>([])
  const [chats, setChats] = useState<Chat[]>([])
  const [showList, setShowList] = useState(false)
  const [input, setInput] = useState('')
  const [error, setError] = useState<{ text: string; setup?: boolean } | null>(null)
  const [pending, start] = useTransition()
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, pending])

  const refresh = () => listThemeChatsAction().then((r) => setChats(r as Chat[]))
  useEffect(() => {
    if (enabled) void refresh()
  }, [enabled])

  if (!enabled) {
    return (
      <Card className="flex flex-col items-center gap-3 px-6 py-10 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#d97757] to-[#8b5cf6] text-white">
          <Sparkles className="h-6 w-6" aria-hidden="true" />
        </span>
        <h3 className="font-semibold">مش عاجبك ولا ثيم؟ اطلب واحد بالوصف</h3>
        <p className="max-w-md text-sm text-[var(--fg-muted)]">
          اوصف اللي في دماغك — الألوان والشكل والتخطيط — وكلود يعمله، وتعدّله بعدين
          من محرّر التخصيص زي أي ثيم.
        </p>
        <Link
          href="/dashboard/plugins"
          className="min-h-11 rounded-lg bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--primary-fg)]"
        >
          فعّل إضافة Claude
        </Link>
      </Card>
    )
  }

  const send = () => {
    const text = input.trim()
    if (!text || pending) return

    start(async () => {
      setError(null)
      setInput('')
      const res = await sendThemeRequestAction({
        conversationId: conversationId ?? undefined,
        message: text,
      })
      if (!res.ok) {
        setError({ text: res.error, setup: res.needsSetup })
        setInput(text)
        return
      }
      setConversationId(res.conversationId)
      setMessages(res.messages)
      void refresh()
    })
  }

  const apply = (messageId: string) =>
    start(async () => {
      const res = await applyThemePlanAction(messageId)
      if (res.ok) setMessages(res.messages)
      else setError({ text: res.error })
    })

  const download = (messageId: string, name: string) =>
    start(async () => {
      const json = await exportThemePlanAction(messageId)
      if (!json) return
      /*
        التنزيل من المتصفح لا من الخادم: الملف صغير وموجود قدامنا
        أصلًا، ورحلة تانية للخادم عشان نفس البيانات مالهاش لازمة.
      */
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${name || 'theme'}.json`
      a.click()
      URL.revokeObjectURL(url)
    })

  return (
    <Card className="flex flex-col overflow-hidden">
      <header className="flex flex-wrap items-center gap-2 bg-gradient-to-l from-[#d97757] to-[#8b5cf6] px-4 py-3 text-white">
        <Sparkles className="h-4 w-4" aria-hidden="true" />
        <span className="text-sm font-semibold">صمّم ثيمك بالوصف</span>

        <button
          type="button"
          onClick={() => setShowList((v) => !v)}
          className="ms-auto flex min-h-9 items-center rounded-lg px-2 text-xs transition-colors hover:bg-white/15"
        >
          المحادثات
        </button>
        <button
          type="button"
          onClick={() => {
            setConversationId(null)
            setMessages([])
            setShowList(false)
            setError(null)
          }}
          aria-label="محادثة جديدة"
          className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-white/15"
        >
          <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>

      {showList && (
        <div className="max-h-48 overflow-y-auto border-b border-[var(--border)] bg-[var(--surface-2)]">
          {chats.length === 0 ? (
            <p className="px-4 py-3 text-xs text-[var(--fg-muted)]">مفيش محادثات محفوظة.</p>
          ) : (
            chats.map((c) => (
              <div key={c.id} className="flex items-center gap-1 px-2 py-1">
                <button
                  type="button"
                  onClick={() =>
                    start(async () => {
                      const res = await loadThemeChatAction(c.id)
                      if (res.ok) {
                        setConversationId(res.conversationId)
                        setMessages(res.messages)
                        setShowList(false)
                      }
                    })
                  }
                  className="min-h-10 flex-1 truncate rounded-lg px-2 text-start text-xs transition-colors hover:bg-[var(--surface)]"
                >
                  {c.title}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    start(async () => {
                      await deleteThemeChatAction(c.id)
                      if (conversationId === c.id) {
                        setConversationId(null)
                        setMessages([])
                      }
                      void refresh()
                    })
                  }
                  aria-label="حذف المحادثة"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--fg-subtle)] hover:text-[var(--color-danger)]"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      <div ref={listRef} className="max-h-[26rem] min-h-[12rem] overflow-y-auto p-4">
        {messages.length === 0 && !pending && (
          <div className="py-4 text-center">
            <p className="text-sm text-[var(--fg-muted)]">
              اوصف الثيم اللي عايزه بالعربي العادي.
            </p>
            <div className="mt-3 flex flex-col gap-1.5">
              {[
                'ثيم فخم بالأسود والدهبي، بانر كبير، والمنتجات ٣ في الصف',
                'شكل بسيط وهادي بالأبيض، خطوط واضحة، من غير زحمة',
                'ألوان دافية لمتجر حلويات، وصور المنتجات مربّعة',
              ].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setInput(s)}
                  className="min-h-10 rounded-lg border border-[var(--border)] px-3 py-2 text-xs transition-colors hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <ChatBubble key={m.id} msg={m} onApply={apply} onDownload={download} busy={pending} />
        ))}

        {pending && (
          <div className="mb-2 flex w-fit gap-1 rounded-2xl bg-[var(--surface-2)] px-3 py-2.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--fg-subtle)]"
                style={{ animationDelay: `${i * 140}ms` }}
              />
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-[var(--color-danger-soft)] px-3 py-2 text-xs text-[var(--color-danger)]">
            {error.text}
            {error.setup && (
              <Link href="/dashboard/plugins" className="mt-1 block font-semibold underline">
                افتح الإضافات وظبّطها
              </Link>
            )}
          </div>
        )}
      </div>

      <div className="flex items-end gap-2 border-t border-[var(--border)] p-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          rows={1}
          maxLength={2000}
          placeholder="اوصف الثيم… أو قول «خلّي الخلفية أفتح»"
          className="max-h-28 min-h-11 flex-1 resize-none rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-3 text-sm focus:border-[var(--primary)] focus:outline-none"
        />
        <button
          type="button"
          onClick={send}
          disabled={pending || !input.trim()}
          aria-label="إرسال"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] text-[var(--primary-fg)] transition-opacity disabled:opacity-40"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </Card>
  )
}

function ChatBubble({
  msg,
  onApply,
  onDownload,
  busy,
}: {
  msg: ThemeChatMsg
  onApply: (id: string) => void
  onDownload: (id: string, name: string) => void
  busy: boolean
}) {
  const mine = msg.role === 'user'

  return (
    <div className="mb-3">
      {msg.text && (
        <div className={`flex ${mine ? 'justify-start' : 'justify-end'}`}>
          <p
            className={`max-w-[88%] rounded-2xl px-3 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
              mine ? 'bg-[var(--primary)] text-[var(--primary-fg)]' : 'bg-[var(--surface-2)]'
            }`}
          >
            {msg.text}
          </p>
        </div>
      )}

      {msg.plan && (
        <div className="mt-2 rounded-xl border border-[var(--border-strong)] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold">{msg.plan.name}</span>
            {msg.applied && (
              <span className="flex items-center gap-1 text-xs text-[var(--color-success)]">
                <Check className="h-3 w-3" aria-hidden="true" />
                اتطبّق على المسوّدة
              </span>
            )}
          </div>

          {msg.plan.identity && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(
                [
                  ['primary', 'أساسي'],
                  ['accent', 'مساعد'],
                  ['background', 'خلفية'],
                  ['surface', 'كروت'],
                  ['text', 'نص'],
                ] as const
              ).map(([key, label]) => {
                const color = msg.plan!.identity?.[key]
                if (!color) return null
                return (
                  <span key={key} className="flex items-center gap-1 text-[11px]">
                    <span
                      className="h-5 w-5 rounded-md border border-[var(--border)]"
                      style={{ background: color }}
                      aria-hidden="true"
                    />
                    {label}
                  </span>
                )
              })}
            </div>
          )}

          <PlanSummary plan={msg.plan} />

          <div className="mt-3 flex flex-wrap gap-1.5">
            {!msg.applied && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onApply(msg.id)}
                className="flex min-h-9 items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 text-xs font-medium text-[var(--primary-fg)] disabled:opacity-60"
              >
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                طبّقه على المسوّدة
              </button>
            )}
            {msg.applied && (
              <Link
                href="/dashboard/storefront/customize"
                className="flex min-h-9 items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 text-xs font-medium text-[var(--primary-fg)]"
              >
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                عاينه وعدّله
              </Link>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => onDownload(msg.id, msg.plan!.name)}
              className="flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--border-strong)] px-3 text-xs transition-colors hover:bg-[var(--surface-2)] disabled:opacity-60"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              نزّل الملف
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** ملخّص الاختيارات بالعربي — التاجر ما يقراش أسماء الحقول الإنجليزي */
function PlanSummary({ plan }: { plan: ThemeChatMsg['plan'] }) {
  if (!plan) return null

  const LABELS: Record<string, string> = {
    top: 'هيدر عادي',
    centered: 'هيدر بالشعار في النص',
    split: 'هيدر مقسوم',
    fullbleed: 'بانر بعرض الشاشة',
    boxed: 'بانر داخل إطار',
    stacked: 'بانر فوق بعض',
    none: 'من غير بانر',
    clean: 'كروت بسيطة',
    overlay: 'كروت بنص فوق الصورة',
    framed: 'كروت بإطار',
    editorial: 'كروت مجلّة',
    compact: 'كروت مضغوطة',
    square: 'صور مربّعة',
    portrait: 'صور طولية',
    wide: 'صور عريضة',
    drawer: 'سلة جانبية',
    page: 'صفحة سلة',
  }

  const bits: string[] = []
  if (plan.header?.layout) bits.push(LABELS[plan.header.layout] ?? plan.header.layout)
  if (plan.hero?.style) bits.push(LABELS[plan.hero.style] ?? plan.hero.style)
  if (plan.listing?.columnsDesktop) bits.push(`${plan.listing.columnsDesktop} منتجات في الصف`)
  if (plan.listing?.cardStyle) bits.push(LABELS[plan.listing.cardStyle] ?? plan.listing.cardStyle)
  if (plan.listing?.imageRatio) bits.push(LABELS[plan.listing.imageRatio] ?? plan.listing.imageRatio)
  if (plan.cart?.mode) bits.push(LABELS[plan.cart.mode] ?? plan.cart.mode)

  if (bits.length === 0) return null

  return <p className="mt-2 text-xs text-[var(--fg-muted)]">{bits.join(' · ')}</p>
}
