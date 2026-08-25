'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import {
  Check,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Hand,
  Link2,
  TriangleAlert,
  X,
  Zap,
} from 'lucide-react'
import type { ProviderDef } from '@/lib/providers'

export type ProviderState = {
  enabled: boolean
  /** الحقول السرّية المحفوظة — الاسم بس، القيمة عمرها ما بترجع */
  savedSecrets: string[]
  /** الحقول العادية بقيمها */
  values: Record<string, string>
  testMode: boolean
  lastError: string | null
  /** بالقرش — لشركات الشحن بس */
  flatRate: number
  freeOver: number
}

/**
 * كارت مزوّد خارجي — بوابة دفع أو شركة شحن.
 *
 * تلات قرارات:
 *
 * ١. **الكارت مقفول والتفاصيل بتتفتح بضغطة.** التاجر بيبص على ١٥
 *    مزوّد؛ لو كلهم مفتوحين بحقولهم، الصفحة بتبقى غير قابلة للقراءة.
 * ٢. **«لسه مش مشترك؟» ظاهر جنب الحقول.** التاجر اللي فتح الكارت
 *    ولقى نفسه مش معاه مفاتيح لازم يلاقي طريقه لحساب عندهم في نفس
 *    اللحظة — مش يقفل ويدوّر.
 * ٣. **الفرق بين «تلقائي» و«يدوي» مكتوب على الكارت.** التاجر لازم
 *    يعرف إيه اللي هيشتغل لوحده وإيه اللي محتاج إيده قبل ما يعتمد
 *    عليه — مش يكتشف بعد أول طلب.
 */
