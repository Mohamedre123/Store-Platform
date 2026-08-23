'use client'

import { useState, useTransition } from 'react'
import { BellRing, Mail, MessageCircle, Plus, Send, Smartphone, Trash2, X } from 'lucide-react'
import { Alert, Card } from '@/components/ui'
import {
  deleteRecipientAction,
  saveRecipientAction,
  toggleRecipientAction,
} from './recipient-actions'

export type RecipientRow = {
  id: string
  name: string | null
  channel: string
  phone: string | null
  chatId: string | null
  events: string[]
  isActive: boolean
}

const EVENT_LABELS: Record<string, string> = {
  order_placed: 'طلب جديد',
  order_confirmed: 'طلب اتأكّد',
  order_shipped: 'طلب اتشحن',
  order_delivered: 'طلب اتسلّم',
  order_cancelled: 'طلب اتلغى',
  abandoned_cart: 'سلة متروكة',
}

const CHANNEL_META: Record<string, { label: string; icon: typeof Send; hint: string }> = {
  telegram: {
    label: 'تيليجرام',
    icon: Send,
    hint: 'معرّف المحادثة (Chat ID). ابعت رسالة للبوت بتاعك وهو يقولك رقمك.',
  },
  whatsapp: { label: 'واتساب', icon: MessageCircle, hint: 'الرقم بصيغة دولية أو محلية.' },
  email: { label: 'بريد', icon: Mail, hint: 'البريد اللي هيوصله الإشعار.' },
  sms: { label: 'رسالة نصية', icon: Smartphone, hint: 'الرقم بصيغة دولية أو محلية.' },
}

/**
 * مين يتبلّغ لما يحصل إيه.
 *
 * ده مش نفس رسايل العملاء — دي إشعارات **لفريقك**. اللي بيغلّف
 * يهمّه «طلب جديد» بس، وصاحب المحل يهمّه «طلب اتلغى». إشعار واحد
 * بيروح للكل معناه إن كله بيتجاهله بعد يومين.
 */
export function RecipientsManager({ recipients }: { recipients: RecipientRow[] }) {
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-2">
          <BellRing className="mt-1 h-4 w-4 shrink-0 text-[var(--primary)]" aria-hidden="true" />
          <div>
            <h2 className="font-semibold">مين يتبلّغ</h2>
            <p className="mt-0.5 text-sm text-[var(--fg-muted)]">
              إشعارات لفريقك — كل واحد بيوصله اللي يخصّه بس.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="flex min-h-10 items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 text-sm font-medium text-[var(--primary-fg)]"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          إضافة
        </button>
      </div>

      {msg && <Alert tone={msg.ok ? 'success' : 'danger'}>{msg.text}</Alert>}

      {adding && (
        <RecipientForm
          onDone={(ok) => {
            setAdding(false)
            if (ok) setMsg({ ok: true, text: 'اتضاف' })
          }}
          onError={(text) => setMsg({ ok: false, text })}
        />
      )}

      {recipients.length === 0 && !adding ? (
        <Card className="px-5 py-8 text-center text-sm text-[var(--fg-muted)]">
          مفيش حد بيتبلّغ دلوقتي. ضيف نفسك أو موظفك عشان تعرف بالطلبات وإنت برّه اللوحة.
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {recipients.map((r) =>
            editing === r.id ? (
              <RecipientForm
                key={r.id}
                recipient={r}
                onDone={(ok) => {
                  setEditing(null)
                  if (ok) setMsg({ ok: true, text: 'اتحفظ' })
                }}
                onError={(text) => setMsg({ ok: false, text })}
              />
            ) : (
              <RecipientCard
                key={r.id}
                row={r}
                onEdit={() => setEditing(r.id)}
                onError={(text) => setMsg({ ok: false, text })}
              />
            ),
          )}
        </div>
      )}
    </section>
  )
}

