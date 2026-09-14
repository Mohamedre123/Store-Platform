/**
 * النشر التلقائي — شاشة أصلية (`/dashboard/studio/schedules`).
 *
 * نفس `SchedulesManager` في اللوحة: الجداول بحالتها ونوعها («بينشر لوحده» / «بيستنّى موافقتك»)
 * والميعاد الجاي وآخر خطأ، ومفتاح تشغيل، «جرّبه» (بيعمل بوست دلوقتي)، تعديل، وحذف بتأكيد.
 * الفورم في لوحة: الأيام والساعة، ينشر عن إيه (كل المنتجات بالدور / قسم / منتجات بالبحث)،
 * صورة/كاروسيل/فيديو (بتنبيه التكلفة)، الشرايح، المقاس، المزوّد والموديل (من مفتاح التاجر)،
 * شكل الصورة، نبرة البوستات، ينشر فين، النشر من غير استئذان، والجدول شغّال.
 */
import { useEffect, useState } from 'preact/hooks'
import { haptic, hapticNotify } from '../bridge'
import { toast } from '../dom'
import { icons } from '../icons'
import { formatDateTime, formatNumber } from './format'
import { postAppJson, useResource } from './http'
import { navigate } from './navigate'
import { Screen, Sheet } from './screen'
import { schedulesData, type ModelsResult, type Schedule } from './studio-api'
import { Icon } from './ui'

type Draft = {
  id?: string
  name: string
  isActive: boolean
  days: number[]
  timeOfDay: string
  targets: string[]
  source: Schedule['source']
  categoryId: string | null
  productIds: string[]
  style: string | null
  preset: string
  media: Schedule['media']
  slides: number
  imageStyle: string
  aiProvider: string | null
  aiTextModel: string | null
  aiImageModel: string | null
  autoPublish: boolean
}

const empty = (): Draft => ({
  name: 'بوست يومي',
  isActive: true,
  /* كل يوم — التاجر بيشيل اللي مش عايزه أسهل من إنه يضيف سبعة */
  days: [0, 1, 2, 3, 4, 5, 6],
  timeOfDay: '10:00',
  targets: [],
  source: 'auto',
  categoryId: null,
  productIds: [],
  style: null,
  preset: 'portrait',
  media: 'image',
  slides: 5,
  imageStyle: 'auto',
  aiProvider: null,
  aiTextModel: null,
  aiImageModel: null,
  autoPublish: false,
})

const toDraft = (s: Schedule): Draft => ({
  id: s.id,
  name: s.name,
  isActive: s.isActive,
  days: s.days,
  timeOfDay: s.timeOfDay,
  targets: s.targets,
  source: s.source,
  categoryId: s.categoryId,
  productIds: s.productIds,
  style: s.style,
  preset: s.preset,
  media: s.media,
  slides: s.slides,
  imageStyle: s.imageStyle,
  aiProvider: s.aiProvider,
  aiTextModel: s.aiTextModel,
  aiImageModel: s.aiImageModel,
  autoPublish: s.autoPublish,
})

const SOURCES = [
  { key: 'auto' as const, label: 'كل منتجاتي بالدور', hint: 'بيلفّ عليها واحد ورا التاني' },
  { key: 'category' as const, label: 'قسم معيّن', hint: 'منتجات القسم بس' },
  { key: 'products' as const, label: 'منتجات أختارها', hint: 'اللي تحدّده إنت' },
]

const MEDIA = [
  { key: 'image' as const, label: 'صورة', hint: 'أسرع وأرخص' },
  { key: 'carousel' as const, label: 'كاروسيل', hint: 'شرايح مترابطة بتتسحب' },
  { key: 'video' as const, label: 'فيديو', hint: 'ريلز وتيك توك — بياخد دقايق' },
]

const PLAY_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="6 3 20 12 6 21 6 3"/></svg>'

