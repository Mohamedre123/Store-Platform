/**
 * المسوّقون بالعمولة — شاشة أصلية.
 *
 * كل مسوّق بكوده ورابطه، وضغطاته وبيعاته ورصيده المستحق. «ابعتله رابطه»
 * على واتساب، «سجّل صرف» بتأكيد لما تدفعله، والإضافة والتعديل من لوحة تحت.
 */
import { useState } from 'preact/hooks'
import { haptic, hapticNotify } from '../bridge'
import { toast } from '../dom'
import { icons } from '../icons'
import { formatMoney, formatNumber } from './format'
import { postAppJson, useResource } from './http'
import { openExternal } from './navigate'
import { COPY_ICON, WALLET_ICON, affiliatesData, copyText, waNumber, type Affiliate } from './ops-api'
import { Screen, Sheet } from './screen'
import { Icon } from './ui'

type Form = {
  id: string | null
  name: string
  phone: string
  email: string
  code: string
  commissionType: 'percent' | 'fixed'
  commissionValue: string
  isActive: boolean
}

const formFrom = (a: Affiliate): Form => ({
  id: a.id,
  name: a.name,
  phone: a.phone ?? '',
  email: a.email ?? '',
  code: a.code,
  commissionType: a.commissionType,
  commissionValue: a.commissionInput,
  isActive: a.isActive,
})

