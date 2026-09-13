/**
 * الموردون — شاشة أصلية.
 *
 * فوق: «محتاج تطلبه» — المنتجات اللي وصلت حد التنبيه متجمّعة على المورّد،
 * بزرار اتصال وزرار واتساب بيبعت له قايمة الطلبية جاهزة. تحت: الموردون
 * بعدد منتجاتهم، وربط المنتجات بكل مورّد، والإضافة والتعديل من لوحة.
 */
import { useMemo, useState } from 'preact/hooks'
import { haptic, hapticNotify } from '../bridge'
import { toast } from '../dom'
import { icons } from '../icons'
import { formatMoney, formatNumber } from './format'
import { postAppJson, useResource } from './http'
import { openExternal } from './navigate'
import { suppliersData, waNumber, type Supplier, type SuppliersPayload } from './ops-api'
import { Screen, Sheet } from './screen'
import { Icon } from './ui'

type Form = { id: string | null; name: string; phone: string; email: string; margin: string; isActive: boolean }

export function SuppliersScreen({ visible, onUnavailable }: { visible: boolean; onUnavailable: () => void }) {
  const { data, failed, load } = useResource(suppliersData, visible, onUnavailable)
  const [busy, setBusy] = useState<string | null>(null)
  const [menuFor, setMenuFor] = useState<Supplier | null>(null)
  const [linkFor, setLinkFor] = useState<Supplier | null>(null)
  const [search, setSearch] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<Supplier | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const currency = data?.currency ?? 'EGP'

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
    toast(done, { tone: 'success', duration: 1800 })
    return true
  }

  const orderOnWhatsApp = (group: SuppliersPayload['reorder'][number]) => {
    if (!group.phone) return
    haptic('LIGHT')
    const lines = group.items.map((p) => `- ${p.name}${p.sku ? ` (${p.sku})` : ''} — باقي ${p.stock}`)
    const text = `أهلًا ${group.name ?? ''} 👋\nمحتاج أطلب الأصناف دي:\n${lines.join('\n')}\nممكن تبلغني بالمتاح والسعر؟`
    openExternal(`https://wa.me/${waNumber(group.phone)}?text=${encodeURIComponent(text)}`)
  }

  const openForm = (s?: Supplier) => {
    haptic('LIGHT')
    setMenuFor(null)
    setFormError(null)
    setForm(
      s
        ? { id: s.id, name: s.name, phone: s.phone ?? '', email: s.email ?? '', margin: String(s.marginPercent), isActive: s.isActive }
        : { id: null, name: '', phone: '', email: '', margin: '30', isActive: true },
    )
  }

  const saveForm = async (e: Event) => {
    e.preventDefault()
    if (!form || busy) return
    if (form.name.trim().length < 2) return setFormError('اكتب اسم المورّد')
    setFormError(null)
    setBusy('form')
    const res = await postAppJson('/api/app/suppliers/save', form)
    if (!res.ok) {
      setBusy(null)
      hapticNotify('ERROR')
      setFormError(res.error)
      return
    }
    await load()
    setBusy(null)
    hapticNotify('SUCCESS')
    toast(form.id ? 'بيانات المورّد اتحفظت' : 'المورّد اتضاف — اربط منتجاته', { tone: 'success' })
    setForm(null)
  }

  const linkTarget = linkFor ? (data?.suppliers.find((s) => s.id === linkFor.id) ?? linkFor) : null
  const mine = useMemo(() => (linkTarget ? (data?.products ?? []).filter((p) => p.supplierId === linkTarget.id) : []), [data, linkTarget])
  const free = useMemo(() => {
    const q = search.trim()
    return (data?.products ?? []).filter((p) => !p.supplierId && (!q || p.name.includes(q)))
  }, [data, search])

  return (
    <Screen visible={visible} title="الموردون" onRefresh={load}>
      <div class="home-body">
        <header class="page-head rise">
          <div class="page-head-text">
            <h1 class="page-title">الموردون</h1>
            <p class="page-sub">
              {data && data.reorderCount > 0 ? `${formatNumber(data.reorderCount)} منتج قرّب يخلص ومحتاج تطلبه` : 'مين بيوردّلك إيه، وإيه اللي محتاج تطلبه'}
            </p>
          </div>
        </header>

        {!data ? (
          failed ? (
            <div class="empty">
              <span class="empty-icon">
                <Icon svg={icons.wifiOff()} />
              </span>
              <b>مش قادرين نجيب الموردين</b>
              <p>اتأكد من النت واسحب لتحت عشان تحاول تاني.</p>
            </div>
          ) : (
            <div class="olist">
              <span class="sk" style="height:160px;border-radius:20px" />
              <span class="sk" style="height:120px;border-radius:20px" />
            </div>
          )
        ) : (
          <>
            {data.reorder.length > 0 && (
              <>
                <div class="mk-sec">
                  <b>محتاج تطلبه ({formatNumber(data.reorderCount)})</b>
                  <small>المنتجات اللي وصلت حد التنبيه — متجمّعة على مين تكلّمه.</small>
                </div>
                {data.reorder.map((g) => (
                  <article key={g.supplierId ?? 'none'} class="card cr rise">
                    <div class="cr-top">
                      <span class={`cr-icon${g.supplierId ? '' : ' cr-icon--off'}`}>
                        <Icon svg={icons.truck()} />
                      </span>
                      <span class="cr-main">
                        <b>{g.name ?? 'من غير مورّد محدّد'}</b>
                        <span class="cr-sub">
                          {formatNumber(g.items.length)} صنف
                          {g.phone && (
                            <>
                              {' · '}
                              <bdi dir="ltr">{g.phone}</bdi>
                            </>
                          )}
                        </span>
                      </span>
                    </div>
                    <div class="sp-items">
                      {g.items.map((p) => (
                        <div key={p.id} class="sp-item">
                          <span class="bl-main">
                            <b>{p.name}</b>
                            {(p.sku || p.costPrice) && (
                              <small>
                                {p.sku ?? ''}
                                {p.sku && p.costPrice ? ' · ' : ''}
                                {p.costPrice ? `تكلفة ${formatMoney(p.costPrice, currency)}` : ''}
                              </small>
                            )}
                          </span>
                          <span class={`inv-chip ${p.stock === 0 ? 'inv-chip--out' : 'inv-chip--low'}`}>
                            {p.stock === 0 ? 'نفد' : `باقي ${formatNumber(p.stock)}`}
                          </span>
                        </div>
                      ))}
                    </div>
                    {g.phone && (
                      <div class="cr-actions">
                        <button type="button" class="act act--wa press" onClick={() => orderOnWhatsApp(g)}>
                          <Icon svg={icons.messageCircle()} />
                          ابعتله الطلبية
                        </button>
                        <button type="button" class="act press" onClick={() => location.assign(`tel:${g.phone}`)}>
                          <Icon svg={icons.phone()} />
                          اتصال
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </>
            )}

            <div class="mk-sec cr-head">
              <span>
                <b>الموردون</b>
                <small>
                  {data.suppliers.length
                    ? `${formatNumber(data.suppliers.length)} مورّد${data.unlinkedCount ? ` · ${formatNumber(data.unlinkedCount)} منتج من غير مورّد` : ''}`
                    : 'سجّل مورّدينك واربط كل منتج بمورّده'}
                </small>
              </span>
              {data.suppliers.length > 0 && (
                <button type="button" class="act press cr-add" onClick={() => openForm()}>
                  <Icon svg={icons.plus()} />
                  ضيف
                </button>
              )}
            </div>

            {data.suppliers.length === 0 ? (
              <div class="empty empty--compact rise">
                <span class="empty-icon">
                  <Icon svg={icons.truck()} />
                </span>
                <b>مافيش موردين مسجّلين</b>
                <p>سجّل مورّدينك واربط كل منتج بمورّده، وهتلاقي هنا قايمة جاهزة بكل اللي قرّب يخلص — مرتّبة على مين تكلّمه.</p>
                <button type="button" class="btn btn--primary press" onClick={() => openForm()}>
                  <Icon svg={icons.plus()} />
                  مورّد جديد
                </button>
              </div>
            ) : (
              <div class="card ops-list rise">
                {data.suppliers.map((s) => (
                  <div key={s.id} class={`bl-row${s.isActive ? '' : ' cr--off'}`}>
                    <span class="bl-main">
                      <b>
                        {s.name}
                        {!s.isActive && <span class="cr-off">موقوف</span>}
                      </b>
                      <small>
                        {formatNumber(s.productCount)} منتج · هامش مقترح {formatNumber(s.marginPercent)}٪
                        {s.phone && (
                          <>
                            {' · '}
                            <bdi dir="ltr">{s.phone}</bdi>
                          </>
                        )}
                      </small>
                    </span>
                    <button
                      type="button"
                      class="act press bl-act"
                      onClick={() => {
                        haptic('LIGHT')
                        setSearch('')
                        setLinkFor(s)
                      }}
                    >
                      المنتجات
                    </button>
                    <button
                      type="button"
                      class="ops-icon press"
                      aria-label={`خيارات ${s.name}`}
                      onClick={() => {
                        haptic('LIGHT')
                        setMenuFor(s)
                      }}
                    >
                      <Icon svg={icons.moreHorizontal()} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* خيارات المورّد */}
      <Sheet open={Boolean(menuFor)} title={menuFor?.name ?? ''} onClose={() => setMenuFor(null)}>
        {menuFor && (
          <div class="sheet-list">
            {menuFor.phone && (
              <button type="button" class="sheet-row" onClick={() => location.assign(`tel:${menuFor.phone}`)}>
                <Icon svg={icons.phone()} />
                <span class="sheet-row-label">اتصل بيه</span>
              </button>
            )}
            {menuFor.phone && (
              <button
                type="button"
                class="sheet-row"
                onClick={() => openExternal(`https://wa.me/${waNumber(menuFor.phone ?? '')}`)}
              >
                <Icon svg={icons.messageCircle()} />
                <span class="sheet-row-label">واتساب</span>
              </button>
            )}
            {menuFor.email && (
              <button type="button" class="sheet-row" onClick={() => location.assign(`mailto:${menuFor.email}`)}>
                <Icon svg={icons.mail()} />
                <span class="sheet-row-label">
                  ابعتله إيميل
                  <small class="set-hint">{menuFor.email}</small>
                </span>
              </button>
            )}
            <button type="button" class="sheet-row" onClick={() => openForm(menuFor)}>
              <Icon svg={icons.pencil()} />
              <span class="sheet-row-label">عدّل بياناته</span>
            </button>
            <button
              type="button"
              class="sheet-row"
              onClick={() => {
                const s = menuFor
                setMenuFor(null)
                setConfirmDelete(s)
              }}
            >
              <Icon svg={icons.trash()} />
              <span class="sheet-row-label">
                احذف المورّد
                <small class="set-hint">منتجاته بتفضل — بس من غير مورّد</small>
              </span>
            </button>
          </div>
        )}
      </Sheet>

      <Sheet open={Boolean(confirmDelete)} title={confirmDelete ? `تحذف ${confirmDelete.name}؟` : ''} onClose={() => setConfirmDelete(null)}>
        {confirmDelete && (
          <>
            <p class="sheet-text">
              {confirmDelete.productCount
                ? `الـ${formatNumber(confirmDelete.productCount)} منتج المربوطين بيه هيفضلوا موجودين، بس من غير مورّد.`
                : 'المورّد هيتحذف من القايمة.'}
            </p>
            <div class="btn-row">
              <button type="button" class="btn btn--ghost press" onClick={() => setConfirmDelete(null)}>
                رجوع
              </button>
              <button
                type="button"
                class="btn btn--danger press"
                onClick={async () => {
                  const s = confirmDelete
                  setConfirmDelete(null)
                  await post(`del-${s.id}`, `/api/app/suppliers/${encodeURIComponent(s.id)}/delete`, {}, 'المورّد اتحذف')
                }}
              >
                أيوه، احذفه
              </button>
            </div>
          </>
        )}
      </Sheet>

      {/* ربط المنتجات */}
      <Sheet open={Boolean(linkFor)} tall title={linkTarget ? `منتجات ${linkTarget.name}` : ''} onClose={() => setLinkFor(null)}>
        {linkTarget && data && (
          <div class="sp-link">
            {mine.length > 0 ? (
              <div class="card ops-list">
                {mine.map((p) => (
                  <div key={p.id} class="bl-row">
                    <span class="bl-main">
                      <b>{p.name}</b>
                    </span>
                    <button
                      type="button"
                      class="act press bl-act"
                      disabled={Boolean(busy)}
                      onClick={() => void post(p.id, '/api/app/suppliers/link', { productId: p.id, supplierId: null }, 'اتفكّ الربط')}
                    >
                      {busy === p.id && <span class="spinner" />}
                      فكّ الربط
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p class="np-note">مفيش منتجات مربوطة بالمورّد ده لسه — اختار من تحت.</p>
            )}

            <div class="mk-sec">
              <b>اربط منتج بالمورّد ده</b>
              <small>المنتجات اللي من غير مورّد بس</small>
            </div>
            <input
              class="np-input"
              type="search"
              placeholder="دوّر على منتج…"
              value={search}
              onInput={(e) => setSearch((e.currentTarget as HTMLInputElement).value)}
            />
            {free.length === 0 ? (
              <p class="np-note">{data.unlinkedCount === 0 ? 'كل منتجاتك مربوطة بموردين.' : 'مفيش منتج بالاسم ده من غير مورّد.'}</p>
            ) : (
              <div class="card ops-list">
                {free.slice(0, 60).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    class="bl-row sp-free press"
                    disabled={Boolean(busy)}
                    onClick={() => void post(p.id, '/api/app/suppliers/link', { productId: p.id, supplierId: linkTarget.id }, `اتربط بـ${linkTarget.name}`)}
                  >
                    <span class="bl-main">
                      <b>{p.name}</b>
                    </span>
                    {busy === p.id ? <span class="spinner" /> : <Icon svg={icons.plus()} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </Sheet>

      {/* إضافة / تعديل */}
      <Sheet open={Boolean(form)} tall title={form?.id ? 'تعديل المورّد' : 'مورّد جديد'} onClose={() => setForm(null)}>
        {form && (
          <form class="np-form ops-form" onSubmit={saveForm}>
            <label class="np-label">
              اسم المورّد
              <input
                class="np-input"
                placeholder="مصنع النور"
                value={form.name}
                maxLength={80}
                onInput={(e) => setForm({ ...form, name: (e.currentTarget as HTMLInputElement).value })}
              />
            </label>
            <label class="np-label">
              تليفون
              <input
                class="np-input"
                type="tel"
                dir="ltr"
                placeholder="01xxxxxxxxx"
                value={form.phone}
                maxLength={30}
                onInput={(e) => setForm({ ...form, phone: (e.currentTarget as HTMLInputElement).value })}
              />
            </label>
            <label class="np-label">
              إيميل (اختياري)
              <input
                class="np-input"
                type="email"
                dir="ltr"
                value={form.email}
                maxLength={120}
                onInput={(e) => setForm({ ...form, email: (e.currentTarget as HTMLInputElement).value })}
              />
            </label>
            <label class="np-label">
              هامش الربح المقترح (٪)
              <input
                class="np-input num"
                type="text"
                inputMode="decimal"
                value={form.margin}
                onInput={(e) => setForm({ ...form, margin: (e.currentTarget as HTMLInputElement).value })}
              />
            </label>
            <button
              type="button"
              class="switch-row"
              onClick={() => {
                haptic('LIGHT')
                setForm({ ...form, isActive: !form.isActive })
              }}
            >
              <span class="switch-text">
                <b>مورّد نشط</b>
                <small>{form.isActive ? 'بتتعامل معاه دلوقتي' : 'موقوف — بيفضل في القايمة'}</small>
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
                {form.id ? 'احفظ' : 'ضيف المورّد'}
              </button>
            </div>
          </form>
        )}
      </Sheet>
    </Screen>
  )
}
