/**
 * الفروع والمخازن — شاشة أصلية (`/dashboard/inventory/branches`).
 *
 * نفس `BranchesManager` في اللوحة: كارت لكل فرع (افتراضي/موقوف، العنوان) ← لوحة تعديل (الاسم، المحافظة، التليفون،
 * العنوان، افتراضي، شغّال، واحذف بتأكيد لغير الافتراضي)، «فرع جديد»، وتوزيع المخزون: كارت لكل منتج بالإجمالي وخانة
 * لكل فرع (بتتحفظ لما تسيبها) و«مش موزّع» (أحمر لو وزّعت أكتر من الإجمالي)، ولو فيه أكتر من فرع: «نقل بين الفروع».
 */
import { useEffect, useMemo, useState } from 'preact/hooks'
import { haptic, hapticNotify } from '../bridge'
import { toast } from '../dom'
import { icons } from '../icons'
import { formatNumber } from './format'
import { branchesData, type Branch, type BranchProduct } from './growth-api'
import { postAppJson, useResource } from './http'
import { Screen, Sheet } from './screen'
import { latinDigits, LoadState, Toggle } from './settings-forms'
import { Icon } from './ui'

type Form = { id?: string; name: string; city: string; address: string; phone: string; isDefault: boolean; isActive: boolean }

function LevelInput({ locationId, product, onSaved }: { locationId: string; product: BranchProduct; onSaved: () => void }) {
  const initial = product.byBranch[locationId] ?? 0
  const [value, setValue] = useState(String(initial))
  const [state, setState] = useState<'idle' | 'busy' | 'ok'>('idle')

  useEffect(() => setValue(String(initial)), [initial])

  const commit = async () => {
    const n = Number(latinDigits(value))
    if (!Number.isFinite(n) || n === initial) return
    setState('busy')
    const res = await postAppJson('/api/app/branches/level', { locationId, productId: product.id, available: n })
    if (!res.ok) {
      setState('idle')
      setValue(String(initial))
      hapticNotify('ERROR')
      toast(res.error, { tone: 'danger' })
      return
    }
    setState('ok')
    hapticNotify('SUCCESS')
    onSaved()
    setTimeout(() => setState('idle'), 1500)
  }

  return (
    <span class="br-level">
      <input
        class="np-input num"
        inputMode="numeric"
        dir="ltr"
        aria-label="الرصيد في الفرع"
        value={value}
        onInput={(e) => setValue(latinDigits((e.currentTarget as HTMLInputElement).value).replace(/\D/g, ''))}
        onBlur={() => void commit()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur()
        }}
      />
      {state !== 'idle' && <i class={`br-saved${state === 'ok' ? ' br-saved--ok' : ''}`}>{state === 'ok' ? '✓' : '…'}</i>}
    </span>
  )
}

