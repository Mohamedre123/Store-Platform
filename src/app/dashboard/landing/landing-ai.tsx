'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, useTransition } from 'react'
import {
  ArrowLeft,
  Check,
  MessageSquarePlus,
  Package,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { Card } from '@/components/ui'
import {
  createLandingFromPlanAction,
  deleteLandingChatAction,
  listLandingChatsAction,
  listProductsForLandingAction,
  loadLandingChatAction,
  sendLandingRequestAction,
  type LandingChatMsg,
} from './ai-actions'

type Chat = { id: string; title: string; updatedAt: Date }
type ProductOption = { id: string; name: string; price: string; image: string | null }

/**
 * مولّد صفحات الهبوط.
 *
 * **اختيار المنتج قبل الوصف.** الصفحة اللي مالهاش منتج بتبقى كلامًا
 * عامًا؛ واللي متربطة بمنتج بتاخد اسمه وسعره ووصفه، وزرار الشراء
 * فيها بيشتغل بسعر قاعدة البيانات مش بسعر مكتوب في النص.
 *
 * والنتيجة بتتعمل **مسوّدة** — التاجر بيفتح المحرّر ويعدّل. آراء
 * العملاء المولّدة لازم يستبدلها بحقيقية قبل ما ينشر.
 */
export function LandingAi({
  enabled,
  pages,
}: {
  enabled: boolean
  /**
   * الصفحات الموجودة — عشان الخطة تتطبّق على وحدة منهم.
   *
   * المنشورة بتتعلّم، لأن التطبيق عليها بيغيّر اللي الزوار شايفينه
   * **دلوقتي** — والتاجر لازم يعرف ده قبل ما يدوس مش بعدها.
   */
  pages: Array<{ id: string; name: string; published: boolean }>
}) {
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<LandingChatMsg[]>([])
  const [chats, setChats] = useState<Chat[]>([])
  const [showList, setShowList] = useState(false)
  const [products, setProducts] = useState<ProductOption[]>([])
  const [productId, setProductId] = useState<string>('')
  const [input, setInput] = useState('')
  const [error, setError] = useState<{ text: string; setup?: boolean } | null>(null)
  const [pending, start] = useTransition()
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, pending])

  const refresh = () => listLandingChatsAction().then((r) => setChats(r as Chat[]))

  useEffect(() => {
    if (!enabled) return
    void refresh()
    void listProductsForLandingAction().then(setProducts)
  }, [enabled])

  if (!enabled) {
    return (
      <Card className="flex flex-col items-center gap-3 px-6 py-10 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#d97757] to-[#8b5cf6] text-white">
          <Sparkles className="h-6 w-6" aria-hidden="true" />
        </span>
        <h3 className="font-semibold">اعمل صفحة هبوط بالوصف</h3>
        <p className="max-w-md text-sm text-[var(--fg-muted)]">
          اختار منتج من متجرك واوصف الحملة — وكلود يكتب الصفحة كاملة بنصوصها
          وترتيبها. وتعدّلها بعدين بالمحرّر العادي.
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

  const chosen = products.find((p) => p.id === productId)

  const send = () => {
    const text = input.trim()
    if (!text || pending) return

    start(async () => {
      setError(null)
      setInput('')
      const res = await sendLandingRequestAction({
        conversationId: conversationId ?? undefined,
        message: text,
        productId: productId || null,
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

  const create = (messageId: string, targetId?: string) =>
    start(async () => {
      const res = await createLandingFromPlanAction(messageId, targetId)
      if (res.ok) setMessages(res.messages)
      else setError({ text: res.error })
    })

  return (
    <Card className="flex flex-col overflow-hidden">
      <header className="flex flex-wrap items-center gap-2 bg-gradient-to-l from-[#d97757] to-[#8b5cf6] px-4 py-3 text-white">
        <Sparkles className="h-4 w-4" aria-hidden="true" />
        <span className="text-sm font-semibold">اعملها بالذكاء الاصطناعي</span>
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
                      const res = await loadLandingChatAction(c.id)
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
                      await deleteLandingChatAction(c.id)
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

      {/* اختيار المنتج — قبل الوصف عن قصد */}
      {messages.length === 0 && (
        <div className="border-b border-[var(--border)] p-4">
          <label className="flex flex-col gap-1.5">
            <span className="flex items-center gap-1.5 text-sm font-medium">
              <Package className="h-3.5 w-3.5 text-[var(--fg-subtle)]" aria-hidden="true" />
              الصفحة دي عن أنهي منتج؟
            </span>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="min-h-11 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm focus:border-[var(--primary)] focus:outline-none"
            >
              <option value="">من غير منتج (صفحة عامة)</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.price}
                </option>
              ))}
            </select>
            <span className="text-xs text-[var(--fg-subtle)]">
              لما تختار منتج، الصفحة بتاخد اسمه وسعره ووصفه، وزرار الشراء بيشتغل
              بسعر متجرك الحقيقي.
            </span>
          </label>

          {chosen && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-[var(--surface-2)] p-2">
              {chosen.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={chosen.image} alt="" className="h-10 w-10 rounded-lg object-cover" />
              )}
              <span className="min-w-0 flex-1 truncate text-xs font-medium">{chosen.name}</span>
              <span className="tabular text-xs text-[var(--primary)]">{chosen.price}</span>
            </div>
          )}
        </div>
      )}

      <div ref={listRef} className="max-h-[26rem] min-h-[10rem] overflow-y-auto p-4">
        {messages.length === 0 && !pending && (
          <div className="flex flex-col gap-1.5">
            <p className="mb-1 text-sm text-[var(--fg-muted)]">واوصف الحملة:</p>
            {[
              'صفحة لعرض خصم ٣٠٪ لمدة يومين، ألوان دافية وعدّاد',
              'صفحة بهوية متجري، تركّز على الجودة والضمان',
              'صفحة قصيرة ومباشرة، السعر فوق والزرار واضح',
            ].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setInput(s)}
                className="min-h-10 rounded-lg border border-[var(--border)] px-3 py-2 text-start text-xs transition-colors hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((m) => (
          <Bubble key={m.id} msg={m} onCreate={create} busy={pending} pages={pages} />
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
          placeholder="اوصف الحملة… أو قول «زوّد قسم أسئلة»"
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

const BLOCK_NAMES: Record<string, string> = {
  hero: 'واجهة',
  features: 'مميزات',
  product: 'المنتج والسعر',
  gallery: 'معرض صور',
  testimonials: 'آراء',
  faq: 'أسئلة',
  countdown: 'عدّاد',
  cta: 'دعوة للشراء',
  text: 'نص',
  video: 'فيديو',
}

function Bubble({
  msg,
  onCreate,
  pages,
  busy,
}: {
  msg: LandingChatMsg
  onCreate: (id: string, targetId?: string) => void
  pages: Array<{ id: string; name: string; published: boolean }>
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
            {msg.createdId && (
              <span className="flex items-center gap-1 text-xs text-[var(--color-success)]">
                <Check className="h-3 w-3" aria-hidden="true" />
                اتعملت مسوّدة
              </span>
            )}
          </div>

          {msg.plan.tokens && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(
                [
                  ['primary', 'أساسي'],
                  ['background', 'خلفية'],
                  ['surface', 'أقسام'],
                  ['text', 'نص'],
                ] as const
              ).map(([key, label]) => {
                const color = msg.plan!.tokens?.[key]
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

          <ol className="mt-2 flex flex-wrap gap-1">
            {msg.plan.blocks.map((b, i) => (
              <li
                key={i}
                className="rounded-md bg-[var(--surface-2)] px-2 py-0.5 text-[11px] text-[var(--fg-muted)]"
              >
                {i + 1}. {BLOCK_NAMES[b.type] ?? b.type}
              </li>
            ))}
          </ol>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {!msg.createdId ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onCreate(msg.id)}
                  className="flex min-h-9 items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 text-xs font-medium text-[var(--primary-fg)] disabled:opacity-60"
                >
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  اعملها صفحة جديدة
                </button>

                {/*
                  التطبيق على صفحة موجودة.

                  من غيره الذكاء بيعرف يعمل بس مش يعدّل: التاجر اللي
                  صفحته منشورة وطالب تعديل كان بياخد صفحة تانية
                  كمسوّدة، وصفحته المنشورة زي ما هي — يعني تعديله ما
                  وصلش لحد. التطبيق هنا بيسيب الرابط والنشر زي ما هما،
                  فالتعديل يبان للزوار على طول.
                */}
                {pages.length > 0 && (
                  <select
                    disabled={busy}
                    defaultValue=""
                    onChange={(e) => {
                      const id = e.target.value
                      if (!id) return
                      const page = pages.find((x) => x.id === id)
                      if (
                        page?.published &&
                        !confirm(`«${page.name}» منشورة — التعديل هيبان للزوار فورًا. تمام؟`)
                      ) {
                        e.target.value = ''
                        return
                      }
                      onCreate(msg.id, id)
                    }}
                    aria-label="طبّق الخطة على صفحة موجودة"
                    className="min-h-9 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-2 text-xs disabled:opacity-60"
                  >
                    <option value="">أو طبّقها على صفحة موجودة…</option>
                    {pages.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                        {x.published ? ' (منشورة)' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </>
            ) : (
              <Link
                href={`/dashboard/landing/${msg.createdId}`}
                className="flex min-h-9 items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 text-xs font-medium text-[var(--primary-fg)]"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                افتح المحرّر
              </Link>
            )}
          </div>

          {msg.plan.blocks.some((b) => b.type === 'testimonials') && !msg.createdId && (
            <p className="mt-2 text-[11px] text-[var(--color-warning)]">
              آراء العملاء اللي فيها مولّدة — استبدلها بآراء حقيقية قبل ما تنشر.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