function RecipientCard({
  row,
  onEdit,
  onError,
}: {
  row: RecipientRow
  onEdit: () => void
  onError: (t: string) => void
}) {
  const [active, setActive] = useState(row.isActive)
  const [pending, start] = useTransition()
  const meta = CHANNEL_META[row.channel] ?? CHANNEL_META.telegram
  const Icon = meta.icon
  const target = row.chatId ?? row.phone ?? '—'

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{row.name || meta.label}</h3>
          <p dir="ltr" className="truncate text-start text-xs text-[var(--fg-subtle)]">
            {target}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={active}
          aria-busy={pending}
          aria-label={active ? 'إيقاف الإشعارات' : 'تفعيل الإشعارات'}
          onClick={() => {
            if (pending) return
            const next = !active
            setActive(next)
            start(async () => {
              const res = await toggleRecipientAction(row.id, next)
              if (res?.error) {
                setActive(!next)
                onError(res.error)
              }
            })
          }}
          className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${
            active ? 'bg-[var(--primary)]' : 'bg-[var(--border-strong)]'
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
              active ? 'start-0.5' : 'start-[1.375rem]'
            }`}
          />
        </button>
      </div>

      <div className="flex flex-wrap gap-1">
        {row.events.map((e) => (
          <span
            key={e}
            className="rounded-md bg-[var(--surface-2)] px-1.5 py-0.5 text-[11px] text-[var(--fg-muted)]"
          >
            {EVENT_LABELS[e] ?? e}
          </span>
        ))}
      </div>

      <div className="flex gap-2 border-t border-[var(--border)] pt-2">
        <button
          type="button"
          onClick={onEdit}
          className="min-h-9 flex-1 rounded-lg bg-[var(--surface-2)] text-sm font-medium transition-colors hover:bg-[var(--border)]"
        >
          تعديل
        </button>
        <DeleteRecipient id={row.id} onError={onError} />
      </div>
    </Card>
  )
}

function DeleteRecipient({ id, onError }: { id: string; onError: (t: string) => void }) {
  const [confirming, setConfirming] = useState(false)
  const [pending, start] = useTransition()

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label="حذف"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--fg-subtle)] transition-colors hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>
    )
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await deleteRecipientAction(id)
          if (res?.error) {
            onError(res.error)
            setConfirming(false)
          }
        })
      }
      className="min-h-9 rounded-lg bg-[var(--color-danger)] px-3 text-xs font-medium text-white disabled:opacity-60"
    >
      {pending ? '…' : 'أكّد'}
    </button>
  )
}

function RecipientForm({
  recipient,
  onDone,
  onError,
}: {
  recipient?: RecipientRow
  onDone: (ok: boolean) => void
  onError: (t: string) => void
}) {
  const [name, setName] = useState(recipient?.name ?? '')
  const [channel, setChannel] = useState(recipient?.channel ?? 'telegram')
  const [target, setTarget] = useState(recipient?.chatId ?? recipient?.phone ?? '')
  const [events, setEvents] = useState<string[]>(recipient?.events ?? ['order_placed'])
  const [pending, start] = useTransition()

  const meta = CHANNEL_META[channel] ?? CHANNEL_META.telegram
  const field =
    'min-h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm focus:border-[var(--primary)] focus:outline-none'

  return (
    <Card className="flex flex-col gap-3 p-4">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="الاسم (اختياري)"
        className={field}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <select value={channel} onChange={(e) => setChannel(e.target.value)} className={field}>
          {Object.entries(CHANNEL_META).map(([key, m]) => (
            <option key={key} value={key}>
              {m.label}
            </option>
          ))}
        </select>
        <input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder={meta.label}
          dir="ltr"
          className={`${field} text-start`}
        />
      </div>
      <p className="-mt-1 text-xs text-[var(--fg-subtle)]">{meta.hint}</p>

      <div className="flex flex-wrap gap-2">
        {Object.entries(EVENT_LABELS).map(([key, label]) => {
          const on = events.includes(key)
          return (
            <button
              key={key}
              type="button"
              aria-pressed={on}
              onClick={() =>
                setEvents((v) => (on ? v.filter((x) => x !== key) : [...v, key]))
              }
              className={`min-h-9 rounded-lg px-3 text-xs font-medium transition-colors ${
                on
                  ? 'bg-[var(--primary)] text-[var(--primary-fg)]'
                  : 'bg-[var(--surface-2)] text-[var(--fg-muted)]'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await saveRecipientAction({
                id: recipient?.id,
                name,
                channel,
                target,
                events,
              })
              if (res?.error) {
                onError(res.error)
                return
              }
              onDone(true)
            })
          }
          className="min-h-10 flex-1 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-fg)] disabled:opacity-60"
        >
          {pending ? 'بيتحفظ…' : 'حفظ'}
        </button>
        <button
          type="button"
          onClick={() => onDone(false)}
          aria-label="إلغاء"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </Card>
  )
}
