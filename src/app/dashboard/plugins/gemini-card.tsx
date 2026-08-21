'use client'

import { useState, useTransition } from 'react'
import { Bot, Check, ExternalLink, KeyRound, Sparkles, TriangleAlert } from 'lucide-react'
import { Alert, Card } from '@/components/ui'
import type { PluginDef } from '@/lib/plugins'
import { saveGeminiAction, verifyGeminiKeyAction } from './ai-actions'

export type GeminiSaved = {
  enabled: boolean
  hasKey: boolean
  model: string | null
  brief: string | null
  botEnabled: boolean
  botGreeting: string | null
  botDailyLimit: number
  botVisitorLimit: number
}

type Model = { id: string; label: string }

/**
 * شاشة إعداد Gemini.
 *
 * مش «الصق معرّفًا واقفل» زي البكسلات — دي محتاجة تحقّق واختيار
 * موديل ووصف للمتجر. والترتيب مقصود: المفتاح الأول، وباقي الخيارات
 * ما تظهرش غير بعد ما يتأكّد إنه شغّال. التاجر اللي بيملا ٦ حقول
 * وبعدين يكتشف إن المفتاح غلط بيسيب الصفحة.
 */
export function GeminiCard({
  def,
  saved,
  embedded = false,
}: {
  def: PluginDef
  saved?: GeminiSaved
  /**
   * جوّه نافذة تفاصيل التطبيق؟
   *
   * ساعتها الكارت بيتشال إطاره: الكارت جوّه كارت بيعمل حدّين
   * متداخلين وحشّين، والمساحة على الموبايل ضيقة أصلًا.
   */
  embedded?: boolean
}) {
  const [enabled, setEnabled] = useState(saved?.enabled ?? false)
  const [apiKey, setApiKey] = useState('')
  const [models, setModels] = useState<Model[]>([])
  const [model, setModel] = useState(saved?.model ?? '')
  const [brief, setBrief] = useState(saved?.brief ?? '')
  const [botEnabled, setBotEnabled] = useState(saved?.botEnabled ?? false)
  const [botGreeting, setBotGreeting] = useState(saved?.botGreeting ?? '')
  const [dailyLimit, setDailyLimit] = useState(String(saved?.botDailyLimit ?? 200))
  const [visitorLimit, setVisitorLimit] = useState(String(saved?.botVisitorLimit ?? 15))

  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [verifying, startVerify] = useTransition()
  const [saving, startSave] = useTransition()

  // المفتاح محفوظ ومتحقَّق منه قبل كده، أو اتحقّقنا منه دلوقتي
  const configured = (saved?.hasKey && Boolean(saved.model)) || models.length > 0

  const verify = () =>
    startVerify(async () => {
      setMsg(null)
      const res = await verifyGeminiKeyAction(apiKey)
      if (!res.ok) {
        setMsg({ ok: false, text: res.error })
        return
      }
      setModels(res.models)
      setModel((m) => m || res.suggested)
      setBrief((b) => b || res.brief)
      setMsg({
        ok: true,
        text: `المفتاح شغّال — ${res.models.length} موديل متاح عليه.`,
      })
    })

  const save = (nextEnabled?: boolean) =>
    startSave(async () => {
      setMsg(null)
      const res = await saveGeminiAction({
        enabled: nextEnabled ?? enabled,
        apiKey: apiKey || undefined,
        model,
        brief,
        botEnabled,
        botGreeting,
        botDailyLimit: Number(dailyLimit) || 200,
        botVisitorLimit: Number(visitorLimit) || 15,
      })
      if (res?.error) {
        setMsg({ ok: false, text: res.error })
        setEnabled(saved?.enabled ?? false)
      } else {
        setApiKey('')
        setMsg({ ok: true, text: (nextEnabled ?? enabled) ? 'اتفعّلت وشغّالة' : 'اتوقفت' })
      }
    })

  const Wrapper = embedded ? ('div' as const) : Card

  return (
    <Wrapper className={embedded ? 'flex flex-col gap-4' : 'flex flex-col gap-4 p-5'}>
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#8b5cf6] to-[#ec4899] text-white">
          <Sparkles className="h-5 w-5" aria-hidden="true" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{def.name}</h3>
            {enabled && saved?.hasKey && (
              <span className="rounded-md bg-[var(--color-success-soft)] px-2 py-0.5 text-xs font-medium text-[var(--color-success)]">
                شغّالة
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-[var(--fg-muted)]">{def.desc}</p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={enabled ? 'إيقاف Gemini' : 'تفعيل Gemini'}
          disabled={saving || (!configured && !enabled)}
          onClick={() => {
            const next = !enabled
            setEnabled(next)
            save(next)
          }}
          className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40 ${
            enabled ? 'bg-[var(--primary)]' : 'bg-[var(--border-strong)]'
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
              enabled ? 'start-0.5' : 'start-[1.375rem]'
            }`}
          />
        </button>
      </div>

      <div className="flex flex-col gap-4 border-t border-[var(--border)] pt-4">
        {msg && <Alert tone={msg.ok ? 'success' : 'danger'}>{msg.text}</Alert>}

        {/* المفتاح */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="gemini-key" className="flex items-center gap-1.5 text-sm font-medium">
            <KeyRound className="h-3.5 w-3.5 text-[var(--fg-subtle)]" aria-hidden="true" />
            مفتاح Gemini API
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="gemini-key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              type="password"
              autoComplete="off"
              dir="ltr"
              placeholder={saved?.hasKey ? '•••••••••• (محفوظ)' : def.fields[0].placeholder}
              className="min-h-11 flex-1 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-start font-mono text-sm focus:border-[var(--primary)] focus:outline-none"
            />
            <button
              type="button"
              onClick={verify}
              disabled={verifying || !apiKey.trim()}
              className="min-h-11 shrink-0 rounded-lg border border-[var(--border-strong)] px-4 text-sm font-medium transition-colors hover:bg-[var(--surface-2)] disabled:opacity-50"
            >
              {verifying ? 'بيتأكّد…' : 'تحقّق'}
            </button>
          </div>
          <p className="text-xs text-[var(--fg-subtle)]">
            المفتاح بيتخزّن مشفّر وما بيتبعتش للمتصفح تاني أبدًا.
          </p>
          {def.where && (
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-[var(--primary)] hover:underline"
            >
              اجيب المفتاح منين؟
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          )}
        </div>

        {configured && (
          <>
            {/* الموديل */}
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">الموديل</span>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="min-h-11 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm focus:border-[var(--primary)] focus:outline-none"
              >
                {models.length === 0 && model && <option value={model}>{model}</option>}
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
              <span className="text-xs text-[var(--fg-subtle)]">
                القايمة جاية من جوجل على مفتاحك — الأحدث فوق. اللي فيه «Flash» أسرع وأرخص.
              </span>
            </label>

            {/* وصف المتجر */}
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">متجرك بيبيع إيه؟</span>
              <textarea
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                rows={3}
                placeholder="متجر ملابس رجالي، تيشيرتات وبناطيل قطن، شحن لكل المحافظات…"
                className="rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2.5 text-sm focus:border-[var(--primary)] focus:outline-none"
              />
              <span className="text-xs text-[var(--fg-subtle)]">
                ملّيناها لك من بيانات متجرك — عدّلها زي ما تحب. دي اللي بتفرّق بين
                تحسين مفيد وكلام عام.
              </span>
            </label>

            {/* البوت */}
            <div className="rounded-xl border border-[var(--border)] p-4">
              <label className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={botEnabled}
                  onChange={(e) => setBotEnabled(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-[var(--primary)]"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    <Bot className="h-4 w-4 text-[var(--primary)]" aria-hidden="true" />
                    بوت الرد على العملاء في المتجر
                  </span>
                  <span className="mt-0.5 block text-xs text-[var(--fg-muted)]">
                    بيظهر فوق زرار واتساب، وبيرد على أسئلة عملائك من منتجاتك وأسعارك
                    الحقيقية — من غير ما تكتبهاله.
                  </span>
                </span>
              </label>

              {botEnabled && (
                <div className="mt-4 flex flex-col gap-3 border-t border-[var(--border)] pt-4">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium">رسالة الترحيب</span>
                    <input
                      value={botGreeting}
                      onChange={(e) => setBotGreeting(e.target.value)}
                      placeholder="أهلًا! اسألني عن أي منتج وأنا أساعدك."
                      className="min-h-11 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm focus:border-[var(--primary)] focus:outline-none"
                    />
                  </label>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-sm font-medium">حد الرسايل اليومي</span>
                      <input
                        value={dailyLimit}
                        onChange={(e) => setDailyLimit(e.target.value.replace(/\D/g, ''))}
                        inputMode="numeric"
                        dir="ltr"
                        className="tabular min-h-11 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-start text-sm focus:border-[var(--primary)] focus:outline-none"
                      />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-sm font-medium">حد الرسايل لكل زائر</span>
                      <input
                        value={visitorLimit}
                        onChange={(e) => setVisitorLimit(e.target.value.replace(/\D/g, ''))}
                        inputMode="numeric"
                        dir="ltr"
                        className="tabular min-h-11 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-start text-sm focus:border-[var(--primary)] focus:outline-none"
                      />
                    </label>
                  </div>

                  <div className="flex items-start gap-2 rounded-lg bg-[var(--color-warning-soft)] px-3 py-2.5 text-xs text-[var(--color-warning)]">
                    <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>
                      كل رسالة من أي زائر بتتحسب على رصيد مفتاحك. المفتاح المجاني بيقف
                      بسرعة على متجر عليه حركة — لما الحد يخلص، العميل بيتحوّل لواتساب
                      بدل ما البوت يقف ميت.
                    </span>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        <div>
          <button
            type="button"
            onClick={() => save()}
            disabled={saving || !configured}
            className="flex min-h-11 items-center gap-2 rounded-lg bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-fg)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            {saving ? 'بيتحفظ…' : 'حفظ'}
          </button>
        </div>
      </div>
    </Wrapper>
  )
}
