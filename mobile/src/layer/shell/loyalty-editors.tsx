/**
 * لوحات تعديل مستويات العملاء وعجلة الحظ — في شاشة الولاء والنقاط (من 2.5).
 *
 * - المستويات: لكل مستوى نوعه (برونزي/فضي/ذهبي/بلاتيني)، اسمه المعروض، من كام نقطة،
 *   والخصم الدائم — لحد ٤ مستويات.
 * - العجلة: التشغيل، العنوان والسطر التوضيحي، تظهر بعد كام ثانية، لفّات لكل رقم يوميًا،
 *   والجوايز (الاسم، النوع، القيمة، الفرصة، اللون) — من ٢ لـ٨ جوايز.
 */
import { useEffect, useState } from 'preact/hooks'
import { haptic, hapticNotify } from '../bridge'
import { icons } from '../icons'
import { formatNumber } from './format'
import { postAppJson } from './http'
import { toLatin, type LoyaltyPayload, type WheelPrize } from './ops-api'
import { Sheet } from './screen'
import { Icon } from './ui'

const TIER_KEYS = [
  { key: 'bronze', label: 'برونزي', color: '#a1662f' },
  { key: 'silver', label: 'فضي', color: '#8a8f98' },
  { key: 'gold', label: 'ذهبي', color: '#c9a227' },
  { key: 'platinum', label: 'بلاتيني', color: '#634b9a' },
]

const PRIZE_TYPES = [
  { key: 'coupon_percent', label: 'خصم ٪' },
  { key: 'coupon_fixed', label: 'خصم مبلغ' },
  { key: 'free_shipping', label: 'شحن مجاني' },
  { key: 'points', label: 'نقاط' },
  { key: 'nothing', label: 'حظ أوفر' },
]

const COLORS = ['#634b9a', '#0f4c81', '#15803d', '#b3341f', '#c9a227', '#0d9488', '#a8577a', '#6b5644']

const DEFAULT_PRIZES: WheelPrize[] = [
  { label: 'خصم ١٠٪', color: COLORS[0], type: 'coupon_percent', value: '10', chance: '25' },
  { label: 'حظ أوفر', color: COLORS[1], type: 'nothing', value: '0', chance: '35' },
  { label: 'شحن مجاني', color: COLORS[2], type: 'free_shipping', value: '0', chance: '20' },
  { label: 'خصم ٥٪', color: COLORS[3], type: 'coupon_percent', value: '5', chance: '20' },
]

type Tier = { key: string; name: string; minPoints: string; discountPercent: string }

function useSave(onDone: (message: string) => Promise<void>) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const save = async (url: string, body: object, done: string) => {
    if (busy) return
    setError(null)
    setBusy(true)
    haptic('MEDIUM')
    const res = await postAppJson(url, body)
    if (!res.ok) {
      setBusy(false)
      hapticNotify('ERROR')
      setError(res.error)
      return
    }
    await onDone(done)
    setBusy(false)
  }
  return { busy, error, setError, save }
}

