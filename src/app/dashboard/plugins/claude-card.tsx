'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { Check, Palette, ShieldCheck, TriangleAlert } from 'lucide-react'
import { Alert, Card } from '@/components/ui'
import type { PluginDef } from '@/lib/plugins'
import type { AiIssue } from '@/lib/ai/providers-meta'
import { saveClaudeAction, verifyDesignerKeyAction } from './ai-actions'
import { IssueBanner, KeyField, ModelSelect, ProviderSwitch, type KeyCheck } from './ai-fields'

type Provider = 'claude' | 'gemini' | 'openai'

export type ClaudeSaved = {
  enabled: boolean
  hasKey: boolean
  /** مفتاح جوجل محفوظ؟ نفس الإضافة بتقبل التلاتة */
  hasGeminiKey: boolean
  hasOpenaiKey: boolean
  provider: Provider
  model: string | null
  lastIssue: AiIssue | null
}

type Model = { id: string; label: string }

const LABELS: Record<Provider, string> = { claude: 'Claude', gemini: 'Gemini', openai: 'ChatGPT' }
const VENDORS: Record<Provider, string> = { claude: 'Anthropic', gemini: 'Google', openai: 'OpenAI' }

export function ClaudeCard({
  def,
  saved,
  embedded = false,
  onToggle,
}: {
  def: PluginDef
  saved?: ClaudeSaved
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
  const [keys, setKeys] = useState<Record<Provider, string>>({ claude: '', gemini: '', openai: '' })
  /**
   * قايمة موديلات لكل مزوّد.
   *
   * التاجر اللي حاطط أكتر من مفتاح لازم يشوفهم ويختار — مش نجبره
   * على واحد. والقايمة بتيجي من المزوّد نفسه على مفتاحه هو، فبتفضل
   * صح مع كل إصدار جديد من غير ما نعدّل سطر.
   */
  const [models, setModels] = useState<Record<Provider, Model[]>>({ claude: [], gemini: [], openai: [] })
  const [provider, setProvider] = useState<Provider>(saved?.provider ?? 'claude')
  const [model, setModel] = useState(saved?.model ?? '')
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger' | 'warning'; text: string } | null>(null)
  const [verifying, startVerify] = useTransition()
  const [saving, startSave] = useTransition()

  /* نتيجة التحقّق لكل مفتاح — بتظهر تحت خانته هو */
  const [checks, setChecks] = useState<Partial<Record<Provider, KeyCheck>>>({})
  const [checking, setChecking] = useState<Provider | null>(null)

  const msgRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (msg) msgRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [msg])

  const has: Record<Provider, boolean> = {
    claude: Boolean(saved?.hasKey) || models.claude.length > 0,
    gemini: Boolean(saved?.hasGeminiKey) || models.gemini.length > 0,
    openai: Boolean(saved?.hasOpenaiKey) || models.openai.length > 0,
  }
  const available = (Object.keys(has) as Provider[]).filter((p) => has[p])
  const configured = available.length > 0 && Boolean(model)

  const verify = (which: Provider) =>
    startVerify(async () => {
      setChecking(which)
      setChecks((c) => ({ ...c, [which]: null }))
      const res = await verifyDesignerKeyAction({ provider: which, apiKey: keys[which] })
      setChecking(null)
      if (!res.ok) {
        setChecks((c) => ({ ...c, [which]: { tone: 'danger', text: res.error } }))
        return
      }

      setModels((m) => ({ ...m, [which]: res.models }))
      setProvider(which)
      setModel(res.suggested)
      setChecks((c) => ({
        ...c,
        [which]: res.warning
          ? { tone: 'warning', text: 'المفتاح اتقبل، بس: ' + res.warning }
          : { tone: 'success', text: 'المفتاح شغّال ✓ — ' + res.models.length + ' موديل متاح عليه. اختار الموديل ودوس «حفظ».' },
      }))
    })

  const save = (nextEnabled?: boolean) =>
    startSave(async () => {
      setMsg(null)
      const res = await saveClaudeAction({
        enabled: nextEnabled ?? enabled,
        apiKey: keys.claude || undefined,
        geminiKey: keys.gemini || undefined,
        openaiKey: keys.openai || undefined,
        provider,
        model: model || undefined,
      })
      if (res?.error) {
        setMsg({ tone: 'danger', text: res.error })
        setEnabled(saved?.enabled ?? false)
      } else {
        onToggle?.(def.slug, nextEnabled ?? enabled)
        setKeys({ claude: '', gemini: '', openai: '' })
        setMsg({
          tone: 'success',
          text: (nextEnabled ?? enabled) ? 'اتفعّلت — هتلاقيها في صفحة المتجر' : 'اتوقفت',
        })
      }
    })

  const Wrapper = embedded ? ('div' as const) : Card

  return (
    <Wrapper className={embedded ? 'flex flex-col gap-4' : 'flex flex-col gap-4 p-5'}>
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#d97757] to-[#8b5cf6] text-white">
          <Palette className="h-5 w-5" aria-hidden="true" />
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
          aria-label={enabled ? 'إيقاف المصمّم' : 'تفعيل المصمّم'}
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
        {msg && (
          <div ref={msgRef}>
            <Alert tone={msg.tone}>{msg.text}</Alert>
          </div>
        )}
        <IssueBanner issue={saved?.lastIssue} />

        {/* الحدّ الأمني — التاجر لازم يعرف الأداة بتوصل لفين */}
        <div className="flex items-start gap-2 rounded-lg bg-[var(--color-success-soft)] px-3 py-2.5 text-xs text-[var(--color-success)]">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            المصمّم بيختار <strong>إعدادات</strong> (ألوان، خطوط، تخطيطات) — مش بيكتب كود
            بيتنفّذ في متجرك. والنتيجة بتروح للمسوّدة، تعاينها وتنشرها لما تعجبك.
          </span>
        </div>

        {/*
          تلات مفاتيح في إضافة واحدة.

          التلاتة بيعرفوا يصمّموا، والتاجر بيحطّ اللي معاه. اللي عنده
          مفتاح للبوت أصلًا ما ينفعش نجبره يفتح حسابًا تانيًا ويشحنه
          عشان يولّد ثيم.
        */}
        <KeyField
          id="designer-claude"
          label="مفتاح Claude (Anthropic)"
          value={keys.claude}
          onChange={(v) => {
            setKeys((k) => ({ ...k, claude: v }))
            setChecks((c) => ({ ...c, claude: null }))
          }}
          saved={Boolean(saved?.hasKey)}
          placeholder="sk-ant-…"
          docHref="https://console.anthropic.com/settings/keys"
          busy={verifying && checking === 'claude'}
          result={checks.claude}
          onVerify={() => verify('claude')}
          optional
        />

        <KeyField
          id="designer-gemini"
          label="مفتاح Gemini (Google)"
          value={keys.gemini}
          onChange={(v) => {
            setKeys((k) => ({ ...k, gemini: v }))
            setChecks((c) => ({ ...c, gemini: null }))
          }}
          saved={Boolean(saved?.hasGeminiKey)}
          placeholder="مفتاحك من Google AI Studio"
          docHref="https://aistudio.google.com/app/apikey"
          busy={verifying && checking === 'gemini'}
          result={checks.gemini}
          onVerify={() => verify('gemini')}
          optional
        />

        <KeyField
          id="designer-openai"
          label="مفتاح ChatGPT (OpenAI)"
          value={keys.openai}
          onChange={(v) => {
            setKeys((k) => ({ ...k, openai: v }))
            setChecks((c) => ({ ...c, openai: null }))
          }}
          saved={Boolean(saved?.hasOpenaiKey)}
          placeholder="sk-…"
          docHref="https://platform.openai.com/api-keys"
          busy={verifying && checking === 'openai'}
          result={checks.openai}
          onVerify={() => verify('openai')}
          optional
        />

        {available.length > 0 && (
          <div className="flex flex-col gap-3">
            {/* الاختيار بين المزوّدين — بيظهر لما يبقى فيه أكتر من واحد فعلًا */}
            {available.length > 1 && (
              <ProviderSwitch
                label="بيصمّم بـ"
                options={available.map((p) => ({ key: p, label: LABELS[p] }))}
                value={provider}
                onChange={(key) => {
                  setProvider(key)
                  if (models[key].length) setModel(models[key][0].id)
                }}
              />
            )}

            <ModelSelect
              label="الموديل"
              value={model}
              onChange={setModel}
              models={models[provider]}
              hint={`القايمة جاية من ${VENDORS[provider]} على مفتاحك — الأحدث فوق. دوس «تحقّق» جنب المفتاح عشان تحدّثها.`}
            />
          </div>
        )}

        <div className="flex items-start gap-2 rounded-lg bg-[var(--color-warning-soft)] px-3 py-2.5 text-xs text-[var(--color-warning)]">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            <strong>التلاتة محتاجين رصيد.</strong> Anthropic وOpenAI مفيهمش خطة مجانية للـAPI،
            وحصّة Gemini المجانية بتقف بسرعة مع التوليد الطويل.
          </span>
        </div>

        <div>
          <button
            type="button"
            onClick={() => save()}
            disabled={saving || !configured}
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
