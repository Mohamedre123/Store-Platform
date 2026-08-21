'use client'

import { useState, useTransition } from 'react'
import { BarChart3, Check, HelpCircle, Sparkles, Target } from 'lucide-react'
import { savePluginAction } from './actions'
import { PLUGINS, type PluginDef } from '@/lib/plugins'
import { Alert } from '@/components/ui'
import { AppCard } from './app-card'
import { GeminiCard, type GeminiSaved } from './gemini-card'
import { GeminiProCard, type GeminiProSaved } from './gemini-pro-card'
import { ClaudeCard, type ClaudeSaved } from './claude-card'

export type PluginRow = { slug: string; enabled: boolean; config: Record<string, unknown> }

/**
 * هوية كل إضافة في المعرض.
 *
 * اللون والحروف من هنا لا من داخل الكارت: التاجر بيتعرّف على
 * الإضافة من المربّع الملوّن قبل ما يقرا اسمها، فلازم يفضل ثابتًا
 * في كل مكان تظهر فيه.
 */
const LOOKS: Record<string, { initials: string; gradient: string; badge?: string }> = {
  facebook_pixel: { initials: 'FB', gradient: '#1877f2' },
  tiktok_pixel: { initials: 'TT', gradient: 'linear-gradient(135deg,#25f4ee,#fe2c55)' },
  snapchat_pixel: { initials: 'SC', gradient: '#fffc00' },
  google_analytics: { initials: 'GA', gradient: 'linear-gradient(135deg,#f9ab00,#e37400)' },
  google_ads: { initials: 'AD', gradient: 'linear-gradient(135deg,#4285f4,#34a853)' },
  gemini: { initials: 'GE', gradient: 'linear-gradient(135deg,#8b5cf6,#ec4899)' },
  gemini_pro: {
    initials: 'PR',
    gradient: 'linear-gradient(135deg,#f59e0b,#ec4899)',
    badge: 'بيغيّر في متجرك',
  },
  claude: { initials: 'CL', gradient: 'linear-gradient(135deg,#d97757,#8b5cf6)' },
}

const GROUPS = [
  {
    key: 'ai' as const,
    title: 'الذكاء الاصطناعي',
    icon: Sparkles,
    hint: 'بمفتاحك إنت — كل نداء بيتحسب على حسابك في جوجل مش علينا.',
  },
  {
    key: 'pixels' as const,
    title: 'بكسلات الإعلانات',
    icon: Target,
    hint: 'بتقيس نتايج إعلاناتك وتحسّن استهدافها. الصق المعرّف بس — من غير أي كود.',
  },
  {
    key: 'analytics' as const,
    title: 'التحليلات',
    icon: BarChart3,
    hint: 'تقارير تفصيلية عن سلوك الزوّار في متجرك.',
  },
]

export function PluginsManager({
  installed,
  gemini,
  pro,
  claude,
}: {
  installed: PluginRow[]
  gemini: GeminiSaved
  pro: GeminiProSaved
  claude: ClaudeSaved
}) {
  const bySlug = new Map(installed.map((p) => [p.slug, p]))

  /** مفعّل فعلًا: الإضافة شغّالة **ومعاها** اللي محتاجاه عشان تشتغل */
  const isActive = (slug: string) => {
    if (slug === 'gemini') return gemini.enabled && gemini.hasKey
    if (slug === 'gemini_pro') return pro.enabled && (pro.hasOwnKey || pro.baseReady)
    if (slug === 'claude') return claude.enabled && claude.hasKey
    const row = bySlug.get(slug)
    return Boolean(row?.enabled && Object.values(row.config ?? {}).some(Boolean))
  }

  /** فيه إعدادات محفوظة؟ بيغيّر نص الزرار من «فعّل» لـ«تفاصيل» */
  const isConfigured = (slug: string) => {
    if (slug === 'gemini') return gemini.hasKey
    if (slug === 'gemini_pro') return pro.hasOwnKey || pro.baseReady
    if (slug === 'claude') return claude.hasKey
    const row = bySlug.get(slug)
    return Boolean(row && Object.values(row.config ?? {}).some(Boolean))
  }

  const activeCount = PLUGINS.filter((p) => isActive(p.slug)).length

  return (
    <div className="flex flex-col gap-8">
      {/* شريط الأرقام — التاجر بيعرف حالته في سطر واحد */}
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-success-soft)] px-3 py-1.5 text-sm font-medium text-[var(--color-success)]">
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
          {activeCount} مفعّلة
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--surface-2)] px-3 py-1.5 text-sm font-medium text-[var(--fg-muted)]">
          {PLUGINS.length - activeCount} مش مفعّلة
        </span>
      </div>

      {GROUPS.map((g) => {
        const items = PLUGINS.filter((p) => p.group === g.key)
        if (items.length === 0) return null
        const Icon = g.icon

        return (
          <section key={g.key} className="flex flex-col gap-4">
            <div className="flex items-start gap-2">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]" aria-hidden="true" />
              <div>
                <h2 className="font-semibold">{g.title}</h2>
                <p className="mt-0.5 text-sm text-[var(--fg-muted)]">{g.hint}</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((def) => {
                const look = LOOKS[def.slug] ?? { initials: '??', gradient: 'var(--primary)' }

                return (
                  <AppCard
                    key={def.slug}
                    name={def.name}
                    desc={def.desc}
                    initials={look.initials}
                    gradient={look.gradient}
                    badge={look.badge}
                    active={isActive(def.slug)}
                    configured={isConfigured(def.slug)}
                  >
                    {def.custom === 'gemini' ? (
                      <GeminiCard def={def} saved={gemini} embedded />
                    ) : def.custom === 'gemini_pro' ? (
                      <GeminiProCard def={def} saved={pro} embedded />
                    ) : def.custom === 'claude' ? (
                      <ClaudeCard def={def} saved={claude} embedded />
                    ) : (
                      <PluginCard def={def} saved={bySlug.get(def.slug)} />
                    )}
                  </AppCard>
                )
              })}
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
    <div className="flex flex-col gap-4">
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
    </div>
  )
}
