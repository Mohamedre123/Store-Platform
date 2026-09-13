/**
 * منتج جديد وتعديل منتج — شاشة أصلية بالكاميرا.
 *
 * التاجر ماسك المنتج في إيده: بيصوّره من الشاشة دي على طول (أو يختار من
 * المعرض)، يكتب الاسم والسعر والكمية، ويدوس «انشر». الصور بتتصغّر على
 * الموبايل قبل الرفع (صورة الكاميرا ٤–٨ ميجا) فالرفع بياخد ثواني مش دقايق،
 * وبتترفع وهو بيكتب — مش بعد ما يدوس حفظ.
 *
 * نفس الشاشة بتعدّل منتج موجود (`/dashboard/products/:id?edit=1`): بتتعبّى
 * من `/api/app/products/:id/edit`، وأي صورة تتحط غلاف بدوسة. الحفظ بيعدّي
 * على فعل اللوحة نفسه، والخادم بيحافظ على المقاسات والسيو والتكلفة زي ما هم.
 */
import { useEffect, useRef, useState } from 'preact/hooks'
import { haptic, hapticNotify } from '../bridge'
import { toast } from '../dom'
import { icons } from '../icons'
import { assetUrl } from './api'
import { productFormData } from './business-api'
import { postAppJson, useResource } from './http'
import { navigate } from './navigate'
import { clearProductsCache, productDetails, type ProductDetail } from './products-api'
import { Screen, Sheet } from './screen'
import { Icon } from './ui'

const MAX_PHOTOS = 8

const CAMERA =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>'

/** `local` = صورة اتصوّرت دلوقتي (معاينتها blob لازم يتفك) */
type Photo = { key: string; preview: string; url: string | null; failed: boolean; local: boolean }

type EditPayload = {
  currency: string
  hasVariants: boolean
  product: {
    id: string
    name: string
    price: string
    compareAtPrice: string
    stock: string
    trackInventory: boolean
    categoryId: string
    description: string
    status: 'active' | 'draft'
    images: string[]
  }
}

const toLatin = (s: string) => s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[٫,]/g, '.')

/** أقصى ضلع ١٦٠٠ بكسل JPEG — كفاية لصفحة المنتج وأخف ١٠ مرات من صورة الكاميرا */
async function shrink(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height))
    if (scale === 1 && file.size < 1_500_000) return file
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86))
    if (!blob) return file
    return new File([blob], `${(file.name || 'photo').replace(/\.[^.]+$/, '')}.jpg`, { type: 'image/jpeg' })
  } catch {
    return file
  }
}

async function upload(file: File): Promise<string | null> {
  const body = new FormData()
  body.append('file', file)
  body.append('folder', 'products')
  try {
    const res = await fetch('/api/upload', { method: 'POST', body, credentials: 'same-origin' })
    const data = (await res.json().catch(() => null)) as { url?: string } | null
    return data?.url ?? null
  } catch {
    return null
  }
}

export function NewProductScreen({ visible, onUnavailable }: { visible: boolean; onUnavailable: () => void }) {
  return <ProductEditor visible={visible} productId={null} onUnavailable={onUnavailable} />
}

export function EditProductScreen({
  visible,
  productId,
  onUnavailable,
}: {
  visible: boolean
  productId: string | null
  onUnavailable: () => void
}) {
  return <ProductEditor visible={visible} productId={productId} editing onUnavailable={onUnavailable} />
}

