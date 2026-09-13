'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { Bot, Check, Sparkles, TriangleAlert, Wand2 } from 'lucide-react'
import { Alert, Card } from '@/components/ui'
import type { PluginDef } from '@/lib/plugins'
import { AI_PROVIDERS, type AiIssue, type AiProvider } from '@/lib/ai/providers-meta'
import { saveGeminiProAction, verifyAiKeyAction } from './ai-actions'
import { IssueBanner, KeyField, ModelSelect, ProviderSwitch, type KeyCheck } from './ai-fields'
import { ModelDefaults } from './model-defaults'

export type GeminiProSaved = {
  enabled: boolean
  /** مفتاح Gemini خاص بالمساعد */
  hasOwnKey: boolean
  hasOwnOpenaiKey: boolean
  model: string | null
  openaiModel: string | null
  imageModel?: string | null
  openaiImageModel?: string | null
  provider: AiProvider | null
  brief: string | null
  /** المزوّدين اللي ليهم مفتاح في إضافة الرد على العملاء — المساعد بيستعيرهم */
  baseProviders: AiProvider[]
  lastIssue: AiIssue | null
}

type Model = { id: string; label: string }

const GEMINI = AI_PROVIDERS[0]
const OPENAI = AI_PROVIDERS[1]

/**
 * شاشة إعداد المساعد المنفّذ.
 *
 * الفرق عن بوت العملاء متكتوب صراحة فوق: **ده بيغيّر في متجرك.**
 * تاجر مفتكر إنه بيكتب نصوص وبيلاقي منتج اتضاف مش هيثق في المنصة
 * تاني، حتى لو هو اللي وافق.
 *
 * ## المفاتيح هنا اختيارية
 * المساعد بيستعير مفاتيح إضافة الرد على العملاء. المفتاح هنا بس لو
 * التاجر عايز يفصل فاتورة المساعد، أو مفتاح البوت مجاني والمساعد
 * محتاج فوترة.
 */
