'use client'

import { useMemo, useState, useTransition } from 'react'
import Image from 'next/image'
import { Check, Copy, ExternalLink, ImageOff, Pencil, Trash2, X } from 'lucide-react'
import { deleteMediaAction, renameMediaAction } from './actions'
import { FOLDER_LABELS } from '@/lib/media-meta'
import { Alert, Button, Card, Input } from '@/components/ui'
import { toast } from '@/components/dashboard/toast'
import { cn, formatDate } from '@/lib/utils'

export type MediaRow = {
  id: string
  url: string
  name: string
  folder: string
  sizeBytes: number
  createdAt: string
  /** مستعملة في كام منتج — الرقم ده هو اللي بيمنع الحذف */
  usedIn: number
}

/**
 * معرض الوسائط.
 *
 * ## المستعمَل معلَّم عليه
 * التاجر بيفتح المعرض عشان يفضّي مساحة، وأول حاجة بيعملها إنه يمسح
 * اللي شكله قديم. الشارة اللي بتقول «في ٣ منتجات» بتوقّفه قبل ما
 * يبوّظ صفحات منتجاته — والحذف نفسه بيترفض على الخادم كمان، لأن
 * الشارة ممكن تكون بايتة والمنتج اتضاف بعدها.
 *
 * ## والاسم بيتغيّر من غير ما الملف يتحرّك
 * الاسم للتاجر، والمسار على التخزين للروابط. تغيير المسار كان
 * هيبوّظ كل منتج بيشاور على الصورة — فالاسم هنا وصف لا مفتاح.
 */
export function MediaManager({
  rows,
  synced,
}: {
  rows: MediaRow[]
  /** كام ملف قديم اتسجّل دلوقتي — بيتقال مرة واحدة بعد المزامنة */
  synced: number
}) {
  const [folder, setFolder] = useState<string>('all')
  const [editing, setEditing] = useState<string | null>(null)

  const folders = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of rows) counts.set(r.folder, (counts.get(r.folder) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [rows])

  const shown = folder === 'all' ? rows : rows.filter((r) => r.folder === folder)

  const totalBytes = rows.reduce((n, r) => n + r.sizeBytes, 0)

  return (
    <div className="flex flex-col gap-5">
      {synced > 0 && (
        <Alert tone="info">
          لقينا {synced} صورة مرفوعة قبل كده وضفناهم للمكتبة.
        </Alert>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="scroll-x flex gap-2 pb-1">
          <FolderChip
            label="الكل"
            count={rows.length}
            active={folder === 'all'}
            onClick={() => setFolder('all')}
          />
          {folders.map(([key, n]) => (
            <FolderChip
              key={key}
              label={FOLDER_LABELS[key] ?? key}
              count={n}
              active={folder === key}
              onClick={() => setFolder(key)}
            />
          ))}
        </div>

        <span className="tabular shrink-0 text-xs text-[var(--fg-subtle)]">
          {formatSize(totalBytes)} إجمالي
        </span>
      </div>

      {shown.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 px-6 py-14 text-center">
          <ImageOff className="h-8 w-8 text-[var(--fg-subtle)]" aria-hidden="true" />
          <h2 className="text-lg font-semibold">مافيش صور هنا</h2>
          <p className="max-w-md text-sm leading-relaxed text-[var(--fg-muted)]">
            كل صورة بترفعها في منتج أو بانر أو قسم بتتسجّل هنا تلقائيًا، وتقدر تعيد استخدامها في
            أي مكان تاني من غير ما ترفعها مرتين.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((r) => (
            <MediaCard
              key={r.id}
              row={r}
              editing={editing === r.id}
              onEdit={() => setEditing(r.id)}
              onDoneEdit={() => setEditing(null)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function FolderChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]'
          : 'border-[var(--border-strong)] text-[var(--fg-muted)] hover:bg-[var(--surface-2)]',
      )}
    >
      {label}
      <span className="tabular ms-1.5 opacity-60">{count}</span>
    </button>
  )
}

function MediaCard({
  row,
  editing,
  onEdit,
  onDoneEdit,
}: {
  row: MediaRow
  editing: boolean
  onEdit: () => void
  onDoneEdit: () => void
}) {
  const [name, setName] = useState(row.name)
  const [copied, setCopied] = useState(false)
  const [pending, start] = useTransition()

  return (
    <Card className="flex flex-col overflow-hidden">
      <span className="relative block aspect-square bg-[var(--surface-2)]">
        <Image
          src={row.url}
          alt={row.name}
          fill
          sizes="(max-width: 640px) 50vw, 25vw"
          className="object-cover"
        />
        {row.usedIn > 0 && (
          <span className="absolute top-2 rounded-md bg-[var(--color-success-soft)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--color-success)] end-2">
            في {row.usedIn} منتج
          </span>
        )}
      </span>

      <div className="flex flex-1 flex-col gap-2 p-3">
        {editing ? (
          <div className="flex items-center gap-1.5">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 text-sm"
              aria-label="اسم الصورة"
            />
            <button
              type="button"
              aria-label="احفظ الاسم"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await renameMediaAction(row.id, name)
                  if (res?.error) toast(res.error, 'error')
                  else toast('اتغيّر الاسم')
                  onDoneEdit()
                })
              }
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)] text-[var(--primary-fg)]"
            >
              <Check className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="إلغاء"
              onClick={() => {
                setName(row.name)
                onDoneEdit()
              }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border-strong)] text-[var(--fg-muted)]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <>
            <span className="truncate text-sm font-medium" title={row.name}>
              {row.name}
            </span>
            <span className="tabular text-xs text-[var(--fg-subtle)]">
              {formatSize(row.sizeBytes)} · {formatDate(row.createdAt)}
            </span>
          </>
        )}

        {!editing && (
          <div className="mt-auto flex gap-1 pt-1">
            <IconAction
              label="انسخ الرابط"
              onClick={async () => {
                await navigator.clipboard.writeText(row.url)
                setCopied(true)
                toast('اتنسخ الرابط')
              }}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </IconAction>

            <a
              href={row.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="افتح الصورة"
              className="flex h-9 flex-1 items-center justify-center rounded-lg border border-[var(--border-strong)] text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)]"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>

            <IconAction label="غيّر الاسم" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
            </IconAction>

            <DeleteAction id={row.id} name={row.name} usedIn={row.usedIn} />
          </div>
        )}
      </div>
    </Card>
  )
}

