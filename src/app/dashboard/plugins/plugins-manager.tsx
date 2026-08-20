'use client'

import { useState, useTransition } from 'react'
import { BarChart3, Check, HelpCircle, Sparkles, Target } from 'lucide-react'
import { savePluginAction } from './actions'
import { PLUGINS, type PluginDef } from '@/lib/plugins'
import { Alert, Card } from '@/components/ui'
import { GeminiCard, type GeminiSaved } from './gemini-card'
import { GeminiProCard, type GeminiProSaved } from './gemini-pro-card'

export type PluginRow = { slug: string; enabled: boolean; config: Record<string, unknown> }

const GROUPS = [
  {
    key: 'ai' as const,
    title: 'الذكاء الاصطناعي',
    icon: Sparkles,
    hint: 'بمفتاحك إنت — كل نداء بيتحسب على حسابك في جوجل مش علينا.',
  },
  { key: 'pixels' as const, title: 'بكسلات الإعلانات', icon: Target, hint: 'بتقيس نتايج إعلاناتك وتحسّن استهدافها. الصق المعرّف بس — من غير أي كود.' },
  { key: 'analytics' as const, title: 'التحليلات', icon: BarChart3, hint: 'تقارير تفصيلية عن سلوك الزوّار في متجرك.' },
]

export function PluginsManager({
  installed,
  gemini,
  pro,
}: {
  installed: PluginRow[]
  gemini: GeminiSaved
  pro: GeminiProSaved
}) {
  const bySlug = new Map(installed.map((p) => [p.slug, p]))

  return (
    <div className="flex flex-col gap-8">
      {GROUPS.map((g) => {
        const items = PLUGINS.filter((p) => p.group === g.key)
        if (items.length === 0) return null
        const Icon = g.icon
        return (
          <section key={g.key} className="flex flex-col gap-3">
            <div className="flex items-start gap-2">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]" aria-hidden="true" />
              <div>
                <h2 className="font-semibold">{g.title}</h2>
                <p className="mt-0.5 text-sm text-[var(--fg-muted)]">{g.hint}</p>
              </div>
            </div>
            <div className="flex flex-col gap-3">
              {items.map((def) =>
                def.custom === 'gemini' ? (
                  <GeminiCard key={def.slug} def={def} saved={gemini} />
                ) : def.custom === 'gemini_pro' ? (
                  <GeminiProCard key={def.slug} def={def} saved={pro} />
                ) : (
                  <PluginCard key={def.slug} def={def} saved={bySlug.get(def.slug)} />
                ),
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function PluginCard({ def, saved }: { def: PluginDef; saved?: PluginRow }) {
  const [enabled, setEnabled] = useState(saved?.enabled ?? false)
  const [config, setConfig] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const f of def.fields) {
      const v = saved?.config?.[f.key]
      initial[f.key] = typeof v === 'string' ? v : ''
    }
    return initial
  })
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [pending, start] = useTransition()

  function save(nextEnabled?: boolean) {
    const willEnable = nextEnabled ?? enabled
    setMsg(null)
    start(async () => {
      const res = await savePluginAction({ slug: def.slug, enabled: willEnable, config })
      if (res?.error) {
        setMsg({ ok: false, text: res.error })
        setEnabled(saved?.enabled ?? false) // رجّع المفتاح لأنه ما اتحفظش
      } else {
        setMsg({ ok: true, text: willEnable ? 'اتفعّل وشغّال على متجرك' : 'اتوقف' })
      }
    })
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{def.name}</h3>
            {enabled && (
              <span className="rounded-md bg-[var(--color-success-soft)] px-2 py-0.5 text-xs font-medium text-[var(--color-success)]">
                شغّال
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-[var(--fg-muted)]">{def.desc}</p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={enabled ? `إيقاف ${def.name}` : `تفعيل ${def.name}`}
          disabled={pending}
          onClick={() => {
            const next = !enabled
            setEnabled(next)
            save(next)
          }}
          className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${
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

        {def.fields.map((f) => (
          <label key={f.key} className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{f.label}</span>
            <input
              value={config[f.key] ?? ''}
              onChange={(e) => setConfig((c) => ({ ...c, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
              dir="ltr"
              className="h-11 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-start font-mono text-sm focus:border-[var(--primary)] focus:outline-none"
            />
          </label>
        ))}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => save()}
            disabled={pending}
            className="flex min-h-10 items-center gap-2 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-fg)] transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            حفظ
          </button>

          {def.where && (
            <button
              type="button"
              onClick={() => setShowHelp((v) => !v)}
              className="flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)]"
            >
              <HelpCircle className="h-4 w-4" aria-hidden="true" />
              أجيبه منين؟
            </button>
          )}
        </div>

        {showHelp && def.where && (
          <p className="rounded-lg bg-[var(--surface-2)] px-3 py-2 text-xs leading-relaxed text-[var(--fg-muted)]">
            {def.where}
          </p>
        )}
      </div>
    </Card>
  )
}