export function GeminiProCard({
  def,
  saved,
  embedded = false,
  onToggle,
}: {
  def: PluginDef
  saved?: GeminiProSaved
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
  const [imageModel, setImageModel] = useState(saved?.imageModel ?? '')
  const [openaiImageModel, setOpenaiImageModel] = useState(saved?.openaiImageModel ?? '')
  const [provider, setProvider] = useState<AiProvider | null>(saved?.provider ?? null)
  const [removed, setRemoved] = useState<AiProvider[]>([])
  const [brief] = useState(saved?.brief ?? '')
  const [msg, setMsg] = useState<{ tone: 'success' | 'danger' | 'warning'; text: string } | null>(null)
  const [verifying, startVerify] = useTransition()
  const [saving, startSave] = useTransition()

  /* نتيجة التحقّق لكل مفتاح — بتظهر تحت خانته هو */
  const [checks, setChecks] = useState<Partial<Record<AiProvider, KeyCheck>>>({})
  const [checking, setChecking] = useState<AiProvider | null>(null)

  const msgRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (msg) msgRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [msg])

  const base = saved?.baseProviders ?? []
  const ownGemini = (Boolean(saved?.hasOwnKey) && !removed.includes('gemini')) || geminiModels.length > 0
  const ownOpenai = (Boolean(saved?.hasOwnOpenaiKey) && !removed.includes('openai')) || openaiModels.length > 0
  const hasGemini = ownGemini || base.includes('gemini')
  const hasOpenai = ownOpenai || base.includes('openai')
  const usable = hasGemini || hasOpenai

  const effective: AiProvider | null =
    provider === 'openai' && hasOpenai
      ? 'openai'
      : provider === 'gemini' && hasGemini
        ? 'gemini'
        : hasGemini
          ? 'gemini'
          : hasOpenai
            ? 'openai'
            : null

  const verify = (which: AiProvider) =>
    startVerify(async () => {
      setChecking(which)
      setChecks((c) => ({ ...c, [which]: null }))
      const res = await verifyAiKeyAction({
        provider: which,
        apiKey: which === 'openai' ? openaiKey : geminiKey,
      })
      setChecking(null)
      if (!res.ok) {
        setChecks((c) => ({ ...c, [which]: { tone: 'danger', text: res.error } }))
        return
      }
      if (which === 'openai') {
        setOpenaiModels(res.models)
        setOpenaiModel((m) => m || res.suggested)
      } else {
        setGeminiModels(res.models)
        setModel((m) => m || res.suggested)
      }
      setRemoved((r) => r.filter((p) => p !== which))

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
      const res = await saveGeminiProAction({
        enabled: nextEnabled ?? enabled,
        apiKey: geminiKey || undefined,
        openaiKey: openaiKey || undefined,
        model: model || undefined,
        openaiModel: openaiModel || undefined,
        imageModel,
        openaiImageModel,
        removeKeys: removed.length ? removed : undefined,
        provider: effective ?? undefined,
        brief,
      })
      if (res?.error) {
        setMsg({ tone: 'danger', text: res.error })
        setEnabled(saved?.enabled ?? false)
      } else {
        setGeminiKey('')
        setOpenaiKey('')
        onToggle?.(def.slug, nextEnabled ?? enabled)
        setMsg({
          tone: 'success',
          text: (nextEnabled ?? enabled) ? 'اتفعّل — هتلاقيه تحت في اللوحة' : 'اتوقف',
        })
      }
    })

  const Wrapper = embedded ? ('div' as const) : Card

  return (
    <Wrapper className={embedded ? 'flex flex-col gap-4' : 'flex flex-col gap-4 p-5'}>
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#f59e0b] to-[#ec4899] text-white">
          <Wand2 className="h-5 w-5" aria-hidden="true" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{def.name}</h3>
            <span className="rounded-md bg-[var(--color-warning-soft)] px-2 py-0.5 text-xs font-medium text-[var(--color-warning)]">
              بيغيّر في متجرك
            </span>
            {enabled && usable && (
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
          aria-label={enabled ? 'إيقاف المساعد' : 'تفعيل المساعد'}
          aria-busy={saving}
          disabled={!usable && !enabled}
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

        {/*
          الفرق بالوظيفة لا بالاسم.

          «عادي» و«برو» ما بيقولوش للتاجر حاجة — لازم يعرف ده بيكلّم
          مين وده بيعمل إيه، عشان يقرّر يشغّل أنهي واحد.
        */}
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-[var(--border)] p-3">
            <span className="flex items-center gap-1.5 text-xs font-semibold">
              <Sparkles className="h-3.5 w-3.5 text-[var(--primary)]" aria-hidden="true" />
              الردّ على عملائك
            </span>
            <p className="mt-1 text-xs leading-relaxed text-[var(--fg-muted)]">
              بيكلّم <strong>زوّار متجرك</strong> ويرد على أسئلتهم.
              ما بيغيّرش حاجة في متجرك.
            </p>
          </div>
          <div className="rounded-lg border border-[var(--color-warning)]/40 bg-[var(--color-warning-soft)]/40 p-3">
            <span className="flex items-center gap-1.5 text-xs font-semibold">
              <Bot className="h-3.5 w-3.5 text-[var(--color-warning)]" aria-hidden="true" />
              مساعدك في الإدارة
            </span>
            <p className="mt-1 text-xs leading-relaxed text-[var(--fg-muted)]">
              بيكلّمك <strong>إنت في اللوحة</strong> و<strong>بينفّذ</strong>: بيضيف
              منتجات ويعدّل أسعار وصور ويغيّر حالة طلبات — بموافقتك على كل إجراء.
            </p>
          </div>
        </div>

        {base.length > 0 && !ownGemini && !ownOpenai && (
          <p className="rounded-lg bg-[var(--surface-2)] px-3 py-2.5 text-xs text-[var(--fg-muted)]">
            هيشتغل بمفاتيح «الردّ على عملائك» (
            {base.map((p) => (p === 'openai' ? OPENAI.label : GEMINI.label)).join(' و')}). حط مفتاحًا
            هنا بس لو عايز تفصل فاتورة المساعد.
          </p>
        )}

        <KeyField
          id="pro-gemini"
          label={GEMINI.keyLabel}
          value={geminiKey}
          onChange={(v) => {
            setGeminiKey(v)
            setChecks((c) => ({ ...c, gemini: null }))
          }}
          saved={Boolean(saved?.hasOwnKey) && !removed.includes('gemini')}
          placeholder={GEMINI.keyPlaceholder}
          docHref={GEMINI.keyHref}
          busy={verifying && checking === 'gemini'}
          result={checks.gemini}
          onVerify={() => verify('gemini')}
          onRemove={() => setRemoved((r) => [...r, 'gemini'])}
          optional
        />

        <KeyField
          id="pro-openai"
          label={OPENAI.keyLabel}
          value={openaiKey}
          onChange={(v) => {
            setOpenaiKey(v)
            setChecks((c) => ({ ...c, openai: null }))
          }}
          saved={Boolean(saved?.hasOwnOpenaiKey) && !removed.includes('openai')}
          placeholder={OPENAI.keyPlaceholder}
          docHref={OPENAI.keyHref}
          busy={verifying && checking === 'openai'}
          result={checks.openai}
          onVerify={() => verify('openai')}
          onRemove={() => setRemoved((r) => [...r, 'openai'])}
          optional
        />

        {usable && (
          <div className="flex flex-col gap-3">
            {hasGemini && hasOpenai && (
              <ProviderSwitch
                label="المساعد يشتغل افتراضيًا بـ"
                hint="وتقدر تبدّل بينهم من جوّه الشات نفسه في أي وقت."
                options={[
                  { key: 'gemini' as const, label: GEMINI.label },
                  { key: 'openai' as const, label: OPENAI.label },
                ]}
                value={effective}
                onChange={setProvider}
              />
            )}

            <ModelDefaults
              slug="gemini_pro"
              hasGemini={hasGemini}
              hasOpenai={hasOpenai}
              geminiKey={geminiKey}
              openaiKey={openaiKey}
              verified={{ gemini: geminiModels, openai: openaiModels }}
              values={{ model, imageModel, openaiModel, openaiImageModel }}
              onChange={(next) => {
                if (next.model !== undefined) setModel(next.model)
                if (next.imageModel !== undefined) setImageModel(next.imageModel)
                if (next.openaiModel !== undefined) setOpenaiModel(next.openaiModel)
                if (next.openaiImageModel !== undefined) setOpenaiImageModel(next.openaiImageModel)
              }}
            />

            <div className="flex items-start gap-2 rounded-lg bg-[var(--color-warning-soft)] px-3 py-2.5 text-xs text-[var(--color-warning)]">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                المساعد بيستهلك أكتر من التحسين العادي لأنه بيقرا بيانات متجرك في كل
                رسالة. <strong>محتاج مفتاح عليه رصيد أو فوترة</strong> لو هتعتمد عليه.
              </span>
            </div>
          </div>
        )}

        <div>
          <button
            type="button"
            onClick={() => save()}
            disabled={saving || (!usable && removed.length === 0)}
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
