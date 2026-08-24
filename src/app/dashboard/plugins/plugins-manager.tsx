'use client'

import { useState, useTransition } from 'react'
import { BarChart3, Check, HelpCircle, MessageCircle, Sparkles, Target } from 'lucide-react'
import { savePluginAction } from './actions'
import { PLUGINS, type PluginDef } from '@/lib/plugins'
import { Alert } from '@/components/ui'
import { AppCard } from './app-card'
import { WhatsappCard } from './whatsapp-card'
import type { WhatsappSettings } from '@/lib/whatsapp'
import type { Templates } from '@/lib/whatsapp-templates'
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
  gemini: { initials: 'رد', gradient: 'linear-gradient(135deg,#8b5cf6,#ec4899)' },
  gemini_pro: {
    initials: 'إد',
    gradient: 'linear-gradient(135deg,#f59e0b,#ec4899)',
    badge: 'بيغيّر في متجرك',
  },
  claude: { initials: 'تص', gradient: 'linear-gradient(135deg,#d97757,#4285f4)' },
  whatsapp: { initials: 'وا', gradient: 'linear-gradient(135deg,#25D366,#128C7E)' },
}

const GROUPS = [
  {
    key: 'messaging' as const,
    title: 'رسايل العملاء',
    icon: MessageCircle,
    hint: 'رموز الدخول وتأكيد الطلبات وحالة الشحن — بتوصل لعملاءك باسم متجرك.',
  },
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
  whatsapp,
  gemini,
  pro,
  claude,
}: {
  installed: PluginRow[]
  whatsapp: {
    settings: WhatsappSettings
    templates: Templates
    storePhone: string | null
    hasPlatformToken: boolean
  }
  gemini: GeminiSaved
  pro: GeminiProSaved
  claude: ClaudeSaved
}) {
  const bySlug = new Map(installed.map((p) => [p.slug, p]))

  /** مفعّل فعلًا: الإضافة شغّالة **ومعاها** اللي محتاجاه عشان تشتغل */
  const initialActive = (slug: string) => {
    /* واتساب «شغّال» يعني مربوط ومعاه مفتاح — مش مجرد إن الصف موجود */
    if (slug === 'whatsapp') {
      return whatsapp.settings.provider !== 'off' && whatsapp.settings.hasKey
    }
    if (slug === 'gemini') return gemini.enabled && gemini.hasKey
    if (slug === 'gemini_pro') return pro.enabled && (pro.hasOwnKey || pro.baseReady)
    if (slug === 'claude') return claude.enabled && claude.hasKey
    const row = bySlug.get(slug)
    return Boolean(row?.enabled && Object.values(row.config ?? {}).some(Boolean))
  }

  /** فيه إعدادات محفوظة؟ بيغيّر نص الزرار من «فعّل» لـ«تفاصيل» */
  const initialConfigured = (slug: string) => {
    if (slug === 'gemini') return gemini.hasKey
    if (slug === 'gemini_pro') return pro.hasOwnKey || pro.baseReady
    if (slug === 'claude') return claude.hasKey
    const row = bySlug.get(slug)
    return Boolean(row && Object.values(row.config ?? {}).some(Boolean))
  }

  /**
   * حالة التفعيل في المتصفح.
   *
   * الخادم مش بيعيد تحميل الصفحة بعد كل مفتاح (وده مقصود — إعادة
   * التحميل كانت بتخلّي المفتاح يبان تقيلًا)، فالعدّاد فوق والنقطة
   * على كل كارت لازم يتحرّكوا من هنا. الكارت بيبلّغ لما يحفظ بنجاح.
   */
  const [live, setLive] = useState<Record<string, { active: boolean; configured: boolean }>>(() =>
    Object.fromEntries(
      PLUGINS.map((d) => [
        d.slug,
        { active: initialActive(d.slug), configured: initialConfigured(d.slug) },
      ]),
    ),
  )

  const report = (slug: string, active: boolean) =>
    setLive((v) => ({ ...v, [slug]: { active, configured: active || (v[slug]?.configured ?? false) } }))

  const activeCount = PLUGINS.filter((d) => live[d.slug]?.active).length

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
                    active={live[def.slug]?.active ?? false}
                    configured={live[def.slug]?.configured ?? false}
                  >
                    {def.custom === 'whatsapp' ? (
                      <WhatsappCard
                        settings={whatsapp.settings}
                        templates={whatsapp.templates}
                        storePhone={whatsapp.storePhone}
                        hasPlatformToken={whatsapp.hasPlatformToken}
                      />
                    ) : def.custom === 'gemini' ? (
                      <GeminiCard def={def} saved={gemini} embedded onToggle={report} />
                    ) : def.custom === 'gemini_pro' ? (
                      <GeminiProCard def={def} saved={pro} embedded onToggle={report} />
                    ) : def.custom === 'claude' ? (
                      <ClaudeCard def={def} saved={claude} embedded onToggle={report} />
                    ) : (
                      <PluginCard def={def} saved={bySlug.get(def.slug)} onToggle={report} />
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

function PluginCard({
  def,
  saved,
  onToggle,
}: {
  def: PluginDef
  saved?: PluginRow
  onToggle?: (slug: string, active: boolean) => void
}) {
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
        onToggle?.(def.slug, willEnable)
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
          aria-busy={pending}
          onClick={() => {
            if (pending) return
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
