'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, useTransition } from 'react'
import {
  Check,
  ImagePlus,
  MessageSquarePlus,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import {
  decideToolAction,
  deleteConversationAction,
  listConversationsAction,
  loadConversationAction,
  sendToAssistantAction,
  type AgentMsg,
} from '@/app/dashboard/assistant/actions'
import { TOOL_LABELS } from '@/lib/ai/tool-labels'

type Conversation = { id: string; title: string; updatedAt: Date }

/**
 * مساعد التاجر.
 *
 * لوحة عائمة على الشمال في اللوحة. تلات قرارات:
 *
 * ١. **كل إجراء بيغيّر حاجة بيتعرض بالعربي ويستنى موافقة.** الموديل
 *    بيقترح، والتاجر بيقرا «تعديل سعر تيشيرت → ٥٥٠ ج» ويوافق. مساعد
 *    بيغيّر أسعار من نفسه غلطة واحدة فيه تبيع المخزون بجنيه.
 * ٢. **الجلسات محفوظة.** التاجر بيسأل حاجة النهارده ويكمّل بكرة،
 *    والمحادثة اللي بتضيع بتخلّيه يعيد الشرح من الأول.
 * ٣. **الصور بترفع الأول وبتتبعت كروابط.** كده المنتج بياخد صوره
 *    الحقيقية، والموديل يقراها ويقترح الاسم والخامة منها.
 */
export function AssistantPanel() {
  const [open, setOpen] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<AgentMsg[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [showList, setShowList] = useState(false)
  const [input, setInput] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<{ text: string; setup?: boolean } | null>(null)
  const [pending, start] = useTransition()

  const listRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, pending])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const refreshList = () =>
    listConversationsAction().then((rows) => setConversations(rows as Conversation[]))

  const send = () => {
    const text = input.trim()
    if (!text || pending) return

    start(async () => {
      setError(null)
      setInput('')
      const sent = [...images]
      setImages([])

      const res = await sendToAssistantAction({
        conversationId: conversationId ?? undefined,
        message: text,
        images: sent,
      })

      if (!res.ok) {
        setError({ text: res.error, setup: res.needsSetup })
        setInput(text)
        return
      }

      setConversationId(res.conversationId)
      setMessages(res.messages)
      void refreshList()
    })
  }

  const decide = (messageId: string, index: number, approve: boolean) =>
    start(async () => {
      const res = await decideToolAction({ messageId, index, approve })
      if (res.ok) setMessages(res.messages)
      else setError({ text: res.error })
    })

  const upload = async (files: FileList) => {
    setUploading(true)
    try {
      const urls: string[] = []
      for (const file of Array.from(files).slice(0, 6)) {
        const form = new FormData()
        form.append('file', file)
        form.append('folder', 'products')
        const res = await fetch('/api/upload', { method: 'POST', body: form })
        const data = (await res.json()) as { url?: string; error?: string }
        if (data.url) urls.push(data.url)
        else if (data.error) setError({ text: data.error })
      }
      setImages((prev) => [...prev, ...urls].slice(0, 6))
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v)
          if (!open) void refreshList()
        }}
        aria-label={open ? 'إغلاق المساعد' : 'افتح مساعد المتجر'}
        aria-expanded={open}
        /*
          على الشمال تحت — القايمة الجانبية على اليمين في الواجهة
          العربية، فالمساعد على الشمال ما بيغطّيش حاجة.
          في RTL الـstart يمين والـend شمال — الفرق ده مش تفصيلة شكلية،
          الزرار كان بيقع فوق القايمة.
        */
        className="fixed bottom-5 end-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#8b5cf6] to-[#ec4899] text-white shadow-xl transition-transform hover:scale-105"
      >
        {open ? <X className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="مساعد المتجر"
          className="fixed inset-x-3 bottom-24 top-16 z-50 flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl sm:inset-x-auto sm:end-5 sm:top-auto sm:h-[min(38rem,calc(100vh-8rem))] sm:w-[26rem]"
        >
          <header className="flex shrink-0 items-center gap-2 bg-gradient-to-l from-[#8b5cf6] to-[#ec4899] px-4 py-3 text-white">
            <Sparkles className="h-4 w-4" />
            <span className="text-sm font-semibold">مساعدك</span>

            <button
              type="button"
              onClick={() => setShowList((v) => !v)}
              className="ms-auto flex h-8 items-center gap-1 rounded-lg px-2 text-xs transition-colors hover:bg-white/15"
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
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-white/15"
            >
              <MessageSquarePlus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="إغلاق"
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-white/15"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          {showList && (
            <div className="max-h-52 shrink-0 overflow-y-auto border-b border-[var(--border)] bg-[var(--surface-2)]">
              {conversations.length === 0 ? (
                <p className="px-4 py-3 text-xs text-[var(--fg-muted)]">مفيش محادثات محفوظة.</p>
              ) : (
                conversations.map((c) => (
                  <div key={c.id} className="flex items-center gap-1 px-2 py-1">
                    <button
                      type="button"
                      onClick={() =>
                        start(async () => {
                          const res = await loadConversationAction(c.id)
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
                          await deleteConversationAction(c.id)
                          if (conversationId === c.id) {
                            setConversationId(null)
                            setMessages([])
                          }
                          void refreshList()
                        })
                      }
                      aria-label="حذف المحادثة"
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--fg-subtle)] hover:text-[var(--color-danger)]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          <div ref={listRef} className="flex-1 overflow-y-auto p-3">
            {messages.length === 0 && !pending && (
              <div className="py-6 text-center">
                <p className="text-sm font-medium">قوللي محتاج إيه</p>
                <p className="mx-auto mt-1 max-w-[16rem] text-xs text-[var(--fg-muted)]">
                  أشرحلك أي حاجة في اللوحة، وأعملهالك لو حبيت.
                </p>
                <div className="mt-4 flex flex-col gap-1.5">
                  {[
                    'إيه أخبار متجري؟',
                    'عايز أعمل خصم ١٠٪ — إزاي؟',
                    'ضيف منتج جديد',
                    'إيه اللي قرّب يخلص من المخزون؟',
                  ].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setInput(s)}
                      className="min-h-10 rounded-lg border border-[var(--border)] px-3 text-xs transition-colors hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <Message key={m.id} msg={m} onDecide={decide} busy={pending} />
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

          {images.length > 0 && (
            <div className="flex shrink-0 gap-1.5 border-t border-[var(--border)] px-3 py-2">
              {images.map((url) => (
                <span key={url} className="relative">
                  {/* صورة معاينة صغيرة — مش محتاجة تحسين Next */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-12 w-12 rounded-lg object-cover" />
                  <button
                    type="button"
                    onClick={() => setImages((p) => p.filter((u) => u !== url))}
                    aria-label="شيل الصورة"
                    className="absolute -end-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-danger)] text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex shrink-0 items-end gap-2 border-t border-[var(--border)] p-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => e.target.files && upload(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || pending}
              aria-label="أرفق صور"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--border-strong)] text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)] disabled:opacity-50"
            >
              <ImagePlus className={`h-4 w-4 ${uploading ? 'animate-pulse' : ''}`} />
            </button>

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
              maxLength={3000}
              placeholder="اكتب اللي محتاجه…"
              className="max-h-28 min-h-11 flex-1 resize-none rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-3 text-sm focus:border-[var(--primary)] focus:outline-none"
            />

            <button
              type="button"
              onClick={send}
              disabled={pending || !input.trim()}
              aria-label="إرسال"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] text-[var(--primary-fg)] transition-opacity disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function Message({
  msg,
  onDecide,
  busy,
}: {
  msg: AgentMsg
  onDecide: (messageId: string, index: number, approve: boolean) => void
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

      {msg.images.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {msg.images.map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={url} src={url} alt="" className="h-16 w-16 rounded-lg object-cover" />
          ))}
        </div>
      )}

      {msg.toolCalls.map((call, i) => (
        <div
          key={i}
          className="mt-2 rounded-xl border p-3"
          style={{
            borderColor:
              call.status === 'done'
                ? 'var(--color-success)'
                : call.status === 'failed'
                  ? 'var(--color-danger)'
                  : 'var(--border-strong)',
          }}
        >
          <p className="text-xs font-medium">
            {TOOL_LABELS[call.name]?.(call.args) ?? call.name}
          </p>

          {call.status === 'pending' && (
            <>
              <p className="mt-1 text-[11px] text-[var(--fg-subtle)]">
                مش هيتنفّذ غير لما توافق.
              </p>
              <div className="mt-2 flex gap-1.5">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onDecide(msg.id, i, true)}
                  className="flex min-h-9 flex-1 items-center justify-center gap-1 rounded-lg bg-[var(--primary)] text-xs font-medium text-[var(--primary-fg)] disabled:opacity-60"
                >
                  <Check className="h-3.5 w-3.5" />
                  نفّذها
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onDecide(msg.id, i, false)}
                  className="min-h-9 rounded-lg border border-[var(--border-strong)] px-3 text-xs transition-colors hover:bg-[var(--surface-2)] disabled:opacity-60"
                >
                  لأ
                </button>
              </div>
            </>
          )}

          {call.status === 'done' && (
            <p className="mt-1 flex items-center gap-1 text-[11px] text-[var(--color-success)]">
              <Check className="h-3 w-3" />
              {call.result ?? 'اتنفّذ'}
            </p>
          )}
          {call.status === 'rejected' && (
            <p className="mt-1 text-[11px] text-[var(--fg-subtle)]">رفضتها</p>
          )}
          {call.status === 'failed' && (
            <p className="mt-1 text-[11px] text-[var(--color-danger)]">{call.result}</p>
          )}
        </div>
      ))}
    </div>
  )
}
