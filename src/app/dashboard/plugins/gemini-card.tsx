'use client'

import { useState, useTransition } from 'react'
import { Bot, Check, Sparkles, TriangleAlert } from 'lucide-react'
import { Alert, Card } from '@/components/ui'
import type { PluginDef } from '@/lib/plugins'
import { AI_PROVIDERS, type AiIssue, type AiProvider } from '@/lib/ai/providers-meta'
import { saveGeminiAction, verifyAiKeyAction } from './ai-actions'
import { IssueBanner, KeyField, ModelSelect, ProviderSwitch } from './ai-fields'
import { RefreshBriefButton } from './refresh-brief'

export type GeminiSaved = {
  enabled: boolean
  /** مفتاح Gemini محفوظ */
  hasKey: boolean
  hasOpenaiKey: boolean
  model: string | null
  openaiModel: string | null
  botProvider: AiProvider | null
  brief: string | null
  botEnabled: boolean
  botGreeting: string | null
  botDailyLimit: number
  botVisitorLimit: number
  lastIssue: AiIssue | null
}

type Model = { id: string; label: string }

const GEMINI = AI_PROVIDERS[0]
const OPENAI = AI_PROVIDERS[1]

/**
 * شاشة إعداد الرد على العملاء — Gemini أو ChatGPT أو الاتنين.
 *
 * مش «الصق معرّفًا واقفل» زي البكسلات — دي محتاجة تحقّق واختيار
 * موديل ووصف للمتجر. والترتيب مقصود: المفاتيح الأول، وباقي الخيارات
 * ما تظهرش غير بعد ما يتأكّد إن فيه واحد شغّال.
 *
 * ## والتاجر هو اللي بيحدد مين يكلّم عملاءه
 * لو حاطط المفتاحين، بيختار واحد يرد على الزوّار. التاني بيفضل شغّال
 * لأدوات اللوحة، وبيبقى احتياطي للبوت لو رصيد الأول خلص.
 */
