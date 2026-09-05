'use client'

import { useState, useTransition } from 'react'
import { Check, Copy, Link2, Mail, ShieldCheck, UserPlus, X } from 'lucide-react'
import {
  cancelInviteAction,
  inviteMemberAction,
  setMemberBlockedAction,
  updateMemberAction,
} from './actions'
import { PERMISSIONS, PRESETS, ROLE_LABELS, type Permission } from '@/lib/permissions'
import { Alert, Button, Card, Field, Input } from '@/components/ui'
import { toast } from '@/components/dashboard/toast'
import { cn, formatDate } from '@/lib/utils'

export type MemberRow = {
  id: string
  userId: string
  name: string
  email: string
  role: 'owner' | 'admin' | 'staff'
  permissions: string[]
  isBlocked: boolean
  joinedAt: string | null
}

export type InviteRow = {
  id: string
  email: string
  role: string
  expiresAt: string
}

/**
 * إدارة الفريق.
 *
 * ## الصلاحيات مكتوبة بلغة التاجر لا بلغة النظام
 * «يشوف الفلوس» مش `finance.view`. التاجر بيقرا القايمة دي وهو
 * بيقرّر حاجة حسّاسة — إن الموظف ده يشوف أرباحه ولا لأ — ولو
 * الأسماء تقنية بيدوس «الكل» وينتهي الموضوع.
 *
 * ## الرابط بيتنسخ لا بيتبعت
 * بريد الدعوة بيقع في السبام والتاجر بيفضل مستني. الرابط بيروح على
 * واتساب في ثانية، وهما الاتنين في المحادثة دي أصلًا.
 */
export function TeamManager({
  members,
  invites,
  canManage,
  currentUserId,
}: {
  members: MemberRow[]
  invites: InviteRow[]
  canManage: boolean
  currentUserId: string
}) {
  const [inviting, setInviting] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [freshLink, setFreshLink] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-6">
      {freshLink && <InviteLink url={freshLink} onClose={() => setFreshLink(null)} />}

      {canManage &&
        (inviting ? (
          <InviteForm
            onDone={(url) => {
              setInviting(false)
              if (url) setFreshLink(url)
            }}
          />
        ) : (
          <Button onClick={() => setInviting(true)} className="self-start">
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            ضيف عضو للفريق
          </Button>
        ))}

      <Card className="divide-y divide-[var(--border)]">
        {members.map((m) => (
          <div key={m.id} className="flex flex-col gap-3 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--primary-soft)] text-sm font-bold text-[var(--primary)]">
                {m.name.trim().slice(0, 2) || '؟'}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium">{m.name}</span>
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-[11px] font-medium',
                      m.role === 'owner'
                        ? 'bg-[var(--primary-soft)] text-[var(--primary)]'
                        : 'bg-[var(--surface-2)] text-[var(--fg-muted)]',
                    )}
                  >
                    {ROLE_LABELS[m.role]}
                  </span>
                  {m.userId === currentUserId && (
                    <span className="text-[11px] text-[var(--fg-subtle)]">(إنت)</span>
                  )}
                  {m.isBlocked && (
                    <span className="rounded bg-[var(--color-danger-soft)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--color-danger)]">
                      موقوف
                    </span>
                  )}
                </span>
                <span dir="ltr" className="mt-0.5 block truncate text-start text-xs text-[var(--fg-subtle)]">
                  {m.email}
                </span>
              </span>

              {canManage && m.role !== 'owner' && (
                <span className="flex shrink-0 flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setEditing(editing === m.id ? null : m.id)}
                  >
                    الصلاحيات
                  </Button>
                  <BlockButton id={m.id} blocked={m.isBlocked} />
                </span>
              )}
            </div>

            {m.role === 'owner' ? (
              <p className="text-xs text-[var(--fg-subtle)]">
                المالك عنده كل حاجة، وصلاحياته ما بتتغيّرش — عشان ما يقفلش على نفسه لوحته بغلطة.
              </p>
            ) : editing === m.id ? (
              <PermissionEditor member={m} onDone={() => setEditing(null)} />
            ) : (
              <p className="text-xs leading-relaxed text-[var(--fg-subtle)]">
                {summarize(m.permissions)}
              </p>
            )}
          </div>
        ))}
      </Card>

      {invites.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">دعوات مستنية</h2>
          <Card className="divide-y divide-[var(--border)]">
            {invites.map((i) => (
              <div key={i.id} className="flex flex-wrap items-center gap-3 p-4">
                <Mail className="h-4 w-4 shrink-0 text-[var(--fg-subtle)]" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span dir="ltr" className="block truncate text-start text-sm">
                    {i.email}
                  </span>
                  <span className="text-xs text-[var(--fg-subtle)]">
                    {ROLE_LABELS[i.role as 'admin' | 'staff'] ?? i.role} · بتنتهي{' '}
                    {formatDate(i.expiresAt)}
                  </span>
                </span>
                {canManage && <CancelInvite id={i.id} />}
              </div>
            ))}
          </Card>
        </section>
      )}

      {!canManage && (
        <Alert tone="info">
          إدارة الفريق للمالك بس. لو محتاج تغيير، كلّم صاحب المتجر.
        </Alert>
      )}
    </div>
  )
}