export function TiersEditor({
  open,
  data,
  onClose,
  onDone,
}: {
  open: boolean
  data: LoyaltyPayload
  onClose: () => void
  onDone: (message: string) => Promise<void>
}) {
  const [tiers, setTiers] = useState<Tier[]>([])
  const s = useSave(onDone)

  useEffect(() => {
    if (!open) return
    s.setError(null)
    setTiers(data.tiers.map((t) => ({ key: t.key, name: t.name, minPoints: String(t.minPoints), discountPercent: String(t.discountBps / 100) })))
  }, [open])

  const set = (i: number, patch: Partial<Tier>) => setTiers(tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)))

  return (
    <Sheet open={open} tall title="مستويات العملاء" onClose={onClose}>
      <form
        class="np-form ops-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (!tiers.some((t) => t.name.trim())) return s.setError('ضيف مستوى واحد على الأقل باسم')
          void s.save(
            '/api/app/loyalty/tiers',
            { tiers: tiers.map((t) => ({ ...t, minPoints: toLatin(t.minPoints), discountPercent: toLatin(t.discountPercent) })) },
            'مستويات العملاء اتحفظت',
          )
        }}
      >
        <p class="np-note">كل ما العميل يجمع نقاط أكتر، بيترقّى لمستوى أعلى بخصم دائم على كل طلباته.</p>
        {tiers.map((t, i) => (
          <div key={i} class="card ly-edit">
            <div class="ly-edit-head">
              <i style={{ background: TIER_KEYS.find((k) => k.key === t.key)?.color }} />
              <b>المستوى {formatNumber(i + 1)}</b>
              <button type="button" class="ops-icon press" aria-label="شيل المستوى" onClick={() => setTiers(tiers.filter((_, j) => j !== i))}>
                <Icon svg={icons.trash()} />
              </button>
            </div>
            <div class="chips">
              {TIER_KEYS.map((k) => (
                <button
                  key={k.key}
                  type="button"
                  class={`fchip${t.key === k.key ? ' fchip--on' : ''}`}
                  onClick={() => {
                    haptic('LIGHT')
                    set(i, { key: k.key })
                  }}
                >
                  {k.label}
                </button>
              ))}
            </div>
            <label class="np-label">
              الاسم اللي العميل بيشوفه
              <input class="np-input" value={t.name} maxLength={30} onInput={(e) => set(i, { name: (e.currentTarget as HTMLInputElement).value })} />
            </label>
            <div class="np-two">
              <label class="np-label">
                من كام نقطة
                <input class="np-input num" type="text" inputMode="numeric" value={t.minPoints} onInput={(e) => set(i, { minPoints: (e.currentTarget as HTMLInputElement).value })} />
              </label>
              <label class="np-label">
                خصم دائم ٪
                <input class="np-input num" type="text" inputMode="decimal" value={t.discountPercent} onInput={(e) => set(i, { discountPercent: (e.currentTarget as HTMLInputElement).value })} />
              </label>
            </div>
          </div>
        ))}
        {tiers.length < 4 && (
          <button
            type="button"
            class="act press of-add"
            onClick={() => {
              const free = TIER_KEYS.find((k) => !tiers.some((t) => t.key === k.key)) ?? TIER_KEYS[3]
              setTiers([...tiers, { key: free.key, name: free.label, minPoints: '5000', discountPercent: '10' }])
            }}
          >
            <Icon svg={icons.plus()} />
            ضيف مستوى
          </button>
        )}
        {s.error && <p class="np-error">{s.error}</p>}
        <div class="btn-row">
          <button type="button" class="btn btn--ghost press" onClick={onClose}>
            رجوع
          </button>
          <button type="submit" class="btn btn--primary press" disabled={s.busy}>
            {s.busy ? <span class="spinner" /> : <Icon svg={icons.check()} />}
            احفظ المستويات
          </button>
        </div>
      </form>
    </Sheet>
  )
}