export function GeminiCard({
  def,
  saved,
  embedded = false,
  onToggle,
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
  /** بيبلّغ المعرض بالحالة الجديدة — العدّاد والنقطة بيتحرّكوا منها */
  onToggle?: (slug: string, active: boolean) => void
}) {
  const [enabled, setEnabled] = useState(saved?.enabled ?? false)

  const [geminiKey, setGeminiKey] = useState('')
  const [openaiKey, setOpenaiKey] = useState('')
  const [geminiModels, setGeminiModels] = useState<Model[]>([])
  const [openaiModels, setOpenaiModels] = useState<Model[]>([])
  const [model, setModel] = useState(saved?.model ?? '')
  const [openaiModel, setOpenaiModel] = useState(saved?.openaiModel ?? '')
  const [removed, setRemoved] = useState<AiProvider[]>([])

  const [botProvider, setBotProvider] = useState<AiProvider | null>(saved?.botProvider ?? null)
  const [brief, setBrief] = useState(saved?.brief ?? '')
  const [botEnabled, setBotEnabled] = useState(saved?.botEnabled ?? false)
  const [botGreeting, setBotGreeting] = useState(saved?.botGreeting ?? '')
  const [dailyLimit, setDailyLimit] = useState(String(saved?.botDailyLimit ?? 200))
  const [visitorLimit, setVisitorLimit] = useState(String(saved?.botVisitorLimit ?? 15))

  const [msg, setMsg] = useState<{ tone: 'success' | 'danger' | 'warning'; text: string } | null>(null)
  const [verifying, startVerify] = useTransition()
  const [saving, startSave] = useTransition()

  const hasGemini = (Boolean(saved?.hasKey) && !removed.includes('gemini')) || geminiModels.length > 0
  const hasOpenai = (Boolean(saved?.hasOpenaiKey) && !removed.includes('openai')) || openaiModels.length > 0
  const configured = hasGemini || hasOpenai

  /* المزوّد الفعلي للعملاء: المختار لو ليه مفتاح، وإلا الموجود */
  const effectiveBot: AiProvider | null =
    botProvider === 'openai' && hasOpenai
      ? 'openai'
      : botProvider === 'gemini' && hasGemini
        ? 'gemini'
        : hasGemini
          ? 'gemini'
          : hasOpenai
            ? 'openai'
            : null

  const verify = (provider: AiProvider) =>
    startVerify(async () => {
      setMsg(null)
      const res = await verifyAiKeyAction({
        provider,
        apiKey: provider === 'openai' ? openaiKey : geminiKey,
      })
      if (!res.ok) {
        setMsg({ tone: 'danger', text: res.error })
        return
      }

      if (provider === 'openai') {
        setOpenaiModels(res.models)
        setOpenaiModel((m) => m || res.suggested)
      } else {
        setGeminiModels(res.models)
        setModel((m) => m || res.suggested)
      }
      setRemoved((r) => r.filter((p) => p !== provider))
      setBrief((b) => b || res.brief)

      const label = provider === 'openai' ? OPENAI.label : GEMINI.label
      setMsg(
        res.warning
          ? { tone: 'warning', text: `مفتاح ${label} اتقبل، بس: ${res.warning}` }
          : { tone: 'success', text: `مفتاح ${label} شغّال — ${res.models.length} موديل متاح عليه.` },
      )
    })

  const save = (nextEnabled?: boolean) =>
    startSave(async () => {
      setMsg(null)
      const res = await saveGeminiAction({
        enabled: nextEnabled ?? enabled,
        apiKey: geminiKey || undefined,
        openaiKey: openaiKey || undefined,
        model: model || undefined,
        openaiModel: openaiModel || undefined,
        removeKeys: removed.length ? removed : undefined,
        botProvider: effectiveBot ?? undefined,
        brief,
        botEnabled,
        botGreeting,
        botDailyLimit: Number(dailyLimit) || 200,
        botVisitorLimit: Number(visitorLimit) || 15,
      })
      if (res?.error) {
        setMsg({ tone: 'danger', text: res.error })
        setEnabled(saved?.enabled ?? false)
      } else {
        setGeminiKey('')
        setOpenaiKey('')
        onToggle?.(def.slug, nextEnabled ?? enabled)
        setMsg({ tone: 'success', text: (nextEnabled ?? enabled) ? 'اتفعّلت وشغّالة' : 'اتوقفت' })
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
            {enabled && configured && (
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
          aria-label={enabled ? 'إيقاف الرد على العملاء' : 'تفعيل الرد على العملاء'}
          aria-busy={saving}
          disabled={!configured && !enabled}
          onClick={() => {
            if (saving) return
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
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        <IssueBanner issue={saved?.lastIssue} />

        <p className="rounded-lg bg-[var(--color-info-soft)] px-3 py-2.5 text-xs leading-relaxed text-[var(--color-info)]">
          <strong>حط مفتاح واحد أو الاتنين.</strong> البوت بيرد على زوّارك بالمزوّد اللي تختاره، ولو
          رصيده خلص في نص اليوم بيكمّل بالتاني بدل ما يقف قدام عميل بيسأل. مفتاح ChatGPT محتاج
          رصيد مشحون من الأول — اشتراك ChatGPT Plus مش بيشغّله.
        </p>

        <KeyField
          id="bot-gemini"
          label={GEMINI.keyLabel}
          value={geminiKey}
          onChange={setGeminiKey}
          saved={Boolean(saved?.hasKey) && !removed.includes('gemini')}
          placeholder={GEMINI.keyPlaceholder}
          docHref={GEMINI.keyHref}
          busy={verifying}
          onVerify={() => verify('gemini')}
          onRemove={() => setRemoved((r) => [...r, 'gemini'])}
          optional
        />

        <KeyField
          id="bot-openai"
          label={OPENAI.keyLabel}
          value={openaiKey}
          onChange={setOpenaiKey}
          saved={Boolean(saved?.hasOpenaiKey) && !removed.includes('openai')}
          placeholder={OPENAI.keyPlaceholder}
          docHref={OPENAI.keyHref}
          busy={verifying}
          onVerify={() => verify('openai')}
          onRemove={() => setRemoved((r) => [...r, 'openai'])}
          optional
        />

        {removed.length > 0 && (
          <p className="text-xs text-[var(--color-danger)]">
            هيتمسح مفتاح {removed.map((p) => (p === 'openai' ? OPENAI.label : GEMINI.label)).join(' و')} لما
            تدوس حفظ.
          </p>
        )}

        {configured && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {hasGemini && (
                <ModelSelect
                  label="موديل Gemini"
                  value={model}
                  onChange={setModel}
                  models={geminiModels}
                  hint="القايمة جاية من جوجل على مفتاحك — اللي فيه «Flash» أسرع وأرخص."
                />
              )}
              {hasOpenai && (
                <ModelSelect
                  label="موديل ChatGPT"
                  value={openaiModel}
                  onChange={setOpenaiModel}
                  models={openaiModels}
                  hint="القايمة جاية من OpenAI على مفتاحك — اللي فيه «mini» أسرع وأرخص."
                />
              )}
            </div>

            {/* وصف المتجر */}
            <label className="flex flex-col gap-1.5">
              <span className="flex flex-wrap items-center justify-between gap-2 text-sm font-medium">
                متجرك بيبيع إيه؟
                <RefreshBriefButton onDone={setBrief} />
              </span>
              <textarea
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                rows={3}
                placeholder="بيبيع إيه، لمين، وإيه اللي يميّزه — وأي تفصيلة تحب البوت يعرفها…"
                className="rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2.5 text-sm focus:border-[var(--primary)] focus:outline-none"
              />
              <span className="text-xs text-[var(--fg-subtle)]">
                ملّيناها لك من بيانات متجرك — عدّلها زي ما تحب. دي اللي بتفرّق بين
                رد مفيد وكلام عام.
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
                  {/*
                    مين بيكلّم العميل — قرار التاجر لوحده.

                    ومفيش أي حقل في طلب البوت يغيّره: زائر يختار المزوّد
                    الأغلى كان هيصرف رصيد التاجر بقراره هو.
                  */}
                  {hasGemini && hasOpenai ? (
                    <ProviderSwitch
                      label="مين يرد على عملائك؟"
                      hint="التاني بيبقى احتياطي لو رصيد ده خلص — عشان البوت ما يقفش."
                      options={[
                        { key: 'gemini' as const, label: GEMINI.label },
                        { key: 'openai' as const, label: OPENAI.label },
                      ]}
                      value={effectiveBot}
                      onChange={setBotProvider}
                    />
                  ) : (
                    <p className="text-xs text-[var(--fg-muted)]">
                      البوت هيرد بـ<strong>{effectiveBot === 'openai' ? OPENAI.label : GEMINI.label}</strong>
                      . حط المفتاح التاني لو عايز تختار أو يبقى احتياطي.
                    </p>
                  )}

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
                      كل رسالة من أي زائر بتتحسب على رصيد مفتاحك. لما الحد يخلص، العميل
                      بيتحوّل لواتساب بدل ما البوت يقف ميت.
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
            disabled={saving || (!configured && removed.length === 0)}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-fg)] transition-opacity hover:opacity-90 disabled:opacity-50 sm:w-auto"
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            {saving ? 'بيتحفظ…' : 'حفظ'}
          </button>
        </div>
      </div>
    </Wrapper>
  )
}
