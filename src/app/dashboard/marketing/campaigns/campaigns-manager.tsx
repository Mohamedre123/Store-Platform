'use client'

import { useEffect, useState, useTransition } from 'react'
import { Mail, Plus, Send, Trash2, X } from 'lucide-react'
import {
  audienceSizeAction,
  deleteCampaignAction,
  saveCampaignAction,
  startCampaignAction,
} from './actions'
import { AUDIENCE_META } from '@/lib/campaigns-meta'
import type { CampaignAudience, CampaignStatus } from '@/db/schema'
import { Alert, Button, Card, Field, Input, Textarea } from '@/components/ui'
import { toast } from '@/components/dashboard/toast'
import { cn, formatDate } from '@/lib/utils'

export type CampaignRow = {
  id: string
  name: string
  subject: string
  body: string
  ctaLabel: string | null
  ctaUrl: string | null
  audience: CampaignAudience
  status: CampaignStatus
  audienceCount: number
  sentCount: number
  failedCount: number
  createdAt: string
}

const STATUS_META: Record<CampaignStatus, { label: string; tone: string }> = {
  draft: { label: 'مسوّدة', tone: 'bg-[var(--surface-2)] text-[var(--fg-muted)]' },
  sending: { label: 'بتتبعت دلوقتي', tone: 'bg-[var(--color-info-soft)] text-[var(--color-info)]' },
  sent: { label: 'اتبعتت', tone: 'bg-[var(--color-success-soft)] text-[var(--color-success)]' },
  failed: { label: 'فشلت', tone: 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]' },
}

/**
 * حملات البريد.
 *
 * ## حجم الجمهور بيبان قبل الإرسال
 * التاجر بيدوس «ابعت» وهو عارف بالظبط لكام واحد. من غير الرقم ده
 * بيبعت لجمهور فاضي ويفتكر إن فيه عطل، أو بيبعت لعشرة آلاف وهو
 * فاكرها مية.
 *
 * ## والمرسَل بيتعدّ مع الدفعات
 * «اتبعت ٤٠٠ من ١٢٠٠» رقم حقيقي بيتحدّث كل دقيقة — مش شريط تقدّم
 * بيتحرك لوحده.
 */
