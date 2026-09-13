/**
 * المندوبون — شاشة أصلية.
 *
 * بتجاوب على سؤالين التاجر بيسألهم كل يوم:
 * ١. **مين هيخرج بإيه؟** — الطلبات المؤكّدة اللي لسه محدّش ماشي بيها فوق،
 *    وكل طلب بيتسند بدوستين (المندوب اللي بيغطّي المنطقة بيطلع الأول).
 * ٢. **مين معاه كام؟** — فلوس التحصيل وأجرته جنب كل مندوب، و«اقفل الحساب».
 *
 * رابط المندوب بيتبعت له على واتساب بدوسة. إضافة وتعديل المندوب من لوحة تحت.
 */
import { useMemo, useState } from 'preact/hooks'
import { haptic, hapticNotify } from '../bridge'
import { toast } from '../dom'
import { icons } from '../icons'
import { formatMoney, formatNumber } from './format'
import { postAppJson, useResource } from './http'
import { navigate, openExternal } from './navigate'
import { couriersData, waNumber, type Courier, type WaitingOrder } from './ops-api'
import { Screen, Sheet } from './screen'
import { Icon } from './ui'

const BIKE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/></svg>'
const COPY =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>'
const WALLET =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/></svg>'

type Form = { id: string | null; name: string; phone: string; vehicle: string; fee: string; zones: string[]; note: string }

