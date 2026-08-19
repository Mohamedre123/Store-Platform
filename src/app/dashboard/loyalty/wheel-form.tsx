'use client'

import { useState, useTransition } from 'react'
import { Check, Plus, Save, Trash2 } from 'lucide-react'
import { saveWheelAction, type WheelPrizeInput } from './wheel-actions'
import { Alert, Card } from '@/components/ui'
import { Toggle } from '@/components/dashboard/controls'

const PRIZE_TYPES = [
  { value: 'coupon_percent' as const, label: 'خصم ٪' },
  { value: 'coupon_fixed' as const, label: 'خصم مبلغ' },
  { value: 'free_shipping' as const, label: 'شحن مجاني' },
  { value: 'points' as const, label: 'نقاط' },
  { value: 'nothing' as const, label: 'حظ أوفر' },
]

const COLORS = ['#634b9a', '#0f4c81', '#15803d', '#b3341f', '#c9a227', '#0d9488', '#a8577a', '#6b5644']

const DEFAULT_PRIZES: WheelPrizeInput[] = [
  { label: 'خصم ١٠٪', color: COLORS[0], type: 'coupon_percent', value: '10', chance: '25' },
  { label: 'حظ أوفر', color: COLORS[1], type: 'nothing', value: '0', chance: '35' },
  { label: 'شحن مجاني', color: COLORS[2], type: 'free_shipping', value: '0', chance: '20' },
  { label: 'خصم ٥٪', color: COLORS[3], type: 'coupon_percent', value: '5', chance: '20' },
]

const field =
  'h-10 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-2.5 text-sm focus:border-[var(--primary)] focus:outline-none'

export function WheelForm({
  settings,
  prizes: initialPrizes,
}: {
  settings: { enabled: boolean; title: string; subtitle: string | null; triggerAfterSeconds: number; freeSpinsPerDay: number } | null
  prizes: WheelPrizeInput[]
}) {
  const [enabled, setEnabled] = useState(settings?.enabled ?? false)
  const [title, setTitle] = useState(settings?.title ?? 'جرّب حظك')
  const [subtitle, setSubtitle] = useState(settings?.subtitle ?? '')
  const [delay, setDelay] = useState(String(settings?.triggerAfterSeconds ?? 15))
  const [spins, setSpins] = useState(String(settings?.freeSpinsPerDay ?? 1))
  const [prizes, setPrizes] = useState<WheelPrizeInput[]>(
    initialPrizes.length ? initialPrizes : DEFAULT_PRIZES,
  )
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()

  const totalChance = prizes.reduce((n, p) => n + (Number(p.chance) || 0), 0)

  function save() {
    setMsg(null)
    start(async () => {
      const res = await saveWheelAction({
        enabled,
        title,
        subtitle,
        triggerAfterSeconds: delay,
        freeSpinsPerDay: spins,
        prizes,
      })
      setMsg(res?.error ? { ok: false, text: res.error } : { ok: true, text: 'اتحفظ' })
    })
  }

  const set = (i: number, patch: Partial<WheelPrizeInput>) => {
    const next = [...prizes]
    next[i] = { ...next[i], ...patch }
    setPrizes(next)
  }

  return (
    <Card className="flex flex-col gap-5 p-5">
      <Toggle
        label="تفعيل عجلة الحظ"
        hint="بتظهر للزائر بعد مدة، ياخد كود خصم مقابل رقم تليفونه."
        checked={enabled}
        onChange={setEnabled}
      />

      {msg && <Alert tone={msg.ok ? 'success' : 'danger'}>{msg.text}</Alert>}

      {enabled && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">العنوان</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className={`${field} h-11`} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">سطر توضيحي</span>
              <input
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="لُف واكسب خصم"
                className={`${field} h-11`}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">تظهر بعد (ثانية)</span>
              <input
                value={delay}
                onChange={(e) => setDelay(e.target.value)}
                inputMode="numeric"
                dir="ltr"
                className={`${field} h-11 w-28 text-start tabular-nums`}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">لفّات لكل رقم يوميًا</span>
              <input
                value={spins}
                onChange={(e) => setSpins(e.target.value)}
                inputMode="numeric"
                dir="ltr"
                className={`${field} h-11 w-28 text-start tabular-nums`}
              />
            </label>
          </div>

          <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">الجوائز</h3>
              <span
                className="text-xs"
                style={{ color: Math.abs(totalChance - 100) > 1 ? 'var(--color-warning)' : 'var(--fg-subtle)' }}
              >
                مجموع الفرص: {totalChance}٪
              </span>
            </div>

            {prizes.map((p, i) => (
              <div key={i} className="flex flex-wrap items-end gap-2 rounded-lg border border-[var(--border)] p-3">
                <label className="flex min-w-32 flex-1 flex-col gap-1">
                  <span className="text-xs font-medium">الاسم</span>
                  <input value={p.label} onChange={(e) => set(i, { label: e.target.value })} className={field} />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium">النوع</span>
                  <select
                    value={p.type}
                    onChange={(e) => set(i, { type: e.target.value as WheelPrizeInput['type'] })}
                    className={`${field} w-28`}
                  >
                    {PRIZE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>

                {p.type !== 'nothing' && p.type !== 'free_shipping' && (
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-medium">القيمة</span>
                    <input
                      value={p.value}
                      onChange={(e) => set(i, { value: e.target.value })}
                      inputMode="decimal"
                      dir="ltr"
                      className={`${field} w-20 text-start tabular-nums`}
                    />
                  </label>
                )}

                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium">الفرصة ٪</span>
                  <input
                    value={p.chance}
                    onChange={(e) => set(i, { chance: e.target.value })}
                    inputMode="decimal"
                    dir="ltr"
                    className={`${field} w-20 text-start tabular-nums`}
                  />
                </label>

                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium">اللون</span>
                  <div className="flex h-10 items-center gap-1">
                    {COLORS.slice(0, 4).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => set(i, { color: c })}
                        aria-label={`لون ${c}`}
                        className={`h-6 w-6 rounded-full border-2 ${p.color === c ? 'border-[var(--fg)]' : 'border-transparent'}`}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                </label>

                {prizes.length > 2 && (
                  <button
                    type="button"
                    onClick={() => setPrizes(prizes.filter((_, j) => j !== i))}
                    aria-label="حذف الجايزة"
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            ))}

            {prizes.length < 8 && (
              <button
                type="button"
                onClick={() =>
                  setPrizes([
                    ...prizes,
                    {
                      label: 'جايزة',
                      color: COLORS[prizes.length % COLORS.length],
                      type: 'nothing',
                      value: '0',
                      chance: '10',
                    },
                  ])
                }
                className="flex w-fit items-center gap-1.5 text-sm font-medium text-[var(--primary)] hover:underline"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                ضيف جايزة
              </button>
            )}
          </div>
        </>
      )}

      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="flex min-h-11 w-fit items-center gap-2 rounded-lg bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-fg)] transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {msg?.ok ? <Check className="h-4 w-4" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
        حفظ العجلة
      </button>
    </Card>
  )
}
