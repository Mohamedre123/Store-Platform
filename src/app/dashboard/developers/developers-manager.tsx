'use client'

import { useState, useTransition } from 'react'
import { AlertTriangle, Check, Copy, KeyRound, Plus, Trash2, Webhook, X } from 'lucide-react'
import {
  createApiKeyAction,
  deleteWebhookAction,
  reactivateWebhookAction,
  revokeApiKeyAction,
  saveWebhookAction,
} from './actions'
import { API_SCOPES } from '@/lib/api-scopes'
import { WEBHOOK_EVENTS } from '@/lib/webhook-events'
import { Alert, Button, Card } from '@/components/ui'
import { formatDate } from '@/lib/utils'

export type KeyRow = {
  id: string
  name: string
  prefix: string
  scopes: string[]
  lastUsedAt: Date | null
  revokedAt: Date | null
  createdAt: Date
}

export type HookRow = {
  id: string
  url: string
  events: string[]
  isActive: boolean
  failureCount: number
  lastDeliveryAt: Date | null
}

const field =
  'h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm focus:border-[var(--primary)] focus:outline-none'

export function DevelopersManager({
  keys,
  hooks,
  apiBase,
}: {
  keys: KeyRow[]
  hooks: HookRow[]
  apiBase: string
}) {
  return (
    <div className="flex flex-col gap-8">
      <ApiKeysSection keys={keys} apiBase={apiBase} />
      <WebhooksSection hooks={hooks} />
    </div>
  )
}

/* ────────────────────────── المفاتيح ────────────────────────── */

function ApiKeysSection({ keys, apiBase }: { keys: KeyRow[]; apiBase: string }) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [scopes, setScopes] = useState<string[]>(['products:read', 'orders:read'])
  const [newKey, setNewKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [pending, start] = useTransition()

  const active = keys.filter((k) => !k.revokedAt)

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-start gap-2">
        <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]" aria-hidden="true" />
        <div>
          <h2 className="font-semibold">مفاتيح API</h2>
          <p className="mt-0.5 text-sm text-[var(--fg-muted)]">
            لربط أنظمة خارجية بمتجرك — نظام محاسبة، مستودع، أو أي أداة عندك.
          </p>
        </div>
      </div>

      {newKey && (
        <Card className="flex flex-col gap-3 border-[var(--color-success)]/40 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-warning)]" aria-hidden="true" />
            <p className="text-sm">
              <strong>انسخ المفتاح دلوقتي.</strong> مش هيظهر تاني — إحنا بنخزّن هاشه بس، زي كلمة
              المرور بالظبط.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-[var(--surface-2)] px-3 py-2.5 font-mono text-xs" dir="ltr">
              {newKey}
            </code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(newKey)
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              }}
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border-strong)] px-3 text-sm"
            >
              {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
              {copied ? 'اتنسخ' : 'انسخ'}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setNewKey(null)}
            className="w-fit text-sm text-[var(--fg-muted)] hover:underline"
          >
            نسخته، اقفل
          </button>
        </Card>
      )}

      {creating ? (
        <Card className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">مفتاح جديد</h3>
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
            <span className="text-sm font-medium">اسم المفتاح</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="نظام المحاسبة"
              className={field}
            />
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">الصلاحيات</span>
            {API_SCOPES.map((s) => (
              <label key={s.key} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={scopes.includes(s.key)}
                  onChange={(e) =>
                    setScopes(
                      e.target.checked ? [...scopes, s.key] : scopes.filter((x) => x !== s.key),
                    )
                  }
                  className="h-4 w-4 accent-[var(--primary)]"
                />
                <span>{s.label}</span>
                <code className="font-mono text-xs text-[var(--fg-subtle)]" dir="ltr">
                  {s.key}
                </code>
              </label>
            ))}
          </div>

          <Button
            onClick={() =>
              start(async () => {
                setError(null)
                const res = await createApiKeyAction({ name, scopes })
                if (res?.error) setError(res.error)
                else {
                  setNewKey(res?.rawKey ?? null)
                  setCreating(false)
                  setName('')
                }
              })
            }
            loading={pending}
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            أنشئ المفتاح
          </Button>
        </Card>
      ) : (
        <Button variant="secondary" onClick={() => setCreating(true)} className="self-start">
          <Plus className="h-4 w-4" aria-hidden="true" />
          مفتاح جديد
        </Button>
      )}

      {active.length > 0 &&
        active.map((k) => <KeyCard key={k.id} row={k} />)}

      <Card className="flex flex-col gap-2 p-4">
        <span className="text-sm font-medium">نقاط النهاية</span>
        <code className="overflow-x-auto rounded-lg bg-[var(--surface-2)] px-3 py-2 font-mono text-xs" dir="ltr">
          GET&nbsp;&nbsp;&nbsp;{apiBase}/api/v1/products
          <br />
          PATCH&nbsp;{apiBase}/api/v1/products
          <br />
          GET&nbsp;&nbsp;&nbsp;{apiBase}/api/v1/orders
          <br />
          PATCH&nbsp;{apiBase}/api/v1/orders
        </code>
        <p className="text-xs text-[var(--fg-subtle)]">
          الترويسة: <code dir="ltr">Authorization: Bearer zw_...</code> — وكل المبالغ بالقرش (رقم صحيح).
        </p>
      </Card>
    </section>
  )
}