export function AffiliatesScreen({ visible, onUnavailable }: { visible: boolean; onUnavailable: () => void }) {
  const { data, failed, load } = useResource(affiliatesData, visible, onUnavailable)
  const [busy, setBusy] = useState<string | null>(null)
  const [menuFor, setMenuFor] = useState<Affiliate | null>(null)
  const [confirm, setConfirm] = useState<{ kind: 'pay' | 'delete'; affiliate: Affiliate } | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const currency = data?.currency ?? 'EGP'
  const money = (n: number) => formatMoney(n, currency)

  const post = async (key: string, url: string, body: object, done: string) => {
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
    toast(done, { tone: 'success', duration: 2000 })
    return true
  }

  const sendLink = (a: Affiliate) => {
    haptic('LIGHT')
    const text = `أهلًا ${a.name} 👋\nده رابطك — أي حد يطلب منه عمولتك بتتحسب تلقائي:\n${a.link}\nكودك: ${a.code}`
    if (a.phone) openExternal(`https://wa.me/${waNumber(a.phone)}?text=${encodeURIComponent(text)}`)
    else void navigator.share?.({ text }).catch(() => undefined)
  }

  const openForm = (a?: Affiliate) => {
    haptic('LIGHT')
    setMenuFor(null)
    setFormError(null)
    setForm(a ? formFrom(a) : { id: null, name: '', phone: '', email: '', code: '', commissionType: 'percent', commissionValue: '10', isActive: true })
  }

  const saveForm = async (e: Event) => {
    e.preventDefault()
    if (!form || busy) return
    if (!form.name.trim()) return setFormError('اكتب اسم المسوّق')
    setFormError(null)
    setBusy('form')
    const res = await postAppJson('/api/app/affiliates/save', form)
    if (!res.ok) {
      setBusy(null)
      hapticNotify('ERROR')
      setFormError(res.error)
      return
    }
    await load()
    setBusy(null)
    hapticNotify('SUCCESS')
    toast(form.id ? 'بيانات المسوّق اتحفظت' : 'المسوّق اتضاف — ابعتله رابطه', { tone: 'success' })
    setForm(null)
  }

  return (
    <Screen visible={visible} title="المسوّقون بالعمولة" onRefresh={load}>
      <div class="home-body">
        <header class="page-head rise">
          <div class="page-head-text">
            <h1 class="page-title">المسوّقون بالعمولة</h1>
            <p class="page-sub">كود لكل مسوّق — وكل بيعة من رابطه بتتحسبله تلقائي</p>
          </div>
        </header>

        {!data ? (
          failed ? (
            <div class="empty">
              <span class="empty-icon">
                <Icon svg={icons.wifiOff()} />
              </span>
              <b>مش قادرين نجيب المسوّقين</b>
              <p>اتأكد من النت واسحب لتحت عشان تحاول تاني.</p>
            </div>
          ) : (
            <div class="olist">
              <span class="sk" style="height:90px;border-radius:20px" />
              <span class="sk" style="height:200px;border-radius:20px" />
            </div>
          )
        ) : (
          <>
            {data.affiliates.length > 0 && (
              <div class="an-kpis rise">
                <div class="card an-kpi">
                  <span class="an-kpi-label">مستحق للمسوّقين</span>
                  <span class={`an-kpi-value${data.stats.balance > 0 ? ' cr-warn' : ''}`}>{money(data.stats.balance)}</span>
                </div>
                <div class="card an-kpi">
                  <span class="an-kpi-label">بيعات جت منهم</span>
                  <span class="an-kpi-value">{formatNumber(data.stats.conversions)}</span>
                </div>
              </div>
            )}

            <button type="button" class="btn btn--primary btn--lg press rise ops-add" onClick={() => openForm()}>
              <Icon svg={icons.plus()} />
              مسوّق جديد
            </button>

            {data.affiliates.length === 0 ? (
              <div class="empty empty--compact rise">
                <span class="empty-icon">
                  <Icon svg={icons.users()} />
                </span>
                <b>مافيش مسوّقين</b>
                <p>ادّي كود لكل مسوّق، وكل بيعة تيجي من رابطه تتحسبله عمولة تلقائيًا.</p>
              </div>
            ) : (
              <div class="aff-list">
                {data.affiliates.map((a) => (
                  <article key={a.id} class={`card cr rise${a.isActive ? '' : ' cr--off'}`}>
                    <div class="cr-top">
                      <span class="cr-icon">
                        <Icon svg={icons.users()} />
                      </span>
                      <span class="cr-main">
                        <b>
                          {a.name}
                          <bdi dir="ltr" class="aff-code">
                            {a.code}
                          </bdi>
                          {!a.isActive && <span class="cr-off">متوقّف</span>}
                        </b>
                        <span class="cr-sub">عمولة {a.commissionLabel}</span>
                      </span>
                      <button
                        type="button"
                        class="ops-icon press"
                        aria-label={`خيارات ${a.name}`}
                        onClick={() => {
                          haptic('LIGHT')
                          setMenuFor(a)
                        }}
                      >
                        <Icon svg={icons.moreHorizontal()} />
                      </button>
                    </div>

                    <div class="cr-stats aff-stats">
                      <div class="cr-stat">
                        <span>ضغطات</span>
                        <b>{formatNumber(a.clicks)}</b>
                      </div>
                      <div class="cr-stat">
                        <span>بيعات</span>
                        <b>{formatNumber(a.conversions)}</b>
                      </div>
                      <div class={`cr-stat${a.balance > 0 ? ' cr-stat--warn' : ''}`}>
                        <span>مستحق</span>
                        <b>{money(a.balance)}</b>
                      </div>
                    </div>

                    {a.balance > 0 && (
                      <button
                        type="button"
                        class="btn btn--ghost press"
                        disabled={Boolean(busy)}
                        onClick={() => {
                          haptic('LIGHT')
                          setConfirm({ kind: 'pay', affiliate: a })
                        }}
                      >
                        {busy === `pay-${a.id}` ? <span class="spinner" /> : <Icon svg={WALLET_ICON} />}
                        سجّل صرف {money(a.balance)}
                      </button>
                    )}

                    <div class="cr-actions">
                      <button type="button" class="act act--wa press" disabled={!a.isActive} onClick={() => sendLink(a)}>
                        <Icon svg={icons.messageCircle()} />
                        ابعتله رابطه
                      </button>
                      <button type="button" class="act press" onClick={() => void copyText(a.link, 'رابط المسوّق اتنسخ')}>
                        <Icon svg={COPY_ICON} />
                        انسخ
                      </button>
                    </div>
                    {a.totalPaid > 0 && <p class="cr-note">اتصرفله قبل كده {money(a.totalPaid)}</p>}
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <Sheet open={Boolean(menuFor)} title={menuFor?.name ?? ''} onClose={() => setMenuFor(null)}>
        {menuFor && (
          <div class="sheet-list">
            {menuFor.phone && (
              <button type="button" class="sheet-row" onClick={() => location.assign(`tel:${menuFor.phone}`)}>
                <Icon svg={icons.phone()} />
                <span class="sheet-row-label">اتصل بيه</span>
              </button>
            )}
            <button type="button" class="sheet-row" onClick={() => openForm(menuFor)}>
              <Icon svg={icons.pencil()} />
              <span class="sheet-row-label">عدّل بياناته</span>
            </button>
            <button
              type="button"
              class="sheet-row"
              disabled={Boolean(busy)}
              onClick={async () => {
                const a = menuFor
                setMenuFor(null)
                await post(
                  `toggle-${a.id}`,
                  '/api/app/affiliates/save',
                  { ...formFrom(a), isActive: !a.isActive },
                  a.isActive ? 'المسوّق اتوقّف' : 'المسوّق رجع شغّال',
                )
              }}
            >
              <Icon svg={menuFor.isActive ? icons.eyeOff() : icons.check()} />
              <span class="sheet-row-label">
                {menuFor.isActive ? 'وقّفه' : 'شغّله تاني'}
                <small class="set-hint">{menuFor.isActive ? 'رابطه يبطّل يحسب عمولات جديدة' : 'رابطه يرجع يحسب عمولات'}</small>
              </span>
            </button>
            <button
              type="button"
              class="sheet-row"
              onClick={() => {
                const a = menuFor
                setMenuFor(null)
                setConfirm({ kind: 'delete', affiliate: a })
              }}
            >
              <Icon svg={icons.trash()} />
              <span class="sheet-row-label">احذف المسوّق</span>
            </button>
          </div>
        )}
      </Sheet>

      <Sheet
        open={Boolean(confirm)}
        title={confirm?.kind === 'pay' ? `صرفت لـ${confirm.affiliate.name}؟` : confirm ? `تحذف ${confirm.affiliate.name}؟` : ''}
        onClose={() => setConfirm(null)}
      >
        {confirm && (
          <>
            <p class="sheet-text">
              {confirm.kind === 'pay'
                ? `هنسجّل إنك دفعتله ${money(confirm.affiliate.balance)} ورصيده هيرجع صفر. اعمل كده بعد ما تدفع فعلًا.`
                : 'رابطه هيبطّل يشتغل. العمولات اللي اتسجّلت قبل كده في الطلبات بتفضل.'}
            </p>
            <div class="btn-row">
              <button type="button" class="btn btn--ghost press" onClick={() => setConfirm(null)}>
                رجوع
              </button>
              <button
                type="button"
                class={`btn press ${confirm.kind === 'pay' ? 'btn--primary' : 'btn--danger'}`}
                onClick={async () => {
                  const { kind, affiliate } = confirm
                  setConfirm(null)
                  await post(
                    `${kind}-${affiliate.id}`,
                    `/api/app/affiliates/${encodeURIComponent(affiliate.id)}/${kind}`,
                    {},
                    kind === 'pay' ? 'اتسجّل الصرف' : 'المسوّق اتحذف',
                  )
                }}
              >
                {confirm.kind === 'pay' ? 'أيوه، دفعتله' : 'أيوه، احذفه'}
              </button>
            </div>
          </>
        )}
      </Sheet>

      <Sheet open={Boolean(form)} tall title={form?.id ? 'تعديل المسوّق' : 'مسوّق جديد'} onClose={() => setForm(null)}>
        {form && (
          <form class="np-form ops-form" onSubmit={saveForm}>
            <label class="np-label">
              الاسم
              <input class="np-input" value={form.name} onInput={(e) => setForm({ ...form, name: (e.currentTarget as HTMLInputElement).value })} />
            </label>
            <label class="np-label">
              كود الإحالة (حروف وأرقام إنجليزي)
              <input
                class="np-input aff-input-code"
                dir="ltr"
                placeholder="AHMED"
                autocapitalize="characters"
                value={form.code}
                onInput={(e) => setForm({ ...form, code: (e.currentTarget as HTMLInputElement).value.toUpperCase() })}
              />
            </label>
            <label class="np-label">
              التليفون (هيتبعتله الرابط عليه)
              <input
                class="np-input"
                type="tel"
                dir="ltr"
                placeholder="01xxxxxxxxx"
                value={form.phone}
                onInput={(e) => setForm({ ...form, phone: (e.currentTarget as HTMLInputElement).value })}
              />
            </label>
            <label class="np-label">
              البريد (اختياري)
              <input
                class="np-input"
                type="email"
                dir="ltr"
                value={form.email}
                onInput={(e) => setForm({ ...form, email: (e.currentTarget as HTMLInputElement).value })}
              />
            </label>
            <div class="np-label">
              نوع العمولة
              <div class="ops-choice">
                {(
                  [
                    { value: 'percent', label: 'نسبة ٪', hint: 'من قيمة المنتجات' },
                    { value: 'fixed', label: 'مبلغ ثابت', hint: 'على كل بيعة' },
                  ] as const
                ).map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    class={`ops-opt${form.commissionType === o.value ? ' ops-opt--on' : ''}`}
                    onClick={() => {
                      haptic('LIGHT')
                      setForm({ ...form, commissionType: o.value })
                    }}
                  >
                    <b>{o.label}</b>
                    <small>{o.hint}</small>
                  </button>
                ))}
              </div>
            </div>
            <label class="np-label">
              {form.commissionType === 'percent' ? 'النسبة (٪)' : `المبلغ (${currency === 'EGP' ? 'ج.م' : currency})`}
              <input
                class="np-input num"
                type="text"
                inputMode="decimal"
                value={form.commissionValue}
                onInput={(e) => setForm({ ...form, commissionValue: (e.currentTarget as HTMLInputElement).value })}
              />
            </label>
            <p class="fine">العمولة بتتحسب على المنتجات بعد الخصم — من غير الشحن.</p>
            <button
              type="button"
              class="switch-row"
              onClick={() => {
                haptic('LIGHT')
                setForm({ ...form, isActive: !form.isActive })
              }}
            >
              <span class="switch-text">
                <b>مفعّل</b>
                <small>{form.isActive ? 'رابطه بيحسب عمولات' : 'متوقّف'}</small>
              </span>
              <span class={`switch${form.isActive ? ' switch--on' : ''}`}>
                <span />
              </span>
            </button>
            {formError && <p class="np-error">{formError}</p>}
            <div class="btn-row">
              <button type="button" class="btn btn--ghost press" onClick={() => setForm(null)}>
                رجوع
              </button>
              <button type="submit" class="btn btn--primary press" disabled={busy === 'form'}>
                {busy === 'form' ? <span class="spinner" /> : <Icon svg={icons.check()} />}
                {form.id ? 'احفظ' : 'ضيف المسوّق'}
              </button>
            </div>
          </form>
        )}
      </Sheet>
    </Screen>
  )
}
