/**
 * البانرات — شاشة أصلية.
 *
 * كل بانر بصورته ومكانه وتاريخ انتهائه، ومفتاح تشغيل بدوسة. «بانر جديد» والدوسة على
 * بانر = لوحة: المكان، صورة الكمبيوتر وصورة الموبايل (بالكاميرا أو المعرض — مجلد `banners`)،
 * العنوان والسطر التوضيحي، الزرار ورابطه، التواريخ، التفعيل، والحذف بتأكيد.
 */
import { useRef, useState } from 'preact/hooks'
import { haptic, hapticNotify } from '../bridge'
import { toast } from '../dom'
import { icons } from '../icons'
import { formatNumber } from './format'
import { postAppJson, useResource } from './http'
import { bannersData, type Banner } from './ops-api'
import { shrink, upload } from './product-new'
import { Screen, Sheet } from './screen'
import { Icon } from './ui'

type Form = Omit<Banner, 'id' | 'placementLabel' | 'expired'> & { id: string | null }

const empty = (): Form => ({
  id: null,
  placement: 'promo',
  title: '',
  subtitle: '',
  imageDesktop: null,
  imageMobile: null,
  ctaLabel: '',
  ctaUrl: '',
  startsAt: '',
  endsAt: '',
  isActive: true,
})

/** خانة صورة واحدة: معاينة + صوّر / من المعرض / شيل */
function ImageSlot({ label, value, onChange }: { label: string; value: string | null; onChange: (url: string | null) => void }) {
  const camera = useRef<HTMLInputElement>(null)
  const gallery = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const pick = async (input: HTMLInputElement) => {
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    haptic('LIGHT')
    setBusy(true)
    const url = await upload(await shrink(file), 'banners')
    setBusy(false)
    if (!url) return void toast('الصورة ما اترفعتش — جرّب تاني', { tone: 'danger' })
    onChange(url)
  }

  return (
    <div class="ct-image">
      <span class="ct-image-box bn-box">
        {value ? <img src={value} alt="" /> : <Icon svg={icons.image()} />}
        {busy && (
          <span class="np-busy">
            <span class="spinner" />
          </span>
        )}
      </span>
      <span class="ct-image-actions">
        <b>{label}</b>
        <span class="cr-actions">
          <button type="button" class="act press" disabled={busy} onClick={() => camera.current?.click()}>
            صوّر
          </button>
          <button type="button" class="act press" disabled={busy} onClick={() => gallery.current?.click()}>
            من المعرض
          </button>
          {value && (
            <button type="button" class="ops-icon press" aria-label="شيل الصورة" onClick={() => onChange(null)}>
              <Icon svg={icons.x()} />
            </button>
          )}
        </span>
      </span>
      <input ref={camera} class="np-file" type="file" accept="image/*" capture="environment" onChange={(e) => void pick(e.currentTarget as HTMLInputElement)} />
      <input ref={gallery} class="np-file" type="file" accept="image/*" onChange={(e) => void pick(e.currentTarget as HTMLInputElement)} />
    </div>
  )
}

