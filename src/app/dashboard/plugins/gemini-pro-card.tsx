'use client'

import { useState, useTransition } from 'react'
import { Bot, Check, ExternalLink, Sparkles, TriangleAlert, Wand2 } from 'lucide-react'
import { Alert, Card } from '@/components/ui'
import type { PluginDef } from '@/lib/plugins'
import { saveGeminiProAction, verifyGeminiKeyAction } from './ai-actions'

export type GeminiProSaved = {
  enabled: boolean
  hasOwnKey: boolean
  model: string | null
  brief: string | null
  /** إضافة الردّ على العملاء متظبّطة؟ لو أيوه، المساعد يقدر يستعير مفتاحها */
  baseReady: boolean
}

type Model = { id: string; label: string }

/**
 * شاشة إعداد المساعد المنفّذ.
 *
 * الفرق عن بوت العملاء متكتوب صراحة فوق: **ده بيغيّر في متجرك.**
 * تاجر مفتكر إنه بيكتب نصوص وبيلاقي منتج اتضاف مش هيثق في المنصة
 * تاني، حتى لو هو اللي وافق.
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
  const [apiKey, setApiKey] = useState('')
  const [models, setModels] = useState<Model[]>([])
  const [model, setModel] = useState(saved?.model ?? '')
  const [brief, setBrief] = useState(saved?.brief ?? '')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [verifying, startVerify] = useTransition()
  const [saving, startSave] = useTransition()

  // شغّالة لو ليها مفتاحها أو لو مفتاح البوت متظبّط
  const usable = saved?.hasOwnKey || saved?.baseReady || models.length > 0

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
      setMsg({ ok: true, text: `المفتاح شغّال — ${res.models.length} موديل متاح.` })
    })

  const save = (nextEnabled?: boolean) =>
    startSave(async () => {
      setMsg(null)
      const res = await saveGeminiProAction({
        enabled: nextEnabled ?? enabled,
        apiKey: apiKey || undefined,
        model: model || undefined,
        brief,
      })
      if (res?.error) {
        setMsg({ ok: false, text: res.error })
        setEnabled(saved?.enabled ?? false)
      } else {
        setApiKey('')
        onToggle?.(def.slug, nextEnabled ?? enabled)
        setMsg({ ok: true, text: (nextEnabled ?? enabled) ? 'اتفعّل — هتلاقيه على الشمال' : 'اتوقف' })
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
        {msg && <Alert tone={msg.ok ? 'success' : 'danger'}>{msg.text}</Alert>}

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

        <p className="rounded-lg bg-[var(--color-warning-soft)] px-3 py-2.5 text-xs leading-relaxed text-[var(--color-warning)]">
          <strong>محتاج مفتاح عليه فوترة.</strong> المساعد ده بيقرا بيانات متجرك في كل
          سؤال وبيعدّل الصور، فاستهلاكه أعلى بكتير من البوت — والمفتاح المجاني بيقف
          معاه من أول شوية. فعّل الفوترة من Google AI Studio.
        </p>

        {saved?.baseReady && !saved.hasOwnKey && (
          <p className="rounded-lg bg-[var(--surface-2)] px-3 py-2.5 text-xs text-[var(--fg-muted)]">
            هيشتغل بمفتاح «الردّ على عملائك». حط مفتاحًا هنا بس لو عايز تفصل فاتورة
            المساعد — أو لو مفتاح البوت مجاني والمساعد محتاج فوترة.
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="gemini-pro-key" className="text-sm font-medium">
            {def.fields[0].label}
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="gemini-pro-key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              type="password"
              autoComplete="off"
              dir="ltr"
              placeholder={saved?.hasOwnKey ? '•••••••••• (محفوظ)' : def.fields[0].placeholder}
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
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-[var(--primary)] hover:underline"
          >
            اجيب المفتاح منين؟
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        </div>

        {models.length > 0 && (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">الموديل</span>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="min-h-11 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm focus:border-[var(--primary)] focus:outline-none"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            <span className="text-xs text-[var(--fg-subtle)]">
              المساعد بيقرا بيانات متجرك مع كل رسالة — الموديل الأقوى بيفهم أحسن
              وبيكلّف أكتر.
            </span>
          </label>
        )}

        {usable && (
          <div className="flex items-start gap-2 rounded-lg bg-[var(--color-warning-soft)] px-3 py-2.5 text-xs text-[var(--color-warning)]">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              المساعد بيستهلك أكتر من التحسين العادي لأنه بيقرا بيانات متجرك في كل
              رسالة. <strong>المفتاح المجاني هيقف بسرعة</strong> — فعّل الفوترة في
              Google AI Studio لو هتعتمد عليه.
            </span>
          </div>
        )}

        <div>
          <button
            type="button"
            onClick={() => save()}
            disabled={saving || !usable}
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
