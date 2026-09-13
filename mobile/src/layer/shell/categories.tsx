/**
 * أقسام المنتجات — شاشة أصلية.
 *
 * الأقسام على مستويين زي اللوحة: القسم الرئيسي وتحته أقسامه الفرعية. كل
 * قسم بصورته وعدد منتجاته، والدوسة بتفتح لوحة التعديل: الصورة بالكاميرا أو
 * المعرض، الاسم، «تحت قسم»، الوصف، الظهور، والحذف بتأكيد.
 */
import { useRef, useState } from 'preact/hooks'
import { haptic, hapticNotify } from '../bridge'
import { toast } from '../dom'
import { icons } from '../icons'
import { assetUrl } from './api'
import { productFormData } from './business-api'
import { formatNumber } from './format'
import { postAppJson, useResource } from './http'
import { categoriesData, type Category } from './ops-api'
import { shrink, upload } from './product-new'
import { Screen, Sheet } from './screen'
import { Icon } from './ui'

type Form = {
  id: string | null
  name: string
  description: string
  image: string | null
  preview: string | null
  parentId: string
  isActive: boolean
}

export function CategoriesScreen({ visible, onUnavailable }: { visible: boolean; onUnavailable: () => void }) {
  const { data, failed, load } = useResource(categoriesData, visible, onUnavailable)
  const [form, setForm] = useState<Form | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const camera = useRef<HTMLInputElement>(null)
  const gallery = useRef<HTMLInputElement>(null)

  const editing = form?.id ? (data?.categories.find((c) => c.id === form.id) ?? null) : null
  const hasChildren = Boolean(form?.id && data?.categories.some((c) => c.parentId === form.id))

  const open = (c?: Category) => {
    haptic('LIGHT')
    setError(null)
    setConfirmDelete(false)
    setForm(
      c
        ? {
            id: c.id,
            name: c.name,
            description: c.description ?? '',
            image: c.image,
            preview: c.image ? (assetUrl(c.image) ?? c.image) : null,
            parentId: c.parentId ?? '',
            isActive: c.isActive,
          }
        : { id: null, name: '', description: '', image: null, preview: null, parentId: '', isActive: true },
    )
  }

  const pick = async (input: HTMLInputElement) => {
    const file = input.files?.[0]
    input.value = ''
    if (!file || !form) return
    haptic('LIGHT')
    const preview = URL.createObjectURL(file)
    setForm((f) => (f ? { ...f, preview } : f))
    setUploading(true)
    const url = await upload(await shrink(file), 'categories')
    setUploading(false)
    if (!url) {
      toast('الصورة ما اترفعتش — جرّب تاني', { tone: 'danger' })
      setForm((f) => (f ? { ...f, preview: f.image ? (assetUrl(f.image) ?? f.image) : null } : f))
      return
    }
    setForm((f) => (f ? { ...f, image: url } : f))
  }

  const finish = async (done: string) => {
    productFormData.clear()
    await load()
    setBusy(false)
    hapticNotify('SUCCESS')
    toast(done, { tone: 'success', duration: 1800 })
    setForm(null)
  }

  const save = async (e: Event) => {
    e.preventDefault()
    if (!form || busy) return
    if (uploading) return void toast('استنى الصورة تخلص رفع')
    if (form.name.trim().length < 2) return setError('اكتب اسم القسم')
    setError(null)
    setBusy(true)
    const res = await postAppJson('/api/app/categories/save', {
      id: form.id,
      name: form.name,
      description: form.description,
      image: form.image ?? '',
      parentId: hasChildren ? '' : form.parentId,
      isActive: form.isActive,
    })
    if (!res.ok) {
      setBusy(false)
      hapticNotify('ERROR')
      setError(res.error)
      return
    }
    await finish(form.id ? 'القسم اتحفظ' : 'القسم اتضاف')
  }

  const remove = async () => {
    if (!form?.id || busy) return
    setBusy(true)
    const res = await postAppJson(`/api/app/categories/${encodeURIComponent(form.id)}/delete`)
    if (!res.ok) {
      setBusy(false)
      hapticNotify('ERROR')
      setError(res.error)
      return
    }
    await finish('القسم اتمسح')
  }

  const roots = (data?.categories ?? []).filter((c) => !c.parentId && c.id !== form?.id)

  return (
    <Screen visible={visible} title="الأقسام" onRefresh={load}>
      <div class="home-body">
        <header class="page-head rise">
          <div class="page-head-text">
            <h1 class="page-title">الأقسام</h1>
            <p class="page-sub">
              {data?.categories.length ? `${formatNumber(data.categories.length)} قسم` : 'قسّم منتجاتك عشان العميل يلاقي اللي بيدوّر عليه'}
            </p>
          </div>
        </header>

        {!data ? (
          failed ? (
            <div class="empty">
              <span class="empty-icon">
                <Icon svg={icons.wifiOff()} />
              </span>
              <b>مش قادرين نجيب الأقسام</b>
              <p>اتأكد من النت واسحب لتحت عشان تحاول تاني.</p>
            </div>
          ) : (
            <div class="olist">
              {[0, 1, 2].map((i) => (
                <span key={i} class="sk" style="height:72px;border-radius:20px" />
              ))}
            </div>
          )
        ) : (
          <>
            <button type="button" class="btn btn--primary btn--lg press rise ops-add" onClick={() => open()}>
              <Icon svg={icons.plus()} />
              قسم جديد
            </button>

            {data.categories.length === 0 ? (
              <div class="empty empty--compact rise">
                <span class="empty-icon">
                  <Icon svg={icons.layers()} />
                </span>
                <b>لسه مافيش أقسام</b>
                <p>الأقسام بتساعد العميل يلاقي اللي بيدوّر عليه بسرعة — وتقدر تحطّ قسم جوّه قسم.</p>
              </div>
            ) : (
              <div class="card ops-list rise">
                {data.categories.map((c) => (
                  <button key={c.id} type="button" class={`bl-row ct-row press${c.parentId ? ' ct-row--child' : ''}`} onClick={() => open(c)}>
                    <span class="inv-thumb">
                      {c.image ? <img src={assetUrl(c.image) ?? c.image} alt="" loading="lazy" /> : <Icon svg={icons.layers()} />}
                    </span>
                    <span class="bl-main">
                      <b>
                        {c.name}
                        {!c.isActive && <span class="cr-off">مخفي</span>}
                      </b>
                      <small>
                        {c.parentName ? `جوّه ${c.parentName} · ` : ''}
                        {formatNumber(c.productCount)} منتج
                      </small>
                    </span>
                    <Icon svg={icons.chevronLeft()} className="ic an-chev" />
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <Sheet open={Boolean(form)} tall title={form?.id ? 'تعديل القسم' : 'قسم جديد'} onClose={() => setForm(null)}>
        {form && (
          <form class="np-form ops-form" onSubmit={save}>
            <div class="ct-image">
              <span class="ct-image-box">
                {form.preview ? <img src={form.preview} alt="" /> : <Icon svg={icons.image()} />}
                {uploading && (
                  <span class="np-busy">
                    <span class="spinner" />
                  </span>
                )}
              </span>
              <span class="ct-image-actions">
                <b>صورة القسم</b>
                <span class="cr-actions">
                  <button type="button" class="act press" onClick={() => camera.current?.click()}>
                    صوّر
                  </button>
                  <button type="button" class="act press" onClick={() => gallery.current?.click()}>
                    من المعرض
                  </button>
                  {form.preview && (
                    <button
                      type="button"
                      class="ops-icon press"
                      aria-label="شيل الصورة"
                      onClick={() => setForm({ ...form, image: null, preview: null })}
                    >
                      <Icon svg={icons.x()} />
                    </button>
                  )}
                </span>
              </span>
              <input ref={camera} class="np-file" type="file" accept="image/*" capture="environment" onChange={(e) => void pick(e.currentTarget as HTMLInputElement)} />
              <input ref={gallery} class="np-file" type="file" accept="image/*" onChange={(e) => void pick(e.currentTarget as HTMLInputElement)} />
            </div>
            <label class="np-label">
              اسم القسم
              <input
                class="np-input"
                value={form.name}
                maxLength={120}
                onInput={(e) => setForm({ ...form, name: (e.currentTarget as HTMLInputElement).value })}
              />
            </label>
            <div class="np-label">
              تحت قسم
              {hasChildren ? (
                <p class="np-note">القسم ده جوّاه أقسام فرعية، فبيفضل قسم رئيسي.</p>
              ) : (
                <div class="chips chips--scroll">
                  {[{ id: '', name: 'قسم رئيسي' }, ...roots].map((c) => (
                    <button
                      key={c.id || 'root'}
                      type="button"
                      class={`fchip${form.parentId === c.id ? ' fchip--on' : ''}`}
                      onClick={() => {
                        haptic('LIGHT')
                        setForm({ ...form, parentId: c.id })
                      }}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <label class="np-label">
              الوصف (اختياري — بيظهر أعلى صفحة القسم)
              <textarea
                class="np-input"
                value={form.description}
                onInput={(e) => setForm({ ...form, description: (e.currentTarget as HTMLTextAreaElement).value })}
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
                <b>ظاهر في المتجر</b>
                <small>{form.isActive ? 'العملاء بيشوفوه في قايمة الأقسام' : 'مخفي عن العملاء'}</small>
              </span>
              <span class={`switch${form.isActive ? ' switch--on' : ''}`}>
                <span />
              </span>
            </button>
            {error && <p class="np-error">{error}</p>}
            {confirmDelete ? (
              <div class="ex-confirm">
                <p class="sheet-text">
                  هتمسح «{form.name}».
                  {editing?.productCount ? ` الـ${formatNumber(editing.productCount)} منتج اللي فيه هيفضلوا موجودين بس من غير قسم.` : ''} متأكد؟
                </p>
                <div class="btn-row">
                  <button type="button" class="btn btn--ghost press" onClick={() => setConfirmDelete(false)}>
                    رجوع
                  </button>
                  <button type="button" class="btn btn--danger press" disabled={busy} onClick={() => void remove()}>
                    {busy ? <span class="spinner" /> : <Icon svg={icons.trash()} />}
                    أيوه، امسحه
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
                    {form.id ? 'احفظ' : 'ضيف القسم'}
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
                    امسح القسم
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
