'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, Plug, ShieldCheck } from 'lucide-react'
import { importFromApiAction } from './api-actions'
import { IMPORT_SOURCES, type ImportSource } from '@/lib/import-sources'
import { Alert, Button, Card, Field, Input } from '@/components/ui'
import { cn } from '@/lib/utils'

/**
 * الاستيراد من منصة تانية بالمفاتيح.
 *
 * ## الحاجز اللي بيشيله
 * الاستيراد بـCSV بيطلب من التاجر يفتح لوحة منصته، يلاقي التصدير،
 * يستنى الملف، ينزّله، يرفعه، ويربط أعمدته. خمس خطوات وكل واحدة
 * مكان يقف عنده. اللي عنده تلتمية منتج على منصة تانية مش هيدخّلهم
 * بإيده، ومش هيفضل يحارب ملفًا — فبيفضل عندهم.
 *
 * ## وخطوات جلب المفتاح مكتوبة هنا
 * «هات الـStorefront API token» جملة مالهاش معنى لتاجر. الخطوات
 * بأسماء الشاشات زي ما هي في لوحة المنصة، بالترتيب — وده الفرق
 * بين إنه يخلّص في دقيقة وإنه يسيب الصفحة.
 */
export function ApiImport() {
  const [picked, setPicked] = useState<ImportSource | null>(null)

  if (!picked) {
    return (
      <Card className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-1">
          <h2 className="flex items-center gap-2 font-semibold">
            <Plug className="h-4 w-4 text-[var(--primary)]" aria-hidden="true" />
            استورد من منصتك القديمة على طول
          </h2>
          <p className="text-sm leading-relaxed text-[var(--fg-muted)]">
            من غير ملفات ولا ربط أعمدة. الصق مفتاحين من لوحة منصتك وهنجيب كتالوجك كله.
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {IMPORT_SOURCES.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setPicked(s)}
              className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-strong)] p-4 text-start transition-colors hover:bg-[var(--surface-2)]"
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{s.name}</span>
                <span className="block truncate text-xs text-[var(--fg-subtle)]">
                  {s.fields.length} حقول · قراءة بس
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 rotate-180 text-[var(--fg-subtle)]" aria-hidden="true" />
            </button>
          ))}
        </div>
      </Card>
    )
  }

  return <SourceForm source={picked} onBack={() => setPicked(null)} />
}

function SourceForm({ source, onBack }: { source: ImportSource; onBack: () => void }) {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{
    created: number
    skipped: number
    categories: number
    fetched: number
  } | null>(null)

  if (done) {
    return (
      <Card className="flex flex-col gap-4 p-5">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-success-soft)] text-[var(--color-success)]">
            <Check className="h-5 w-5" aria-hidden="true" />
          </span>
          <h2 className="font-semibold">جبنا كتالوجك من {source.name}</h2>
        </div>

        <ul className="flex flex-col gap-1.5 text-sm">
          <li>
            <strong className="tabular">{done.fetched}</strong> منتج اتقروا من {source.name}
          </li>
          <li>
            <strong className="tabular">{done.created}</strong> اتضافوا عندك — <strong>كمسوّدات</strong>
          </li>
          {done.skipped > 0 && (
            <li className="text-[var(--fg-muted)]">
              <span className="tabular">{done.skipped}</span> اتخطّوا (موجودين عندك بنفس الاسم)
            </li>
          )}
          {done.categories > 0 && (
            <li className="text-[var(--fg-muted)]">
              <span className="tabular">{done.categories}</span> قسم اتعمل لوحده
            </li>
          )}
        </ul>

        {/*
          ليه مسوّدات — والسبب مكتوب هنا مش في مكان تاني.

          التاجر لو ما عرفش، هيفتح متجره ويلاقيه فاضي ويفتكر إن
          الاستيراد فشل.
        */}
        <p className="rounded-lg bg-[var(--surface-2)] px-3.5 py-2.5 text-xs leading-relaxed text-[var(--fg-muted)]">
          نزلوا مسوّدات عن قصد — عشان تراجع الأسعار والصور قبل ما عملاؤك يشوفوهم. راجعهم وانشرهم من
          صفحة المنتجات.
        </p>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/products?status=draft"
            className="flex h-11 items-center rounded-lg bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-fg)]"
          >
            راجع المسوّدات
          </Link>
          <Button variant="ghost" onClick={onBack}>
            استورد من منصة تانية
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <Card className="flex flex-col gap-5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="font-semibold">استيراد من {source.name}</h2>
          <p className="text-sm leading-relaxed text-[var(--fg-muted)]">{source.intro}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onBack}>
          غيّر المنصة
        </Button>
      </div>

      {/* الخطوات — بأسماء الشاشات زي ما هي عندهم */}
      <ol className="flex flex-col gap-2 rounded-lg bg-[var(--surface-2)] p-4">
        {source.steps.map((step, i) => (
          <li key={step} className="flex gap-2.5 text-xs leading-relaxed">
            <span className="tabular flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--primary-soft)] text-[11px] font-semibold text-[var(--primary)]">
              {i + 1}
            </span>
            <span dir="auto">{step}</span>
          </li>
        ))}
      </ol>

      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          setError(null)
          const fd = new FormData(e.currentTarget)
          const credentials: Record<string, string> = {}
          for (const f of source.fields) credentials[f.key] = String(fd.get(f.key) ?? '')

          start(async () => {
            const res = await importFromApiAction({ source: source.key, credentials })
            if (!res) return
            if ('error' in res) setError(res.error)
            else setDone(res)
          })
        }}
      >
        {source.fields.map((f) => (
          <Field key={f.key} label={f.label} hint={f.hint} htmlFor={`imp-${f.key}`} required>
            <Input
              id={`imp-${f.key}`}
              name={f.key}
              dir="ltr"
              className="text-start"
              required
              maxLength={500}
              placeholder={f.placeholder}
              autoComplete="off"
              /*
                الحقول السرّية `text` مش `password`.

                التاجر بينسخ التوكن من لوحة منصته وبيلزقه، والغلطة
                الشائعة إنه ينسخ مسافة زيادة أو نُص المفتاح. النجوم
                بتخفي الغلطة عنه، والحقل ده بيتلزق مرة وبيتنسى —
                مفيش حد بيبص على شاشته وقتها.
              */
              type="text"
            />
          </Field>
        ))}

        {error && <Alert tone="danger">{error}</Alert>}

        <div className="flex flex-col gap-2">
          <Button type="submit" loading={pending} className="self-start">
            {pending ? 'بنجيب كتالوجك…' : `هات منتجاتي من ${source.name}`}
          </Button>

          <p className="flex items-start gap-1.5 text-xs leading-relaxed text-[var(--fg-subtle)]">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              مفاتيحك <strong>مش بتتخزّن عندنا</strong>. بتتستعمل مرة عشان نقرا كتالوجك وبتتنسى —
              الاستيراد بيحصل مرة، ومفيش سبب نفضل ماسكين وصولًا لمتجرك على منصة تانية.
            </span>
          </p>
        </div>
      </form>
    </Card>
  )
}

/** فاصل بصري بين طريقتي الاستيراد */
export function ImportDivider() {
  return (
    <div className="flex items-center gap-3">
      <span className="h-px flex-1 bg-[var(--border)]" aria-hidden="true" />
      <span className={cn('text-xs text-[var(--fg-subtle)]')}>أو ارفع ملف CSV</span>
      <span className="h-px flex-1 bg-[var(--border)]" aria-hidden="true" />
    </div>
  )
}
