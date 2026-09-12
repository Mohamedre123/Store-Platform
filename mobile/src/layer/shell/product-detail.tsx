/**
 * تفاصيل المنتج — شاشة أصلية.
 *
 * صور بالسحب، السعر والمخزون والمقاسات في نظرة، ومفتاح «ظاهر في المتجر»
 * بيشتغل في ثانية. المشاركة بشاشة المشاركة بتاعة الموبايل (واتساب،
 * إنستجرام، أي تطبيق) لأن ده أكتر حاجة التاجر بيعملها بالمنتج من
 * موبايله.
 *
 * التعديل الكامل بيفتح فورم المنصة لنفس المنتج.
 */
import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import { haptic } from '../bridge'
import { toast } from '../dom'
import { icons } from '../icons'
import { assetUrl } from './api'
import { formatDateTime, formatMoney, formatNumber } from './format'
import { navigate, openExternal } from './navigate'
import { fetchProduct, postProductAction, productDetails, productPreviews, type ProductDetail } from './products-api'
import { stockLabel } from './products'
import { Screen, Sheet } from './screen'
import { Icon } from './ui'

export function ProductDetailScreen({
  visible,
  productId,
  onUnavailable,
}: {
  visible: boolean
  productId: string | null
  onUnavailable: () => void
}) {
  const [detail, setDetail] = useState<ProductDetail | null>(null)
  const [missing, setMissing] = useState(false)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState<'status' | 'delete' | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [slide, setSlide] = useState(0)
  const current = useRef(productId)
  current.current = productId

  useEffect(() => {
    if (!productId) return
    setDetail(productDetails.get(productId) ?? null)
    setMissing(false)
    setFailed(false)
    setSlide(0)
    setConfirmDelete(false)
  }, [productId])

  const load = useCallback(async () => {
    const id = current.current
    if (!id) return
    const res = await fetchProduct(id)
    if (current.current !== id) return
    if (res.kind === 'ok') {
      productDetails.set(id, res.data)
      setDetail(res.data)
      setFailed(false)
    } else if (res.kind === 'unavailable') onUnavailable()
    else if (res.kind === 'notFound') setMissing(true)
    else if (res.kind === 'error') setFailed(true)
  }, [onUnavailable])

  useEffect(() => {
    if (visible && productId) void load()
  }, [visible, productId])

  const goBack = () => {
    if (history.length > 1) history.back()
    else navigate('/dashboard/products')
  }

  const edit = () => {
    if (productId) navigate(`/dashboard/products/${productId}?web=1`)
  }

  const toggle = async () => {
    const id = current.current
    if (!id || busy) return
    haptic('MEDIUM')
    setBusy('status')
    const res = await postProductAction(id, 'status')
    setBusy(null)
    if (!res.ok) return void toast(res.error, { tone: 'danger' })
    if (res.detail && current.current === id) setDetail(res.detail)
    toast(res.detail?.product.status === 'active' ? 'المنتج بقى ظاهر في المتجر' : 'المنتج اتخفى من المتجر', {
      tone: 'success',
    })
  }

  const remove = async () => {
    const id = current.current
    if (!id || busy) return
    setConfirmDelete(false)
    setBusy('delete')
    const res = await postProductAction(id, 'delete')
    setBusy(null)
    if (!res.ok) return void toast(res.error, { tone: 'danger' })
    toast('المنتج اتنقل لسلة المهملات', {
      tone: 'success',
      action: { label: 'السلة', run: () => navigate('/dashboard/products/trash') },
    })
    navigate('/dashboard/products', { replace: true })
  }

  const share = async () => {
    if (!detail) return
    haptic('LIGHT')
    try {
      await navigator.share({ title: detail.product.name, text: detail.product.name, url: detail.product.url })
    } catch {
      /* التاجر قفل شاشة المشاركة */
    }
  }

  const preview = productId ? productPreviews.get(productId) : undefined
  const p = detail?.product
  const name = p?.name ?? preview?.name
  const currency = detail?.currency ?? preview?.currency ?? 'EGP'
  const images = p?.images ?? (preview?.image ? [preview.image] : [])
  const price = p?.price ?? preview?.price ?? 0
  const compare = p?.compareAtPrice ?? preview?.compareAtPrice ?? null
  const status = p?.status ?? preview?.status
  const active = status === 'active'

  return (
    <>
      <Screen
        visible={visible}
        kind="detail"
        title={name ?? 'المنتج'}
        onBack={goBack}
        resetKey={productId}
        onRefresh={load}
        actions={
          detail ? (
            <button type="button" class="appbar-btn press" aria-label="مشاركة المنتج" onClick={share}>
              <Icon svg={icons.share()} />
            </button>
          ) : null
        }
      >
        <div class="home-body">
          {missing ? (
            <div class="empty">
              <span class="empty-icon">
                <Icon svg={icons.package()} />
              </span>
              <b>المنتج ده مش موجود</b>
              <p>ممكن يكون اتنقل لسلة المهملات.</p>
              <button type="button" class="btn btn--primary press" onClick={() => navigate('/dashboard/products')}>
                كل المنتجات
              </button>
            </div>
          ) : !name ? (
            <div class="stack" aria-busy="true">
              <span class="sk" style="aspect-ratio:1;border-radius:24px" />
              <span class="sk" style="height:120px;border-radius:22px" />
              <span class="sk" style="height:180px;border-radius:22px" />
            </div>
          ) : (
            <>
              <div class="gallery rise">
                {images.length ? (
                  <>
                    <div
                      class="gallery-track"
                      onScroll={(e) => {
                        const el = e.currentTarget as HTMLElement
                        const i = Math.round(Math.abs(el.scrollLeft) / Math.max(1, el.clientWidth))
                        if (i !== slide) setSlide(i)
                      }}
                    >
                      {images.map((src, i) => (
                        <img key={src + i} src={assetUrl(src) ?? ''} alt="" loading={i ? 'lazy' : 'eager'} />
                      ))}
                    </div>
                    {images.length > 1 && (
                      <div class="gallery-dots">
                        {images.map((_, i) => (
                          <span key={i} class={i === slide ? 'on' : ''} />
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div class="gallery-empty">
                    <Icon svg={icons.image()} />
                    <span>مفيش صور للمنتج</span>
                  </div>
                )}
              </div>

              <header class="p-head rise">
                {p?.category && <span class="p-cat">{p.category}</span>}
                <h1 class="p-name">{name}</h1>
                <div class="p-price">
                  <strong>{formatMoney(price, currency)}</strong>
                  {compare && <s>{formatMoney(compare, currency)}</s>}
                  {compare && compare > price && (
                    <span class="p-off">خصم {formatNumber(Math.round(((compare - price) / compare) * 100))}٪</span>
                  )}
                </div>
              </header>

              <section class="card sec rise">
                <button type="button" class="switch-row" disabled={!detail || Boolean(busy)} onClick={toggle}>
                  <span class="switch-text">
                    <b>{active ? 'ظاهر في المتجر' : 'مسوّدة — مخفي عن العملاء'}</b>
                    <small>{active ? 'العملاء يقدروا يشوفوه ويطلبوه دلوقتي.' : 'اضغط عشان تنشره في متجرك.'}</small>
                  </span>
                  <span class={`switch${active ? ' switch--on' : ''}${busy === 'status' ? ' switch--busy' : ''}`}>
                    <span />
                  </span>
                </button>
              </section>

              {detail && <ProductFacts detail={detail} currency={currency} />}

              {!detail && failed && (
                <div class="empty empty--compact">
                  <b>مش قادرين نجيب تفاصيل المنتج</b>
                  <p>اسحب لتحت عشان تحاول تاني.</p>
                </div>
              )}

              <div class="stack rise">
                <button type="button" class="btn btn--primary btn--lg press" onClick={edit}>
                  <Icon svg={icons.pencil()} />
                  تعديل المنتج
                </button>
                {detail && (
                  <div class="btn-row">
                    <button type="button" class="btn btn--ghost press" onClick={share}>
                      <Icon svg={icons.share()} />
                      مشاركة
                    </button>
                    <button type="button" class="btn btn--ghost press" onClick={() => openExternal(detail.product.url)}>
                      <Icon svg={icons.externalLink()} />
                      في المتجر
                    </button>
                  </div>
                )}
                {detail && (
                  <button
                    type="button"
                    class="btn btn--ghost btn--danger-text press"
                    disabled={Boolean(busy)}
                    onClick={() => setConfirmDelete(true)}
                  >
                    {busy === 'delete' ? <span class="spinner" /> : <Icon svg={icons.trash()} />}
                    نقل لسلة المهملات
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </Screen>

      <Sheet open={confirmDelete} title="تنقل المنتج لسلة المهملات؟" onClose={() => setConfirmDelete(false)}>
        <p class="sheet-text">هيختفي من متجرك ومن القايمة. الصور بتفضل، وتقدر ترجّعه من سلة المهملات بضغطة.</p>
        <div class="btn-row">
          <button type="button" class="btn btn--ghost press" onClick={() => setConfirmDelete(false)}>
            رجوع
          </button>
          <button type="button" class="btn btn--danger press" onClick={remove}>
            أيوه، انقله
          </button>
        </div>
      </Sheet>
    </>
  )
}

function ProductFacts({ detail: d, currency }: { detail: ProductDetail; currency: string }) {
  const p = d.product
  const stock = d.variantStock !== null ? { trackInventory: p.trackInventory, stock: d.variantStock } : p
  const label = stockLabel(stock)
  const profit = p.costPrice ? p.price - p.costPrice : null

  return (
    <>
      <section class="card sec facts rise">
        <div class="fact">
          <span class="fact-label">المخزون</span>
          <b class={label ? `fact-${label.tone}` : ''}>
            {p.trackInventory ? (stock.stock === 0 ? 'نفد' : formatNumber(stock.stock)) : 'مش متتبّع'}
          </b>
        </div>
        <div class="fact">
          <span class="fact-label">{profit !== null ? 'ربح القطعة' : 'الكود'}</span>
          <b class={profit !== null ? (profit > 0 ? 'fact-good' : 'fact-danger') : ''}>
            {profit !== null ? formatMoney(profit, currency) : p.sku || '—'}
          </b>
        </div>
        <div class="fact">
          <span class="fact-label">التركيبات</span>
          <b>{d.variants.length ? formatNumber(d.variants.length) : '—'}</b>
        </div>
      </section>

      {d.options.length > 0 && (
        <section class="card sec rise">
          <h2 class="card-title">المقاسات والألوان</h2>
          {d.options.map((o) => (
            <div key={o.name} class="opt-group">
              <span class="opt-name">{o.name}</span>
              <div class="opt-values">
                {o.values.map((v) => (
                  <span key={v.value} class="opt-val">
                    {v.hex && <i style={{ background: v.hex }} />}
                    {v.value}
                  </span>
                ))}
              </div>
            </div>
          ))}
          <div class="vlist">
            {d.variants.map((v) => {
              const vl = stockLabel({ trackInventory: p.trackInventory, stock: v.stock })
              return (
                <div key={v.id} class={`vrow${v.isActive ? '' : ' vrow--off'}`}>
                  <span class="vrow-title">{v.title}</span>
                  <span class="vrow-price">{formatMoney(v.price, currency)}</span>
                  {!v.isActive ? (
                    <span class="stock stock--muted">متوقّف</span>
                  ) : (
                    vl && <span class={`stock stock--${vl.tone}`}>{v.stock === 0 ? 'نفد' : formatNumber(v.stock)}</span>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {p.description && (
        <section class="card sec rise">
          <h2 class="card-title">الوصف</h2>
          <p class="p-desc">{p.description}</p>
        </section>
      )}

      <p class="fine center">اتضاف {formatDateTime(p.createdAt)}</p>
    </>
  )
}
