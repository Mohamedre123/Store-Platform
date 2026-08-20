'use client'

import { useState, useTransition } from 'react'
import { Check, ExternalLink, Palette, ShieldCheck, TriangleAlert } from 'lucide-react'
import { Alert, Card } from '@/components/ui'
import type { PluginDef } from '@/lib/plugins'
import { saveClaudeAction, verifyClaudeKeyAction } from './ai-actions'

export type ClaudeSaved = {
  enabled: boolean
  hasKey: boolean
  model: string | null
}

type Model = { id: string; label: string }

export function ClaudeCard({ def, saved }: { def: PluginDef; saved?: ClaudeSaved }) {
  const [enabled, setEnabled] = useState(saved?.enabled ?? false)
  const [apiKey, setApiKey] = useState('')
  const [models, setModels] = useState<Model[]>([])
  const [model, setModel] = useState(saved?.model ?? '')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [verifying, startVerify] = useTransition()
  const [saving, startSave] = useTransition()

  const configured = (saved?.hasKey && Boolean(saved.model)) || models.length > 0

  const verify = () =>
    startVerify(async () => {
      setMsg(null)
      const res = await verifyClaudeKeyAction(apiKey)
      if (!res.ok) {
        setMsg({ ok: false, text: res.error })
        return
      }
      setModels(res.models)
      setModel((m) => m || res.suggested)
      setMsg({ ok: true, text: `المفتاح شغّال — ${res.models.length} موديل متاح.` })
    })

  const save = (nextEnabled?: boolean) =>
    startSave(async () => {
      setMsg(null)
      const res = await saveClaudeAction({
        enabled: nextEnabled ?? enabled,
        apiKey: apiKey || undefined,
        model: model || undefined,
      })
      if (res?.error) {
        setMsg({ ok: false, text: res.error })
        setEnabled(saved?.enabled ?? false)
      } else {
        setApiKey('')
        setMsg({
          ok: true,
          text: (nextEnabled ?? enabled) ? 'اتفعّلت — هتلاقيها في صفحة المتجر' : 'اتوقفت',
        })
      }
    })

  return (
    <Card className="flex flex-col gap-4 p-5">
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

        {/* الحدّ الأمني — التاجر لازم يعرف الأداة بتوصل لفين */}
        <div className="flex items-start gap-2 rounded-lg bg-[var(--color-success-soft)] px-3 py-2.5 text-xs text-[var(--color-success)]">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            كلود بيختار <strong>إعدادات</strong> (ألوان، خطوط، تخطيطات) — مش بيكتب كود
            بيتنفّذ في متجرك. والنتيجة بتروح للمسوّدة، تعاينها وتنشرها لما تعجبك.
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="claude-key" className="text-sm font-medium">
            {def.fields[0].label}
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="claude-key"
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
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--primary)] hover:underline"
          >
            اجيب المفتاح منين؟
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        </div>

        {configured && (
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
              القايمة جاية من Anthropic على مفتاحك — الأحدث فوق.
            </span>
          </label>
        )}

        <div className="flex items-start gap-2 rounded-lg bg-[var(--color-warning-soft)] px-3 py-2.5 text-xs text-[var(--color-warning)]">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            <strong>مفيش خطة مجانية زي Gemini.</strong> حساب Anthropic محتاج رصيد مشحون —
            من غيره كل محاولة هتترفض.
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
    </Card>
  )
}