/** وصف مختصر للصلاحيات المفتوحة — عشان التاجر يقرا السطر من غير ما يفتح المحرّر */
function summarize(permissions: string[]): string {
  if (permissions.length === 0) return 'صلاحيات الدور الافتراضية'
  const labels = PERMISSIONS.filter((p) => permissions.includes(p.key)).map((p) => p.label)
  if (labels.length === 0) return 'مفيش صلاحيات مفتوحة'
  if (labels.length <= 3) return labels.join(' · ')
  return `${labels.slice(0, 3).join(' · ')} و${labels.length - 3} غيرها`
}

function InviteForm({ onDone }: { onDone: (url: string | null) => void }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'staff'>('staff')
  const [permissions, setPermissions] = useState<Permission[]>([
    'orders.view',
    'orders.manage',
    'products.view',
  ])
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function submit() {
    setError(null)
    start(async () => {
      const res = await inviteMemberAction({ email, role, permissions })
      if (res?.error) setError(res.error)
      else onDone(res?.inviteUrl ?? null)
    })
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">عضو جديد</h2>
        <button
          type="button"
          onClick={() => onDone(null)}
          aria-label="إغلاق"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <Field
        label="بريده"
        required
        hint="الدعوة مربوطة بالبريد ده — أي حد يفتح الرابط ببريد تاني بيترفض."
      >
        <Input
          dir="ltr"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="text-start"
          placeholder="staff@example.com"
        />
      </Field>

      <Field label="الدور">
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { value: 'staff', label: 'موظف', hint: 'بتحدّد له كل صلاحية بإيدك' },
              { value: 'admin', label: 'مدير', hint: 'كل حاجة عدا الفريق والاشتراك' },
            ] as const
          ).map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                setRole(o.value)
                if (o.value === 'admin') {
                  setPermissions(
                    PERMISSIONS.filter((p) => p.key !== 'team.manage').map((p) => p.key),
                  )
                }
              }}
              aria-pressed={role === o.value}
              className={cn(
                'flex min-h-16 flex-col items-start justify-center gap-0.5 rounded-lg border px-3 py-2 text-start transition-colors',
                role === o.value
                  ? 'border-[var(--primary)] bg-[var(--primary-soft)]'
                  : 'border-[var(--border-strong)] hover:bg-[var(--surface-2)]',
              )}
            >
              <span
                className={cn(
                  'text-sm font-medium',
                  role === o.value && 'text-[var(--primary)]',
                )}
              >
                {o.label}
              </span>
              <span className="text-xs text-[var(--fg-subtle)]">{o.hint}</span>
            </button>
          ))}
        </div>
      </Field>

      {/*
        القوالب فوق الشبكة لا بدالها.

        التاجر بيدوس «ميديا باير» فالصلاحيات بتتحدّد، وبعدين يشوفها
        قدامه ويعدّل لو حابب. لو القالب خفى التفاصيل، كان بيدّي وصولًا
        وهو مش شايف هو بيدّي إيه بالظبط.
      */}
      <Field label="قوالب جاهزة" hint="اختار الأقرب وبعدين عدّل اللي تحته لو محتاج.">
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              title={p.hint}
              onClick={() => {
                setRole(p.role)
                setPermissions([...p.permissions])
              }}
              className="min-h-10 rounded-lg border border-[var(--border-strong)] px-2 text-xs font-medium text-[var(--fg-muted)] transition-colors hover:border-[var(--primary)] hover:bg-[var(--primary-soft)] hover:text-[var(--primary)]"
            >
              {p.label}
            </button>
          ))}
        </div>
      </Field>

      <PermissionGrid value={permissions} onChange={setPermissions} />

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="flex gap-2">
        <Button onClick={submit} loading={pending}>
          اعمل رابط الدعوة
        </Button>
        <Button variant="ghost" onClick={() => onDone(null)}>
          إلغاء
        </Button>
      </div>
    </Card>
  )
}