function DeleteAction({ id, name, usedIn }: { id: string; name: string; usedIn: number }) {
  const [confirming, setConfirming] = useState(false)
  const [pending, start] = useTransition()

  /*
    المستعملة ما بيبقاش عليها زرار حذف أصلًا.

    زرار بيرفض لما تدوسه بيخلّي التاجر يدوس تلات مرات ويفتكر إن فيه
    عطل. الغياب بيقول «مش دلوقتي» من غير محاولة.
  */
  if (usedIn > 0) {
    return (
      <span
        title={`مستعملة في ${usedIn} منتج`}
        className="flex h-9 flex-1 cursor-not-allowed items-center justify-center rounded-lg border border-[var(--border)] text-[var(--fg-subtle)] opacity-40"
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    )
  }

  if (confirming) {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await deleteMediaAction(id)
            if (res?.error) toast(res.error, 'error')
            else toast('اتحذفت')
            setConfirming(false)
          })
        }
        className="h-9 flex-1 rounded-lg bg-[var(--color-danger)] text-xs font-semibold text-white disabled:opacity-60"
      >
        أكيد؟
      </button>
    )
  }

  return (
    <IconAction label={`احذف ${name}`} onClick={() => setConfirming(true)} danger>
      <Trash2 className="h-3.5 w-3.5" />
    </IconAction>
  )
}

function IconAction({
  label,
  onClick,
  danger,
  children,
}: {
  label: string
  onClick: () => void
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'flex h-9 flex-1 items-center justify-center rounded-lg border border-[var(--border-strong)] transition-colors',
        danger
          ? 'text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]'
          : 'text-[var(--fg-muted)] hover:bg-[var(--surface-2)]',
      )}
    >
      {children}
    </button>
  )
}

/** الحجم بوحدة يقراها الإنسان — الرقم بالبايت مالوش معنى للتاجر */
function formatSize(bytes: number): string {
  if (bytes <= 0) return '—'
  if (bytes < 1024) return `${bytes} بايت`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} ك.ب`
  return `${(bytes / (1024 * 1024)).toFixed(1)} م.ب`
}
