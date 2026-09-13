/**
 * الكوبونات والعروض — شاشة أصلية.
 *
 * كل كوبون كارت فيه الكود (بتدوس عليه يتنسخ)، قيمة الخصم، شروطه، وعدد
 * مرات استخدامه، وزرار تشغيل/إيقاف بضغطة. وتحت: عروض الكمية والباقات
 * بنفس الزرار. «+ كوبون» والدوسة على أي كوبون بيفتحوا فورم الكوبون في لوحة
 * (`coupon-editor.tsx`). عروض الكمية والباقات بتتعمل من صفحة المنصة.
 */
import { useState } from 'preact/hooks'
import { haptic, hapticNotify } from '../bridge'
import { toast } from '../dom'
import { icons } from '../icons'
import { marketingData, type MarketingPayload } from './business-api'
import { CouponEditor, emptyCoupon, type CouponForm } from './coupon-editor'
import { BundleEditor, OfferEditor, emptyBundle, emptyOffer, type BundleForm, type OfferForm } from './offer-editor'
import { formatNumber } from './format'
import { postAppJson, useResource } from './http'
import { navigate } from './navigate'
import { Screen } from './screen'
import { Icon } from './ui'

type Kind = 'coupons' | 'offers'

export function MarketingScreen({ visible, onUnavailable }: { visible: boolean; onUnavailable: () => void }) {
  const { data, failed, load } = useResource(marketingData, visible, onUnavailable)
  const [override, setOverride] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState<Record<string, boolean>>({})

  const drop = (id: string) =>
    setOverride((o) => {
      const next = { ...o }
      delete next[id]
      return next
    })

  const toggle = async (kind: Kind, id: string, next: boolean) => {
    if (busy[id]) return
    haptic('LIGHT')
    setOverride((o) => ({ ...o, [id]: next }))
    setBusy((b) => ({ ...b, [id]: true }))
    const res = await postAppJson(`/api/app/marketing/${kind}/${encodeURIComponent(id)}/toggle`, { isActive: next })
    setBusy((b) => ({ ...b, [id]: false }))
    if (!res.ok) {
      drop(id)
      hapticNotify('ERROR')
      toast(res.error, { tone: 'danger' })
      return
    }
    hapticNotify('SUCCESS')
    toast(next ? 'اتفعّل — بيتطبّق في الشيك أوت دلوقتي' : 'اتوقف', { tone: 'success', duration: 1800 })
    await load()
    drop(id)
  }

  const on = (id: string, base: boolean) => override[id] ?? base

  const manage = () => {
    haptic('LIGHT')
    navigate('/dashboard/marketing?web=1')
  }

  /* فورم الكوبون — ولو الموقع لسه ما بيبعتش خانات الفورم، صفحة المنصة */
  const [editing, setEditing] = useState<CouponForm | null>(null)
  const canEdit = Boolean(data?.pickProducts)
  const newCoupon = () => {
    if (!canEdit) return manage()
    haptic('LIGHT')
    setEditing(emptyCoupon())
  }
  /* عروض الكمية والباقات — من 2.5 */
  const [editingOffer, setEditingOffer] = useState<OfferForm | null>(null)
  const [editingBundle, setEditingBundle] = useState<BundleForm | null>(null)
  const canOffers = Boolean(data?.editsOffers)
  const openOffer = (o?: MarketingPayload['offers'][number]) => {
    if (!canOffers || (o && !o.form)) return manage()
    haptic('LIGHT')
    setEditingOffer(o?.form ? { ...o.form, id: o.id, isActive: o.isActive } : emptyOffer())
  }
  const openBundle = (b?: MarketingPayload['bundles'][number]) => {
    if (!canOffers || (b && !b.form)) return manage()
    haptic('LIGHT')
    setEditingBundle(b?.form ? { ...b.form, id: b.id, isActive: b.isActive } : emptyBundle())
  }
  const saved = async (message: string) => {
    await load()
    hapticNotify('SUCCESS')
    toast(message, { tone: 'success', duration: 2400 })
    setEditing(null)
    setEditingOffer(null)
    setEditingBundle(null)
  }

  const editCoupon = (c: MarketingPayload['coupons'][number]) => {
    if (!c.form) return manage()
    haptic('LIGHT')
    setEditing({ ...c.form, id: c.id, code: c.code, description: c.description ?? '', isActive: c.isActive })
  }

  const copy = async (code: string) => {
    haptic('LIGHT')
    try {
      await navigator.clipboard.writeText(code)
      toast(`اتنسخ الكود ${code}`, { tone: 'success', duration: 1800 })
    } catch {
      toast(code)
    }
  }

  return (
    <Screen visible={visible} title="الكوبونات والعروض" onRefresh={load}>
      <div class="home-body">
        <header class="page-head rise">
          <div class="page-head-text">
            <h1 class="page-title">الكوبونات والعروض</h1>
            <p class="page-sub">بتتطبّق للعميل في الشيك أوت فورًا</p>
          </div>
          <button type="button" class="pill-btn press" onClick={newCoupon}>
            <Icon svg={icons.plus()} />
            كوبون
          </button>
        </header>

        {!data ? (
          failed ? (
            <div class="empty">
              <span class="empty-icon">
                <Icon svg={icons.wifiOff()} />
              </span>
              <b>مش قادرين نجيب الكوبونات</b>
              <p>اتأكد من النت واسحب لتحت عشان تحاول تاني.</p>
            </div>
          ) : (
            <div class="olist">
              {[0, 1, 2].map((i) => (
                <span key={i} class="sk" style="height:150px;border-radius:22px" />
              ))}
            </div>
          )
        ) : (
          <>
            {data.stats.total > 0 && (
              <section class="card sec facts rise">
                <div class="fact">
                  <span class="fact-label">مفعّلة</span>
                  <b>{formatNumber(data.stats.active)}</b>
                </div>
                <div class="fact">
                  <span class="fact-label">اتستخدمت</span>
                  <b>{formatNumber(data.stats.totalUses)}</b>
                </div>
                <div class="fact">
                  <span class="fact-label">كل الكوبونات</span>
                  <b>{formatNumber(data.stats.total)}</b>
                </div>
              </section>
            )}

            <div class="mk-sec rise">
              <b>كوبونات الخصم</b>
            </div>
            {data.coupons.length === 0 ? (
              <div class="empty empty--compact rise">
                <span class="empty-icon">
                  <Icon svg={icons.gift()} />
                </span>
                <b>مافيش كوبونات لسه</b>
                <p>اعمل كوبون وابعته لعملاءك على واتساب أو السوشيال.</p>
                <button type="button" class="btn btn--primary press" onClick={newCoupon}>
                  <Icon svg={icons.plus()} />
                  اعمل كوبون
                </button>
              </div>
            ) : (
              <div class="mk-coupons">
                {data.coupons.map((c, i) => {
                  const active = on(c.id, c.isActive)
                  return (
                    <div
                      key={c.id}
                      class={`card mk-coupon rise${active ? '' : ' mk-coupon--off'}`}
                      style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}
                    >
                      <div class="mk-top">
                        <button type="button" class="mk-code press" onClick={() => void copy(c.code)} aria-label={`نسخ الكود ${c.code}`}>
                          {c.code}
                        </button>
                        <b class="mk-value">{c.valueLabel}</b>
                      </div>
                      {c.description && <p class="mk-desc">{c.description}</p>}
                      <div class="mk-conds mk-conds--tap" role="button" tabIndex={0} onClick={() => editCoupon(c)}>
                        {c.expired && <span class="mk-expired">انتهى</span>}
                        {c.conditions.map((t) => (
                          <span key={t}>{t}</span>
                        ))}
                      </div>
                      <div class="mk-foot">
                        <button type="button" class="mk-edit press" onClick={() => editCoupon(c)}>
                          <Icon svg={icons.pencil()} />
                          {c.usedLabel}
                        </button>
                        <button
                          type="button"
                          class="switch-btn"
                          role="switch"
                          aria-checked={active}
                          aria-label={active ? 'إيقاف الكوبون' : 'تفعيل الكوبون'}
                          onClick={() => void toggle('coupons', c.id, !active)}
                        >
                          <span class={`switch${active ? ' switch--on' : ''}${busy[c.id] ? ' switch--busy' : ''}`}>
                            <span />
                          </span>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div class="mk-sec cr-head rise">
              <span>
                <b>عروض الكمية</b>
                <small>كل ما يشتري أكتر، يوفّر أكتر — من غير كود</small>
              </span>
              <button type="button" class="act press cr-add" onClick={() => openOffer()}>
                <Icon svg={icons.plus()} />
                عرض
              </button>
            </div>
            {data.offers.length === 0 ? (
              <p class="fine">مافيش عروض كمية. «اشترِ ٣ ووفّر ١٥٪» بترفع قيمة الطلب — اعمله من «+ عرض».</p>
            ) : (
              <div class="card list rise">
                {data.offers.map((o) => {
                  const active = on(o.id, o.isActive)
                  return (
                    <div key={o.id} class={`mk-row${active ? '' : ' mk-coupon--off'}`}>
                      <span class="mk-row-main">
                        <b>
                          {o.name}
                          {o.badge && <span class="mk-badge">{o.badge}</span>}
                        </b>
                        <small>{o.tiersLabel}</small>
                        <small>{o.productsLabel}</small>
                      </span>
                      <button type="button" class="ops-icon press" aria-label={`تعديل ${o.name}`} onClick={() => openOffer(o)}>
                        <Icon svg={icons.pencil()} />
                      </button>
                      <button
                        type="button"
                        class="switch-btn"
                        role="switch"
                        aria-checked={active}
                        aria-label={active ? 'إيقاف العرض' : 'تفعيل العرض'}
                        onClick={() => void toggle('offers', o.id, !active)}
                      >
                        <span class={`switch${active ? ' switch--on' : ''}${busy[o.id] ? ' switch--busy' : ''}`}>
                          <span />
                        </span>
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            <div class="mk-sec cr-head rise">
              <span>
                <b>الباقات</b>
                <small>منتجات مع بعض بسعر واحد</small>
              </span>
              <button type="button" class="act press cr-add" onClick={() => openBundle()}>
                <Icon svg={icons.plus()} />
                باقة
              </button>
            </div>
            {data.bundles.length === 0 ? (
              <p class="fine">مافيش باقات. الباقة بتبيع منتجات مختلفة مع بعض بسعر واحد — اعملها من «+ باقة».</p>
            ) : (
              <div class="card list rise">
                {data.bundles.map((b) => {
                  const active = on(b.id, b.isActive)
                  return (
                    <div key={b.id} class={`mk-row${active ? '' : ' mk-coupon--off'}`}>
                      <span class="mk-row-main">
                        <b>
                          {b.name}
                          {b.badge && <span class="mk-badge">{b.badge}</span>}
                        </b>
                        <small>{b.productsLabel}</small>
                        {b.priceLabel && <small>بسعر {b.priceLabel}</small>}
                      </span>
                      <button type="button" class="ops-icon press" aria-label={`تعديل ${b.name}`} onClick={() => openBundle(b)}>
                        <Icon svg={icons.pencil()} />
                      </button>
                      <button
                        type="button"
                        class="switch-btn"
                        role="switch"
                        aria-checked={active}
                        aria-label={active ? 'إيقاف الباقة' : 'تفعيل الباقة'}
                        onClick={() => void toggle('offers', b.id, !active)}
                      >
                        <span class={`switch${active ? ' switch--on' : ''}${busy[b.id] ? ' switch--busy' : ''}`}>
                          <span />
                        </span>
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            <p class="fine center">دوس على الكود عشان تنسخه، وعلى القلم عشان تعدّل.</p>
          </>
        )}
      </div>

      {data && (
        <>
          <CouponEditor initial={editing} data={data} onClose={() => setEditing(null)} onDone={saved} />
          <OfferEditor initial={editingOffer} data={data} onClose={() => setEditingOffer(null)} onDone={saved} />
          <BundleEditor initial={editingBundle} data={data} onClose={() => setEditingBundle(null)} onDone={saved} />
        </>
      )}
    </Screen>
  )
}
