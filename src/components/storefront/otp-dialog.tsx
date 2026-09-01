'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { Loader2, ShieldCheck, X } from 'lucide-react'
import { requestOrderOtpAction, verifyOrderOtpAction } from '@/app/s/[store]/checkout/actions'

/**
 * رمز التحقق — **جوّه تأكيد الطلب لا خطوة جنبه**.
 *
 * ## اللي كان بيحصل
 * الرمز كان صندوقًا مستقلًا فوق زرار «تأكيد الطلب»: العميل لازم يدوس
 * «ابعت رمز التحقق»، يستنّى، يكتبه، يدوس «تأكيد»، وبعدين يدوس «تأكيد
 * الطلب». خمس ضغطات في آخر شاشة قبل الشرا — وأي واحد فيهم بيتنسى
 * بيسيب العميل قدام زرار متعطّل من غير ما يعرف ليه.
 *
 * وكمان كان بيتحشر في كارت الملخّص فبيخرج من حدوده على الشاشات
 * الضيّقة — زرار «تأكيد» كان بيتزقّ برّه الكارت.
 *
 * ## اللي بيحصل دلوقتي
 * العميل بيدوس «تأكيد الطلب» زي أي طلب تاني. لو المتجر مفعّل التحقق،
 * النافذة دي بتفتح **وهي بتبعت الرمز أصلًا**، وأول ما يتأكّد الطلب
 * بيتسجّل لوحده. الخطوة بقت جزءًا من المسار لا فرعًا جنبه.
 *
 * ## وليه نافذة لا سطر في الصفحة
 * الرمز جاي على وسيلة تانية (بريد أو واتساب)، يعني العميل هيسيب
 * الصفحة ويرجع. النافذة بتحافظ على مكانه في المسار: بيرجع يلاقي
 * الخانة مفتوحة قدامه بدل ما يدوّر على حتّة صغيرة وسط نموذج طويل.
 */
export function OtpDialog({
  storeIdentifier,
  phone,
  email,
  onVerified,
  onClose,
}: {
  storeIdentifier: string
  phone: string
  /** الرمز بيتسلّم عليه — التسليم نفسه بيتقرّر على الخادم */
  email?: string
  onVerified: () => void
  onClose: () => void
}) {
  const [code, setCode] = useState('')
  const [target, setTarget] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [sending, startSend] = useTransition()
  const [verifying, startVerify] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  /*
    الرمز بيتبعت مع الفتح.

    لو استنينا ضغطة تانية، كنا رجّعنا نفس الخطوة الزيادة اللي شيلناها:
    العميل دوس «أكّد الطلب» خلاص — ده طلب واضح إنه عايز يكمّل.

    والحارس ضروري: React بيشغّل التأثيرات مرتين في وضع التطوير،
    والبعتة التانية كانت هتلغي الرمز الأول وتخلّي اللي في بريده غلط.
  */
  const requested = useRef(false)
  useEffect(() => {
    if (requested.current) return
    requested.current = true
    send()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function send() {
    setMsg(null)
    startSend(async () => {
      const res = await requestOrderOtpAction({ storeIdentifier, phone, email })
      if (res.ok) {
        setTarget(res.target)
        setCode('')
        inputRef.current?.focus()
      } else {
        setMsg({ ok: false, text: res.error })
      }
    })
  }

  function verify(value: string) {
    setMsg(null)
    startVerify(async () => {
      const res = await verifyOrderOtpAction({ storeIdentifier, phone, code: value })
      if (res.ok) onVerified()
      else setMsg({ ok: false, text: res.error })
    })
  }

  /* الرمز كامل = العميل خلص. الضغطة الزيادة هنا مالهاش أي معنى */
  function onCodeChange(raw: string) {
    const clean = raw.replace(/\D/g, '').slice(0, 6)
    setCode(clean)
    if (clean.length === 6 && !verifying) verify(clean)
  }

  /* الخروج بالمفتاح — النافذة اللي مالهاش خروج بتحبس العميل */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const busy = sending || verifying

  /*
    النافذة بترسم جوّه شجرة المتجر لا في جسم الصفحة.

    ألوان المتجر متغيّرات CSS متحطّة على حاوية المتجر وبتتوارث لجوّه.
    اللي بيتنقل بـportal لجسم الصفحة بيخرج من نطاقها — فالزرار بيرسم
    بلون فاضي ويبان مساحة بيضا مالهاش معنى. ونفس السبب خلّى درج السلة
    وعجلة الحظ يرسموا جوّه الشجرة من الأول.
  */
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="تأكيد رقمك"
        dir="rtl"
        /*
          `min-w-0` مع `w-full`: الخانة جوّه بتباعد بين الحروف
          (`tracking`) فعرضها الطبيعي أوسع من شاشة الفون — ومن غير
          الحد ده كانت بتزقّ الزرار برّه حدود الكارت.
        */
        className="flex w-full min-w-0 max-w-sm flex-col gap-4 rounded-[var(--sf-radius,1rem)] bg-[var(--sf-surface,#fff)] p-5 text-[var(--sf-text,#111)] shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--sf-primary)]/12 text-[var(--sf-primary)]">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-bold">أكّد رقمك عشان نكمّل الطلب</h2>
            <p className="mt-1 text-xs leading-relaxed opacity-65">
              {sending && !target
                ? 'بنبعتلك الرمز دلوقتي…'
                : target
                  ? `بعتنا رمزًا من ٦ أرقام على ${target}`
                  : 'اكتب الرمز اللي وصلك.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="-m-1 shrink-0 rounded-lg p-1 opacity-50 transition-opacity hover:opacity-100"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <input
          ref={inputRef}
          value={code}
          onChange={(e) => onCodeChange(e.target.value)}
          inputMode="numeric"
          autoComplete="one-time-code"
          dir="ltr"
          placeholder="––––––"
          aria-label="رمز التحقق"
          disabled={verifying}
          className="h-14 w-full min-w-0 rounded-[var(--sf-radius,1rem)] border border-[var(--sf-text)]/20 bg-transparent px-3 text-center text-2xl font-bold tracking-[0.3em] outline-none focus:border-[var(--sf-primary)] disabled:opacity-60"
        />

        {msg && (
          <p className={`text-xs ${msg.ok ? 'text-green-600' : 'text-red-600'}`} role="alert">
            {msg.text}
          </p>
        )}

        <button
          type="button"
          onClick={() => code.length === 6 && verify(code)}
          disabled={busy || code.length !== 6}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--sf-radius,1rem)] bg-[var(--sf-primary)] px-4 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-55"
        >
          {verifying && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {verifying ? 'بنتأكّد…' : 'أكّد الطلب'}
        </button>

        <button
          type="button"
          onClick={send}
          disabled={busy}
          className="text-center text-xs font-medium text-[var(--sf-primary)] underline underline-offset-4 disabled:opacity-50"
        >
          {sending ? 'بنبعت…' : 'ما وصلكش؟ ابعت الرمز تاني'}
        </button>
      </div>
    </div>
  )
}
