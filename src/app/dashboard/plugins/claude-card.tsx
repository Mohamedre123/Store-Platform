'use client'

import { useState, useTransition } from 'react'
import { Check, ExternalLink, Palette, ShieldCheck, TriangleAlert } from 'lucide-react'
import { Alert, Card } from '@/components/ui'
import type { PluginDef } from '@/lib/plugins'
import { saveClaudeAction, verifyDesignerKeyAction } from './ai-actions'

export type ClaudeSaved = {
  enabled: boolean
  hasKey: boolean
  /** مفتاح جوجل محفوظ؟ نفس الإضافة بتقبل الاتنين */
  hasGeminiKey: boolean
  provider: 'claude' | 'gemini'
  model: string | null
}

type Model = { id: string; label: string }

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
  const [apiKey, setApiKey] = useState('')
  const [geminiKey, setGeminiKey] = useState('')
  /**
   * قايمة موديلات لكل مزوّد.
   *
   * التاجر اللي حاطط المفتاحين لازم يشوف الاتنين ويختار — مش نجبره
   * على واحد. والقايمة بتيجي من المزوّد نفسه على مفتاحه هو، فبتفضل
   * صح مع كل إصدار جديد من غير ما نعدّل سطر.
   */
  const [claudeModels, setClaudeModels] = useState<Model[]>([])
  const [geminiModels, setGeminiModels] = useState<Model[]>([])
  const [provider, setProvider] = useState<'claude' | 'gemini'>(saved?.provider ?? 'claude')
  const [model, setModel] = useState(saved?.model ?? '')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [verifying, startVerify] = useTransition()
  const [saving, startSave] = useTransition()

  const hasClaude = Boolean(saved?.hasKey) || claudeModels.length > 0
  const hasGemini = Boolean(saved?.hasGeminiKey) || geminiModels.length > 0
  const configured = (hasClaude || hasGemini) && Boolean(model)

  const activeModels = provider === 'gemini' ? geminiModels : claudeModels

  const verify = (which: 'claude' | 'gemini') =>
    startVerify(async () => {
      setMsg(null)
      const key = which === 'gemini' ? geminiKey : apiKey
      const res = await verifyDesignerKeyAction({ provider: which, apiKey: key })
      if (!res.ok) {
        setMsg({ ok: false, text: res.error })
        return
      }

      if (which === 'gemini') setGeminiModels(res.models)
      else setClaudeModels(res.models)

      setProvider(which)
      setModel(res.suggested)
      setMsg({
        ok: true,
        text: `المفتاح شغّال — ${res.models.length} موديل متاح.`,
      })
    })

  const save = (nextEnabled?: boolean) =>
    startSave(async () => {
      setMsg(null)
      const res = await saveClaudeAction({
        enabled: nextEnabled ?? enabled,
        apiKey: apiKey || undefined,
        geminiKey: geminiKey || undefined,
        provider,
        model: model || undefined,
      })
      if (res?.error) {
        setMsg({ ok: false, text: res.error })
        setEnabled(saved?.enabled ?? false)
      } else {
        onToggle?.(def.slug, nextEnabled ?? enabled)
        setApiKey('')
        setGeminiKey('')
        setMsg({
          ok: true,
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
          aria-label={enabled ? 'إيقاف Claude' : 'تفعيل Claude'}
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
        {msg && <Alert tone={msg.ok ? 'success' : 'danger'}>{msg.text}</Alert>}

        {/* الحدّ الأمني — التاجر لازم يعرف الأداة بتوصل لفين */}
        <div className="flex items-start gap-2 rounded-lg bg-[var(--color-success-soft)] px-3 py-2.5 text-xs text-[var(--color-success)]">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            كلود بيختار <strong>إعدادات</strong> (ألوان، خطوط، تخطيطات) — مش بيكتب كود
            بيتنفّذ في متجرك. والنتيجة بتروح للمسوّدة، تعاينها وتنشرها لما تعجبك.
          </span>
        </div>

        {/*
          مفتاحان في إضافة واحدة.

          الاتنين بيعرفوا يصمّموا، والتاجر بيحطّ اللي معاه. اللي عنده
          مفتاح جيميني للبوت أصلًا ما ينفعش نجبره يفتح حسابًا عند
          أنثروبيك ويشحنه عشان يولّد ثيم.
        */}
        <KeyField
          id="designer-claude"
          label="مفتاح Anthropic (Claude)"
          value={apiKey}
          onChange={setApiKey}
          saved={Boolean(saved?.hasKey)}
          placeholder="sk-ant-…"
          docHref="https://console.anthropic.com/settings/keys"
          busy={verifying}
          onVerify={() => verify('claude')}
        />

        <KeyField
          id="designer-gemini"
          label="مفتاح Google (Gemini)"
          value={geminiKey}
          onChange={setGeminiKey}
          saved={Boolean(saved?.hasGeminiKey)}
          placeholder="مفتاحك من Google AI Studio"
          docHref="https://aistudio.google.com/app/apikey"
          busy={verifying}
          onVerify={() => verify('gemini')}
        />

        {(hasClaude || hasGemini) && (
          <div className="flex flex-col gap-3">
            {/* الاختيار بين المزوّدين — بيظهر لما يبقى فيه اتنين فعلًا */}
            {hasClaude && hasGemini && (
              <div className="flex gap-2">
                {(['claude', 'gemini'] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={provider === key}
                    onClick={() => {
                      setProvider(key)
                      const list = key === 'gemini' ? geminiModels : claudeModels
                      if (list.length) setModel(list[0].id)
                    }}
                    className={`min-h-10 flex-1 rounded-lg text-sm font-medium transition-colors ${
                      provider === key
                        ? 'bg-[var(--primary)] text-[var(--primary-fg)]'
                        : 'bg-[var(--surface-2)] text-[var(--fg-muted)]'
                    }`}
                  >
                    {key === 'gemini' ? 'Gemini' : 'Claude'}
                  </button>
                ))}
              </div>
            )}

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">الموديل</span>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="min-h-11 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm focus:border-[var(--primary)] focus:outline-none"
              >
                {activeModels.length === 0 && model && <option value={model}>{model}</option>}
                {activeModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
              <span className="text-xs text-[var(--fg-subtle)]">
                القايمة جاية من {provider === 'gemini' ? 'Google' : 'Anthropic'} على مفتاحك —
                الأحدث فوق. دوس «تحقّق» جنب المفتاح عشان تحدّثها.
              </span>
            </label>
          </div>
        )}

        <div className="flex items-start gap-2 rounded-lg bg-[var(--color-warning-soft)] px-3 py-2.5 text-xs text-[var(--color-warning)]">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            <strong>الاتنين محتاجين رصيد.</strong> Anthropic مفيهوش خطة مجانية خالص،
            وGemini حصّته المجانية بتقف بسرعة مع التوليد الطويل — فعّل الفوترة على
            اللي هتستخدمه.
          </span>
        </div>

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

/**
 * خانة مفتاح مع زرار تحقّق.
 *
 * **التحقّق بنداء حقيقي لا بشكل المفتاح.** صيغ المفاتيح بتتغيّر عند
 * المزوّدين، وأي فحص بالشكل بيرفض مفاتيح سليمة والتاجر يفضل يحاول
 * ومش فاهم.
 */
function KeyField({
  id,
  label,
  value,
  onChange,
  saved,
  placeholder,
  docHref,
  busy,
  onVerify,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  saved: boolean
  placeholder: string
  docHref: string
  busy: boolean
  onVerify: () => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
        {label}
        {saved && (
          <span className="rounded-md bg-[var(--color-success-soft)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--color-success)]">
            محفوظ
          </span>
        )}
      </label>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          type="password"
          autoComplete="off"
          dir="ltr"
          placeholder={saved ? '•••••••••• (محفوظ)' : placeholder}
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-start font-mono text-sm focus:border-[var(--primary)] focus:outline-none"
        />
        <button
          type="button"
          onClick={onVerify}
          disabled={busy || !value.trim()}
          className="min-h-11 shrink-0 rounded-lg border border-[var(--border-strong)] px-4 text-sm font-medium transition-colors hover:bg-[var(--surface-2)] disabled:opacity-50"
        >
          {busy ? 'بيتأكّد…' : 'تحقّق'}
        </button>
      </div>

      <a
        href={docHref}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs font-medium text-[var(--primary)] hover:underline"
      >
        اجيب المفتاح منين؟
        <ExternalLink className="h-3 w-3" aria-hidden="true" />
      </a>
    </div>
  )
}