function ProductEditor({
  visible,
  productId,
  editing = false,
  onUnavailable,
}: {
  visible: boolean
  productId: string | null
  editing?: boolean
  onUnavailable: () => void
}) {
  const { data } = useResource(productFormData, visible, onUnavailable, 5 * 60_000)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [compareAt, setCompareAt] = useState('')
  const [track, setTrack] = useState(true)
  const [stock, setStock] = useState('1')
  const [categoryId, setCategoryId] = useState('')
  const [description, setDescription] = useState('')
  const [publish, setPublish] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pickCategory, setPickCategory] = useState(false)
  /* تعديل: المنتج اللي بياناته معبّية الفورم دلوقتي، وهل ليه مقاسات */
  const [shownId, setShownId] = useState<string | null>(null)
  const [hasVariants, setHasVariants] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const fetchedFor = useRef<string | null>(null)
  const camera = useRef<HTMLInputElement>(null)
  const gallery = useRef<HTMLInputElement>(null)

  const releasePhotos = (list: Photo[]) => list.forEach((p) => p.local && URL.revokeObjectURL(p.preview))

  const reset = () => {
    releasePhotos(photos)
    setPhotos([])
    setName('')
    setPrice('')
    setCompareAt('')
    setTrack(true)
    setStock('1')
    setCategoryId('')
    setDescription('')
    setPublish(true)
    setError(null)
  }

  const loadEdit = async (id: string) => {
    setLoadFailed(false)
    try {
      const res = await fetch(`/api/app/products/${encodeURIComponent(id)}/edit`, {
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { accept: 'application/json' },
      })
      const isJson = (res.headers.get('content-type') ?? '').includes('application/json')
      /* المسار لسه مش منشور على الموقع — فورم المنصة بيظهر بداله */
      if (!isJson && (res.status === 404 || res.ok)) return onUnavailable()
      if (res.status === 404) {
        toast('المنتج ده مش موجود', { tone: 'danger' })
        return navigate('/dashboard/products', { replace: true })
      }
      if (!res.ok) throw new Error('bad')
      const body = (await res.json()) as EditPayload
      if (fetchedFor.current !== id) return
      const p = body.product
      setPhotos((old) => {
        releasePhotos(old)
        return p.images.map((url, i) => ({ key: `${i}-${url}`, preview: assetUrl(url) ?? url, url, failed: false, local: false }))
      })
      setName(p.name)
      setPrice(p.price)
      setCompareAt(p.compareAtPrice)
      setTrack(p.trackInventory)
      setStock(p.stock)
      setCategoryId(p.categoryId)
      setDescription(p.description)
      setPublish(p.status === 'active')
      setHasVariants(body.hasVariants)
      setError(null)
      setShownId(id)
    } catch {
      if (fetchedFor.current === id) {
        fetchedFor.current = null
        setLoadFailed(true)
      }
    }
  }

  /* كل مرة شاشة التعديل تتفتح بتجيب آخر نسخة من المنتج */
  useEffect(() => {
    if (!editing || !productId) return
    if (!visible) {
      fetchedFor.current = null
      return
    }
    if (fetchedFor.current === productId) return
    fetchedFor.current = productId
    void loadEdit(productId)
  }, [editing, visible, productId])

  const addFiles = async (input: HTMLInputElement) => {
    const files = Array.from(input.files ?? []).slice(0, Math.max(0, MAX_PHOTOS - photos.length))
    input.value = ''
    if (!files.length) return
    haptic('LIGHT')
    for (const file of files) {
      const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`
      setPhotos((list) => [...list, { key, preview: URL.createObjectURL(file), url: null, failed: false, local: true }])
      const url = await upload(await shrink(file))
      setPhotos((list) => list.map((p) => (p.key === key ? { ...p, url, failed: !url } : p)))
      if (!url) toast('صورة ما اترفعتش — شيلها وجرّب تاني', { tone: 'danger' })
    }
  }

  const remove = (key: string) => {
    haptic('LIGHT')
    setPhotos((list) => {
      const target = list.find((p) => p.key === key)
      if (target?.local) URL.revokeObjectURL(target.preview)
      return list.filter((p) => p.key !== key)
    })
  }

  const makeCover = (key: string) => {
    haptic('LIGHT')
    setPhotos((list) => {
      const target = list.find((p) => p.key === key)
      return target ? [target, ...list.filter((p) => p.key !== key)] : list
    })
  }

  const uploading = photos.some((p) => !p.url && !p.failed)
  const category = data?.categories.find((c) => c.id === categoryId) ?? null
  const ready = !editing || (Boolean(productId) && shownId === productId)

  const leave = () => {
    if (editing && productId) {
      if (history.length > 1) history.back()
      else navigate(`/dashboard/products/${productId}`, { replace: true })
    } else navigate('/dashboard/products', { replace: true })
  }

  const save = async () => {
    if (saving || !ready) return
    if (uploading) {
      toast('استنى الصور تخلص رفع')
      return
    }
    if (name.trim().length < 2) return setError('اكتب اسم المنتج')
    if (!(Number(toLatin(price)) > 0)) return setError('اكتب سعر المنتج')
    setError(null)
    setSaving(true)
    haptic('MEDIUM')
    const id = editing ? productId : null
    const res = await postAppJson<{ detail?: ProductDetail | null }>(
      id ? `/api/app/products/${encodeURIComponent(id)}/edit` : '/api/app/products/new',
      {
        name,
        price: toLatin(price),
        compareAtPrice: toLatin(compareAt),
        trackInventory: track,
        stock: track ? toLatin(stock) : '',
        categoryId,
        description,
        status: publish ? 'active' : 'draft',
        images: photos.filter((p) => p.url).map((p) => p.url),
      },
    )
    setSaving(false)
    if (!res.ok) {
      hapticNotify('ERROR')
      setError(res.error)
      return
    }
    hapticNotify('SUCCESS')
    clearProductsCache()
    if (id) {
      if (res.data.detail) productDetails.set(id, res.data.detail)
      toast('التعديلات اتحفظت', { tone: 'success', duration: 2200 })
      fetchedFor.current = null
      leave()
      return
    }
    toast(publish ? 'المنتج اتنشر في متجرك 🎉' : 'المنتج اتحفظ مسوّدة', { tone: 'success', duration: 3000 })
    reset()
    navigate('/dashboard/products', { replace: true })
  }

  const title = editing ? 'تعديل المنتج' : 'منتج جديد'

  return (
    <Screen
      visible={visible}
      kind="detail"
      title={title}
      onBack={leave}
      resetKey={editing ? productId : null}
      overlay={
        ready ? (
          <div class="np-save">
            <button type="button" class="btn btn--primary btn--lg press" disabled={saving} onClick={() => void save()}>
              {saving ? <span class="spinner" /> : <Icon svg={icons.check()} />}
              {editing ? 'احفظ التعديلات' : publish ? 'انشر المنتج' : 'احفظ مسوّدة'}
            </button>
          </div>
        ) : null
      }
    >
      <div class="home-body np-body">
        <header class="d-head rise">
          <h1 class="page-title">{title}</h1>
          <p class="page-sub">{editing ? (ready ? name || 'غيّر السعر والصور والكمية' : 'بنجيب بيانات المنتج…') : 'صوّره واكتب سعره — وينزل متجرك على طول'}</p>
        </header>

        {!ready ? (
          loadFailed ? (
            <div class="empty">
              <span class="empty-icon">
                <Icon svg={icons.wifiOff()} />
              </span>
              <b>مش قادرين نجيب بيانات المنتج</b>
              <p>اتأكد من النت وجرّب تاني.</p>
              <button
                type="button"
                class="btn btn--primary press"
                onClick={() => {
                  if (!productId) return
                  fetchedFor.current = productId
                  void loadEdit(productId)
                }}
              >
                <Icon svg={icons.refresh()} />
                جرّب تاني
              </button>
            </div>
          ) : (
            <div class="stack" aria-busy="true">
              <span class="sk" style="height:150px;border-radius:22px" />
              <span class="sk" style="height:260px;border-radius:22px" />
              <span class="sk" style="height:160px;border-radius:22px" />
            </div>
          )
        ) : (
          <>
            <section class="card sec rise">
              <div class="an-head">
                <b>الصور</b>
                <span>
                  {photos.length}/{MAX_PHOTOS} · الأولى هي الغلاف
                </span>
              </div>
              <div class="np-grid">
                {photos.map((p, i) => (
                  <div key={p.key} class="np-photo">
                    <img src={p.preview} alt="" />
                    {!p.url && !p.failed && (
                      <span class="np-busy">
                        <span class="spinner" />
                      </span>
                    )}
                    {p.failed && <span class="np-failed">ما اترفعتش</span>}
                    {i === 0 && p.url && <span class="np-cover">الغلاف</span>}
                    {i > 0 && p.url && (
                      <button type="button" class="np-makecover" onClick={() => makeCover(p.key)}>
                        خليها الغلاف
                      </button>
                    )}
                    <button type="button" class="np-remove" aria-label="شيل الصورة" onClick={() => remove(p.key)}>
                      <Icon svg={icons.x()} />
                    </button>
                  </div>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <>
                    <button type="button" class="np-add press" onClick={() => camera.current?.click()}>
                      <Icon svg={CAMERA} />
                      صوّر
                    </button>
                    <button type="button" class="np-add press" onClick={() => gallery.current?.click()}>
                      <Icon svg={icons.image()} />
                      من المعرض
                    </button>
                  </>
                )}
              </div>
              <input
                ref={camera}
                class="np-file"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => void addFiles(e.currentTarget as HTMLInputElement)}
              />
              <input
                ref={gallery}
                class="np-file"
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => void addFiles(e.currentTarget as HTMLInputElement)}
              />
            </section>

            <section class="card sec np-form rise">
              <label class="np-label">
                اسم المنتج
                <input
                  class="np-input"
                  type="text"
                  placeholder="مثلًا: فستان سهرة ستان"
                  value={name}
                  onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)}
                />
              </label>
              <div class="np-two">
                <label class="np-label">
                  السعر ({data?.currency === 'EGP' || !data ? 'ج.م' : data.currency})
                  <input
                    class="np-input num"
                    type="text"
                    inputMode="decimal"
                    placeholder="٠"
                    value={price}
                    onInput={(e) => setPrice((e.currentTarget as HTMLInputElement).value)}
                  />
                </label>
                <label class="np-label">
                  قبل الخصم (اختياري)
                  <input
                    class="np-input num"
                    type="text"
                    inputMode="decimal"
                    placeholder="—"
                    value={compareAt}
                    onInput={(e) => setCompareAt((e.currentTarget as HTMLInputElement).value)}
                  />
                </label>
              </div>
              <label class="np-label">
                الوصف (اختياري)
                <textarea
                  class="np-input"
                  placeholder="الخامة، المقاسات، أي تفاصيل تهم العميل"
                  value={description}
                  onInput={(e) => setDescription((e.currentTarget as HTMLTextAreaElement).value)}
                />
              </label>
            </section>

            <section class="card sec np-form rise">
              <button
                type="button"
                class="switch-row"
                onClick={() => {
                  haptic('LIGHT')
                  setTrack(!track)
                }}
              >
                <span class="switch-text">
                  <b>تتبّع المخزون</b>
                  <small>الكمية بتقل مع كل طلب، والمنتج بيقفل لما يخلص</small>
                </span>
                <span class={`switch${track ? ' switch--on' : ''}`}>
                  <span />
                </span>
              </button>
              {track &&
                (editing && hasVariants ? (
                  <p class="np-note">المنتج ده ليه مقاسات أو ألوان — الكمية بتتعدّل لكل واحدة من شاشة «المخزون».</p>
                ) : (
                  <label class="np-label">
                    الكمية المتاحة
                    <input
                      class="np-input num"
                      type="text"
                      inputMode="numeric"
                      value={stock}
                      onInput={(e) => setStock((e.currentTarget as HTMLInputElement).value)}
                    />
                  </label>
                ))}
              <div class="np-label">
                القسم
                <button
                  type="button"
                  class="np-pick press"
                  onClick={() => {
                    haptic('LIGHT')
                    setPickCategory(true)
                  }}
                >
                  <span>{category?.name ?? 'من غير قسم'}</span>
                  <Icon svg={icons.chevronDown()} />
                </button>
              </div>
              <button
                type="button"
                class="switch-row"
                onClick={() => {
                  haptic('LIGHT')
                  setPublish(!publish)
                }}
              >
                <span class="switch-text">
                  <b>{editing ? 'ظاهر في المتجر' : 'ينزل المتجر على طول'}</b>
                  <small>{publish ? 'العملاء هيشوفوه ويقدروا يطلبوه' : 'هيتحفظ مسوّدة مخفية لحد ما تنشره'}</small>
                </span>
                <span class={`switch${publish ? ' switch--on' : ''}`}>
                  <span />
                </span>
              </button>
            </section>

            {error && <p class="np-error rise">{error}</p>}

            <button
              type="button"
              class="an-link press rise"
              onClick={() => navigate(editing && productId ? `/dashboard/products/${productId}?web=1` : '/dashboard/products/new?web=1')}
            >
              <Icon svg={icons.layers()} />
              <span>
                مقاسات وألوان وسيو
                <small>
                  {editing ? 'من صفحة المنتج الكاملة — احفظ تعديلاتك هنا الأول' : 'من صفحة المنتج الكاملة — اللي كتبته هنا مش هيتنقل'}
                </small>
              </span>
              <Icon svg={icons.chevronLeft()} className="ic an-chev" />
            </button>
          </>
        )}
      </div>

      <Sheet open={pickCategory} title="القسم" onClose={() => setPickCategory(false)}>
        <div class="sheet-list">
          {[{ id: '', name: 'من غير قسم' }, ...(data?.categories ?? [])].map((c) => (
            <button
              key={c.id || 'none'}
              type="button"
              class={`sheet-row${c.id === categoryId ? ' sheet-row--on' : ''}`}
              onClick={() => {
                haptic('LIGHT')
                setCategoryId(c.id)
                setPickCategory(false)
              }}
            >
              <span class="sheet-row-label">{c.name}</span>
              {c.id === categoryId && <Icon svg={icons.check()} className="ic sheet-check" />}
            </button>
          ))}
        </div>
      </Sheet>
    </Screen>
  )
}
