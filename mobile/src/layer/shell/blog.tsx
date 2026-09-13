/**
 * المدوّنة — شاشة أصلية.
 *
 * المقالات بصورة الغلاف والحالة والمشاهدات، ومفتاح نشر/إخفاء بدوسة. «مقال جديد» والدوسة
 * على مقال = لوحة كتابة: صورة الغلاف بالكاميرا أو المعرض، العنوان، المقدّمة، المحتوى،
 * الكاتب، الرابط (اختياري)، النشر، ومشاركة رابط المقال المنشور، والحذف بتأكيد.
 */
import { useRef, useState } from 'preact/hooks'
import { haptic, hapticNotify } from '../bridge'
import { toast } from '../dom'
import { icons } from '../icons'
import { formatNumber } from './format'
import { postAppJson, useResource } from './http'
import { blogData, type BlogPost } from './ops-api'
import { shrink, upload } from './product-new'
import { Screen, Sheet } from './screen'
import { Icon } from './ui'

type Form = {
  id: string | null
  title: string
  slug: string
  excerpt: string
  content: string
  cover: string | null
  author: string
  isPublished: boolean
}

const FILE_TEXT =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>'

export function BlogScreen({ visible, onUnavailable }: { visible: boolean; onUnavailable: () => void }) {
  const { data, failed, load } = useResource(blogData, visible, onUnavailable)
  const [form, setForm] = useState<Form | null>(null)
  const [editing, setEditing] = useState<BlogPost | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const camera = useRef<HTMLInputElement>(null)
  const gallery = useRef<HTMLInputElement>(null)

  const openForm = (p?: BlogPost) => {
    haptic('LIGHT')
    setError(null)
    setConfirmDelete(false)
    setEditing(p ?? null)
    setForm(
      p
        ? { id: p.id, title: p.title, slug: p.slug, excerpt: p.excerpt, content: p.content, cover: p.cover, author: p.author, isPublished: p.isPublished }
        : { id: null, title: '', slug: '', excerpt: '', content: '', cover: null, author: '', isPublished: false },
    )
  }

  const pickCover = async (input: HTMLInputElement) => {
    const file = input.files?.[0]
    input.value = ''
    if (!file || !form) return
    haptic('LIGHT')
    setUploading(true)
    const url = await upload(await shrink(file), 'misc')
    setUploading(false)
    if (!url) return void toast('الصورة ما اترفعتش — جرّب تاني', { tone: 'danger' })
    setForm((f) => (f ? { ...f, cover: url } : f))
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

  const save = async (e: Event) => {
    e.preventDefault()
    if (!form) return
    if (uploading) return void toast('استنى صورة الغلاف تخلص رفع')
    if (!form.title.trim()) return setError('اكتب عنوان المقال')
    setError(null)
    const ok = await post('save', '/api/app/blog/save', form, form.id ? 'المقال اتحفظ' : form.isPublished ? 'المقال اتنشر في متجرك' : 'المقال اتحفظ مسوّدة')
    if (ok) setForm(null)
  }

  const share = async (p: BlogPost) => {
    haptic('LIGHT')
    try {
      await navigator.share({ title: p.title, text: p.title, url: p.url })
    } catch {
      /* التاجر قفل شاشة المشاركة */
    }
  }

  const posts = data?.posts ?? []
  const published = posts.filter((p) => p.isPublished).length

  return (
    <Screen visible={visible} title="المدوّنة" onRefresh={load}>
      <div class="home-body">
        <header class="page-head rise">
          <div class="page-head-text">
            <h1 class="page-title">المدوّنة</h1>
            <p class="page-sub">
              {posts.length ? `${formatNumber(published)} منشور · ${formatNumber(posts.length - published)} مسوّدة` : 'مقالات بتجيبلك زوّار من جوجل من غير إعلانات'}
            </p>
          </div>
        </header>

        {!data ? (
          failed ? (
            <div class="empty">
              <span class="empty-icon">
                <Icon svg={icons.wifiOff()} />
              </span>
              <b>مش قادرين نجيب المقالات</b>
              <p>اتأكد من النت واسحب لتحت عشان تحاول تاني.</p>
            </div>
          ) : (
            <div class="olist">
              {[0, 1, 2].map((i) => (
                <span key={i} class="sk" style="height:96px;border-radius:20px" />
              ))}
            </div>
          )
        ) : (
          <>
            <button type="button" class="btn btn--primary btn--lg press rise ops-add" onClick={() => openForm()}>
              <Icon svg={icons.pencil()} />
              مقال جديد
            </button>

            {posts.length === 0 ? (
              <div class="empty empty--compact rise">
                <span class="empty-icon">
                  <Icon svg={FILE_TEXT} />
                </span>
                <b>مافيش مقالات</b>
                <p>اكتب عن منتجاتك وإزاي تُستخدم — المقالات بتجيبلك زوّار من جوجل.</p>
              </div>
            ) : (
              <div class="card ops-list rise">
                {posts.map((p) => (
                  <div key={p.id} class={`bl-row bg-row${p.isPublished ? '' : ' bg-row--draft'}`}>
                    <button type="button" class="bg-open press" onClick={() => openForm(p)}>
                      <span class="inv-thumb bg-thumb">{p.cover ? <img src={p.cover} alt="" loading="lazy" /> : <Icon svg={FILE_TEXT} />}</span>
                      <span class="bl-main">
                        <b>
                          {p.title}
                          {!p.isPublished && <span class="cr-off">مسوّدة</span>}
                        </b>
                        <small>
                          {p.publishedAt ? new Date(p.publishedAt).toLocaleDateString('ar-EG') : 'لسه ما اتنشرش'}
                          {p.views > 0 ? ` · ${formatNumber(p.views)} مشاهدة` : ''}
                        </small>
                      </span>
                    </button>
                    <button
                      type="button"
                      class="switch-btn"
                      role="switch"
                      aria-checked={p.isPublished}
                      aria-label={p.isPublished ? 'إخفاء المقال' : 'نشر المقال'}
                      onClick={() => void post(`t-${p.id}`, `/api/app/blog/${encodeURIComponent(p.id)}/toggle`, { isPublished: !p.isPublished }, p.isPublished ? 'المقال اتخفى' : 'المقال اتنشر')}
                    >
                      <span class={`switch${p.isPublished ? ' switch--on' : ''}${busy === `t-${p.id}` ? ' switch--busy' : ''}`}>
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

      <Sheet open={Boolean(form)} tall title={form?.id ? 'تعديل المقال' : 'مقال جديد'} onClose={() => setForm(null)}>
        {form && (
          <form class="np-form ops-form" onSubmit={save}>
            <div class="ct-image">
              <span class="ct-image-box bg-cover">
                {form.cover ? <img src={form.cover} alt="" /> : <Icon svg={icons.image()} />}
                {uploading && (
                  <span class="np-busy">
                    <span class="spinner" />
                  </span>
                )}
              </span>
              <span class="ct-image-actions">
                <b>صورة الغلاف</b>
                <span class="cr-actions">
                  <button type="button" class="act press" onClick={() => camera.current?.click()}>
                    صوّر
                  </button>
                  <button type="button" class="act press" onClick={() => gallery.current?.click()}>
                    من المعرض
                  </button>
                  {form.cover && (
                    <button type="button" class="ops-icon press" aria-label="شيل الغلاف" onClick={() => setForm({ ...form, cover: null })}>
                      <Icon svg={icons.x()} />
                    </button>
                  )}
                </span>
              </span>
              <input ref={camera} class="np-file" type="file" accept="image/*" capture="environment" onChange={(e) => void pickCover(e.currentTarget as HTMLInputElement)} />
              <input ref={gallery} class="np-file" type="file" accept="image/*" onChange={(e) => void pickCover(e.currentTarget as HTMLInputElement)} />
            </div>
            <label class="np-label">
              العنوان
              <input class="np-input" value={form.title} maxLength={200} onInput={(e) => setForm({ ...form, title: (e.currentTarget as HTMLInputElement).value })} />
            </label>
            <label class="np-label">
              مقدّمة قصيرة (بتظهر في قايمة المقالات وفي جوجل)
              <textarea class="np-input bg-excerpt" value={form.excerpt} maxLength={1000} onInput={(e) => setForm({ ...form, excerpt: (e.currentTarget as HTMLTextAreaElement).value })} />
            </label>
            <label class="np-label">
              المحتوى (سطر فاضي بيبدأ فقرة جديدة)
              <textarea class="np-input bg-content" value={form.content} onInput={(e) => setForm({ ...form, content: (e.currentTarget as HTMLTextAreaElement).value })} />
            </label>
            <div class="np-two">
              <label class="np-label">
                الكاتب
                <input class="np-input" value={form.author} maxLength={100} onInput={(e) => setForm({ ...form, author: (e.currentTarget as HTMLInputElement).value })} />
              </label>
              <label class="np-label">
                الرابط (اختياري)
                <input class="np-input" dir="ltr" placeholder="من العنوان" value={form.slug} maxLength={200} onInput={(e) => setForm({ ...form, slug: (e.currentTarget as HTMLInputElement).value })} />
              </label>
            </div>
            <button
              type="button"
              class="switch-row"
              onClick={() => {
                haptic('LIGHT')
                setForm({ ...form, isPublished: !form.isPublished })
              }}
            >
              <span class="switch-text">
                <b>منشور</b>
                <small>{form.isPublished ? 'العملاء بيشوفوه في مدوّنة متجرك' : 'مسوّدة — مش ظاهر لعملائك'}</small>
              </span>
              <span class={`switch${form.isPublished ? ' switch--on' : ''}`}>
                <span />
              </span>
            </button>
            {error && <p class="np-error">{error}</p>}
            {confirmDelete ? (
              <div class="ex-confirm">
                <p class="sheet-text">هتحذف «{form.title}» نهائيًا، ورابطه هيبطّل يفتح.</p>
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
                      const ok = await post('delete', `/api/app/blog/${encodeURIComponent(form.id)}/delete`, {}, 'المقال اتحذف')
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
                    {form.id ? 'احفظ' : form.isPublished ? 'انشر المقال' : 'احفظ مسوّدة'}
                  </button>
                </div>
                {editing && (
                  <div class="cr-actions">
                    {editing.isPublished && (
                      <button type="button" class="act press" onClick={() => void share(editing)}>
                        <Icon svg={icons.share()} />
                        شارك رابط المقال
                      </button>
                    )}
                    <button type="button" class="act act--danger press" onClick={() => setConfirmDelete(true)}>
                      <Icon svg={icons.trash()} />
                      احذف
                    </button>
                  </div>
                )}
              </>
            )}
          </form>
        )}
      </Sheet>
    </Screen>
  )
}