export function CampaignsManager({
  rows,
  subscribers,
  withoutEmail,
}: {
  rows: CampaignRow[]
  /** إجمالي المشتركين — بيبان فوق عشان التاجر يعرف قاعدته قد إيه */
  subscribers: number
  /**
   * عملاء مالهمش بريد.
   *
   * الرقم ده هو الفرق بين «مفيش مشتركين» و«عندك عملاء بس مفيش
   * وسيلة توصلهم». الصفر من غير سبب بيخلّي التاجر يفتكر إن فيه
   * عطل ويسيب الميزة.
   */
  withoutEmail: number
}) {
  const [editing, setEditing] = useState<CampaignRow | 'new' | null>(null)

  return (
    <div className="flex flex-col gap-6">
      <Card className="flex flex-wrap items-center gap-3 p-4">
        <Mail className="h-5 w-5 shrink-0 text-[var(--primary)]" aria-hidden="true" />
        <span className="flex-1 text-sm">
          <span className="font-semibold">
            <span className="tabular">{subscribers}</span> مشترك موافق يستقبل رسايلك
          </span>
          <span className="mt-0.5 block text-xs text-[var(--fg-muted)]">
            {subscribers === 0 && withoutEmail > 0 ? (
              <>
                عندك <span className="tabular">{withoutEmail}</span> عميل من غير بريد — افتح خانة
                البريد في إعدادات الشيك أوت عشان تقدر توصلهم.
              </>
            ) : (
              'اللي ألغى اشتراكه مش محسوب — وما بيستقبلش أي حملة مهما كان الجمهور المختار.'
            )}
          </span>
        </span>
      </Card>

      {editing ? (
        <CampaignForm
          row={editing === 'new' ? null : editing}
          onDone={() => setEditing(null)}
        />
      ) : (
        <Button onClick={() => setEditing('new')} className="self-start">
          <Plus className="h-4 w-4" aria-hidden="true" />
          حملة جديدة
        </Button>
      )}

      {rows.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 px-6 py-14 text-center">
          <Mail className="h-8 w-8 text-[var(--fg-subtle)]" aria-hidden="true" />
          <h2 className="text-lg font-semibold">مافيش حملات لسه</h2>
          <p className="max-w-md text-sm leading-relaxed text-[var(--fg-muted)]">
            العملاء اللي سجّلوا بريدهم في متجرك أرخص قناة عندك — مش محتاجة إعلان ولا وسيط. اكتب
            حملة وابعتلهم.
          </p>
        </Card>
      ) : (
        <Card className="divide-y divide-[var(--border)]">
          {rows.map((r) => {
            const meta = STATUS_META[r.status]
            const progress =
              r.audienceCount > 0
                ? Math.round(((r.sentCount + r.failedCount) / r.audienceCount) * 100)
                : 0

            return (
              <div key={r.id} className="flex flex-col gap-2.5 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium">{r.name}</span>
                      <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-medium', meta.tone)}>
                        {meta.label}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-[var(--fg-subtle)]">
                      {r.subject} · {AUDIENCE_META[r.audience].label} · {formatDate(r.createdAt)}
                    </span>
                  </span>

                  <span className="flex shrink-0 gap-2">
                    {r.status === 'draft' && (
                      <>
                        <Button size="sm" variant="secondary" onClick={() => setEditing(r)}>
                          عدّل
                        </Button>
                        <StartButton id={r.id} />
                        <DeleteButton id={r.id} name={r.name} />
                      </>
                    )}
                  </span>
                </div>

                {r.status !== 'draft' && (
                  <div className="flex flex-col gap-1.5">
                    <span className="tabular text-xs text-[var(--fg-muted)]">
                      اتبعت {r.sentCount} من {r.audienceCount}
                      {r.failedCount > 0 ? ` · ${r.failedCount} ما وصلوش` : ''}
                    </span>
                    <span className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
                      <span
                        className="block h-full rounded-full bg-[var(--primary)] transition-all"
                        style={{ width: `${Math.min(100, progress)}%` }}
                      />
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </Card>
      )}
    </div>
  )
}

function CampaignForm({ row, onDone }: { row: CampaignRow | null; onDone: () => void }) {
  const [name, setName] = useState(row?.name ?? '')
  const [subject, setSubject] = useState(row?.subject ?? '')
  const [body, setBody] = useState(row?.body ?? '')
  const [ctaLabel, setCtaLabel] = useState(row?.ctaLabel ?? '')
  const [ctaUrl, setCtaUrl] = useState(row?.ctaUrl ?? '')
  const [audience, setAudience] = useState<CampaignAudience>(row?.audience ?? 'all')
  const [size, setSize] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  /* حجم الجمهور بيتحدّث مع كل تغيير — التاجر بيقرّر وهو شايف الرقم */
  useEffect(() => {
    let alive = true
    setSize(null)
    audienceSizeAction(audience).then((n) => {
      if (alive) setSize(n)
    })
    return () => {
      alive = false
    }
  }, [audience])

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{row ? 'تعديل الحملة' : 'حملة جديدة'}</h2>
        <button
          type="button"
          onClick={onDone}
          aria-label="إغلاق"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <Field label="اسم الحملة" required hint="للتنظيم عندك بس — العميل ما بيشوفهوش.">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="عروض رمضان" />
      </Field>

      <Field
        label="عنوان الرسالة"
        required
        hint="ده اللي العميل بيقراه في صندوقه قبل ما يفتح — وهو اللي بيقرّر يفتح ولا لأ."
      >
        <Input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="خصم ٢٠٪ على كل التيشيرتات لحد الجمعة"
        />
      </Field>

      <Field label="نص الرسالة" required hint="اكتب عادي — كل سطرين بيبقوا فقرة.">
        <Textarea rows={7} value={body} onChange={(e) => setBody(e.target.value)} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="نص الزر" hint="سيبه فاضي لو مش عايز زرار.">
          <Input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} placeholder="اتسوّق دلوقتي" />
        </Field>
        <Field label="رابط الزر">
          <Input
            dir="ltr"
            value={ctaUrl}
            onChange={(e) => setCtaUrl(e.target.value)}
            className="text-start"
            placeholder="https://…"
          />
        </Field>
      </div>

      <Field label="الجمهور">
        <div className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(AUDIENCE_META) as CampaignAudience[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setAudience(k)}
              aria-pressed={audience === k}
              className={cn(
                'flex min-h-16 flex-col items-start justify-center gap-0.5 rounded-lg border px-3 py-2 text-start transition-colors',
                audience === k
                  ? 'border-[var(--primary)] bg-[var(--primary-soft)]'
                  : 'border-[var(--border-strong)] hover:bg-[var(--surface-2)]',
              )}
            >
              <span
                className={cn('text-sm font-medium', audience === k && 'text-[var(--primary)]')}
              >
                {AUDIENCE_META[k].label}
              </span>
              <span className="text-xs text-[var(--fg-subtle)]">{AUDIENCE_META[k].hint}</span>
            </button>
          ))}
        </div>
      </Field>

      <p className="rounded-lg bg-[var(--surface-2)] px-3.5 py-2.5 text-sm">
        {size === null ? (
          'بنحسب حجم الجمهور…'
        ) : size === 0 ? (
          'مفيش حد في الجمهور ده دلوقتي.'
        ) : (
          <>
            هتوصل لـ<span className="tabular font-bold"> {size} </span>عميل.
          </>
        )}
      </p>

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="flex gap-2">
        <Button
          loading={pending}
          onClick={() =>
            start(async () => {
              setError(null)
              const res = await saveCampaignAction({
                id: row?.id,
                name,
                subject,
                body,
                ctaLabel: ctaLabel || null,
                ctaUrl: ctaUrl || null,
                audience,
              })
              if (res?.error) setError(res.error)
              else {
                toast('اتحفظت كمسوّدة')
                onDone()
              }
            })
          }
        >
          احفظ كمسوّدة
        </Button>
        <Button variant="ghost" onClick={onDone}>
          إلغاء
        </Button>
      </div>
    </Card>
  )
}

function StartButton({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false)
  const [pending, start] = useTransition()

  if (confirming) {
    return (
      <span className="flex items-center gap-1">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await startCampaignAction(id)
              if (res?.error) toast(res.error, 'error')
              else toast('بدأ الإرسال — هيكمّل حتى لو قفلت الشاشة')
              setConfirming(false)
            })
          }
          className="h-9 rounded-lg bg-[var(--primary)] px-3 text-xs font-semibold text-[var(--primary-fg)] disabled:opacity-60"
        >
          ابعت دلوقتي
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          aria-label="إلغاء"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-strong)] text-[var(--fg-muted)]"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </span>
    )
  }

  return (
    <Button size="sm" onClick={() => setConfirming(true)}>
      <Send className="h-3.5 w-3.5" aria-hidden="true" />
      ابعت
    </Button>
  )
}

function DeleteButton({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition()
  return (
    <Button
      size="sm"
      variant="ghost"
      loading={pending}
      aria-label={`احذف ${name}`}
      onClick={() =>
        start(async () => {
          const res = await deleteCampaignAction(id)
          if (res?.error) toast(res.error, 'error')
          else toast('اتحذفت')
        })
      }
    >
      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
    </Button>
  )
}