export function CouriersScreen({ visible, onUnavailable }: { visible: boolean; onUnavailable: () => void }) {
  const { data, failed, load } = useResource(couriersData, visible, onUnavailable)
  const [busy, setBusy] = useState<string | null>(null)
  const [assignFor, setAssignFor] = useState<WaitingOrder | null>(null)
  const [menuFor, setMenuFor] = useState<Courier | null>(null)
  const [confirm, setConfirm] = useState<{ kind: 'settle' | 'rotate'; courier: Courier } | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const currency = data?.currency ?? 'EGP'
  const money = (n: number) => formatMoney(n, currency)
  const active = useMemo(() => (data?.couriers ?? []).filter((c) => c.isActive), [data])

  const post = async (key: string, url: string, body: object, done: (res: Record<string, unknown>) => string) => {
    if (busy) return false
    haptic('LIGHT')
    setBusy(key)
    const res = await postAppJson(url, body)
    if (!res.ok) {
      setBusy(null)
      hapticNotify('ERROR')
      toast(res.error, { tone: 'danger' })
      return false
    }
    await load()
    setBusy(null)
    hapticNotify('SUCCESS')
    toast(done(res.data), { tone: 'success', duration: 2200 })
    return true
  }

  const sendLink = (c: Courier) => {
    haptic('LIGHT')
    const text = `أهلًا ${c.name} 👋\nده رابط الطلبات اللي هتوصّلها — افتحه من موبايلك:\n${c.link}`
    openExternal(`https://wa.me/${waNumber(c.phone)}?text=${encodeURIComponent(text)}`)
  }

  const copyLink = async (c: Courier) => {
    haptic('LIGHT')
    try {
      await navigator.clipboard.writeText(c.link)
      toast('الرابط اتنسخ — ابعتهوله', { tone: 'success', duration: 1800 })
    } catch {
      toast(c.link)
    }
  }

  const openForm = (c?: Courier) => {
    haptic('LIGHT')
    setMenuFor(null)
    setFormError(null)
    setForm(
      c
        ? {
            id: c.id,
            name: c.name,
            phone: c.phone,
            vehicle: c.vehicle,
            fee: c.feePerOrder ? String(c.feePerOrder / 100) : '',
            zones: [...c.zones],
            note: c.note ?? '',
          }
        : { id: null, name: '', phone: '', vehicle: 'motorcycle', fee: '', zones: [], note: '' },
    )
  }

  const saveForm = async (e: Event) => {
    e.preventDefault()
    if (!form || busy) return
    if (form.name.trim().length < 2) return setFormError('اكتب اسم المندوب')
    if (form.phone.replace(/\D/g, '').length < 6) return setFormError('اكتب رقم المندوب')
    setFormError(null)
    setBusy('form')
    const res = await postAppJson('/api/app/couriers/save', form)
    if (!res.ok) {
      setBusy(null)
      hapticNotify('ERROR')
      setFormError(res.error)
      return
    }
    await load()
    setBusy(null)
    hapticNotify('SUCCESS')
    toast(form.id ? 'بيانات المندوب اتحفظت' : 'المندوب اتضاف — ابعتله رابطه', { tone: 'success' })
    setForm(null)
  }

  /* المندوبين اللي بيغطّوا مدينة الطلب (أو مالهمش مناطق) الأول */
  const covers = (c: Courier, city: string | null) => !city || c.zones.length === 0 || c.zones.includes(city)
  const sortedFor = (order: WaitingOrder) =>
    [...active].sort((a, b) => Number(covers(b, order.city)) - Number(covers(a, order.city)))

  return (
    <Screen visible={visible} title="المندوبون" onRefresh={load}>
      <div class="home-body">
        <header class="page-head rise">
          <div class="page-head-text">
            <h1 class="page-title">المندوبون</h1>
            <p class="page-sub">تسند الطلبات، تبعت الرابط، وتقفل الحساب آخر اليوم</p>
          </div>
        </header>

        {!data ? (
          failed ? (
            <div class="empty">
              <span class="empty-icon">
                <Icon svg={icons.wifiOff()} />
              </span>
              <b>مش قادرين نجيب المندوبين</b>
              <p>اتأكد من النت واسحب لتحت عشان تحاول تاني.</p>
            </div>
          ) : (
            <div class="olist">
              <span class="sk" style="height:150px;border-radius:20px" />
              <span class="sk" style="height:220px;border-radius:20px" />
            </div>
          )
        ) : (
          <>
            {data.couriers.length > 0 && (
              <div class="an-kpis rise">
                <div class="card an-kpi">
                  <span class="an-kpi-label">مندوبين شغّالين</span>
                  <span class="an-kpi-value">{formatNumber(data.stats.active)}</span>
                </div>
                <div class="card an-kpi">
                  <span class="an-kpi-label">طلبات في الطريق</span>
                  <span class="an-kpi-value">{formatNumber(data.stats.open)}</span>
                </div>
                <div class="card an-kpi">
                  <span class="an-kpi-label">مستنية مندوب</span>
                  <span class="an-kpi-value">{formatNumber(data.stats.waiting)}</span>
                </div>
                <div class="card an-kpi">
                  <span class="an-kpi-label">فلوس مع المندوبين</span>
                  <span class={`an-kpi-value${data.stats.due > 0 ? ' cr-warn' : ''}`}>{money(data.stats.due)}</span>
                </div>
              </div>
            )}

            {active.length > 0 && data.waiting.length > 0 && (
              <>
                <div class="mk-sec">
                  <b>طلبات مؤكّدة مستنية مندوب ({formatNumber(data.waiting.length)})</b>
                  <small>كل يوم بيعدّي عليهم بيزوّد احتمال إن العميل يلغي.</small>
                </div>
                <div class="olist">
                  {data.waiting.map((o, i) => (
                    <article key={o.id} class="ocard rise" style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}>
                      <div class="ocard-top">
                        <span class="ocard-no num">{o.orderLabel}</span>
                        <span class="ocard-total">{o.isPaid ? 'مدفوع' : money(o.total)}</span>
                      </div>
                      <div class="ocard-name">
                        {o.customerName || 'بلا اسم'}
                        {o.city && <span class="ocard-city"> · {o.city}</span>}
                      </div>
                      <div class="ocard-actions">
                        <button
                          type="button"
                          class="act act--wa press"
                          disabled={Boolean(busy)}
                          onClick={() => {
                            haptic('LIGHT')
                            setAssignFor(o)
                          }}
                        >
                          {busy === o.id ? <span class="spinner" /> : <Icon svg={BIKE} />}
                          اسند لمندوب
                        </button>
                        <button type="button" class="act press" onClick={() => navigate(`/dashboard/orders/${o.id}`)}>
                          <Icon svg={icons.bag()} />
                          الطلب
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}

            <div class="mk-sec cr-head">
              <span>
                <b>المندوبون</b>
                <small>{data.couriers.length ? `${formatNumber(data.couriers.length)} مندوب` : 'مندوبك بتاعك — مش شركة شحن'}</small>
              </span>
              {data.couriers.length > 0 && (
                <button type="button" class="act press cr-add" onClick={() => openForm()}>
                  <Icon svg={icons.plus()} />
                  ضيف
                </button>
              )}
            </div>

            {data.couriers.length === 0 ? (
              <div class="empty empty--compact rise">
                <span class="empty-icon">
                  <Icon svg={BIKE} />
                </span>
                <b>مفيش مندوبين لسه</b>
                <p>لو بتوصّل بمندوبك أنت، سجّله هنا. هتسنده الطلبات بدوسة، وهو هيشوفها على موبايله برابط من غير حساب.</p>
                <button type="button" class="btn btn--primary press" onClick={() => openForm()}>
                  <Icon svg={icons.plus()} />
                  ضيف مندوب
                </button>
              </div>
            ) : (
              data.couriers.map((c) => (
                <article key={c.id} class={`card cr rise${c.isActive ? '' : ' cr--off'}`}>
                  <div class="cr-top">
                    <span class="cr-icon">
                      <Icon svg={BIKE} />
                    </span>
                    <span class="cr-main">
                      <b>
                        {c.name}
                        {!c.isActive && <span class="cr-off">متوقّف</span>}
                      </b>
                      <span class="cr-sub">
                        <bdi dir="ltr">{c.phone}</bdi> · {c.vehicleLabel}
                        {c.feePerOrder > 0 ? ` · ${money(c.feePerOrder)} للطلب` : ''}
                      </span>
                      {c.zones.length > 0 && <small>{c.zones.join('، ')}</small>}
                    </span>
                    <button
                      type="button"
                      class="ops-icon press"
                      aria-label={`خيارات ${c.name}`}
                      onClick={() => {
                        haptic('LIGHT')
                        setMenuFor(c)
                      }}
                    >
                      <Icon svg={icons.moreHorizontal()} />
                    </button>
                  </div>

                  <div class="cr-stats">
                    <div class="cr-stat">
                      <span>في الطريق</span>
                      <b>{formatNumber(c.openCount)}</b>
                    </div>
                    <div class="cr-stat">
                      <span>وصّل</span>
                      <b>{formatNumber(c.deliveredCount)}</b>
                    </div>
                    <div class={`cr-stat${c.failedCount > 0 ? ' cr-stat--danger' : ''}`}>
                      <span>فشل/رجع</span>
                      <b>{formatNumber(c.failedCount)}</b>
                    </div>
                    <div class={`cr-stat${c.dueAmount > 0 ? ' cr-stat--warn' : ''}`}>
                      <span>معاه</span>
                      <b>{money(c.dueAmount)}</b>
                    </div>
                  </div>

                  {(c.dueAmount > 0 || c.feesDue > 0) && (
                    <div class="cr-settle">
                      <span>
                        هياخد منك <strong>{money(c.feesDue)}</strong> أجرة، وهيسلّمك <strong>{money(c.dueAmount)}</strong> تحصيل.
                        {c.dueAmount > c.feesDue && (
                          <>
                            {' '}
                            الصافي ليك <strong>{money(c.dueAmount - c.feesDue)}</strong>.
                          </>
                        )}
                      </span>
                      <button
                        type="button"
                        class="btn btn--ghost press"
                        disabled={Boolean(busy)}
                        onClick={() => {
                          haptic('LIGHT')
                          setConfirm({ kind: 'settle', courier: c })
                        }}
                      >
                        {busy === `settle-${c.id}` ? <span class="spinner" /> : <Icon svg={WALLET} />}
                        اقفل الحساب
                      </button>
                    </div>
                  )}

                  {c.note && <p class="cr-note">{c.note}</p>}

                  <div class="cr-actions">
                    <button type="button" class="act act--wa press" disabled={!c.isActive} onClick={() => sendLink(c)}>
                      <Icon svg={icons.messageCircle()} />
                      ابعتله الرابط
                    </button>
                    <button type="button" class="act press" onClick={() => void copyLink(c)}>
                      <Icon svg={COPY} />
                      انسخ
                    </button>
                  </div>
                </article>
              ))
            )}
          </>
        )}
      </div>

      {/* إسناد طلب */}
      <Sheet
        open={Boolean(assignFor)}
        title={assignFor ? `اسند ${assignFor.orderLabel} لمين؟` : ''}
        onClose={() => setAssignFor(null)}
      >
        {assignFor && (
          <div class="sheet-list">
            {sortedFor(assignFor).map((c) => {
              const inZone = Boolean(assignFor.city) && c.zones.includes(assignFor.city ?? '')
              return (
                <button
                  key={c.id}
                  type="button"
                  class="sheet-row"
                  disabled={Boolean(busy)}
                  onClick={async () => {
                    const order = assignFor
                    setAssignFor(null)
                    await post(order.id, '/api/app/couriers/assign', { orderId: order.id, courierId: c.id }, () => `${order.orderLabel} اتسند لـ${c.name}`)
                  }}
                >
                  <span class="cr-icon cr-icon--sm">
                    <Icon svg={BIKE} />
                  </span>
                  <span class="sheet-row-label">
                    {c.name}
                    <small class="set-hint">
                      {inZone ? `بيغطّي ${assignFor.city}` : c.zones.length ? c.zones.join('، ') : 'كل المناطق'} ·{' '}
                      {formatNumber(c.openCount)} في الطريق
                    </small>
                  </span>
                  {inZone && <Icon svg={icons.check()} className="ic sheet-check" />}
                </button>
              )
            })}
          </div>
        )}
      </Sheet>

      {/* خيارات المندوب */}
      <Sheet open={Boolean(menuFor)} title={menuFor?.name ?? ''} onClose={() => setMenuFor(null)}>
        {menuFor && (
          <div class="sheet-list">
            <button type="button" class="sheet-row" onClick={() => location.assign(`tel:${menuFor.phone}`)}>
              <Icon svg={icons.phone()} />
              <span class="sheet-row-label">اتصل بيه</span>
            </button>
            <button type="button" class="sheet-row" onClick={() => openForm(menuFor)}>
              <Icon svg={icons.pencil()} />
              <span class="sheet-row-label">عدّل بياناته</span>
            </button>
            <button
              type="button"
              class="sheet-row"
              disabled={Boolean(busy)}
              onClick={async () => {
                const c = menuFor
                setMenuFor(null)
                await post(`toggle-${c.id}`, `/api/app/couriers/${encodeURIComponent(c.id)}/toggle`, { active: !c.isActive }, () =>
                  c.isActive ? 'المندوب اتوقّف' : 'المندوب رجع شغّال',
                )
              }}
            >
              <Icon svg={menuFor.isActive ? icons.eyeOff() : icons.check()} />
              <span class="sheet-row-label">
                {menuFor.isActive ? 'وقّفه' : 'شغّله تاني'}
                <small class="set-hint">{menuFor.isActive ? 'شحناته وحسابه بيفضلوا — بس مش هيتسند له طلبات' : 'يرجع يتسند له طلبات'}</small>
              </span>
            </button>
            <button
              type="button"
              class="sheet-row"
              onClick={() => {
                const c = menuFor
                setMenuFor(null)
                setConfirm({ kind: 'rotate', courier: c })
              }}
            >
              <Icon svg={icons.refresh()} />
              <span class="sheet-row-label">
                رابط جديد
                <small class="set-hint">لو المندوب مشي — الرابط القديم بيموت فورًا</small>
              </span>
            </button>
          </div>
        )}
      </Sheet>

      {/* تأكيد التسوية أو الرابط الجديد */}
      <Sheet
        open={Boolean(confirm)}
        title={confirm?.kind === 'settle' ? `تقفل حساب ${confirm.courier.name}؟` : 'تعمل رابط جديد؟'}
        onClose={() => setConfirm(null)}
      >
        {confirm && (
          <>
            <p class="sheet-text">
              {confirm.kind === 'settle'
                ? `اتأكد إنك استلمت ${money(confirm.courier.dueAmount)} وسلّمته ${money(confirm.courier.feesDue)}. الحساب هيتقفل على الأرقام دي ومش هينفع ترجع فيها.`
                : 'الرابط اللي مع المندوب هيبطّل يشتغل فورًا، ومش هيشوف أي طلب لحد ما تبعتله الجديد.'}
            </p>
            <div class="btn-row">
              <button type="button" class="btn btn--ghost press" onClick={() => setConfirm(null)}>
                رجوع
              </button>
              <button
                type="button"
                class={`btn press ${confirm.kind === 'settle' ? 'btn--primary' : 'btn--danger'}`}
                onClick={async () => {
                  const { kind, courier } = confirm
                  setConfirm(null)
                  await post(`${kind}-${courier.id}`, `/api/app/couriers/${encodeURIComponent(courier.id)}/${kind}`, {}, (res) =>
                    kind === 'settle'
                      ? `الحساب اتقفل على ${formatNumber(Number(res.count ?? 0))} شحنة`
                      : 'رابط جديد اتعمل — ابعتهوله',
                  )
                }}
              >
                {confirm.kind === 'settle' ? 'أيوه، اقفله' : 'أيوه، رابط جديد'}
              </button>
            </div>
          </>
        )}
      </Sheet>

      {/* إضافة / تعديل */}
      <Sheet open={Boolean(form)} tall title={form?.id ? 'تعديل المندوب' : 'مندوب جديد'} onClose={() => setForm(null)}>
        {form && data && (
          <form class="np-form ops-form" onSubmit={saveForm}>
            <label class="np-label">
              الاسم
              <input
                class="np-input"
                value={form.name}
                maxLength={80}
                onInput={(e) => setForm({ ...form, name: (e.currentTarget as HTMLInputElement).value })}
              />
            </label>
            <label class="np-label">
              الموبايل (هيتبعتله الرابط عليه)
              <input
                class="np-input"
                type="tel"
                dir="ltr"
                placeholder="01xxxxxxxxx"
                value={form.phone}
                maxLength={24}
                onInput={(e) => setForm({ ...form, phone: (e.currentTarget as HTMLInputElement).value })}
              />
            </label>
            <div class="np-label">
              بيتنقّل بإيه
              <div class="chips">
                {data.vehicles.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    class={`fchip${form.vehicle === v.key ? ' fchip--on' : ''}`}
                    onClick={() => {
                      haptic('LIGHT')
                      setForm({ ...form, vehicle: v.key })
                    }}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
            <label class="np-label">
              أجرته على الطلب (بالجنيه)
              <input
                class="np-input num"
                type="text"
                inputMode="decimal"
                placeholder="30"
                value={form.fee}
                onInput={(e) => setForm({ ...form, fee: (e.currentTarget as HTMLInputElement).value })}
              />
            </label>
            {data.cities.length > 0 && (
              <div class="np-label">
                المناطق اللي بيغطّيها (اختياري)
                <div class="chips chips--scroll">
                  {data.cities.map((city) => {
                    const on = form.zones.includes(city)
                    return (
                      <button
                        key={city}
                        type="button"
                        class={`fchip${on ? ' fchip--on' : ''}`}
                        onClick={() => {
                          haptic('LIGHT')
                          setForm({ ...form, zones: on ? form.zones.filter((z) => z !== city) : [...form.zones, city] })
                        }}
                      >
                        {city}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            <label class="np-label">
              ملاحظة
              <textarea
                class="np-input"
                value={form.note}
                maxLength={400}
                onInput={(e) => setForm({ ...form, note: (e.currentTarget as HTMLTextAreaElement).value })}
              />
            </label>
            {formError && <p class="np-error">{formError}</p>}
            <div class="btn-row">
              <button type="button" class="btn btn--ghost press" onClick={() => setForm(null)}>
                رجوع
              </button>
              <button type="submit" class="btn btn--primary press" disabled={busy === 'form'}>
                {busy === 'form' ? <span class="spinner" /> : <Icon svg={icons.check()} />}
                {form.id ? 'احفظ' : 'ضيف المندوب'}
              </button>
            </div>
          </form>
        )}
      </Sheet>
    </Screen>
  )
}
