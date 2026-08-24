'use client'

import { useEffect, useRef, useState } from 'react'
import { Send, Sparkles, X } from 'lucide-react'

type Msg = {
  role: 'user' | 'model'
  text: string
  /**
   * رابط واتساب برسالة جاهزة عن سؤال العميل.
   *
   * بييجي مع الرد اللي البوت قال فيه إن الحاجة مش معروضة. مربوط
   * بالرسالة نفسها لا بالمحادثة كلها: العميل بيلاقيه في اللحظة
   * اللي محتاجه فيها بالظبط، وفيه سؤاله هو مكتوب جاهز.
   */
  whatsappHref?: string | null
}

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
  liftedOnMobile = true,
}: {
  storeIdentifier: string
  greeting: string
  whatsappHref: string | null
  /** لون المتجر — البوت جزء من المتجر مش أداة غريبة عليه */
  accent: string
  /** الأزرار العائمة مرفوعة فوق شريط التنقّل السفلي؟ */
  liftedOnMobile?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [exhausted, setExhausted] = useState(false)
  /**
   * رقم واتساب جاي مع رد الخادم.
   *
   * الشريط العائم ممكن يكون متقفل من التخصيص، وساعتها `whatsappHref`
   * بييجي فاضي — والعميل اللي البوت وقف معاه بيتقفل عليه الباب.
   * الخادم بيرجّع رقم المتجر مع الرد اللي فيه فشل، فالطريق لبني آدم
   * بيفضل مفتوح مهما كان إعداد الشريط.
   */
  const [fallbackWa, setFallbackWa] = useState<string | null>(null)
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

      const data = (await res.json()) as {
        reply?: string
        error?: string
        exhausted?: boolean
        whatsapp?: string | null
        whatsappHref?: string | null
      }

      setMessages((m) => [
        ...m,
        {
          role: 'model',
          text: data.reply ?? 'معلش، حصلت مشكلة. جرّب تاني.',
          whatsappHref: data.whatsappHref ?? null,
        },
      ])
      if (data.exhausted) setExhausted(true)
      if (data.whatsapp) setFallbackWa(data.whatsapp)
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

  /*
    الرابط المعروف الأول، وبعدين اللي جه مع الرد.
    الترتيب ده بيخلّي الرسالة الجاهزة اللي التاجر كتبها في التخصيص
    تفضل شغّالة، والرقم الخام بيبقى شبكة أمان بس.
  */
  /*
    كان مكتوب `[^d]` مكان `D` — يعني الريجيكس كان بيشيل كل حاجة
    ما عدا حرف الـd، فالرقم بيطلع فاضي والرابط `wa.me/?text=…`
    بيفتح واتساب على شاشة «الرقم غير صحيح». العميل اللي البوت وقف
    معاه كان بيتقفل عليه آخر باب.
  */
  const waLink =
    whatsappHref ??
    (fallbackWa
      ? `https://wa.me/${fallbackWa.replace(/\D/g, '')}?text=${encodeURIComponent(
          'أهلًا، كنت بسأل المساعد وعايز مساعدة.',
        )}`
      : null)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'إغلاق المساعد' : 'اسأل مساعد المتجر'}
        aria-expanded={open}
        title="اسأل مساعد المتجر"
        className="flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg ring-2 ring-white/70 transition-transform hover:scale-105 active:scale-95"
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
          /*
            الارتفاع بـ`svh` لا `vh`.

            `vh` على موبايل بيتحسب على الشاشة **من غير** شريط عنوان
            المتصفح، فاللوحة بتطلع أطول من المساحة الظاهرة وآخرها
            بيتقص — والعميل بيلاقي خانة الكتابة نُصّها مخفي.

            والقاع بيتحسب من فوق الأزرار العائمة نفسها: هي مرفوعة
            `5.5rem` فوق شريط التنقّل وطولها `3.5rem`، فاللوحة
            بتبدأ من `9.5rem` وفوق. من غير الحساب ده كانت بتنزل
            عليها فتبان مقصوصة.
          */
          /*
            الإزاحة متغيّر CSS لا كلاس مبني وقت التشغيل.

            Tailwind بيولّد كلاساته من قراءة الملفات، فأي كلاس متركّب
            من قيمة بتتحسب أثناء التشغيل ما بيتولّدش أصلًا — الكلاس
            بيوصل للمتصفح بلا تعريف والعنصر بيقع في مكانه الافتراضي.
            المتغيّر بيتحطّ inline، والكلاسات نفسها ثابتة.
          */
          style={{ '--bot-lift': liftedOnMobile ? '9.5rem' : '5rem' } as React.CSSProperties}
          className="fixed inset-x-3 bottom-[var(--bot-lift)] z-50 flex h-[min(72svh,34rem)] max-h-[calc(100svh-var(--bot-lift)-1.5rem)] flex-col overflow-hidden rounded-2xl border border-[var(--sf-text)]/12 bg-[var(--sf-surface)] shadow-2xl sm:inset-x-auto sm:bottom-24 sm:end-4 sm:h-[min(78vh,40rem)] sm:max-h-[calc(100svh-8rem)] sm:w-[26rem]"
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
              <div key={i}>
                <Bubble role={m.role} text={m.text} />
                {m.whatsappHref && <WhatsappOffer href={m.whatsappHref} />}
              </div>
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

            {exhausted && waLink && (
              <a
                href={waLink}
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

/**
 * زر «اتأكد على واتساب» تحت رد البوت.
 *
 * بيظهر لما البوت يقول إن حاجة مش معروضة. السبب إن «مش موجود» مش
 * دايمًا آخر الكلام: التاجر ممكن يكون عنده المنتج وما ضافهوش
 * للمتجر لسه، والعميل اللي بيسأل عنه بالاسم ده عميل جاهز يشتري —
 * خساره يمشي على رد آلي.
 *
 * والرسالة بتفتح مكتوبة بسؤاله هو، فمحدّش محتاج يعيد الشرح.
 */
function WhatsappOffer({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="mb-2 flex min-h-11 w-fit max-w-[85%] items-center gap-2 rounded-2xl px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      style={{ background: '#25D366' }}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 fill-current" aria-hidden="true">
        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm5.8 14.14c-.25.69-1.44 1.32-1.99 1.37-.53.05-1.02.24-3.45-.72-2.9-1.14-4.74-4.1-4.88-4.29-.14-.19-1.16-1.55-1.16-2.95 0-1.4.73-2.09.99-2.37.26-.28.57-.35.76-.35.19 0 .38 0 .55.01.18.01.41-.07.64.49.24.57.81 1.97.88 2.11.07.14.12.31.02.5-.09.19-.14.31-.28.47-.14.16-.29.36-.42.48-.14.14-.28.29-.12.57.16.28.72 1.19 1.55 1.93 1.07.95 1.97 1.25 2.25 1.39.28.14.44.12.6-.07.16-.19.69-.81.88-1.09.19-.28.37-.23.63-.14.26.09 1.65.78 1.93.92.28.14.47.21.54.33.07.12.07.69-.18 1.38Z" />
      </svg>
      اتأكد على واتساب
    </a>
  )
}
