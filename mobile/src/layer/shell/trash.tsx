/**
 * سلة مهملات المنتجات — شاشة أصلية.
 *
 * المنتج المحذوف بيقعد هنا بصوره وبياناته. «رجّعه» بيرجّعه **مسوّدة** (زي
 * اللوحة) عشان التاجر يراجعه قبل ما ينشره، و«امسح» نهائي بتأكيد.
 */
import { useState } from 'preact/hooks'
import { haptic, hapticNotify } from '../bridge'
import { toast } from '../dom'
import { icons } from '../icons'
import { assetUrl } from './api'
import { formatMoney, formatNumber } from './format'
import { postAppJson, useResource } from './http'
import { navigate } from './navigate'
import { trashData, type TrashPayload } from './ops-api'
import { clearProductsCache } from './products-api'
import { Screen, Sheet } from './screen'
import { Icon } from './ui'

type Item = TrashPayload['products'][number]

export function TrashScreen({ visible, onUnavailable }: { visible: boolean; onUnavailable: () => void }) {
  const { data, failed, load } = useResource(trashData, visible, onUnavailable)
  const [busy, setBusy] = useState<string | null>(null)
  const [purgeFor, setPurgeFor] = useState<Item | null>(null)

  const act = async (item: Item, action: 'restore' | 'purge') => {
    if (busy) return
    haptic(action === 'purge' ? 'MEDIUM' : 'LIGHT')
    setBusy(item.id)
    const res = await postAppJson(`/api/app/trash/${encodeURIComponent(item.id)}/${action}`)
    if (!res.ok) {
      setBusy(null)
      hapticNotify('ERROR')
      toast(res.error, { tone: 'danger' })
      return
    }
    clearProductsCache()
    await load()
    setBusy(null)
    hapticNotify('SUCCESS')
    if (action === 'restore') {
      toast('رجع مسوّدة — راجعه وانشره', {
        tone: 'success',
        action: { label: 'افتحه', run: () => navigate(`/dashboard/products/${item.id}`) },
      })
    } else toast('اتمسح نهائيًا', { tone: 'success', duration: 1800 })
  }

  const currency = data?.currency ?? 'EGP'

  return (
    <Screen visible={visible} title="سلة المهملات" onRefresh={load}>
      <div class="home-body">
        <header class="page-head rise">
          <div class="page-head-text">
            <h1 class="page-title">سلة المهملات</h1>
            <p class="page-sub">
              {data?.products.length ? `${formatNumber(data.products.length)} منتج محذوف` : 'المنتجات اللي حذفتها — رجّعها بدوسة'}
            </p>
          </div>
        </header>

        {!data ? (
          failed ? (
            <div class="empty">
              <span class="empty-icon">
                <Icon svg={icons.wifiOff()} />
              </span>
              <b>مش قادرين نجيب السلة</b>
              <p>اتأكد من النت واسحب لتحت عشان تحاول تاني.</p>
            </div>
          ) : (
            <div class="olist">
              {[0, 1, 2].map((i) => (
                <span key={i} class="sk" style="height:72px;border-radius:20px" />
              ))}
            </div>
          )
        ) : data.products.length === 0 ? (
          <div class="empty rise">
            <span class="empty-icon">
              <Icon svg={icons.trash()} />
            </span>
            <b>السلة فاضية</b>
            <p>أي منتج تحذفه بيقعد هنا بصوره وبياناته لحد ما ترجّعه أو تمسحه نهائيًا. الطلبات القديمة عليه ما بتتأثرش.</p>
          </div>
        ) : (
          <div class="card ops-list rise">
            {data.products.map((p) => (
              <div key={p.id} class="bl-row">
                <span class="inv-thumb">
                  {p.image ? <img src={assetUrl(p.image) ?? p.image} alt="" loading="lazy" /> : <Icon svg={icons.package()} />}
                </span>
                <span class="bl-main">
                  <b>{p.name}</b>
                  <small>
                    {formatMoney(p.price, currency)} · اتحذف {new Date(p.deletedAt).toLocaleDateString('ar-EG')}
                  </small>
                </span>
                <button type="button" class="act act--wa press bl-act" disabled={Boolean(busy)} onClick={() => void act(p, 'restore')}>
                  {busy === p.id ? <span class="spinner" /> : <Icon svg={icons.refresh()} />}
                  رجّعه
                </button>
                <button
                  type="button"
                  class="ops-icon press"
                  aria-label={`امسح ${p.name} نهائيًا`}
                  disabled={Boolean(busy)}
                  onClick={() => {
                    haptic('LIGHT')
                    setPurgeFor(p)
                  }}
                >
                  <Icon svg={icons.trash()} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Sheet open={Boolean(purgeFor)} title="تمسحه نهائيًا؟" onClose={() => setPurgeFor(null)}>
        {purgeFor && (
          <>
            <p class="sheet-text">
              «{purgeFor.name}» هيتمسح هو وصوره ومش هينفع يرجع. الفواتير القديمة عليه بتفضل زي ما هي.
            </p>
            <div class="btn-row">
              <button type="button" class="btn btn--ghost press" onClick={() => setPurgeFor(null)}>
                رجوع
              </button>
              <button
                type="button"
                class="btn btn--danger press"
                onClick={() => {
                  const item = purgeFor
                  setPurgeFor(null)
                  void act(item, 'purge')
                }}
              >
                امسحه خالص
              </button>
            </div>
          </>
        )}
      </Sheet>
    </Screen>
  )
}