export function BannersScreen({ visible, onUnavailable }: { visible: boolean; onUnavailable: () => void }) {
  const { data, failed, load } = useResource(bannersData, visible, onUnavailable)
  const [form, setForm] = useState<Form | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const open = (b?: Banner) => {
    haptic('LIGHT')
    setError(null)
    setConfirmDelete(false)
    setForm(b ? { ...b } : empty())
  }

  const post = async (key: string, url: string, body: object, done: string) => {
    if (busy) return false
    haptic('LIGHT')
    setBusy(key)
    const res = await postAppJson(url, body)
    if (!res.ok) {
      setBusy(null)
      hapticNotify('ERROR')
      if (form) setError(res.error)
      else toast(res.error, { tone: 'danger' })
      return false
    }
    await load()
    setBusy(null)
    hapticNotify('SUCCESS')
    toast(done, { tone: 'success', duration: 2000 })
    return true
  }

  const list = data?.banners ?? []
  const active = list.filter((b) => b.isActive && !b.expired).length
  /* «الرئيسي» و«المنبثقة» بيتعملوا من تصميم المتجر — الفورم بيعرضهم بس لو البانر أصلًا منهم */
  const placements = (data?.placements ?? []).filter((p) => p.key === 'promo' || p.key === 'category' || p.key === form?.placement)

  return (
    <Screen visible={visible} title="البانرات" onRefresh={load}>
      <div class="home-body">
        <header class="page-head rise">
          <div class="page-head-text">
            <h1 class="page-title">البانرات</h1>
            <p class="page-sub">{list.length ? `${formatNumber(active)} شغّال من ${formatNumber(list.length)}` : 'شرائط ترويجية بتختفي لوحدها لما العرض ينتهي'}</p>
          </div>
        </header>

        {!data ? (
          failed ? (
            <div class="empty">
              <span class="empty-icon">
                <Icon svg={icons.wifiOff()} />
              </span>
              <b>مش قادرين نجيب البانرات</b>
              <p>اتأكد من النت واسحب لتحت عشان تحاول تاني.</p>
            </div>
          ) : (
            <div class="olist">
              {[0, 1].map((i) => (
                <span key={i} class="sk" style="height:96px;border-radius:20px" />
              ))}
            </div>
          )
        ) : (
          <>
            <button type="button" class="btn btn--primary btn--lg press rise ops-add" onClick={() => open()}>
              <Icon svg={icons.plus()} />
              بانر جديد
            </button>
            {list.length === 0 ? (
              <div class="empty empty--compact rise">
                <span class="empty-icon">
                  <Icon svg={icons.image()} />
                </span>
                <b>مافيش بانرات</b>
                <p>البانر الترويجي بيعلن عن عروضك في صفحة متجرك الرئيسية — صوّر وارفع من هنا.</p>
              </div>
            ) : (
              <div class="card ops-list rise">
                {list.map((b) => (
                  <div key={b.id} class={`bl-row bg-row${b.isActive && !b.expired ? '' : ' bg-row--draft'}`}>
                    <button type="button" class="bg-open press" onClick={() => open(b)}>
                      <span class="inv-thumb bn-thumb">{b.imageMobile || b.imageDesktop ? <img src={(b.imageMobile || b.imageDesktop)!} alt="" loading="lazy" /> : <Icon svg={icons.image()} />}</span>
                      <span class="bl-main">
                        <b>
                          {b.title || 'بانر من غير عنوان'}
                          {b.expired && <span class="cr-off">انتهى</span>}
                        </b>
                        <small>
                          {b.placementLabel}
                          {b.endsAt ? ` · لحد ${new Date(b.endsAt).toLocaleDateString('ar-EG')}` : ''}
                        </small>
                      </span>
                    </button>
                    <button
                      type="button"
                      class="switch-btn"
                      role="switch"
                      aria-checked={b.isActive}
                      aria-label={b.isActive ? 'إيقاف البانر' : 'تشغيل البانر'}
                      onClick={() => void post(`t-${b.id}`, `/api/app/banners/${encodeURIComponent(b.id)}/toggle`, { isActive: !b.isActive }, b.isActive ? 'البانر اتوقّف' : 'البانر اشتغل')}
                    >
                      <span class={`switch${b.isActive ? ' switch--on' : ''}${busy === `t-${b.id}` ? ' switch--busy' : ''}`}>
                        <span />
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <Sheet open={Boolean(form)} tall title={form?.id ? 'تعديل البانر' : 'بانر جديد'} onClose={() => setForm(null)}>
        {form && (
          <form
            class="np-form ops-form"
            onSubmit={async (e) => {
              e.preventDefault()
              if (!form.imageDesktop && !form.title.trim()) return setError('البانر محتاج صورة أو عنوان على الأقل')
              setError(null)
              const ok = await post('save', '/api/app/banners/save', form, form.id ? 'البانر اتحفظ' : 'البانر اتضاف لمتجرك')
              if (ok) setForm(null)
            }}
          >
            <div class="np-label">
              المكان
              <div class="chips">
                {placements.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    class={`fchip${form.placement === p.key ? ' fchip--on' : ''}`}
                    onClick={() => {
                      haptic('LIGHT')
                      setForm({ ...form, placement: p.key })
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <ImageSlot label="صورة الكمبيوتر (عريضة)" value={form.imageDesktop} onChange={(imageDesktop) => setForm((f) => (f ? { ...f, imageDesktop } : f))} />
            <ImageSlot label="صورة الموبايل (اختياري)" value={form.imageMobile} onChange={(imageMobile) => setForm((f) => (f ? { ...f, imageMobile } : f))} />
            <label class="np-label">
              العنوان
              <input class="np-input" value={form.title} maxLength={200} onInput={(e) => setForm({ ...form, title: (e.currentTarget as HTMLInputElement).value })} />
            </label>
            <label class="np-label">
              سطر توضيحي (اختياري)
              <input class="np-input" value={form.subtitle} maxLength={300} onInput={(e) => setForm({ ...form, subtitle: (e.currentTarget as HTMLInputElement).value })} />
            </label>
            <div class="np-two">
              <label class="np-label">
                نص الزرار
                <input class="np-input" placeholder="اطلب دلوقتي" value={form.ctaLabel} maxLength={60} onInput={(e) => setForm({ ...form, ctaLabel: (e.currentTarget as HTMLInputElement).value })} />
              </label>
              <label class="np-label">
                رابط الزرار
                <input class="np-input" dir="ltr" placeholder="/products" value={form.ctaUrl} maxLength={500} onInput={(e) => setForm({ ...form, ctaUrl: (e.currentTarget as HTMLInputElement).value })} />
              </label>
            </div>
            <div class="np-two">
              <label class="np-label">
                يبدأ (اختياري)
                <input class="np-input num" type="date" value={form.startsAt} onInput={(e) => setForm({ ...form, startsAt: (e.currentTarget as HTMLInputElement).value })} />
              </label>
              <label class="np-label">
                ينتهي (اختياري)
                <input class="np-input num" type="date" value={form.endsAt} onInput={(e) => setForm({ ...form, endsAt: (e.currentTarget as HTMLInputElement).value })} />
              </label>
            </div>
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
                <small>{form.isActive ? 'ظاهر في متجرك (في المواعيد اللي حدّدتها)' : 'متوقّف'}</small>
              </span>
              <span class={`switch${form.isActive ? ' switch--on' : ''}`}>
                <span />
              </span>
            </button>
            {error && <p class="np-error">{error}</p>}
            {confirmDelete ? (
              <div class="ex-confirm">
                <p class="sheet-text">هتحذف البانر ده خالص من متجرك.</p>
                <div class="btn-row">
                  <button type="button" class="btn btn--ghost press" onClick={() => setConfirmDelete(false)}>
                    رجوع
                  </button>
                  <button
                    type="button"
                    class="btn btn--danger press"
                    disabled={Boolean(busy)}
                    onClick={async () => {
                      if (!form.id) return
                      const ok = await post('delete', `/api/app/banners/${encodeURIComponent(form.id)}/delete`, {}, 'البانر اتحذف')
                      if (ok) setForm(null)
                    }}
                  >
                    {busy === 'delete' ? <span class="spinner" /> : <Icon svg={icons.trash()} />}
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
                  <button type="submit" class="btn btn--primary press" disabled={Boolean(busy)}>
                    {busy === 'save' ? <span class="spinner" /> : <Icon svg={icons.check()} />}
                    {form.id ? 'احفظ' : 'ضيف البانر'}
                  </button>
                </div>
                {form.id && (
                  <button type="button" class="btn btn--ghost btn--danger-text press" onClick={() => setConfirmDelete(true)}>
                    <Icon svg={icons.trash()} />
                    احذف البانر
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
