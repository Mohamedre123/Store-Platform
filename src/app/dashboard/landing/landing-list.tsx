'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check, ExternalLink, LayoutTemplate, Plus, Trash2, X } from 'lucide-react'
import { createLandingAction, deleteLandingAction, toggleLandingAction } from './actions'
import { TEMPLATES } from '@/lib/landing'
import { Alert, Button, Card } from '@/components/ui'
import { formatDate } from '@/lib/utils'

export type FunnelRow = {
  id: string
  name: string
  slug: string
  status: string
  views: number
  conversions: number
  createdAt: Date
}

export function LandingList({
  funnels,
  products,
  storeUrl,
}: {
  funnels: FunnelRow[]
  products: Array<{ id: string; name: string }>
  storeUrl: string
}) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [template, setTemplate] = useState(TEMPLATES[0].key)
  const [productId, setProductId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const field =
    'h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm focus:border-[var(--primary)] focus:outline-none'

  return (
    <div className="flex flex-col gap-4">
      {creating ? (
        <Card className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">صفحة هبوط جديدة</h2>
            <button
              type="button"
              onClick={() => setCreating(false)}
              aria-label="إغلاق"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {error && <Alert tone="danger">{error}</Alert>}

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">اسم الصفحة</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="اسم الصفحة"
              className={field}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">المنتج</span>
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className={field}>
              <option value="">— اختار المنتج —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">ابدأ من قالب</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTemplate(t.key)}
                  aria-pressed={template === t.key}
                  className={`rounded-lg border p-3 text-start transition-colors ${
                    template === t.key
                      ? 'border-[var(--primary)] bg-[var(--primary-soft)]'
                      : 'border-[var(--border)] hover:bg-[var(--surface-2)]'
                  }`}
                >
                  <span className="block text-sm font-medium">{t.name}</span>
                  <span className="block text-xs text-[var(--fg-subtle)]">{t.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={() =>
              start(async () => {
                setError(null)
                const res = await createLandingAction({
                  name,
                  template,
                  productId: productId || null,
                })
                if (res?.error) setError(res.error)
                else if (res?.id) router.push(`/dashboard/landing/${res.id}`)
              })
            }
            loading={pending}
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            أنشئ وابدأ التحرير
          </Button>
        </Card>
      ) : (
        <Button onClick={() => setCreating(true)} className="self-start">
          <Plus className="h-4 w-4" aria-hidden="true" />
          صفحة هبوط جديدة
        </Button>
      )}

      {funnels.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <LayoutTemplate className="h-10 w-10 text-[var(--fg-subtle)]" aria-hidden="true" />
          <h2 className="text-lg font-semibold">مافيش صفحات هبوط</h2>
          <p className="max-w-sm text-sm text-[var(--fg-muted)]">
            صفحة هبوط = صفحة لمنتج واحد بهويتها الخاصة، مخصوصة لحملة إعلانية. بتحوّل أعلى من صفحة
            المنتج العادية لأنها مفيهاش أي مشتّتات.
          </p>
        </Card>
      ) : (
        funnels.map((f) => <FunnelCard key={f.id} funnel={f} storeUrl={storeUrl} />)
      )}
    </div>
  )
}

function FunnelCard({ funnel: f, storeUrl }: { funnel: FunnelRow; storeUrl: string }) {
  const [pending, start] = useTransition()
  const published = f.status === 'published'
  // معدّل التحويل — الرقم اللي بيقول الصفحة نجحت ولا لأ
  const rate = f.views > 0 ? Math.round((f.conversions / f.views) * 1000) / 10 : 0

  return (
    <Card className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/dashboard/landing/${f.id}`} className="font-medium hover:text-[var(--primary)]">
            {f.name}
          </Link>
          {!published && (
            <span className="rounded-md bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--fg-subtle)]">
              مسوّدة
            </span>
          )}
        </div>
        <span className="mt-0.5 block text-xs text-[var(--fg-subtle)]">
          <bdi dir="ltr">/lp/{f.slug}</bdi> · {f.views} زيارة
          {f.views > 0 && ` · تحويل ${rate}٪`} · {formatDate(f.createdAt)}
        </span>
      </div>

      {published && (
        <a
          href={`${storeUrl}/lp/${f.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="افتح الصفحة"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </a>
      )}

      <button
        type="button"
        role="switch"
        aria-checked={published}
        aria-label={published ? 'إيقاف النشر' : 'نشر'}
        disabled={pending}
        onClick={() => start(() => toggleLandingAction(f.id, !published).then(() => {}))}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          published ? 'bg-[var(--primary)]' : 'bg-[var(--border-strong)]'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            published ? 'start-0.5' : 'start-[1.375rem]'
          }`}
        />
      </button>

      <Link
        href={`/dashboard/landing/${f.id}`}
        className="rounded-lg border border-[var(--border-strong)] px-3 py-2 text-sm text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)]"
      >
        تحرير
      </Link>

      <button
        type="button"
        onClick={() => start(() => deleteLandingAction(f.id).then(() => {}))}
        disabled={pending}
        aria-label="حذف"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--fg-muted)] transition-colors hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>
    </Card>
  )
}
