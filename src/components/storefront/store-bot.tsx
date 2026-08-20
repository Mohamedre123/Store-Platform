'use client'

import { useEffect, useRef, useState } from 'react'
import { Send, Sparkles, X } from 'lucide-react'

type Msg = { role: 'user' | 'model'; text: string }

/**
 * مساعد المتجر.
 *
 * بيقعد فوق زرار الواتساب في نفس العمود العائم — مش بديل عنه.
 * الواتساب بيوصّل لبني آدم، والبوت بيرد على السؤال البسيط في ثانية.
 * ولما البوت يقف (حد الاستهلاك خلص)، بيوجّه العميل للواتساب بنفسه.
 *
 * معرّف الجلسة نفسه بتاع القياس — مش كوكي ومش مربوط بالعميل، وبيموت
 * مع قفل التبويب.
 */
export function StoreBot({
  storeIdentifier,
  greeting,
  whatsappHref,
  accent,
}: {
  storeIdentifier: string
  greeting: string
  whatsappHref: string | null
  /** لون المتجر — البوت جزء من المتجر مش أداة غريبة عليه */
  accent: string
}) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [exhausted, setExhausted] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // النزول لآخر رسالة مع كل إضافة
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    // التركيز على الكتابة فورًا — العميل فتح عشان يسأل
    inputRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const sessionId = () => {
    try {
      const key = 'zw_sid'
      let id = sessionStorage.getItem(key)
      if (!id) {
        id = Math.random().toString(36).slice(2) + Date.now().toString(36)
        sessionStorage.setItem(key, id)
      }
      return id
    } catch {
      return 'anon'
    }
  }

  const send = async (text: string) => {
    const question = text.trim()
    if (!question || busy) return

    setInput('')
    setMessages((m) => [...m, { role: 'user', text: question }])
    setBusy(true)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store: storeIdentifier,
          visitorId: sessionId(),
          message: question,
          history: messages.slice(-6),
        }),
      })

      const data = (await res.json()) as { reply?: string; error?: string; exhausted?: boolean }

      setMessages((m) => [
        ...m,
        {
          role: 'model',
          text: data.reply ?? 'معلش، حصلت مشكلة. جرّب تاني.',
        },
      ])
      if (data.exhausted) setExhausted(true)
    } catch {
      setMessages((m) => [
        ...m,
        { role: 'model', text: 'مفيش اتصال دلوقتي. جرّب تاني بعد شوية.' },
      ])
    } finally {
      setBusy(false)
      inputRef.current?.focus()
    }
  }

  const suggestions = ['عندكم إيه؟', 'الأسعار كام؟', 'الشحن بيوصل امتى؟']

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'إغلاق المساعد' : 'اسأل مساعد المتجر'}
        aria-expanded={open}
        className="flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-105"
        style={{ background: accent }}
      >
        {open ? (
          <X className="h-6 w-6" aria-hidden="true" />
        ) : (
          <Sparkles className="h-6 w-6" aria-hidden="true" />
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="مساعد المتجر"
          /*
            على الموبايل بياخد الشاشة كلها تقريبًا مع هامش، وعلى
            الديسكتوب لوحة جنبية. اللوحة الثابتة بعرض ٢٤rem بتخرج برّه
            الشاشة على ٣٢٠px وبتعمل تمرير أفقي في المتجر كله.
          */
          className="fixed inset-x-3 bottom-24 z-50 flex max-h-[70vh] flex-col overflow-hidden rounded-2xl border border-[var(--sf-text)]/12 bg-[var(--sf-surface)] shadow-2xl sm:inset-x-auto sm:bottom-24 sm:end-4 sm:w-[24rem]"
        >
          <div
            className="flex shrink-0 items-center gap-2 px-4 py-3 text-white"
            style={{ background: accent }}
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            <span className="text-sm font-semibold">مساعد المتجر</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="إغلاق"
              className="ms-auto flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-white/15"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto p-3">
            <Bubble role="model" text={greeting} />

            {messages.map((m, i) => (
              <Bubble key={i} role={m.role} text={m.text} />
            ))}

            {busy && (
              <div className="mb-2 flex gap-1 rounded-2xl bg-[var(--sf-text)]/6 px-3 py-2.5 w-fit">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--sf-text)]/40"
                    style={{ animationDelay: `${i * 140}ms` }}
                  />
                ))}
              </div>
            )}

            {messages.length === 0 && !busy && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="min-h-9 rounded-full border border-[var(--sf-text)]/15 px-3 text-xs transition-colors hover:bg-[var(--sf-text)]/6"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {exhausted && whatsappHref && (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-semibold text-white"
                style={{ background: '#25D366' }}
              >
                كلّمنا على واتساب
              </a>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              send(input)
            }}
            className="safe-bottom flex shrink-0 gap-2 border-t border-[var(--sf-text)]/10 p-3"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={busy || exhausted}
              maxLength={500}
              placeholder={exhausted ? 'المساعد مش متاح دلوقتي' : 'اسأل عن أي منتج…'}
              className="min-h-11 flex-1 rounded-xl border border-[var(--sf-text)]/15 bg-[var(--sf-bg)] px-3 text-sm outline-none focus:border-[var(--sf-primary)] disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={busy || exhausted || !input.trim()}
              aria-label="إرسال"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white transition-opacity disabled:opacity-40"
              style={{ background: accent }}
            >
              <Send className="h-4 w-4" aria-hidden="true" />
            </button>
          </form>
        </div>
      )}
    </>
  )
}

function Bubble({ role, text }: { role: 'user' | 'model'; text: string }) {
  const mine = role === 'user'
  return (
    <div className={`mb-2 flex ${mine ? 'justify-start' : 'justify-end'}`}>
      <p
        className={`max-w-[85%] rounded-2xl px-3 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
          mine
            ? 'bg-[var(--sf-primary)] text-white'
            : 'bg-[var(--sf-text)]/6 text-[var(--sf-text)]'
        }`}
      >
        {text}
      </p>
    </div>
  )
}
