'use client'

import { useState, useTransition } from 'react'
import { Check, Plus, Save, Trash2 } from 'lucide-react'
import { saveLoyaltyAction } from './actions'
import { Alert, Card } from '@/components/ui'
import { Toggle } from '@/components/dashboard/controls'
import type { TierConfig } from '@/db/schema'

const TIER_KEYS: TierConfig['key'][] = ['bronze', 'silver', 'gold', 'platinum']
const TIER_LABEL: Record<TierConfig['key'], string> = {
  bronze: 'برونزي',
  silver: 'فضي',
  gold: 'ذهبي',
  platinum: 'بلاتيني',
}

const DEFAULT_TIERS: TierConfig[] = [
  { key: 'bronze', name: 'برونزي', minPoints: 0, color: '#a1662f', perks: [], discountBps: 0 },
  { key: 'silver', name: 'فضي', minPoints: 500, color: '#8a8f98', perks: [], discountBps: 300 },
  { key: 'gold', name: 'ذهبي', minPoints: 2000, color: '#c9a227', perks: [], discountBps: 700 },
]

const field =
  'h-11 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm tabular-nums focus:border-[var(--primary)] focus:outline-none'

export function LoyaltyForm({
  settings,
  currency,
}: {
  settings: {
    enabled: boolean
    pointsPerUnit: number
    pointValue: number
    minPointsToRedeem: number
    welcomePoints: number
    reviewPoints: number
    tiers: TierConfig[]
  } | null
  currency: string
}) {
  const [enabled, setEnabled] = useState(settings?.enabled ?? false)
  const [pointsPerPound, setPointsPerPound] = useState(String(settings?.pointsPerUnit ?? 1))
  const [pointValue, setPointValue] = useState(String(settings?.pointValue ?? 1))
  const [minRedeem, setMinRedeem] = useState(String(settings?.minPointsToRedeem ?? 100))
  const [welcome, setWelcome] = useState(String(settings?.welcomePoints ?? 0))
  const [review, setReview] = useState(String(settings?.reviewPoints ?? 0))
  const [tiers, setTiers] = useState<TierConfig[]>(
    settings?.tiers?.length ? settings.tiers : DEFAULT_TIERS,
  )
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()

  function save() {
    setMsg(null)
    start(async () => {
      const res = await saveLoyaltyAction({
        enabled,
        pointsPerPound,
        pointValue,
        minPointsToRedeem: minRedeem,
        welcomePoints: welcome,
        reviewPoints: review,
        tiers,
      })
      setMsg(res?.error ? { ok: false, text: res.error } : { ok: true, text: 'اتحفظ' })
    })
  }

  // مثال حي بيوضّح المعادلة للتاجر بدل ما يحسبها في دماغه
  const perPound = Number(pointsPerPound) || 0
  const value = Number(pointValue) || 0
  const example = perPound > 0 && value > 0 ? Math.round((1000 * perPound * value) / 100) / 100 : 0

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-col gap-5 p-5">
        <Toggle
          label="تفعيل نظام النقاط"
          hint="العميل بيجمع نقاط مع كل طلب يتسلّمه، ويستبدلها خصمًا في طلبات جاية."
          checked={enabled}
          onChange={setEnabled}
        />

        {msg && <Alert tone={msg.ok ? 'success' : 'danger'}>{msg.text}</Alert>}

        {enabled && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">نقاط لكل جنيه</span>
                <input
                  value={pointsPerPound}
                  onChange={(e) => setPointsPerPound(e.target.value)}
                  inputMode="numeric"
                  dir="ltr"
                  className={`${field} text-start`}
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">قيمة النقطة (بالقرش)</span>
                <input
                  value={pointValue}
                  onChange={(e) => setPointValue(e.target.value)}
                  inputMode="numeric"
                  dir="ltr"
                  className={`${field} text-start`}
                />
              </label>
            </div>

            {example > 0 && (
              <p className="rounded-lg bg-[var(--surface-2)] px-3 py-2 text-xs leading-relaxed text-[var(--fg-muted)]">
                يعني: عميل طلب بـ<strong>١٠٠٠ {currency}</strong> هياخد{' '}
                <strong>{(1000 * perPound).toLocaleString('ar-EG')} نقطة</strong>، قيمتها{' '}
                <strong>{example} {currency}</strong> خصم في طلبه الجاي.
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">أقل نقاط للاستبدال</span>
                <input
                  value={minRedeem}
                  onChange={(e) => setMinRedeem(e.target.value)}
                  inputMode="numeric"
                  dir="ltr"
                  className={`${field} text-start`}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">نقاط الترحيب</span>
                <input
                  value={welcome}
                  onChange={(e) => setWelcome(e.target.value)}
                  inputMode="numeric"
                  dir="ltr"
                  className={`${field} text-start`}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">نقاط المراجعة</span>
                <input
                  value={review}
                  onChange={(e) => setReview(e.target.value)}
                  inputMode="numeric"
                  dir="ltr"
                  className={`${field} text-start`}
                />
              </label>
            </div>
          </>
        )}
      </Card>

      {enabled && (
        <Card className="flex flex-col gap-4 p-5">
          <div>
            <h2 className="font-semibold">مستويات العملاء</h2>
            <p className="mt-0.5 text-sm text-[var(--fg-muted)]">
              كل ما العميل يجمع نقاط أكتر، يترقّى لمستوى أعلى بخصم دائم.
            </p>
          </div>

          {tiers.map((t, i) => (
            <div key={i} className="flex flex-wrap items-end gap-3 rounded-lg border border-[var(--border)] p-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium">المستوى</span>
                <select
                  value={t.key}
                  onChange={(e) => {
                    const next = [...tiers]
                    next[i] = { ...t, key: e.target.value as TierConfig['key'] }
                    setTiers(next)
                  }}
                  className={`${field} w-28`}
                >
                  {TIER_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {TIER_LABEL[k]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-1 flex-col gap-1.5">
                <span className="text-xs font-medium">الاسم المعروض</span>
                <input
                  value={t.name}
                  onChange={(e) => {
                    const next = [...tiers]
                    next[i] = { ...t, name: e.target.value }
                    setTiers(next)
                  }}
                  className={`${field} w-full`}
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium">من نقاط</span>
                <input
                  value={t.minPoints}
                  onChange={(e) => {
                    const next = [...tiers]
                    next[i] = { ...t, minPoints: Number(e.target.value) || 0 }
                    setTiers(next)
                  }}
                  inputMode="numeric"
                  dir="ltr"
                  className={`${field} w-24 text-start`}
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium">خصم دائم ٪</span>
                <input
                  value={t.discountBps / 100}
                  onChange={(e) => {
                    const next = [...tiers]
                    next[i] = { ...t, discountBps: Math.round((Number(e.target.value) || 0) * 100) }
                    setTiers(next)
                  }}
                  inputMode="decimal"
                  dir="ltr"
                  className={`${field} w-24 text-start`}
                />
              </label>

              <button
                type="button"
                onClick={() => setTiers(tiers.filter((_, j) => j !== i))}
                aria-label="حذف المستوى"
                className="flex h-11 w-11 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ))}

          {tiers.length < 4 && (
            <button
              type="button"
              onClick={() =>
                setTiers([
                  ...tiers,
                  { key: 'platinum', name: 'بلاتيني', minPoints: 5000, color: '#634b9a', perks: [], discountBps: 1000 },
                ])
              }
              className="flex w-fit items-center gap-1.5 text-sm font-medium text-[var(--primary)] hover:underline"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              ضيف مستوى
            </button>
          )}
        </Card>
      )}

      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="flex min-h-11 w-fit items-center gap-2 rounded-lg bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-fg)] transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {msg?.ok ? <Check className="h-4 w-4" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
        حفظ إعدادات الولاء
      </button>
    </div>
  )
}