export function ProviderCard({
  def,
  state,
  webhookUrl,
  onSave,
  kindLabel,
  showPricing = false,
  currency = 'EGP',
}: {
  def: ProviderDef
  state?: ProviderState
  /** رابط الويب هوك بتاع المتجر — بيتنسخ ويتلزق عندهم */
  webhookUrl: string | null
  onSave: (input: {
    slug: string
    enabled: boolean
    values: Record<string, string>
    testMode: boolean
    flatRate?: number
    freeOver?: number
  }) => Promise<{ ok?: boolean; error?: string } | null>
  kindLabel: string
  /**
   * كارت شحن؟ بيعرض خانتين سعر كمان.
   *
   * الشركة مش بترجّع تسعيرة مع كل طلب — التاجر بيتفق معاها على سعر
   * وبيكتبه هنا. من غيره الشحن بيتحسب صفرًا وهو بيشحن على حسابه في
   * كل طلب.
   */
  showPricing?: boolean
  currency?: string
}) {
  const [open, setOpen] = useState(false)
  const [enabled, setEnabled] = useState(state?.enabled ?? false)
  const [values, setValues] = useState<Record<string, string>>(state?.values ?? {})
  const [testMode, setTestMode] = useState(state?.testMode ?? true)
  const [flatRate, setFlatRate] = useState(state?.flatRate ? String(state.flatRate / 100) : '')
  const [freeOver, setFreeOver] = useState(state?.freeOver ? String(state.freeOver / 100) : '')
  const [show, setShow] = useState<Record<string, boolean>>({})
  const [copied, setCopied] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  const panelRef = useRef<HTMLDivElement>(null)

  /*
    الـportal محتاج `document` — وهو مش موجود وقت العرض على الخادم.
    العلم ده بيأجّل النافذة للعرض في المتصفح بس.
  */
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const saved = state?.savedSecrets ?? []
  const connected = Boolean(state?.enabled)
  const hasCreds = saved.length > 0 || Object.values(state?.values ?? {}).some(Boolean)

  const save = (nextEnabled?: boolean) =>
    start(async () => {
      setMsg(null)
      const res = await onSave({
        slug: def.slug,
        enabled: nextEnabled ?? enabled,
        values,
        testMode,
        flatRate: Number(flatRate) || 0,
        freeOver: Number(freeOver) || 0,
      })
      if (res?.error) {
        setMsg({ ok: false, text: res.error })
        setEnabled(state?.enabled ?? false)
      } else {
        // الأسرار بتتمسح من الحالة بعد الحفظ — مبقاش لها لزوم في المتصفح
        setValues((v) => {
          const next = { ...v }
          for (const f of def.fields) if (f.kind === 'secret') delete next[f.key]
          return next
        })
        setMsg({ ok: true, text: (nextEnabled ?? enabled) ? 'اتفعّلت' : 'اتوقفت' })
      }
    })

  return (
    <>
      <div className="flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex flex-1 items-start gap-3 p-4">
          {/* شارة الشركة بلونها — بتتعرف من بعيد */}
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
            style={{ background: def.color }}
            aria-hidden="true"
          >
            {def.brand.slice(0, 2).toUpperCase()}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="font-semibold">{def.name}</h3>
              <span className="text-xs text-[var(--fg-subtle)]" dir="ltr">
                {def.brand}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--fg-muted)]">
              {def.desc}
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span
                className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
                  def.mode === 'api'
                    ? 'bg-[var(--primary-soft)] text-[var(--primary)]'
                    : 'bg-[var(--surface-2)] text-[var(--fg-muted)]'
                }`}
              >
                {def.mode === 'api' ? (
                  <>
                    <Zap className="h-3 w-3" aria-hidden="true" />
                    تلقائي
                  </>
                ) : (
                  <>
                    <Hand className="h-3 w-3" aria-hidden="true" />
                    يدوي
                  </>
                )}
              </span>
              <span className="text-[11px] text-[var(--fg-subtle)]">{kindLabel}</span>
            </div>
          </div>

          {/* حالة الربط في الركن */}
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
            style={{
              background: state?.lastError
                ? 'var(--color-danger-soft)'
                : connected
                  ? 'var(--color-success-soft)'
                  : 'var(--surface-2)',
              color: state?.lastError
                ? 'var(--color-danger)'
                : connected
                  ? 'var(--color-success)'
                  : 'var(--fg-subtle)',
            }}
            title={
              state?.lastError ? 'فيها مشكلة' : connected ? 'مربوطة وشغّالة' : 'مش مربوطة'
            }
          >
            {state?.lastError ? (
              <TriangleAlert className="h-4 w-4" aria-hidden="true" />
            ) : connected ? (
              <Check className="h-4 w-4" aria-hidden="true" />
            ) : (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            )}
          </span>
        </div>

        {state?.lastError && (
          <p className="mx-4 mb-3 rounded-lg bg-[var(--color-danger-soft)] px-2.5 py-1.5 text-[11px] text-[var(--color-danger)]">
            {state.lastError}
          </p>
        )}

        <div className="flex items-center gap-2 border-t border-[var(--border)] p-3">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[var(--surface-2)] px-3 text-sm font-medium transition-colors hover:bg-[var(--border)]"
          >
            <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
            {hasCreds ? 'تفاصيل الربط' : 'اضغط هنا للتفعيل'}
          </button>

          {hasCreds && (
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-label={enabled ? `إيقاف ${def.name}` : `تفعيل ${def.name}`}
              aria-busy={pending}
              onClick={() => {
                // الضغط المتكرّر بيتجاهل هنا بدل ما نقفل المفتاح ويبان معطّلًا
                if (pending) return
                const next = !enabled
                setEnabled(next)
                save(next)
              }}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                enabled ? 'bg-[var(--primary)]' : 'bg-[var(--border-strong)]'
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                  enabled ? 'start-0.5' : 'start-[1.375rem]'
                }`}
              />
            </button>
          )}
        </div>
      </div>

      {/**
       * لوحة التفاصيل — في `body` مباشرةً لا مكانها في الشجرة.
       *
       * **`z-50` مكانش بيكفي، وده السبب.** البطاقة جوّه `Reveal` اللي
       * بيتحرّك بـ`transform`، و`transform` بيعمل **سياق تكديس جديد**.
       * يعني `z-50` بتاع النافذة بيتحسب جوّه البطاقة بس — مش على
       * الصفحة كلها. فأي كارت بعدها في الصفحة (الدفع عند الاستلام
       * مثلًا) بيرسم فوق النافذة، وزرار «احفظ وفعّل» بيختفي وراه.
       *
       * الـ`portal` بيطلّع النافذة برّه أي سياق تكديس — فبتفضل فوق
       * كل حاجة مهما اتحرّكت البطاقة اللي جواها.
       */}
      {open &&
        mounted &&
        createPortal(
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
          <button
            type="button"
            aria-label="إغلاق"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/50"
          />

          <div
            ref={panelRef}
            role="dialog"
            aria-label={`ربط ${def.name}`}
            /*
              على الموبايل بتطلع من تحت وبتاخد أغلب الشاشة — النموذج
              فيه ٦ حقول أحيانًا، والنافذة الصغيرة في النص بتخلّي
              التاجر يمرّر جوّه صندوق صغير.
            */
            className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-[var(--surface)] shadow-2xl sm:max-h-[86vh] sm:w-[min(34rem,92vw)] sm:rounded-2xl"
          >
            <header className="flex shrink-0 items-center gap-3 border-b border-[var(--border)] p-4">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white"
                style={{ background: def.color }}
                aria-hidden="true"
              >
                {def.brand.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold">{def.name}</h3>
                <p className="text-xs text-[var(--fg-subtle)]" dir="ltr">
                  {def.brand}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="إغلاق"
                className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-4">
              {msg && (
                <p
                  className="mb-3 rounded-lg px-3 py-2 text-sm"
                  style={{
                    background: msg.ok ? 'var(--color-success-soft)' : 'var(--color-danger-soft)',
                    color: msg.ok ? 'var(--color-success)' : 'var(--color-danger)',
                  }}
                >
                  {msg.text}
                </p>
              )}

              {def.mode === 'manual' && (
                <p className="mb-4 flex items-start gap-2 rounded-lg bg-[var(--surface-2)] px-3 py-2.5 text-xs text-[var(--fg-muted)]">
                  <Hand className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    الشركة دي مالهاش API عام موثّق لحد دلوقتي، فالربط <strong>يدوي</strong>:
                    بتعمل البوليصة على لوحتهم وتنسخ رقمها في صفحة الشحنات. حطّ مفاتيحك
                    هنا لو معاك، وأول ما يبقى عندهم API هيشتغل تلقائي.
                  </span>
                </p>
              )}

              {/* «لسه مش مشترك؟» */}
              <a
                href={def.signupUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mb-4 flex items-center justify-between gap-2 rounded-lg border border-[var(--border-strong)] px-3 py-2.5 text-sm transition-colors hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]"
              >
                <span>
                  لسه مش مشترك في {def.name}؟
                  <span className="block text-xs text-[var(--fg-subtle)]">
                    افتح حساب عندهم وهات مفاتيحك — إحنا مش وسيط، الحساب بتاعك إنت.
                  </span>
                </span>
                <ExternalLink className="h-4 w-4 shrink-0 text-[var(--primary)]" aria-hidden="true" />
              </a>

              <div className="flex flex-col gap-3.5">
                {def.fields.map((f) => {
                  const isSaved = f.kind === 'secret' && saved.includes(f.key)
                  const visible = show[f.key] ?? false

                  return (
                    <label key={f.key} className="flex flex-col gap-1.5">
                      <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                        {f.label}
                        {!f.required && (
                          <span className="text-xs font-normal text-[var(--fg-subtle)]">
                            (اختياري)
                          </span>
                        )}
                      </span>

                      <span className="relative flex">
                        <input
                          value={values[f.key] ?? ''}
                          onChange={(e) =>
                            setValues((v) => ({ ...v, [f.key]: e.target.value }))
                          }
                          type={f.kind === 'secret' && !visible ? 'password' : 'text'}
                          autoComplete="off"
                          dir="ltr"
                          placeholder={isSaved ? '•••••••••• (محفوظ)' : f.placeholder}
                          className="min-h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-start font-mono text-sm focus:border-[var(--primary)] focus:outline-none"
                          style={f.kind === 'secret' ? { paddingInlineEnd: '2.75rem' } : undefined}
                        />
                        {f.kind === 'secret' && (
                          <button
                            type="button"
                            onClick={() => setShow((s) => ({ ...s, [f.key]: !visible }))}
                            aria-label={visible ? 'إخفاء' : 'إظهار'}
                            className="absolute inset-y-0 end-0 flex w-11 items-center justify-center text-[var(--fg-subtle)]"
                          >
                            {visible ? (
                              <EyeOff className="h-4 w-4" aria-hidden="true" />
                            ) : (
                              <Eye className="h-4 w-4" aria-hidden="true" />
                            )}
                          </button>
                        )}
                      </span>

                      {f.hint && (
                        <span className="text-xs leading-relaxed text-[var(--fg-subtle)]">
                          {f.hint}
                        </span>
                      )}
                    </label>
                  )
                })}
              </div>

              {/* رابط الويب هوك */}
              {def.webhook && webhookUrl && (
                <div className="mt-4 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
                  <span className="text-sm font-medium">رابط الإشعارات (Webhook)</span>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--fg-muted)]">
                    الزق الرابط ده في لوحة {def.name}. من غيره حالة الطلب مش هتتحدّث
                    لوحدها — هتفضل تدخل تغيّرها بإيدك.
                  </p>
                  <div className="mt-2 flex gap-1.5">
                    <code
                      dir="ltr"
                      className="min-w-0 flex-1 truncate rounded-lg bg-[var(--surface)] px-2.5 py-2 text-start font-mono text-xs"
                    >
                      {webhookUrl}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(webhookUrl)
                        setCopied(true)
                        setTimeout(() => setCopied(false), 2000)
                      }}
                      aria-label="انسخ الرابط"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--border-strong)] transition-colors hover:bg-[var(--surface)]"
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-[var(--color-success)]" aria-hidden="true" />
                      ) : (
                        <Copy className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {showPricing && (
                <div className="mt-4 flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
                  <div>
                    <span className="text-sm font-medium">سعر الشحن معاهم</span>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--fg-muted)]">
                      السعر اللي اتفقت عليه مع {def.name}. أول ما تفعّلها، ده اللي
                      بيظهر للعميل بدل تسعيرك اليدوي. سيبه فاضي عشان يفضل تسعيرك
                      اليدوي شغّالًا.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium">السعر ({currency})</span>
                      <input
                        value={flatRate}
                        onChange={(e) => setFlatRate(e.target.value)}
                        inputMode="decimal"
                        dir="ltr"
                        placeholder="60"
                        className="min-h-11 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-start text-sm tabular-nums focus:border-[var(--primary)] focus:outline-none"
                      />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium">مجاني فوق ({currency})</span>
                      <input
                        value={freeOver}
                        onChange={(e) => setFreeOver(e.target.value)}
                        inputMode="decimal"
                        dir="ltr"
                        placeholder="1000"
                        className="min-h-11 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-start text-sm tabular-nums focus:border-[var(--primary)] focus:outline-none"
                      />
                    </label>
                  </div>
                </div>
              )}

              {def.hasTestMode && (
                <label className="mt-4 flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={testMode}
                    onChange={(e) => setTestMode(e.target.checked)}
                    className="mt-1 h-4 w-4 accent-[var(--primary)]"
                  />
                  <span>
                    <span className="block text-sm font-medium">وضع تجريبي</span>
                    <span className="block text-xs text-[var(--fg-muted)]">
                      بيستخدم بيئة الاختبار بتاعتهم. <strong>اقفله قبل ما تستقبل طلبات
                      حقيقية</strong> — الطلبات في الوضع ده فلوسها مش بتتحوّل.
                    </span>
                  </span>
                </label>
              )}

              {def.docsUrl && (
                <a
                  href={def.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[var(--primary)] hover:underline"
                >
                  دليل {def.name} للمطوّرين
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              )}
            </div>

            <footer className="safe-bottom flex shrink-0 gap-2 border-t border-[var(--border)] p-4">
              <button
                type="button"
                onClick={() => save(true)}
                disabled={pending}
                className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-fg)] transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                <Check className="h-4 w-4" aria-hidden="true" />
                {pending ? 'بيتحفظ…' : 'احفظ وفعّل'}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="min-h-11 rounded-lg px-4 text-sm text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)]"
              >
                إغلاق
              </button>
            </footer>
          </div>
        </div>,
          document.body,
        )}
    </>
  )
}
