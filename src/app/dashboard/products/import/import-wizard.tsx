'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, FileUp, Upload } from 'lucide-react'
import { importProductsAction } from './actions'
import {
  guessColumns,
  mapRows,
  parseCsv,
  type ImportField,
  type ImportIssue,
  type ImportRow,
} from '@/lib/product-csv'
import { Alert, Button, Card, Field } from '@/components/ui'
import { toast } from '@/components/dashboard/toast'
import { cn, formatMoney } from '@/lib/utils'

/** الحقول بأسمائها العربية — والمطلوب منها معلَّم */
const FIELDS: Array<{ key: ImportField; label: string; required?: boolean }> = [
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

/** ٥ ميجا — نفس حد رفع الصور، والملف الأكبر من كده مش كتالوج متجر */
const MAX_BYTES = 5 * 1024 * 1024

/**
 * معالج استيراد المنتجات.
 *
 * ## خطوتان لا خطوة واحدة
 * التاجر بيرفع، بيشوف إحنا فهمنا إيه، وبعدين بيستورد. الاستيراد
 * الفوري بيخلّي ملفًا أعمدته مقلوبة يعمل تلتمية منتج بأسعار غلط —
 * وتصليحها بعد كده أصعب من إدخالها من الأول.
 *
 * ## والقراءة في المتصفح
 * فورية، ومن غير رفعة. لو غيّر ربط عمود، المعاينة بتتحدّث في نفس
 * اللحظة من غير أي رحلة للخادم.
 */
export function ImportWizard({ currency }: { currency: string }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [rows, setRows] = useState<string[][] | null>(null)
  const [fileName, setFileName] = useState('')
  const [columns, setColumns] = useState<Record<ImportField, number> | null>(null)
  const [readError, setReadError] = useState<string | null>(null)
  const [result, setResult] = useState<{ created: number; skipped: number; categories: number } | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const header = rows?.[0] ?? []
  const body = useMemo(() => rows?.slice(1) ?? [], [rows])

  const mapped = useMemo(() => {
    if (!columns || body.length === 0) return { items: [] as ImportRow[], issues: [] as ImportIssue[] }
    return mapRows(body, columns)
  }, [body, columns])

  function readFile(file: File) {
    setReadError(null)
    setResult(null)
    setError(null)

    if (file.size > MAX_BYTES) {
      setReadError('الملف أكبر من ٥ ميجا. قسّمه لملفات أصغر.')
      return
    }

    const reader = new FileReader()
    reader.onerror = () => setReadError('مقدرناش نقرا الملف. جرّب تاني.')
    reader.onload = () => {
      const parsed = parseCsv(String(reader.result ?? ''))
      if (parsed.length < 2) {
        setReadError('الملف فاضي أو فيه سطر واحد بس. لازم يكون فيه ترويسة وصف واحد على الأقل.')
        return
      }
      setRows(parsed)
      setColumns(guessColumns(parsed[0]))
      setFileName(file.name)
    }
    /*
      UTF-8 صراحةً.

      إكسل العربي بيحفظ أحيانًا بترميز الويندوز، والقراءة بالافتراضي
      بتطلّع «Ù…Ù†ØªØ¬» مكان «منتج». الترميز الصريح بيغطّي الحالة
      الشائعة، واللي بيحفظ بترميز تاني بيشوف الحروف مكسورة في
      المعاينة قبل ما يستورد.
    */
    reader.readAsText(file, 'utf-8')
  }

  if (result) {
    return (
      <Card className="flex flex-col items-center gap-4 p-8 text-center">
        <CheckCircle2 className="h-10 w-10 text-[var(--color-success)]" aria-hidden="true" />
        <h2 className="text-lg font-bold">
          اتضاف <span className="tabular">{result.created}</span> منتج
        </h2>
        <p className="max-w-md text-sm leading-relaxed text-[var(--fg-muted)]">
          كلهم دخلوا <strong>مسوّدات</strong> — مش ظاهرين في متجرك لسه. راجع الصور والأسعار وانشر
          اللي جاهز.
          {result.categories > 0 && ` واتعمل ${result.categories} قسم جديد.`}
          {result.skipped > 0 &&
            ` و${result.skipped} اتخطّوا لأن عندك منتجات بنفس الاسم — ما لمسناش القديم.`}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => router.push('/dashboard/products')}>روح للمنتجات</Button>
          <Button
            variant="secondary"
            onClick={() => {
              setResult(null)
              setRows(null)
              setColumns(null)
              setFileName('')
            }}
          >
            استورد ملف تاني
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ───────── الرفع ───────── */}
      <Card className="flex flex-col gap-4 p-5">
        <h2 className="text-sm font-semibold">١ · ارفع الملف</h2>

        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) readFile(f)
            e.target.value = ''
          }}
        />

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border-strong)] px-4 py-6 text-center transition-colors hover:border-[var(--primary)] hover:bg-[var(--surface-2)]"
        >
          <FileUp className="h-6 w-6 text-[var(--fg-subtle)]" aria-hidden="true" />
          <span className="text-sm font-medium">
            {fileName || 'اختار ملف CSV من جهازك'}
          </span>
          <span className="text-xs text-[var(--fg-subtle)]">
            صدّر منتجاتك من منصتك القديمة كـCSV وارفعه هنا — إحنا بنفهم أعمدة شوبيفاي وووكومرس
            والملفات العربية.
          </span>
        </button>

        {readError && <Alert tone="danger">{readError}</Alert>}
      </Card>

      {/* ───────── ربط الأعمدة ───────── */}
      {rows && columns && (
        <>
          <Card className="flex flex-col gap-4 p-5">
            <div className="flex flex-col gap-1">
              <h2 className="text-sm font-semibold">٢ · اتأكد من الأعمدة</h2>
              <p className="text-xs leading-relaxed text-[var(--fg-subtle)]">
                خمّنّا الربط من أسماء الأعمدة. غيّر أي حاجة غلط قبل ما تكمّل.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {FIELDS.map((f) => (
                <Field
                  key={f.key}
                  label={f.label}
                  required={f.required}
                  error={
                    f.required && columns[f.key] < 0 ? 'لازم تختار العمود ده' : undefined
                  }
                >
                  <select
                    value={columns[f.key]}
                    onChange={(e) =>
                      setColumns({ ...columns, [f.key]: Number(e.target.value) })
                    }
                    className="h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm"
                  >
                    <option value={-1}>— مش موجود —</option>
                    {header.map((h, i) => (
                      <option key={i} value={i}>
                        {h || `عمود ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </Field>
              ))}
            </div>
          </Card>

          {/* ───────── المعاينة ───────── */}
          <Card className="flex flex-col gap-4 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold">٣ · شوف النتيجة قبل ما تستورد</h2>
              <span className="tabular text-sm text-[var(--fg-muted)]">
                {mapped.items.length} منتج جاهز
                {mapped.issues.length > 0 ? ` · ${mapped.issues.length} صف هيتخطّى` : ''}
              </span>
            </div>

            {mapped.items.length === 0 ? (
              <Alert tone="warning">
                مفيش صف واحد صالح. اتأكد إن عمودَي الاسم والسعر متربطين صح.
              </Alert>
            ) : (
              <div className="scroll-x">
                <table className="w-full min-w-[36rem] text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)]">
                      {['المنتج', 'السعر', 'الكمية', 'القسم', 'صورة'].map((h, i) => (
                        <th
                          key={h}
                          className={cn(
                            'px-3 py-2 text-xs font-medium text-[var(--fg-muted)]',
                            i === 0 ? 'text-start' : 'text-end',
                          )}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mapped.items.slice(0, 5).map((item, i) => (
                      <tr key={i} className="border-b border-[var(--border)] last:border-0">
                        <td className="px-3 py-2 font-medium">{item.name}</td>
                        <td className="tabular px-3 py-2 text-end">
                          {formatMoney(item.price, currency)}
                        </td>
                        <td className="tabular px-3 py-2 text-end text-[var(--fg-muted)]">
                          {item.stock}
                        </td>
                        <td className="px-3 py-2 text-end text-[var(--fg-muted)]">
                          {item.category ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-end text-[var(--fg-muted)]">
                          {item.image ? '✓' : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {mapped.items.length > 5 && (
                  <p className="pt-2 text-xs text-[var(--fg-subtle)]">
                    وباقي {mapped.items.length - 5} منتج.
                  </p>
                )}
              </div>
            )}

            {mapped.issues.length > 0 && (
              <div className="flex flex-col gap-1.5 rounded-lg bg-[var(--color-warning-soft)] p-3.5">
                <span className="flex items-center gap-2 text-sm font-medium text-[var(--color-warning)]">
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                  صفوف هتتخطّى
                </span>
                <ul className="flex flex-col gap-0.5">
                  {mapped.issues.slice(0, 6).map((issue) => (
                    <li key={issue.line} className="text-xs text-[var(--fg-muted)]">
                      سطر {issue.line}: {issue.reason}
                    </li>
                  ))}
                  {mapped.issues.length > 6 && (
                    <li className="text-xs text-[var(--fg-subtle)]">
                      و{mapped.issues.length - 6} غيرهم.
                    </li>
                  )}
                </ul>
              </div>
            )}

            {error && <Alert tone="danger">{error}</Alert>}

            <Button
              size="lg"
              disabled={mapped.items.length === 0}
              loading={pending}
              onClick={() =>
                start(async () => {
                  setError(null)
                  const res = await importProductsAction({ rows: mapped.items })
                  if (!res || 'error' in res) {
                    setError(res?.error ?? 'حصلت مشكلة')
                    return
                  }
                  toast(`اتضاف ${res.created} منتج`)
                  setResult(res)
                })
              }
              className="self-start"
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              استورد {mapped.items.length} منتج
            </Button>
          </Card>
        </>
      )}
    </div>
  )
}
