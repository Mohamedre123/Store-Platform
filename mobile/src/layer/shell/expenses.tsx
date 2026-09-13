/**
 * المصروفات والأرباح — شاشة أصلية.
 *
 * فوق: صافي الربح في آخر ٣٠ يوم (المبيعات − تكلفة البضاعة − المصروفات)،
 * و«فلوسك رايحة فين» بشرايط ملوّنة لكل تصنيف. تحت: كل المصروفات بفلتر
 * التصنيف. «سجّل مصروف» والتعديل والحذف من لوحة تحت.
 */
import { useMemo, useState } from 'preact/hooks'
import { haptic, hapticNotify } from '../bridge'
import { toast } from '../dom'
import { icons } from '../icons'
import { formatBps, formatMoney, formatNumber } from './format'
import { postAppJson, useResource } from './http'
import { expensesData, toLatin, type ExpenseItem } from './ops-api'
import { Screen, Sheet } from './screen'
import { Icon } from './ui'

type Form = {
  id: string | null
  title: string
  category: string
  amount: string
  spentAt: string
  note: string
  isRecurring: boolean
}

/* تاريخ النهارده بتوقيت الموبايل — `YYYY-MM-DD` */
const today = () => new Date().toLocaleDateString('en-CA')

export function ExpensesScreen({ visible, onUnavailable }: { visible: boolean; onUnavailable: () => void }) {
  const { data, failed, load } = useResource(expensesData, visible, onUnavailable)
  const [filter, setFilter] = useState('all')
  const [form, setForm] = useState<Form | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const currency = data?.currency ?? 'EGP'
  const money = (n: number) => formatMoney(n, currency)
  const all = data?.expenses ?? []
  const list = useMemo(() => (filter === 'all' ? all : all.filter((e) => e.category === filter)), [data, filter])
  const biggest = data?.totals.length ? Math.max(...data.totals.map((t) => t.total)) : 0

  const open = (e?: ExpenseItem) => {
    haptic('LIGHT')
    setError(null)
    setConfirmDelete(false)
    setForm(
      e
        ? {
            id: e.id,
            title: e.title,
            category: e.category,
            amount: String(e.amount / 100),
            spentAt: e.spentAt.slice(0, 10),
            note: e.note ?? '',
            isRecurring: e.isRecurring,
          }
        : { id: null, title: '', category: 'ads', amount: '', spentAt: today(), note: '', isRecurring: false },
    )
  }

  const finish = async (done: string) => {
    await load()
    setBusy(false)
    hapticNotify('SUCCESS')
    toast(done, { tone: 'success', duration: 1800 })
    setForm(null)
  }

  const save = async (ev: Event) => {
    ev.preventDefault()
    if (!form || busy) return
    if (form.title.trim().length < 2) return setError('اكتب المصروف على إيه')
    if (!(Number(toLatin(form.amount)) > 0)) return setError('اكتب المبلغ')
    setError(null)
    setBusy(true)
    const res = await postAppJson('/api/app/expenses/save', { ...form, amount: toLatin(form.amount) })
    if (!res.ok) {
      setBusy(false)
      hapticNotify('ERROR')
      setError(res.error)
      return
    }
    await finish(form.id ? 'المصروف اتعدّل' : 'المصروف اتسجّل')
  }

  const remove = async () => {
    if (!form?.id || busy) return
    setBusy(true)
    const res = await postAppJson(`/api/app/expenses/${encodeURIComponent(form.id)}/delete`)
    if (!res.ok) {
      setBusy(false)
      hapticNotify('ERROR')
      setError(res.error)
      return
    }
    await finish('المصروف اتحذف')
  }

  const hint = data?.categories.find((c) => c.key === form?.category)?.hint ?? ''

  return (
    <Screen visible={visible} title="المصروفات" onRefresh={load}>
      <div class="home-body">
        <header class="page-head rise">
          <div class="page-head-text">
            <h1 class="page-title">المصروفات والأرباح</h1>
            <p class="page-sub">ربحك الحقيقي في آخر ٣٠ يوم — بعد الإعلانات والإيجار والمرتبات</p>
          </div>
        </header>

        {!data ? (
          failed ? (
            <div class="empty">
              <span class="empty-icon">
                <Icon svg={icons.wifiOff()} />
              </span>
              <b>مش قادرين نجيب المصروفات</b>
              <p>اتأكد من النت واسحب لتحت عشان تحاول تاني.</p>
            </div>
          ) : (
            <div class="olist">
              <span class="sk" style="height:170px;border-radius:20px" />
              <span class="sk" style="height:220px;border-radius:20px" />
            </div>
          )
        ) : (
          <>
            <div class="an-kpis rise">
              <div class="card an-kpi">
                <span class="an-kpi-label">مبيعات ٣٠ يوم</span>
                <span class="an-kpi-value">{money(data.profit.revenue)}</span>
              </div>
              <div class="card an-kpi">
                <span class="an-kpi-label">تكلفة البضاعة</span>
                <span class="an-kpi-value">− {money(data.profit.cogs)}</span>
              </div>
              <div class="card an-kpi">
                <span class="an-kpi-label">مصروفات</span>
                <span class="an-kpi-value">− {money(data.profit.expenses)}</span>
              </div>
              <div class="card an-kpi ex-net">
                <span class="an-kpi-label">صافي الربح</span>
                <span class={`an-kpi-value${data.profit.net < 0 ? ' an-kpi-value--neg' : ''}`}>{money(data.profit.net)}</span>
                {data.profit.net !== 0 && <span class="ex-margin">هامش {formatBps(data.profit.marginBps)}</span>}
              </div>
            </div>

            {data.profit.shippingCollected > 0 && (
              <p class="fine">
                الشحن المحصَّل ({money(data.profit.shippingCollected)}) متشال من الحساب لأنه بيروح لشركة الشحن — سجّل فاتورة الشحن
                في المصروفات عشان تشوف الفرق الحقيقي.
              </p>
            )}

            {data.totals.length > 0 && (
              <section class="card sec rise ex-where">
                <div class="an-head">
                  <b>فلوسك رايحة فين</b>
                  <span>{money(data.monthTotal)} آخر ٣٠ يوم</span>
                </div>
                <ul class="ex-bars">
                  {data.totals.map((t) => (
                    <li key={t.category}>
                      <span class="ex-bar-label">{t.label}</span>
                      <span class="ex-bar">
                        <i style={{ width: `${biggest ? Math.max(3, (t.total / biggest) * 100) : 0}%`, background: t.color }} />
                      </span>
                      <b class="num">{money(t.total)}</b>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <button type="button" class="btn btn--primary btn--lg press rise ops-add" onClick={() => open()}>
              <Icon svg={icons.plus()} />
              سجّل مصروف
            </button>

            {all.length > 0 && (
              <div class="frail" role="tablist" aria-label="فلترة المصروفات">
                {[{ key: 'all', label: 'الكل' }, ...data.categories].map((c) => {
                  const n = c.key === 'all' ? all.length : all.filter((e) => e.category === c.key).length
                  if (c.key !== 'all' && n === 0) return null
                  return (
                    <button
                      key={c.key}
                      type="button"
                      role="tab"
                      aria-selected={filter === c.key}
                      class={`fchip${filter === c.key ? ' fchip--on' : ''}`}
                      onClick={() => {
                        haptic('LIGHT')
                        setFilter(c.key)
                      }}
                    >
                      {c.label}
                      <span class="fchip-n">{formatNumber(n)}</span>
                    </button>
                  )
                })}
              </div>
            )}

            {list.length === 0 ? (
              <div class="empty empty--compact rise">
                <span class="empty-icon">
                  <Icon svg={icons.creditCard()} />
                </span>
                <b>مافيش مصروفات مسجّلة</b>
                <p>من غيرها «صافي الربح» بيحسب تكلفة البضاعة بس. سجّل الإعلانات والإيجار والمرتبات وهتشوف ربحك الحقيقي.</p>
              </div>
            ) : (
              <div class="card ops-list rise">
                {list.map((e) => (
                  <button key={e.id} type="button" class="ex-row press" onClick={() => open(e)}>
                    <span class="ex-stripe" style={{ background: e.color }} />
                    <span class="bl-main">
                      <b>
                        {e.title}
                        {e.isRecurring && <span class="cr-off">شهري</span>}
                      </b>
                      <small>
                        {e.categoryLabel} · {new Date(e.spentAt).toLocaleDateString('ar-EG')}
                        {e.note ? ` · ${e.note}` : ''}
                      </small>
                    </span>
                    <b class="ex-amount num">{money(e.amount)}</b>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <Sheet open={Boolean(form)} tall title={form?.id ? 'تعديل مصروف' : 'مصروف جديد'} onClose={() => setForm(null)}>
        {form && data && (
          <form class="np-form ops-form" onSubmit={save}>
            <div class="np-label">
              التصنيف
              <div class="chips">
                {data.categories.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    class={`fchip${form.category === c.key ? ' fchip--on' : ''}`}
                    onClick={() => {
                      haptic('LIGHT')
                      setForm({ ...form, category: c.key })
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <label class="np-label">
              على إيه
              <input
                class="np-input"
                placeholder={hint}
                value={form.title}
                maxLength={120}
                onInput={(e) => setForm({ ...form, title: (e.currentTarget as HTMLInputElement).value })}
              />
            </label>
            <div class="np-two">
              <label class="np-label">
                المبلغ ({currency === 'EGP' ? 'ج.م' : currency})
                <input
                  class="np-input num"
                  type="text"
                  inputMode="decimal"
                  placeholder="٠"
                  value={form.amount}
                  onInput={(e) => setForm({ ...form, amount: (e.currentTarget as HTMLInputElement).value })}
                />
              </label>
              <label class="np-label">
                اتصرف امتى
                <input
                  class="np-input num"
                  type="date"
                  value={form.spentAt}
                  onInput={(e) => setForm({ ...form, spentAt: (e.currentTarget as HTMLInputElement).value })}
                />
              </label>
            </div>
            <label class="np-label">
              ملاحظة (اختياري)
              <textarea
                class="np-input"
                value={form.note}
                maxLength={500}
                onInput={(e) => setForm({ ...form, note: (e.currentTarget as HTMLTextAreaElement).value })}
              />
            </label>
            <button
              type="button"
              class="switch-row"
              onClick={() => {
                haptic('LIGHT')
                setForm({ ...form, isRecurring: !form.isRecurring })
              }}
            >
              <span class="switch-text">
                <b>بيتكرر كل شهر</b>
                <small>بنفكّرك بيه أول كل شهر — مش بنسجّله لوحدنا</small>
              </span>
              <span class={`switch${form.isRecurring ? ' switch--on' : ''}`}>
                <span />
              </span>
            </button>
            {error && <p class="np-error">{error}</p>}
            {confirmDelete ? (
              <div class="ex-confirm">
                <p class="sheet-text">هتحذف «{form.title}» نهائيًا والربح هيتحسب من غيره. متأكد؟</p>
                <div class="btn-row">
                  <button type="button" class="btn btn--ghost press" onClick={() => setConfirmDelete(false)}>
                    رجوع
                  </button>
                  <button type="button" class="btn btn--danger press" disabled={busy} onClick={() => void remove()}>
                    {busy ? <span class="spinner" /> : <Icon svg={icons.trash()} />}
                    أيوه، احذفه
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div class="btn-row">
                  <button type="button" class="btn btn--ghost press" onClick={() => setForm(null)}>
                    رجوع
                  </button>
                  <button type="submit" class="btn btn--primary press" disabled={busy}>
                    {busy ? <span class="spinner" /> : <Icon svg={icons.check()} />}
                    {form.id ? 'احفظ' : 'سجّل'}
                  </button>
                </div>
                {form.id && (
                  <button
                    type="button"
                    class="btn btn--ghost btn--danger-text press"
                    onClick={() => {
                      haptic('LIGHT')
                      setConfirmDelete(true)
                    }}
                  >
                    <Icon svg={icons.trash()} />
                    احذف المصروف
                  </button>
                )}
              </>
            )}
          </form>
        )}
      </Sheet>
    </Screen>
  )
}