function PermissionEditor({ member, onDone }: { member: MemberRow; onDone: () => void }) {
  const [role, setRole] = useState<'admin' | 'staff'>(
    member.role === 'admin' ? 'admin' : 'staff',
  )
  const [permissions, setPermissions] = useState<Permission[]>(
    member.permissions as Permission[],
  )
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-4">
      <Field label="الدور">
        <div className="grid grid-cols-2 gap-2">
          {(['staff', 'admin'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              aria-pressed={role === r}
              className={cn(
                'min-h-10 rounded-lg border px-3 text-sm font-medium transition-colors',
                role === r
                  ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]'
                  : 'border-[var(--border-strong)] text-[var(--fg-muted)]',
              )}
            >
              {ROLE_LABELS[r]}
            </button>
          ))}
        </div>
      </Field>

      <PermissionGrid value={permissions} onChange={setPermissions} />

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="flex gap-2">
        <Button
          size="sm"
          loading={pending}
          onClick={() =>
            start(async () => {
              const res = await updateMemberAction({ memberId: member.id, role, permissions })
              if (res?.error) setError(res.error)
              else {
                toast('اتحفظ')
                onDone()
              }
            })
          }
        >
          احفظ
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>
          إلغاء
        </Button>
      </div>
    </div>
  )
}

function PermissionGrid({
  value,
  onChange,
}: {
  value: Permission[]
  onChange: (v: Permission[]) => void
}) {
  return (
    <Field label="يقدر يعمل إيه">
      <div className="flex flex-col gap-1.5">
        {PERMISSIONS.map((p) => {
          const on = value.includes(p.key)
          const risky = p.key === 'finance.view' || p.key === 'team.manage'
          return (
            <button
              key={p.key}
              type="button"
              onClick={() =>
                onChange(on ? value.filter((k) => k !== p.key) : [...value, p.key])
              }
              aria-pressed={on}
              className={cn(
                'flex items-start gap-3 rounded-lg border p-3 text-start transition-colors',
                on
                  ? 'border-[var(--primary)] bg-[var(--primary-soft)]'
                  : 'border-[var(--border-strong)] hover:bg-[var(--surface-2)]',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border',
                  on
                    ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-fg)]'
                    : 'border-[var(--border-strong)]',
                )}
                aria-hidden="true"
              >
                {on && <Check className="h-3 w-3" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  {p.label}
                  {risky && (
                    <ShieldCheck
                      className="h-3.5 w-3.5 text-[var(--color-warning)]"
                      aria-label="صلاحية حسّاسة"
                    />
                  )}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-[var(--fg-subtle)]">
                  {p.hint}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </Field>
  )
}

function InviteLink({ url, onClose }: { url: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)

  return (
    <Card className="flex flex-col gap-3 border-[var(--primary)] bg-[var(--primary-soft)] p-4">
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-[var(--primary)]" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-[var(--primary)]">الرابط جاهز — ابعتهوله</h2>
      </div>

      <p className="text-xs leading-relaxed text-[var(--fg-muted)]">
        شغّال أسبوع، ومربوط ببريده هو. أي حد يفتحه بحساب تاني بيترفض.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <code
          dir="ltr"
          className="min-w-0 flex-1 truncate rounded-lg bg-[var(--surface)] px-3 py-2.5 text-start text-xs"
        >
          {url}
        </code>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(url)
            setCopied(true)
            toast('اتنسخ')
          }}
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-fg)]"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          انسخ
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`ادخل على لوحة المتجر من الرابط ده: ${url}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 shrink-0 items-center rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-4 text-sm font-semibold"
        >
          واتساب
        </a>
        <button
          type="button"
          onClick={onClose}
          aria-label="إخفاء"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:bg-[var(--surface)]"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </Card>
  )
}

function BlockButton({ id, blocked }: { id: string; blocked: boolean }) {
  const [pending, start] = useTransition()
  return (
    <Button
      size="sm"
      variant={blocked ? 'secondary' : 'danger'}
      loading={pending}
      onClick={() =>
        start(async () => {
          const res = await setMemberBlockedAction(id, !blocked)
          if (res?.error) toast(res.error, 'error')
          else toast(blocked ? 'رجع يشتغل' : 'اتوقف')
        })
      }
    >
      {blocked ? 'رجّعه' : 'وقّفه'}
    </Button>
  )
}

function CancelInvite({ id }: { id: string }) {
  const [pending, start] = useTransition()
  return (
    <Button
      size="sm"
      variant="ghost"
      loading={pending}
      onClick={() =>
        start(async () => {
          await cancelInviteAction(id)
          toast('اتلغت')
        })
      }
    >
      ألغِ
    </Button>
  )
}