export function BranchesScreen({ visible, onUnavailable }: { visible: boolean; onUnavailable: () => void }) {
  const { data, failed, load } = useResource(branchesData, visible, onUnavailable)
  const [form, setForm] = useState<Form | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [query, setQuery] = useState('')
  const [transfer, setTransfer] = useState<{ productId: string; fromId: string; toId: string; quantity: string } | null>(null)

  const active = useMemo(() => (data ? data.branches.filter((b) => b.isActive) : []), [data])
  const products = useMemo(() => {
    const q = query.trim()
    return (data?.products ?? []).filter((p) => !q || p.name.includes(q))
  }, [data, query])

  const open = (b?: Branch) => {
    haptic('LIGHT')
    setError(null)
    setConfirmDelete(false)
    setForm(
      b
        ? { id: b.id, name: b.name, city: b.city ?? '', address: b.address ?? '', phone: b.phone ?? '', isDefault: b.isDefault, isActive: b.isActive }
        : { name: '', city: '', address: '', phone: '', isDefault: false, isActive: true },
    )
  }

  const call = async (key: string, url: string, body: object, done: string) => {
    if (busy) return false
    setBusy(key)
    setError(null)
    const res = await postAppJson(url, body)
    if (!res.ok) {
      setBusy(null)
      hapticNotify('ERROR')
      setError(res.error)
      return false
    }
    await load()
    setBusy(null)
    hapticNotify('SUCCESS')
    toast(done, { tone: 'success', duration: 2200 })
    return true
  }

  return (
    <Screen visible={visible} title="الفروع والمخازن" onRefresh={load}>
      <div class="home-body">
        <header class="page-head rise">
          <div class="page-head-text">
            <h1 class="page-title">الفروع والمخازن</h1>
            <p class="page-sub">اعرف بضاعتك موجودة فين، وانقلها بين فروعك من غير ما تعدّ من الأول.</p>
          </div>
        </header>

        {!data ? (
          <LoadState failed={failed} what="الفروع" />
        ) : (
          <>
            <p class="np-note rise">الفرع الافتراضي هو اللي البيع بيخصم منه. الباقي للتوزيع والنقل.</p>

            <div class="card ops-list rise">
              {data.branches.map((b) => (
                <button key={b.id} type="button" class="bl-row br-row press" onClick={() => open(b)}>
                  <span class="br-icon">
                    <Icon svg={icons.mapPin()} />
                  </span>
                  <span class="bl-main">
                    <b>
                      {b.name}
                      {b.isDefault && <span class="pst-pill pst-pill--primary">افتراضي</span>}
                      {!b.isActive && <span class="pst-pill pst-pill--muted">موقوف</span>}
                    </b>
                    <small>{[b.city, b.address].filter(Boolean).join('، ') || 'من غير عنوان'}</small>
                  </span>
                  <Icon svg={icons.chevronLeft()} className="ic an-chev" />
                </button>
              ))}
            </div>

            <button type="button" class="btn btn--primary btn--lg press rise ops-add" onClick={() => open()}>
              <Icon svg={icons.plus()} />
              فرع جديد
            </button>

            {active.length > 0 && data.products.length > 0 && (
              <>
                <div class="pv-sec rise">
                  <h2>توزيع المخزون</h2>
                  <p>اكتب الموجود في كل فرع. لو المجموع أقل من الإجمالي، الفرق معناه كمية لسه ما اتوزّعتش — وهي معروضة للبيع عادي.</p>
                </div>

                {active.length > 1 && (
                  <button
                    type="button"
                    class="btn btn--ghost press rise br-transfer-btn"
                    onClick={() => {
                      haptic('LIGHT')
                      setError(null)
                      setTransfer({ productId: data.products[0]?.id ?? '', fromId: active[0].id, toId: active[1].id, quantity: '' })
                    }}
                  >
                    <Icon svg={icons.refresh()} />
                    نقل بين الفروع
                  </button>
                )}

                <input class="np-input rise" type="search" placeholder="دوّر على منتج…" value={query} onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)} />

                <div class="br-products">
                  {products.map((p) => {
                    const assigned = active.reduce((n, b) => n + (p.byBranch[b.id] ?? 0), 0)
                    const rest = p.total - assigned
                    return (
                      <section key={p.id} class="card br-product">
                        <div class="br-product-head">
                          <b>{p.name}</b>
                          <span>
                            الإجمالي <b>{formatNumber(p.total)}</b>
                          </span>
                        </div>
                        <div class="br-levels">
                          {active.map((b) => (
                            <label key={b.id}>
                              <small>{b.name}</small>
                              <LevelInput locationId={b.id} product={p} onSaved={() => void load()} />
                            </label>
                          ))}
                          <span class={`br-rest${rest < 0 ? ' br-rest--bad' : ''}`}>
                            <small>مش موزّع</small>
                            <b>{formatNumber(rest)}</b>
                          </span>
                        </div>
                        {rest < 0 && <small class="st-bad">وزّعت أكتر من الإجمالي — راجع الأرقام</small>}
                      </section>
                    )
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>

      <Sheet open={Boolean(form)} tall title={form?.id ? 'تعديل الفرع' : 'فرع جديد'} onClose={() => setForm(null)}>
        {form && (
          <div class="np-form ops-form">
            <label class="np-label">
              اسم الفرع
              <input class="np-input" maxLength={80} value={form.name} onInput={(e) => setForm({ ...form, name: (e.currentTarget as HTMLInputElement).value })} />
            </label>
            <label class="np-label">
              المحافظة
              <input class="np-input" maxLength={80} value={form.city} onInput={(e) => setForm({ ...form, city: (e.currentTarget as HTMLInputElement).value })} />
            </label>
            <label class="np-label">
              تليفون الفرع
              <input class="np-input" type="tel" inputMode="tel" dir="ltr" maxLength={30} value={form.phone} onInput={(e) => setForm({ ...form, phone: (e.currentTarget as HTMLInputElement).value })} />
            </label>
            <label class="np-label">
              العنوان
              <input class="np-input" maxLength={200} value={form.address} onInput={(e) => setForm({ ...form, address: (e.currentTarget as HTMLInputElement).value })} />
            </label>
            <Toggle label="الفرع الافتراضي" hint="البيع بيخصم منه. فرع واحد بس يبقى افتراضي." on={form.isDefault} onChange={(x) => setForm({ ...form, isDefault: x })} />
            <Toggle label="شغّال" on={form.isActive} onChange={(x) => setForm({ ...form, isActive: x })} />

            {error && <p class="np-error">{error}</p>}
            <div class="btn-row">
              <button type="button" class="btn btn--ghost press" onClick={() => setForm(null)}>
                رجوع
              </button>
              <button
                type="button"
                class="btn btn--primary press"
                disabled={Boolean(busy)}
                onClick={async () => {
                  const { id, ...rest } = form
                  if (await call('save', '/api/app/branches/save', { ...(id ? { id } : {}), ...rest }, 'اتحفظ')) setForm(null)
                }}
              >
                {busy === 'save' ? <span class="spinner" /> : <Icon svg={icons.check()} />}
                حفظ
              </button>
            </div>

            {form.id &&
              data?.branches.find((b) => b.id === form.id && !b.isDefault) &&
              (confirmDelete ? (
                <div class="ex-confirm">
                  <p class="sheet-text">«{form.name}» هيتمسح والأرصدة اللي فيه هتتشال معاه. الإجمالي اللي المتجر بيبيع منه ما بيتغيّرش.</p>
                  <div class="btn-row">
                    <button type="button" class="btn btn--ghost press" onClick={() => setConfirmDelete(false)}>
                      رجوع
                    </button>
                    <button
                      type="button"
                      class="btn btn--danger press"
                      disabled={Boolean(busy)}
                      onClick={async () => {
                        if (await call('delete', `/api/app/branches/${encodeURIComponent(form.id!)}/delete`, {}, 'الفرع اتمسح')) setForm(null)
                      }}
                    >
                      {busy === 'delete' ? <span class="spinner" /> : null}
                      أيوه، امسحه
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" class="btn btn--ghost btn--danger-text press" onClick={() => setConfirmDelete(true)}>
                  <Icon svg={icons.trash()} />
                  امسح الفرع
                </button>
              ))}
          </div>
        )}
      </Sheet>

      <Sheet open={Boolean(transfer)} title="نقل بين الفروع" onClose={() => setTransfer(null)}>
        {transfer && data && (
          <div class="np-form ops-form">
            <p class="np-note">النقل بيحرّك الكمية بس — الإجمالي ما بيتغيّرش، والحركتين بيتسجّلوا في سجل المخزون.</p>
            <label class="np-label">
              المنتج
              <select class="np-input" value={transfer.productId} onChange={(e) => setTransfer({ ...transfer, productId: (e.currentTarget as HTMLSelectElement).value })}>
                {data.products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label class="np-label">
              من
              <select class="np-input" value={transfer.fromId} onChange={(e) => setTransfer({ ...transfer, fromId: (e.currentTarget as HTMLSelectElement).value })}>
                {active.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({formatNumber(data.products.find((p) => p.id === transfer.productId)?.byBranch[b.id] ?? 0)})
                  </option>
                ))}
              </select>
            </label>
            <label class="np-label">
              إلى
              <select class="np-input" value={transfer.toId} onChange={(e) => setTransfer({ ...transfer, toId: (e.currentTarget as HTMLSelectElement).value })}>
                {active.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label class="np-label">
              الكمية
              <input
                class="np-input num"
                inputMode="numeric"
                dir="ltr"
                value={transfer.quantity}
                onInput={(e) => setTransfer({ ...transfer, quantity: latinDigits((e.currentTarget as HTMLInputElement).value).replace(/\D/g, '') })}
              />
            </label>
            {error && <p class="np-error">{error}</p>}
            <div class="btn-row">
              <button type="button" class="btn btn--ghost press" onClick={() => setTransfer(null)}>
                رجوع
              </button>
              <button
                type="button"
                class="btn btn--primary press"
                disabled={Boolean(busy) || !transfer.quantity}
                onClick={async () => {
                  if (await call('transfer', '/api/app/branches/transfer', { ...transfer, quantity: Number(transfer.quantity) }, 'اتنقلت')) setTransfer(null)
                }}
              >
                {busy === 'transfer' ? <span class="spinner" /> : <Icon svg={icons.check()} />}
                انقل
              </button>
            </div>
          </div>
        )}
      </Sheet>
    </Screen>
  )
}
