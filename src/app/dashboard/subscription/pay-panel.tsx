'use client'

import { useState, useTransition } from 'react'
import { Check, Copy, Loader2, MessageCircle, Sparkles, Wallet, X } from 'lucide-react'
import { requestSubscriptionAction, cancelRequestAction } from './actions'
import { Alert } from '@/components/ui'

export type PayPlan = {
  key: 'monthly' | 'yearly'
  name: string
  price: string
  tagline: string
  features: string[]
  highlight?: boolean
}

type Method = 'wallet' | 'instapay'

/**
 * علامة إنستا باي.
 *
 * مرسومة عندنا لا منقولة من عندهم: الشعار الرسمي علامة تجارية،
 * ونسخه في منصة تانية استخدام مالناش حق فيه. الشكل ده بيقول
 * «تحويل فوري» بلغة تصميم المنصة نفسها.
 */
function InstapayMark({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M4 9h11.5M15.5 9l-3-3M15.5 9l-3 3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20 15H8.5M8.5 15l3-3M8.5 15l3 3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    /*
      الحافظة بترفض في سياق مش آمن (http على شبكة محلية) وفي بعض
      متصفحات الموبايل. الرجوع للطريقة القديمة بيخلّي الزرار يشتغل
      بدل ما يبان مكسورًا من غير سبب واضح.
    */
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      const el = document.createElement('textarea')
      el.value = value
      el.setAttribute('readonly', '')
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.select()
      try {
        document.execCommand('copy')
      } catch {
        /* المتصفح رافض تمامًا — الرقم ظاهر قدامه وينفع ينسخه بإيده */
      }
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-[var(--fg-muted)]">{label}</span>
      <div className="flex items-stretch gap-2">
        <bdi
          dir="ltr"
          className="tabular flex flex-1 items-center justify-center rounded-lg border border-[var(--border-strong)] bg-[var(--surface-2)] px-4 py-3 text-lg font-bold tracking-[0.12em]"
        >
          {value}
        </bdi>
        <button
          type="button"
          onClick={copy}
          aria-label={copied ? 'اتنسخ' : 'انسخ ' + label}
          className="flex min-h-11 w-12 shrink-0 items-center justify-center rounded-lg border border-[var(--border-strong)] text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
        >
          {copied ? (
            <Check className="h-4 w-4 text-[var(--color-success)]" aria-hidden="true" />
          ) : (
            <Copy className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
      {copied && <span className="text-xs text-[var(--color-success)]">اتنسخ ✓</span>}
    </div>
  )
}

const METHODS = [
  { key: 'wallet' as const, label: 'محفظة إلكترونية', hint: 'فودافون كاش وأخواتها' },
  { key: 'instapay' as const, label: 'إنستا باي', hint: 'تحويل فوري من تطبيق بنكك' },
]

export function PayPanel({
  plans,
  payTo,
  hasPending,
  pendingPlan,
  renewing,
}: {
  plans: PayPlan[]
  payTo: string
  hasPending: boolean
  pendingPlan: string | null
  /** الاشتراك شغّال — الأزرار بتقول «جدّد» بدل «اشترك» */
  renewing: boolean
}) {
  const [selected, setSelected] = useState<PayPlan['key'] | null>(null)
  const [method, setMethod] = useState<Method>('wallet')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [pending, start] = useTransition()

  const plan = plans.find((p) => p.key === selected) ?? null

  function confirmPaid() {
    if (!plan) return
    setError(null)
    start(async () => {
      const res = await requestSubscriptionAction({ plan: plan.key, method })
      if (!res.ok) {
        setError(res.error)
        return
      }
      setSent(true)
      /*
        التحويل بـassign لا بـwindow.open.

        الفتح في تبويب جديد بعد await بيتحسب «مش من ضغطة المستخدم»
        عند مانع النوافذ، فبيتبلع من غير ما التاجر يعرف. الانتقال في
        نفس التبويب بيعدّي دايمًا، وواتساب بيفتح في تطبيقه على الموبايل
        وفي الويب على الديسكتوب.
      */
      window.location.assign(res.whatsapp)
    })
  }

  return (
    <div className="flex flex-col gap-5">
      {/* الباقات */}
      <div className="grid gap-4 sm:grid-cols-2">
        {plans.map((p) => {
          const active = selected === p.key
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => setSelected(active ? null : p.key)}
              aria-pressed={active}
              className={`surface flex flex-col gap-3 p-5 text-start transition-all ${
                active
                  ? 'border-[var(--primary)] ring-2 ring-[var(--primary)]'
                  : p.highlight
                    ? 'border-[var(--primary)]/50 hover:border-[var(--primary)]'
                    : 'hover:border-[var(--border-strong)]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold">{p.name}</h3>
                  <p className="mt-0.5 text-xs text-[var(--fg-muted)]">{p.tagline}</p>
                </div>
                {p.highlight && (
                  <span className="flex shrink-0 items-center gap-1 rounded-md bg-[var(--primary-soft)] px-2 py-1 text-xs font-medium text-[var(--primary)]">
                    <Sparkles className="h-3 w-3" aria-hidden="true" />
                    الأشهر
                  </span>
                )}
              </div>

              <div className="flex items-baseline gap-1.5">
                <span className="tabular text-2xl font-bold tracking-tight">{p.price}</span>
                <span className="text-sm text-[var(--fg-muted)]">
                  / {p.key === 'yearly' ? 'سنة' : 'شهر'}
                </span>
              </div>

              <ul className="flex flex-col gap-1.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check
                      className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-success)]"
                      aria-hidden="true"
                    />
                    <span className="text-[var(--fg-muted)]">{f}</span>
                  </li>
                ))}
              </ul>

              <span
                className={`mt-1 flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold ${
                  active
                    ? 'bg-[var(--primary)] text-[var(--primary-fg)]'
                    : 'border border-[var(--border-strong)] text-[var(--fg)]'
                }`}
              >
                {active ? 'مختارة ✓' : renewing ? 'جدّد ' + p.name : 'اشترك ' + p.name}
              </span>
            </button>
          )
        })}
      </div>

      {/* خطوات الدفع — بتظهر بعد اختيار الباقة */}
      {plan && (
        <div className="surface flex flex-col gap-5 p-5">
          <div>
            <h3 className="font-bold">حوّل {plan.price} وابعتلنا الإيصال</h3>
            <p className="mt-1 text-sm text-[var(--fg-muted)]">
              اختار طريقة التحويل، حوّل على الرقم، وبعدها دوس «تم الدفع».
            </p>
          </div>

          {/* طريقة التحويل */}
          <div className="grid gap-3 sm:grid-cols-2">
            {METHODS.map((m) => {
              const on = method === m.key
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMethod(m.key)}
                  aria-pressed={on}
                  className={`flex items-center gap-3 rounded-xl border p-4 text-start transition-colors ${
                    on
                      ? 'border-[var(--primary)] bg-[var(--primary-soft)]'
                      : 'border-[var(--border)] hover:bg-[var(--surface-2)]'
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                      on
                        ? 'bg-[var(--primary)] text-[var(--primary-fg)]'
                        : 'bg-[var(--surface-2)] text-[var(--fg-muted)]'
                    }`}
                  >
                    {m.key === 'wallet' ? (
                      <Wallet className="h-5 w-5" aria-hidden="true" />
                    ) : (
                      <InstapayMark />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{m.label}</span>
                    <span className="block text-xs text-[var(--fg-muted)]">{m.hint}</span>
                  </span>
                  {on && (
                    <Check
                      className="ms-auto h-4 w-4 shrink-0 text-[var(--primary)]"
                      aria-hidden="true"
                    />
                  )}
                </button>
              )
            })}
          </div>

          <CopyField
            value={payTo}
            label={method === 'instapay' ? 'رقم إنستا باي' : 'رقم المحفظة'}
          />

          <ol className="flex flex-col gap-2 text-sm text-[var(--fg-muted)]">
            <li className="flex items-start gap-2.5">
              <Step n={1} />
              <span>حوّل {plan.price} على الرقم اللي فوق.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <Step n={2} />
              <span>صوّر إيصال التحويل — سكرين شوت من التطبيق يكفي.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <Step n={3} />
              <span>
                دوس «تم الدفع» تحت، وهنفتحلك واتساب برسالة جاهزة فيها معرّف حسابك واسم متجرك.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <Step n={4} />
              <span>
                ابعت الرسالة{' '}
                <strong className="text-[var(--fg)]">ومعاها صورة الإيصال</strong> — من غيرها
                التفعيل بيتأخر.
              </span>
            </li>
          </ol>

          {error && <Alert>{error}</Alert>}

          <button
            type="button"
            onClick={confirmPaid}
            disabled={pending || sent}
            className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[var(--color-success)] px-5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {pending || sent ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
            )}
            {sent ? 'بنفتحلك واتساب…' : 'تم الدفع — ابعت الإيصال على واتساب'}
          </button>

          <p className="text-xs text-[var(--fg-subtle)]">
            صورة الإيصال شرط أساسي للتفعيل — من غيرها مش هنعرف نأكّد التحويل.
          </p>
        </div>
      )}

      {/* طلب معلّق */}
      {hasPending && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-info)]/40 bg-[var(--color-info-soft)] p-4">
          <p className="text-sm font-medium text-[var(--color-info)]">
            طلبك{pendingPlan ? ' لـ' + pendingPlan : ''} وصلنا وبنراجع التحويل — هنفعّلك أول ما
            نتأكد.
          </p>
          <button
            type="button"
            onClick={() => start(async () => void (await cancelRequestAction()))}
            disabled={pending}
            className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[var(--color-info)]/40 px-3 text-sm font-medium text-[var(--color-info)] transition-colors hover:bg-[var(--surface)] disabled:opacity-60"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            ألغِ الطلب
          </button>
        </div>
      )}
    </div>
  )
}

function Step({ n }: { n: number }) {
  return (
    <span className="tabular mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-xs font-bold text-[var(--fg)]">
      {n}
    </span>
  )
}
