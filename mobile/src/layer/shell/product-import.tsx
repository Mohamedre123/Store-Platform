/**
 * استيراد المنتجات — شاشة أصلية (`/dashboard/products/import`).
 *
 * نفس صفحة اللوحة بطريقتيها:
 * - **من منصتك القديمة** (شوبيفاي/ووكومرس/إيزي أوردرز): اختار المنصة ← الخطوات بأسماء شاشاتهم ← الصق المفاتيح ←
 *   «هات منتجاتي» ← النتيجة (اتقروا/اتضافوا مسوّدات/اتخطّوا/أقسام جديدة). المفاتيح بتتستعمل مرة وبتتنسى.
 * - **ملف CSV**: اختار الملف ← ربط الأعمدة (مخمَّن ويتغيّر) ← معاينة أول ٥ ومشاكل الصفوف ← «استورد X منتج».
 *   الملف بيتقري على الخادم بنفس دوال اللوحة (`/api/app/product-import/preview`) وما بيتكتبش غير بعد التأكيد.
 */
import { useRef, useState } from 'preact/hooks'
import { haptic, hapticNotify } from '../bridge'
import { toast } from '../dom'
import { icons } from '../icons'
import { clearProductsCache } from './products-api'
import { formatMoney, formatNumber } from './format'
import { importData, type ImportSource } from './growth-api'
import { postAppJson, useResource } from './http'
import { navigate } from './navigate'
import { Screen } from './screen'
import { Group, LoadState } from './settings-forms'
import { Icon } from './ui'

/* نفس `FIELDS` في `import-wizard.tsx` */
const FIELDS: Array<{ key: string; label: string; required?: boolean }> = [
  { key: 'name', label: 'اسم المنتج', required: true },
  { key: 'price', label: 'السعر', required: true },
  { key: 'compareAtPrice', label: 'السعر قبل الخصم' },
  { key: 'costPrice', label: 'التكلفة' },
  { key: 'sku', label: 'الكود (SKU)' },
  { key: 'stock', label: 'الكمية' },
  { key: 'category', label: 'القسم' },
  { key: 'brand', label: 'الماركة' },
  { key: 'description', label: 'الوصف' },
  { key: 'image', label: 'رابط الصورة' },
]

type Item = { name: string; price: number; stock: number; category: string | null; image: string | null }
type Preview = { header: string[]; columns: Record<string, number>; items: Item[]; issues: Array<{ line: number; reason: string }>; issueCount: number }
type Result = { created: number; skipped: number; categories: number; fetched?: number; source?: string }

const fieldCount = (n: number) => (n === 1 ? 'حقل واحد' : n === 2 ? 'حقلين' : `${formatNumber(n)} حقول`)