/** نفس `describeSchedule` في `studio-meta.ts` */
function describe(weekdays: Array<{ day: number; label: string }>, days: number[], time: string): string {
  if (days.length === 0) return 'اختار يوم واحد على الأقل'
  if (days.length === 7) return `كل يوم الساعة ${time}`
  const names = weekdays.filter((w) => days.includes(w.day)).map((w) => w.label)
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join('، ')} و${names[names.length - 1]}`
  return `كل ${list} الساعة ${time}`
}

/** اختيار الموديل — القايمة من مفتاح التاجر نفسه (نفس `AiModelPicker`) */
function ModelPicker({
  provider,
  textModel,
  imageModel,
  showImage,
  onChange,
}: {
  provider: string | null
  textModel: string
  imageModel: string
  showImage: boolean
  onChange: (next: { textModel: string; imageModel: string }) => void
}) {
  const [state, setState] = useState<ModelsResult | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetch(`/api/app/schedules/models${provider ? `?provider=${encodeURIComponent(provider)}` : ''}`, {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { accept: 'application/json' },
    })
      .then((r) => r.json() as Promise<ModelsResult>)
      .catch((): ModelsResult => ({ ok: false, error: 'مقدرناش نجيب الموديلات — اتأكد من النت' }))
      .then((res) => {
        if (!alive) return
        setLoading(false)
        setState(res)
        /* موديل مزوّد تاني ما ينفعش يفضل مختار بعد تغيير المزوّد */
        if (res.ok) {
          const fitsText = !textModel || res.text.some((m) => m.id === textModel)
          const fitsImage = !imageModel || res.image.some((m) => m.id === imageModel)
          if (!fitsText || !fitsImage) onChange({ textModel: fitsText ? textModel : '', imageModel: fitsImage ? imageModel : '' })
        }
      })
    return () => {
      alive = false
    }
  }, [provider])

  if (state && !state.ok) return <p class="np-error">{state.error}</p>

  const select = (
    label: string,
    value: string,
    models: Array<{ id: string; label: string }>,
    fallback: string | null,
    autoText: string,
    set: (v: string) => void,
  ) => (
    <label class="np-label">
      {label}
      <select class="np-input" value={value} onChange={(e) => set((e.currentTarget as HTMLSelectElement).value)}>
        <option value="">{fallback ? `الافتراضي — ${fallback}` : autoText}</option>
        {value && !models.some((m) => m.id === value) && <option value={value}>{value}</option>}
        {models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>
    </label>
  )

  return (
    <div class="sc-models">
      {loading && <small class="pst-hint">بنجيب قايمة الموديلات…</small>}
      {select('موديل الكلام', textModel, state?.ok ? state.text : [], state?.ok ? state.defaultText : null, 'تلقائي', (v) =>
        onChange({ textModel: v, imageModel }),
      )}
      {showImage &&
        select('موديل الصور', imageModel, state?.ok ? state.image : [], state?.ok ? state.defaultImage : null, 'تلقائي — أول موديل صور شغّال', (v) =>
          onChange({ textModel, imageModel: v }),
        )}
    </div>
  )
}

export function SchedulesScreen({ visible, onUnavailable }: { visible: boolean; onUnavailable: () => void }) {
  const { data, failed, load } = useResource(schedulesData, visible, onUnavailable)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [removing, setRemoving] = useState<Schedule | null>(null)
  const [productQuery, setProductQuery] = useState('')

  const post = async (key: string, url: string, body: object, done: string | null, sheet = false) => {
    if (busy) return false
    haptic('LIGHT')
    setBusy(key)
    setError(null)
    const res = await postAppJson(url, body)
    if (!res.ok) {
      setBusy(null)
      hapticNotify('ERROR')
      if (sheet) setError(res.error)
      else toast(res.error, { tone: 'danger', duration: 4200 })
      return false
    }
    await load()
    setBusy(null)
    hapticNotify('SUCCESS')
    if (done) toast(done, { tone: 'success', duration: 2200 })
    return true
  }

  const open = (s?: Schedule) => {
    haptic('LIGHT')
    setError(null)
    setProductQuery('')
    setDraft(s ? toDraft(s) : empty())
  }

  const run = async (s: Schedule) => {
    const ok = await post(`run-${s.id}`, `/api/app/schedules/${encodeURIComponent(s.id)}/run`, {}, null)
    if (ok) toast('اتعمل — شوفه في البوستات', { tone: 'success', duration: 5000, action: { label: 'افتح', run: () => navigate('/dashboard/studio/posts') } })
  }

  const schedules = data?.schedules ?? []
  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d))
  const toggleIn = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id])
  const style = data?.styles.find((s) => s.key === draft?.imageStyle)
  const q = productQuery.trim()
  const products = (data?.products ?? []).filter((p) => !q || p.name.includes(q))

  return (
    <Screen visible={visible} title="النشر التلقائي" onRefresh={load}>
      <div class="home-body">
        <header class="page-head rise">
          <div class="page-head-text">
            <h1 class="page-title">النشر التلقائي</h1>
            <p class="page-sub">قوله كل يوم الساعة كام — وهو بيعمل البوست وينشره لوحده.</p>
          </div>
        </header>

        {!data ? (
          failed ? (
            <div class="empty">
              <span class="empty-icon">
                <Icon svg={icons.wifiOff()} />
              </span>
              <b>مش قادرين نجيب الجداول</b>
              <p>اتأكد من النت واسحب لتحت عشان تحاول تاني.</p>
            </div>
          ) : (
            <div class="olist">
              {[0, 1].map((i) => (
                <span key={i} class="sk" style="height:120px;border-radius:20px" />
              ))}
            </div>
          )
        ) : (
          <>
            {!data.studioEnabled && (
              <div class="np-note pst-gap">
                «استوديو المحتوى» مقفول من الإضافات — فعّله عشان الجداول تشتغل.
                <button type="button" class="act press pst-note-btn" onClick={() => navigate('/dashboard/plugins')}>
                  افتح الإضافات
                </button>
              </div>
            )}
            <p class="pst-hint sc-tz">بيتنفّذ بتوقيت متجرك ({data.timezone}).</p>
            <button type="button" class="btn btn--primary btn--lg press rise ops-add" onClick={() => open()}>
              <Icon svg={icons.plus()} />
              جدول جديد
            </button>

            {schedules.length === 0 ? (
              <div class="empty empty--compact rise">
                <span class="empty-icon">
                  <Icon svg={icons.clock()} />
                </span>
                <b>مفيش جداول</b>
                <p>ظبّط واحد وهو هيعمل بوست بصورة وكلام كل يوم في ميعاده — من غير ما تفتح حاجة.</p>
              </div>
            ) : (
              <div class="pst-list">
                {schedules.map((s) => (
                  <article key={s.id} class={`card sc-card rise${s.isActive ? '' : ' sc-card--off'}`}>
                    <div class="sc-head">
                      <span class="bl-main">
                        <b>{s.name}</b>
                        <span class="sc-pills">
                          {!s.isActive && <span class="pst-pill pst-pill--muted">متوقّف</span>}
                          {s.media === 'carousel' && <span class="pst-pill pst-pill--info">كاروسيل · {formatNumber(s.slides)}</span>}
                          {s.media === 'video' && <span class="pst-pill pst-pill--info">فيديو</span>}
                          {s.autoPublish ? (
                            <span class="pst-pill pst-pill--good">بينشر لوحده</span>
                          ) : (
                            <span class="pst-pill pst-pill--muted">بيستنّى موافقتك</span>
                          )}
                        </span>
                        <small>
                          {s.summary}
                          {s.nextRunAt ? ` · الجاي ${formatDateTime(s.nextRunAt)}` : ''}
                        </small>
                        {s.lastError && <small class="pst-err">{s.lastError}</small>}
                      </span>
                      <button
                        type="button"
                        class="switch-btn"
                        role="switch"
                        aria-checked={s.isActive}
                        aria-label={s.isActive ? 'وقّف الجدول' : 'شغّل الجدول'}
                        onClick={() => void post(`t-${s.id}`, '/api/app/schedules/save', { ...toDraft(s), isActive: !s.isActive }, s.isActive ? 'الجدول اتوقّف' : 'الجدول اشتغل')}
                      >
                        <span class={`switch${s.isActive ? ' switch--on' : ''}${busy === `t-${s.id}` ? ' switch--busy' : ''}`}>
                          <span />
                        </span>
                      </button>
                    </div>
                    <div class="pst-actions">
                      <button type="button" class="act press" disabled={Boolean(busy)} onClick={() => void run(s)}>
                        {busy === `run-${s.id}` ? <span class="spinner" /> : <Icon svg={PLAY_ICON} />}
                        {busy === `run-${s.id}` ? 'بيعمل البوست…' : 'جرّبه'}
                      </button>
                      <button type="button" class="act press" onClick={() => open(s)}>
                        تعديل
                      </button>
                      <button type="button" class="ops-icon press pst-del" aria-label={`احذف ${s.name}`} onClick={() => (haptic('LIGHT'), setRemoving(s))}>
                        <Icon svg={icons.trash()} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <Sheet open={Boolean(draft)} tall title={draft?.id ? 'تعديل الجدول' : 'جدول جديد'} onClose={() => setDraft(null)}>
        {draft && data && (
          <form
            class="np-form ops-form"
            onSubmit={async (e) => {
              e.preventDefault()
              if (draft.days.length === 0) return setError('اختار يوم واحد على الأقل')
              if (draft.autoPublish && draft.targets.length === 0) return setError('اختار حسابًا واحدًا على الأقل عشان النشر التلقائي يشتغل')
              const ok = await post('save', '/api/app/schedules/save', draft, draft.id ? 'اتحفظ' : 'الجدول اشتغل', true)
              if (ok) setDraft(null)
            }}
          >
            <label class="np-label">
              اسم الجدول
              <input class="np-input" value={draft.name} maxLength={60} onInput={(e) => set({ name: (e.currentTarget as HTMLInputElement).value })} />
            </label>

            <div class="np-label">
              امتى
              <div class="chips">
                {data.weekdays.map((w) => {
                  const on = draft.days.includes(w.day)
                  return (
                    <button
                      key={w.day}
                      type="button"
                      class={`fchip${on ? ' fchip--on' : ''}`}
                      onClick={() => {
                        haptic('LIGHT')
                        set({ days: on ? draft.days.filter((d) => d !== w.day) : [...draft.days, w.day].sort((a, b) => a - b) })
                      }}
                    >
                      {w.label}
                    </button>
                  )
                })}
              </div>
              <input class="np-input num sc-time" type="time" value={draft.timeOfDay} aria-label="الساعة" onInput={(e) => set({ timeOfDay: (e.currentTarget as HTMLInputElement).value })} />
              <small class="pv-hint">{describe(data.weekdays, draft.days, draft.timeOfDay)}</small>
            </div>

            <div class="np-label">
              ينشر عن إيه
              <div class="sc-options">
                {SOURCES.map((s) => (
                  <button key={s.key} type="button" class={`sc-option${draft.source === s.key ? ' sc-option--on' : ''}`} onClick={() => (haptic('LIGHT'), set({ source: s.key }))}>
                    <b>{s.label}</b>
                    <small>{s.hint}</small>
                  </button>
                ))}
              </div>
            </div>

            {draft.source === 'category' && (
              <label class="np-label">
                القسم
                <select class="np-input" value={draft.categoryId ?? ''} onChange={(e) => set({ categoryId: (e.currentTarget as HTMLSelectElement).value || null })}>
                  <option value="">اختار قسم…</option>
                  {data.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {draft.source === 'products' && (
              <div class="np-label">
                المنتجات <small class="pv-opt">({formatNumber(draft.productIds.length)} مختار)</small>
                <input class="np-input" placeholder="دوّر على منتج…" value={productQuery} onInput={(e) => setProductQuery((e.currentTarget as HTMLInputElement).value)} />
                <div class="sc-products">
                  {products.map((p) => {
                    const on = draft.productIds.includes(p.id)
                    return (
                      <button key={p.id} type="button" class={`sc-product${on ? ' sc-product--on' : ''}`} onClick={() => (haptic('LIGHT'), set({ productIds: toggleIn(draft.productIds, p.id) }))}>
                        <span class="inv-thumb">{p.image ? <img src={p.image} alt="" loading="lazy" /> : <Icon svg={icons.package()} />}</span>
                        <span class="sc-product-name">{p.name}</span>
                        {on && <Icon svg={icons.check()} />}
                      </button>
                    )
                  })}
                  {products.length === 0 && <small class="pst-hint">مفيش منتجات بالاسم ده.</small>}
                </div>
              </div>
            )}

            <div class="np-label">
              بيعمل إيه
              <div class="sc-options sc-options--row">
                {MEDIA.map((m) => (
                  <button key={m.key} type="button" class={`sc-option${draft.media === m.key ? ' sc-option--on' : ''}`} onClick={() => (haptic('LIGHT'), set({ media: m.key }))}>
                    <b>{m.label}</b>
                    <small>{m.hint}</small>
                  </button>
                ))}
              </div>
              {draft.media === 'video' && <small class="pv-hint sc-warn">الفيديو أغلى من الصورة بمراحل — راجع تسعير Veo عند جوجل قبل ما تخلّيه يومي</small>}
              {draft.media === 'carousel' && (
                <small class="pv-hint sc-warn">
                  كل شريحة صورة لوحدها — {formatNumber(draft.slides)} شرايح يوميًا يعني {formatNumber(draft.slides)} صور في اليوم على مفتاحك
                </small>
              )}
            </div>

            {draft.media === 'carousel' && (
              <div class="np-label">
                عدد الشرايح
                <div class="chips">
                  {[3, 4, 5, 6, 8, 10].map((n) => (
                    <button key={n} type="button" class={`fchip${draft.slides === n ? ' fchip--on' : ''}`} onClick={() => (haptic('LIGHT'), set({ slides: n }))}>
                      {formatNumber(n)}
                    </button>
                  ))}
                </div>
                <small class="pv-hint">الأولى غلاف، والأخيرة دعوة للطلب، واللي بينهم فوايد وتفاصيل</small>
              </div>
            )}

            <div class="np-label">
              {draft.media === 'video' ? 'مقاس الفيديو' : draft.media === 'carousel' ? 'مقاس الشرايح' : 'مقاس الصورة'}
              <div class="chips">
                {data.presets.map((p) => (
                  <button key={p.key} type="button" class={`fchip${draft.preset === p.key ? ' fchip--on' : ''}`} onClick={() => (haptic('LIGHT'), set({ preset: p.key }))}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {data.providers.length > 1 && (
              <div class="np-label">
                بيولّد بـ
                <div class="chips">
                  {[{ key: null as string | null, label: 'زي المساعد' }, ...data.providers].map((o) => (
                    <button key={o.key ?? 'default'} type="button" class={`fchip${draft.aiProvider === o.key ? ' fchip--on' : ''}`} onClick={() => (haptic('LIGHT'), set({ aiProvider: o.key }))}>
                      {o.label}
                    </button>
                  ))}
                </div>
                <small class="pv-hint">«زي المساعد» يعني نفس المزوّد اللي مختاره في شات المساعد</small>
              </div>
            )}

            {data.providers.length > 0 && (
              <div class="np-label">
                الموديل
                <ModelPicker
                  provider={draft.aiProvider}
                  textModel={draft.aiTextModel ?? ''}
                  imageModel={draft.aiImageModel ?? ''}
                  showImage={draft.media !== 'video'}
                  onChange={(next) => set({ aiTextModel: next.textModel || null, aiImageModel: next.imageModel || null })}
                />
                <small class="pv-hint">«الافتراضي» هو اللي في صفحة الإضافات. اختيارك هنا للجدول ده بس.</small>
              </div>
            )}

            <div class="np-label">
              شكل الصورة
              <div class="sc-styles">
                {data.styles.map((st) => (
                  <button key={st.key} type="button" class={`fchip${draft.imageStyle === st.key ? ' fchip--on' : ''}`} onClick={() => (haptic('LIGHT'), set({ imageStyle: st.key }))}>
                    {st.label}
                  </button>
                ))}
              </div>
              {style && <small class="pv-hint">{style.hint} — ولو كتبت شكل في «نبرة البوستات» تحت، هو اللي بيتنفّذ</small>}
            </div>

            <label class="np-label">
              نبرة البوستات (اختياري)
              <textarea
                class="np-input np-textarea"
                rows={3}
                maxLength={600}
                placeholder="مثال: خلّي الصور بخلفية فاتحة وبسيطة، والكلام قصير ومباشر، واذكر الشحن المجاني فوق ٥٠٠."
                value={draft.style ?? ''}
                onInput={(e) => set({ style: (e.currentTarget as HTMLTextAreaElement).value })}
              />
            </label>

            <div class="np-label">
              ينشر فين
              {data.accounts.length === 0 ? (
                <button type="button" class="act press" onClick={() => navigate('/dashboard/studio/accounts')}>
                  مفيش حسابات مربوطة — اربط صفحاتك
                </button>
              ) : (
                <div class="chips">
                  {data.accounts.map((a) => {
                    const on = draft.targets.includes(a.id)
                    return (
                      <button key={a.id} type="button" class={`fchip pst-account${on ? ' fchip--on' : ''}`} onClick={() => (haptic('LIGHT'), set({ targets: toggleIn(draft.targets, a.id) }))}>
                        <i style={{ background: a.color }} aria-hidden="true" />
                        {a.name}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <button type="button" class="switch-row" onClick={() => (haptic('LIGHT'), set({ autoPublish: !draft.autoPublish }))}>
              <span class="switch-text">
                <b>انشر لوحدك من غير ما تستأذنّي</b>
                <small>مقفول = البوست بيستنّاك في «البوستات» وتدوس نشر.</small>
              </span>
              <span class={`switch${draft.autoPublish ? ' switch--on' : ''}`}>
                <span />
              </span>
            </button>
            <button type="button" class="switch-row" onClick={() => (haptic('LIGHT'), set({ isActive: !draft.isActive }))}>
              <span class="switch-text">
                <b>الجدول شغّال</b>
              </span>
              <span class={`switch${draft.isActive ? ' switch--on' : ''}`}>
                <span />
              </span>
            </button>

            {error && <p class="np-error">{error}</p>}
            <div class="btn-row pv-sticky">
              <button type="button" class="btn btn--ghost press" onClick={() => setDraft(null)}>
                رجوع
              </button>
              <button type="submit" class="btn btn--primary press" disabled={Boolean(busy)}>
                {busy === 'save' ? <span class="spinner" /> : <Icon svg={icons.check()} />}
                {draft.id ? 'احفظ' : 'شغّل الجدول'}
              </button>
            </div>
          </form>
        )}
      </Sheet>

      <Sheet open={Boolean(removing)} title="تحذف الجدول؟" onClose={() => setRemoving(null)}>
        {removing && (
          <div class="np-form ops-form">
            <p class="sheet-text">هتحذف «{removing.name}» — مش هيعمل بوستات تاني. البوستات اللي عملها قبل كده بتفضل.</p>
            <div class="btn-row">
              <button type="button" class="btn btn--ghost press" onClick={() => setRemoving(null)}>
                رجوع
              </button>
              <button
                type="button"
                class="btn btn--danger press"
                disabled={Boolean(busy)}
                onClick={async () => {
                  const ok = await post('delete', `/api/app/schedules/${encodeURIComponent(removing.id)}/delete`, {}, 'الجدول اتحذف')
                  if (ok) setRemoving(null)
                }}
              >
                {busy === 'delete' ? <span class="spinner" /> : <Icon svg={icons.trash()} />}
                أيوه، احذفه
              </button>
            </div>
          </div>
        )}
      </Sheet>
    </Screen>
  )
}