export function WheelEditor({
  open,
  data,
  onClose,
  onDone,
}: {
  open: boolean
  data: LoyaltyPayload
  onClose: () => void
  onDone: (message: string) => Promise<void>
}) {
  const w = data.wheel
  const [enabled, setEnabled] = useState(w.enabled)
  const [title, setTitle] = useState(w.title)
  const [subtitle, setSubtitle] = useState('')
  const [delay, setDelay] = useState('15')
  const [spins, setSpins] = useState('1')
  const [prizes, setPrizes] = useState<WheelPrize[]>([])
  const s = useSave(onDone)

  useEffect(() => {
    if (!open) return
    s.setError(null)
    setEnabled(w.enabled)
    setTitle(w.title)
    setSubtitle(w.subtitle ?? '')
    setDelay(String(w.triggerAfterSeconds ?? 15))
    setSpins(String(w.freeSpinsPerDay ?? 1))
    setPrizes(w.prizeInputs?.length ? w.prizeInputs.map((p) => ({ ...p })) : DEFAULT_PRIZES.map((p) => ({ ...p })))
  }, [open])

  const set = (i: number, patch: Partial<WheelPrize>) => setPrizes(prizes.map((p, j) => (j === i ? { ...p, ...patch } : p)))
  const total = prizes.reduce((n, p) => n + (Number(toLatin(p.chance)) || 0), 0)

  return (
    <Sheet open={open} tall title="عجلة الحظ" onClose={onClose}>
      <form
        class="np-form ops-form"
        onSubmit={(e) => {
          e.preventDefault()
          void s.save(
            '/api/app/loyalty/wheel',
            {
              enabled,
              title,
              subtitle,
              triggerAfterSeconds: toLatin(delay),
              freeSpinsPerDay: toLatin(spins),
              prizes: prizes.map((p) => ({ ...p, value: toLatin(p.value), chance: toLatin(p.chance) })),
            },
            'العجلة اتحفظت',
          )
        }}
      >
        <button
          type="button"
          class="switch-row"
          onClick={() => {
            haptic('LIGHT')
            setEnabled(!enabled)
          }}
        >
          <span class="switch-text">
            <b>تشغيل العجلة</b>
            <small>بتظهر للزائر بعد مدة، وياخد كود خصم مقابل رقم تليفونه</small>
          </span>
          <span class={`switch${enabled ? ' switch--on' : ''}`}>
            <span />
          </span>
        </button>
        <label class="np-label">
          العنوان
          <input class="np-input" value={title} maxLength={60} onInput={(e) => setTitle((e.currentTarget as HTMLInputElement).value)} />
        </label>
        <label class="np-label">
          سطر توضيحي (اختياري)
          <input class="np-input" placeholder="لُف واكسب خصم" value={subtitle} maxLength={120} onInput={(e) => setSubtitle((e.currentTarget as HTMLInputElement).value)} />
        </label>
        <div class="np-two">
          <label class="np-label">
            تظهر بعد (ثانية)
            <input class="np-input num" type="text" inputMode="numeric" value={delay} onInput={(e) => setDelay((e.currentTarget as HTMLInputElement).value)} />
          </label>
          <label class="np-label">
            لفّات لكل رقم يوميًا
            <input class="np-input num" type="text" inputMode="numeric" value={spins} onInput={(e) => setSpins((e.currentTarget as HTMLInputElement).value)} />
          </label>
        </div>

        <div class="mk-sec cr-head">
          <span>
            <b>الجوايز</b>
            <small class={Math.abs(total - 100) > 1 ? 'ly-total-warn' : ''}>مجموع الفرص: {formatNumber(total)}٪</small>
          </span>
        </div>
        {prizes.map((p, i) => (
          <div key={i} class="card ly-edit">
            <div class="ly-edit-head">
              <i style={{ background: p.color }} />
              <input class="np-input ly-prize-name" value={p.label} maxLength={40} onInput={(e) => set(i, { label: (e.currentTarget as HTMLInputElement).value })} />
              {prizes.length > 2 && (
                <button type="button" class="ops-icon press" aria-label="شيل الجايزة" onClick={() => setPrizes(prizes.filter((_, j) => j !== i))}>
                  <Icon svg={icons.trash()} />
                </button>
              )}
            </div>
            <div class="chips">
              {PRIZE_TYPES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  class={`fchip${p.type === t.key ? ' fchip--on' : ''}`}
                  onClick={() => {
                    haptic('LIGHT')
                    set(i, { type: t.key })
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div class="np-two">
              {p.type !== 'nothing' && p.type !== 'free_shipping' && (
                <label class="np-label">
                  {p.type === 'coupon_percent' ? 'النسبة ٪' : p.type === 'points' ? 'عدد النقاط' : 'المبلغ (ج)'}
                  <input class="np-input num" type="text" inputMode="decimal" value={p.value} onInput={(e) => set(i, { value: (e.currentTarget as HTMLInputElement).value })} />
                </label>
              )}
              <label class="np-label">
                فرصة الظهور ٪
                <input class="np-input num" type="text" inputMode="decimal" value={p.chance} onInput={(e) => set(i, { chance: (e.currentTarget as HTMLInputElement).value })} />
              </label>
            </div>
            <div class="ly-colors">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`لون ${c}`}
                  class={`ly-color${p.color === c ? ' ly-color--on' : ''}`}
                  style={{ background: c }}
                  onClick={() => set(i, { color: c })}
                />
              ))}
            </div>
          </div>
        ))}
        {prizes.length < 8 && (
          <button
            type="button"
            class="act press of-add"
            onClick={() => setPrizes([...prizes, { label: 'جايزة', color: COLORS[prizes.length % COLORS.length], type: 'nothing', value: '0', chance: '10' }])}
          >
            <Icon svg={icons.plus()} />
            ضيف جايزة
          </button>
        )}
        {s.error && <p class="np-error">{s.error}</p>}
        <div class="btn-row">
          <button type="button" class="btn btn--ghost press" onClick={onClose}>
            رجوع
          </button>
          <button type="submit" class="btn btn--primary press" disabled={s.busy}>
            {s.busy ? <span class="spinner" /> : <Icon svg={icons.check()} />}
            احفظ العجلة
          </button>
        </div>
      </form>
    </Sheet>
  )
}