export function ProductImportScreen({ visible, onUnavailable }: { visible: boolean; onUnavailable: () => void }) {
  const { data, failed, load } = useResource(importData, visible, onUnavailable, 5 * 60_000)
  const [source, setSource] = useState<ImportSource | null>(null)
  const [creds, setCreds] = useState<Record<string, string>>({})
  const [text, setText] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const file = useRef<HTMLInputElement>(null)

  const reset = () => {
    setSource(null)
    setCreds({})
    setText(null)
    setFileName('')
    setPreview(null)
    setError(null)
    setResult(null)
  }

  const runPreview = async (csv: string, columns?: Record<string, number>) => {
    setBusy('preview')
    setError(null)
    const res = await postAppJson<Preview>('/api/app/product-import/preview', { text: csv, columns })
    setBusy(null)
    if (!res.ok) {
      hapticNotify('ERROR')
      setError(res.error)
      return
    }
    setPreview(res.data)
  }

  const pickFile = async (input: HTMLInputElement) => {
    const f = input.files?.[0]
    input.value = ''
    if (!f) return
    if (f.size > 4 * 1024 * 1024) {
      setError('الملف أكبر من ٤ ميجا. قسّمه لملفات أصغر.')
      return
    }
    const csv = await f.text()
    setFileName(f.name)
    setText(csv)
    setResult(null)
    await runPreview(csv)
  }

  const finish = (r: Result) => {
    hapticNotify('SUCCESS')
    clearProductsCache()
    setResult(r)
    toast(`اتضاف ${formatNumber(r.created)} منتج`, { tone: 'success', duration: 2600 })
  }

  const importCsv = async () => {
    if (!preview || busy) return
    setBusy('csv')
    setError(null)
    const res = await postAppJson<Result>('/api/app/product-import/csv', { rows: preview.items })
    setBusy(null)
    if (!res.ok) {
      hapticNotify('ERROR')
      setError(res.error)
      return
    }
    finish(res.data)
  }

  const importApi = async () => {
    if (!source || busy) return
    setBusy('api')
    setError(null)
    const res = await postAppJson<Result>('/api/app/product-import/api', { source: source.key, credentials: creds })
    setBusy(null)
    if (!res.ok) {
      hapticNotify('ERROR')
      setError(res.error)
      return
    }
    finish({ ...res.data, source: source.name })
  }

  const missing = preview ? FIELDS.filter((f) => f.required && (preview.columns[f.key] ?? -1) < 0) : []

  return (
    <Screen visible={visible} title="استيراد المنتجات" onRefresh={load}>
      <div class="home-body">
        <header class="page-head rise">
          <div class="page-head-text">
            <h1 class="page-title">استيراد المنتجات</h1>
            <p class="page-sub">ناقل من منصة تانية؟ اربط حسابك وهنجيب كتالوجك كله — أو ارفع ملف CSV.</p>
          </div>
        </header>

        {!data ? (
          <LoadState failed={failed} what="الاستيراد" />
        ) : result ? (
          <section class="card sec rise pi-done">
            <span class="pi-done-icon">
              <Icon svg={icons.check()} />
            </span>
            <b>
              {result.source ? `جبنا كتالوجك من ${result.source} — ` : ''}اتضاف {formatNumber(result.created)} منتج
            </b>
            <ul class="st-steps">
              {result.fetched !== undefined && <li>• {formatNumber(result.fetched)} منتج اتقروا</li>}
              <li>
                • كلهم دخلوا <b>مسوّدات</b> — مش ظاهرين في متجرك لسه. راجع الصور والأسعار وانشر اللي جاهز.
              </li>
              {result.categories > 0 && <li>• اتعمل {formatNumber(result.categories)} قسم جديد.</li>}
              {result.skipped > 0 && <li>• {formatNumber(result.skipped)} اتخطّوا لأن عندك منتجات بنفس الاسم — ما لمسناش القديم.</li>}
            </ul>
            <div class="btn-row">
              <button type="button" class="btn btn--primary press" onClick={() => navigate('/dashboard/products')}>
                روح للمنتجات
              </button>
              <button type="button" class="btn btn--ghost press" onClick={reset}>
                استورد تاني
              </button>
            </div>
          </section>
        ) : source ? (
          <Group title={`استيراد من ${source.name}`} lead={source.intro}>
            <ol class="st-box st-steps pi-steps">
              {source.steps.map((s, i) => (
                <li key={s}>
                  <i>{formatNumber(i + 1)}</i>
                  <span dir="auto">{s}</span>
                </li>
              ))}
            </ol>
            {source.fields.map((f) => (
              <label key={f.key} class="np-label">
                {f.label}
                <input
                  class="np-input st-mono"
                  dir="ltr"
                  autocomplete="off"
                  maxLength={500}
                  placeholder={f.placeholder}
                  value={creds[f.key] ?? ''}
                  onInput={(e) => setCreds({ ...creds, [f.key]: (e.currentTarget as HTMLInputElement).value })}
                />
                {f.hint && <small class="pv-hint">{f.hint}</small>}
              </label>
            ))}
            {error && <p class="np-error">{error}</p>}
            <button
              type="button"
              class="btn btn--primary btn--lg press"
              disabled={Boolean(busy) || source.fields.some((f) => !(creds[f.key] ?? '').trim())}
              onClick={() => void importApi()}
            >
              {busy === 'api' ? <span class="spinner" /> : <Icon svg={icons.download()} />}
              {busy === 'api' ? 'بنجيب كتالوجك…' : `هات منتجاتي من ${source.name}`}
            </button>
            <p class="st-risk">
              <Icon svg={icons.shieldCheck()} />
              <span>مفاتيحك مش بتتخزّن عندنا. بتتستعمل مرة عشان نقرا كتالوجك وبتتنسى.</span>
            </p>
            <button type="button" class="btn btn--ghost press" onClick={reset}>
              غيّر المنصة
            </button>
          </Group>
        ) : (
          <>
            <Group title="استورد من منصتك القديمة على طول" lead="من غير ملفات ولا ربط أعمدة. الصق مفتاحين من لوحة منصتك وهنجيب كتالوجك كله.">
              <div class="card ops-list">
                {data.sources.map((s) => (
                  <button key={s.key} type="button" class="bl-row press" onClick={() => (haptic('LIGHT'), setError(null), setSource(s))}>
                    <span class="bl-main">
                      <b>{s.name}</b>
                      <small>{fieldCount(s.fields.length)} · قراءة بس</small>
                    </span>
                    <Icon svg={icons.chevronLeft()} className="ic an-chev" />
                  </button>
                ))}
              </div>
            </Group>

            <div class="pi-divider rise">أو ارفع ملف CSV</div>

            <Group title="١ · ارفع الملف">
              <input ref={file} type="file" accept=".csv,text/csv,text/plain" hidden onChange={(e) => void pickFile(e.currentTarget as HTMLInputElement)} />
              <button type="button" class="pi-drop press" disabled={busy === 'preview'} onClick={() => file.current?.click()}>
                {busy === 'preview' ? <span class="spinner" /> : <Icon svg={icons.download()} />}
                <b>{fileName || 'اختار ملف CSV من موبايلك'}</b>
                <small>صدّر منتجاتك من منصتك القديمة كـCSV وارفعه هنا — بنفهم أعمدة شوبيفاي وووكومرس والملفات العربية.</small>
              </button>
              {error && !preview && <p class="np-error">{error}</p>}
            </Group>

            {preview && text && (
              <>
                <Group title="٢ · اتأكد من الأعمدة" lead="خمّنّا الربط من أسماء الأعمدة. غيّر أي حاجة غلط قبل ما تكمّل.">
                  {FIELDS.map((f) => (
                    <label key={f.key} class="np-label">
                      {f.label}
                      {f.required ? ' *' : ''}
                      <select
                        class="np-input"
                        value={String(preview.columns[f.key] ?? -1)}
                        onChange={(e) => void runPreview(text, { ...preview.columns, [f.key]: Number((e.currentTarget as HTMLSelectElement).value) })}
                      >
                        <option value="-1">— مش موجود —</option>
                        {preview.header.map((h, i) => (
                          <option key={i} value={String(i)}>
                            {h || `عمود ${i + 1}`}
                          </option>
                        ))}
                      </select>
                      {f.required && (preview.columns[f.key] ?? -1) < 0 && <small class="st-bad">لازم تختار العمود ده</small>}
                    </label>
                  ))}
                </Group>

                <Group title="٣ · شوف النتيجة قبل ما تستورد">
                  <p class="st-preview">
                    <span>
                      <b>{formatNumber(preview.items.length)}</b> منتج جاهز
                    </span>
                    {preview.issueCount > 0 && <span class="st-bad">{formatNumber(preview.issueCount)} صف هيتخطّى</span>}
                  </p>
                  {preview.items.length === 0 ? (
                    <p class="np-note st-warn">مفيش صف واحد صالح. اتأكد إن عمودَي الاسم والسعر متربطين صح.</p>
                  ) : (
                    <div class="card ops-list">
                      {preview.items.slice(0, 5).map((it, i) => (
                        <div key={i} class="bl-row">
                          <span class="bl-main">
                            <b>{it.name}</b>
                            <small>
                              {formatMoney(it.price, data.currency)} · الكمية {formatNumber(it.stock)} · {it.category ?? 'من غير قسم'}
                              {it.image ? ' · بصورة' : ''}
                            </small>
                          </span>
                        </div>
                      ))}
                      {preview.items.length > 5 && <small class="fine pi-more">وباقي {formatNumber(preview.items.length - 5)} منتج.</small>}
                    </div>
                  )}
                  {preview.issues.length > 0 && (
                    <div class="np-note st-warn">
                      <b>صفوف هتتخطّى</b>
                      <ul class="st-steps">
                        {preview.issues.slice(0, 6).map((is) => (
                          <li key={is.line}>
                            سطر {formatNumber(is.line)}: {is.reason}
                          </li>
                        ))}
                        {preview.issueCount > 6 && <li>و{formatNumber(preview.issueCount - 6)} غيرهم.</li>}
                      </ul>
                    </div>
                  )}
                  {error && <p class="np-error">{error}</p>}
                  <button
                    type="button"
                    class="btn btn--primary btn--lg press"
                    disabled={Boolean(busy) || preview.items.length === 0 || missing.length > 0}
                    onClick={() => void importCsv()}
                  >
                    {busy === 'csv' ? <span class="spinner" /> : <Icon svg={icons.check()} />}
                    استورد {formatNumber(preview.items.length)} منتج
                  </button>
                </Group>
              </>
            )}
          </>
        )}
      </div>
    </Screen>
  )
}