function KeyCard({ row: k }: { row: KeyRow }) {
  const [pending, start] = useTransition()
  const [confirming, setConfirming] = useState(false)

  return (
    <Card className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
      <div className="min-w-0 flex-1">
        <span className="font-medium">{k.name}</span>
        <span className="mt-0.5 block font-mono text-xs text-[var(--fg-subtle)]" dir="ltr">
          {k.prefix}··· · {k.scopes.length} صلاحية
          {k.lastUsedAt ? ` · آخر استخدام ${formatDate(k.lastUsedAt)}` : ' · ما اتستخدمش'}
        </span>
      </div>

      {confirming ? (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => start(() => revokeApiKeyAction(k.id).then(() => {}))}
            disabled={pending}
            className="rounded-lg bg-[var(--color-danger)] px-3 py-2 text-sm font-medium text-white"
          >
            تأكيد الإلغاء
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded-lg px-2 py-2 text-sm text-[var(--fg-muted)]"
          >
            تراجع
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded-lg border border-[var(--border-strong)] px-3 py-2 text-sm text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)]"
        >
          إلغاء المفتاح
        </button>
      )}
    </Card>
  )
}

/* ────────────────────────── الويب هوكس ────────────────────────── */

function WebhooksSection({ hooks }: { hooks: HookRow[] }) {
  const [creating, setCreating] = useState(false)
  const [url, setUrl] = useState('')
  const [events, setEvents] = useState<string[]>(['order.created'])
  const [secret, setSecret] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  return (
    <section className="flex flex-col gap-3 border-t border-[var(--border)] pt-6">
      <div className="flex items-start gap-2">
        <Webhook className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]" aria-hidden="true" />
        <div>
          <h2 className="font-semibold">الويب هوكس</h2>
          <p className="mt-0.5 text-sm text-[var(--fg-muted)]">
            بنبعتلك إشعارًا فوريًا على رابطك أول ما يحصل حدث في متجرك.
          </p>
        </div>
      </div>

      {secret && (
        <Card className="flex flex-col gap-2 border-[var(--color-success)]/40 p-4">
          <p className="text-sm">
            <strong>سر التوقيع</strong> — استخدمه عشان تتأكد إن الرسالة منّنا. مش هيظهر تاني.
          </p>
          <code className="overflow-x-auto rounded-lg bg-[var(--surface-2)] px-3 py-2 font-mono text-xs" dir="ltr">
            {secret}
          </code>
          <p className="text-xs text-[var(--fg-subtle)]">
            التوقيع بيجي في ترويسة <code dir="ltr">X-Zawya-Signature</code> بصيغة HMAC-SHA256 لجسم الطلب.
          </p>
          <button
            type="button"
            onClick={() => setSecret(null)}
            className="w-fit text-sm text-[var(--fg-muted)] hover:underline"
          >
            نسخته، اقفل
          </button>
        </Card>
      )}

      {creating ? (
        <Card className="flex flex-col gap-4 p-5">
          {error && <Alert tone="danger">{error}</Alert>}

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">الرابط</span>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              dir="ltr"
              placeholder="https://example.com/hooks/zawya"
              className={`${field} text-start`}
            />
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">الأحداث</span>
            {WEBHOOK_EVENTS.map((e) => (
              <label key={e.key} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={events.includes(e.key)}
                  onChange={(ev) =>
                    setEvents(
                      ev.target.checked ? [...events, e.key] : events.filter((x) => x !== e.key),
                    )
                  }
                  className="h-4 w-4 accent-[var(--primary)]"
                />
                <span>{e.label}</span>
                <code className="font-mono text-xs text-[var(--fg-subtle)]" dir="ltr">
                  {e.key}
                </code>
              </label>
            ))}
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() =>
                start(async () => {
                  setError(null)
                  const res = await saveWebhookAction({ url, events })
                  if (res?.error) setError(res.error)
                  else {
                    setSecret(res?.secret ?? null)
                    setCreating(false)
                    setUrl('')
                  }
                })
              }
              loading={pending}
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              أضف الويب هوك
            </Button>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              إلغاء
            </Button>
          </div>
        </Card>
      ) : (
        <Button variant="secondary" onClick={() => setCreating(true)} className="self-start">
          <Plus className="h-4 w-4" aria-hidden="true" />
          ويب هوك جديد
        </Button>
      )}

      {hooks.map((h) => (
        <HookCard key={h.id} row={h} />
      ))}
    </section>
  )
}

function HookCard({ row: h }: { row: HookRow }) {
  const [pending, start] = useTransition()

  return (
    <Card className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
      <div className="min-w-0 flex-1">
        <bdi dir="ltr" className="block truncate text-start font-mono text-sm">
          {h.url}
        </bdi>
        <span className="mt-0.5 block text-xs text-[var(--fg-subtle)]">
          {h.events.length} حدث
          {h.lastDeliveryAt && ` · آخر إرسال ${formatDate(h.lastDeliveryAt)}`}
          {h.failureCount > 0 && ` · ${h.failureCount} فشل`}
        </span>
      </div>

      {!h.isActive && (
        <button
          type="button"
          onClick={() => start(() => reactivateWebhookAction(h.id).then(() => {}))}
          disabled={pending}
          className="rounded-lg bg-[var(--color-warning-soft)] px-3 py-2 text-sm font-medium text-[var(--color-warning)]"
        >
          اتوقف — أعد التفعيل
        </button>
      )}

      <button
        type="button"
        onClick={() => start(() => deleteWebhookAction(h.id).then(() => {}))}
        disabled={pending}
        aria-label="حذف"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--fg-muted)] transition-colors hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>
    </Card>
  )
}
