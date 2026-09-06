'use client'

import { useMemo, useState, useTransition } from 'react'
import { Gift, Megaphone, PartyPopper, Plus, Sparkles, Trash2, X } from 'lucide-react'
import { deleteNoticeAction, saveNoticeAction, toggleNoticeAction } from './notice-actions'
import { Alert, Button, Card, Field, Input, Textarea } from '@/components/ui'
import { Toggle } from '@/components/dashboard/controls'
import { toast } from '@/components/dashboard/toast'
import { cn } from '@/lib/utils'

export type NoticeRow = {
  id: string
  title: string
  body: string
  ctaLabel: string | null
  ctaHref: string | null
  tone: 'offer' | 'praise' | 'info'
  audience: 'all' | 'stores' | 'rule'
  targetStoreIds: string[]
  minDeliveredOrders: number
  minReferrals: number
  isActive: boolean
}

export type StorePick = { id: string; name: string; accountId: string | null; delivered: number }

type Draft = Omit<NoticeRow, 'id'> & { id?: string }

const empty = (): Draft => ({
  title: '',
  body: '',
  ctaLabel: '',
  ctaHref: '',
  tone: 'offer',
  audience: 'rule',
  targetStoreIds: [],
  minDeliveredOrders: 10,
  minReferrals: 0,
  isActive: true,
})

const TONES = [
  { key: 'offer' as const, label: 'عرض ومكافأة', icon: Gift },
  { key: 'praise' as const, label: 'تهنئة', icon: PartyPopper },
  { key: 'info' as const, label: 'خبر', icon: Sparkles },
]

const AUDIENCES = [
  { key: 'rule' as const, label: 'اللي حقّقوا شرط', hint: 'طلبات مسلَّمة أو إحالات — بيتقاس لحظة العرض' },
  { key: 'stores' as const, label: 'متاجر بعينها', hint: 'تختارهم بالاسم' },
  { key: 'all' as const, label: 'كل التجّار', hint: 'الرسالة بتوصل الكل' },
]

/**
 * محرّر رسايل المنصة.
 *
 * ## الشرط بيتقاس لحظة العرض لا وقت الكتابة
 * الإدارة بتكتب «لكل واحد وصّل ١٠ طلبات» مرة واحدة، والتاجر اللي
 * بيوصل بعد شهر بيشوفها لوحده. القايمة الثابتة كانت هتحتاج حد يفتح
 * اللوحة كل يوم ويضيف الجداد — يعني ميزة بتموت بعد أسبوع.
 *
 * ## والمعاينة بتوري الشكل اللي التاجر هيشوفه
 * الرسالة دي بتنزل في لوحة تجّار حقيقيين. الكتابة على أعمى بتخلّي
 * أول واحدة تنزل بشكل مش مقصود — ومفيش «تراجع» بعد ما تتشاف.
 */
export function NoticesManager({
  notices,
  stores,
}: {
  notices: NoticeRow[]
  stores: StorePick[]
}) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function save() {
    if (!draft) return
    setError(null)
    start(async () => {
      const res = await saveNoticeAction(draft)
      if (res?.error) setError(res.error)
      else {
        toast(draft.id ? 'الرسالة اتحفظت' : 'الرسالة نزلت للتجّار')
        setDraft(null)
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <Megaphone className="h-4 w-4 text-[var(--primary)]" aria-hidden="true" />
            رسايل ومكافآت للتجّار
          </h2>
          <p className="mt-0.5 text-sm leading-relaxed text-[var(--fg-muted)]">
            بتظهر في لوحة التاجر اللي شروطها تنطبق عليه، وبيقدر يقفلها.
          </p>
        </div>
        {!draft && (
          <Button size="sm" onClick={() => setDraft(empty())}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            رسالة جديدة
          </Button>
        )}
      </div>

      {draft && (
        <NoticeForm
          draft={draft}
          setDraft={setDraft}
          stores={stores}
          error={error}
          pending={pending}
          onSave={save}
          onCancel={() => setDraft(null)}
        />
      )}

      {notices.length === 0 && !draft ? (
        <Card className="flex flex-col items-center gap-2 px-6 py-10 text-center">
          <Megaphone className="h-7 w-7 text-[var(--fg-subtle)]" aria-hidden="true" />
          <h3 className="font-semibold">مفيش رسايل</h3>
          <p className="max-w-md text-sm leading-relaxed text-[var(--fg-muted)]">
            اكتب أول عرض — «اللي وصّل ١٠ طلبات ياخد شهر ببلاش» مثلًا — وهيظهر لوحده لكل تاجر
            يوصل للرقم ده، دلوقتي أو بعد شهر.
          </p>
        </Card>
      ) : (
        notices.map((n) => (
          <Card key={n.id} className={cn('flex flex-wrap items-start gap-3 p-4', !n.isActive && 'opacity-60')}>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">{n.title}</span>
                {!n.isActive && (
                  <span className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[11px] text-[var(--fg-muted)]">
                    متوقّفة
                  </span>
                )}
              </span>
              <span className="mt-0.5 block text-xs text-[var(--fg-subtle)]">
                {n.audience === 'all'
                  ? 'كل التجّار'
                  : n.audience === 'stores'
                    ? `${n.targetStoreIds.length} متجر مختار`
                    : [
                        n.minDeliveredOrders > 0 ? `${n.minDeliveredOrders} طلب مسلَّم` : null,
                        n.minReferrals > 0 ? `${n.minReferrals} إحالة` : null,
                      ]
                        .filter(Boolean)
                        .join(' و')}
              </span>
            </span>

            <div className="flex shrink-0 gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setDraft({ ...n, ctaLabel: n.ctaLabel ?? '', ctaHref: n.ctaHref ?? '' })}
              >
                تعديل
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  start(async () => {
                    await toggleNoticeAction(n.id, !n.isActive)
                    toast(n.isActive ? 'اتوقّفت' : 'رجعت شغّالة')
                  })
                }
              >
                {n.isActive ? 'وقّفها' : 'شغّلها'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`احذف ${n.title}`}
                onClick={() => {
                  if (!confirm('هتحذف الرسالة دي خالص؟')) return
                  start(async () => {
                    await deleteNoticeAction(n.id)
                    toast('اتحذفت')
                  })
                }}
              >
                <Trash2 className="h-4 w-4 text-[var(--color-danger)]" aria-hidden="true" />
              </Button>
            </div>
          </Card>
        ))
      )}
    </div>
  )
}

function NoticeForm({
  draft,
  setDraft,
  stores,
  error,
  pending,
  onSave,
  onCancel,
}: {
  draft: Draft
  setDraft: (d: Draft) => void
  stores: StorePick[]
  error: string | null
  pending: boolean
  onSave: () => void
  onCancel: () => void
}) {
  const [query, setQuery] = useState('')

  const matching = useMemo(() => {
    if (draft.audience !== 'rule') return null
    return stores.filter(
      (s) => s.delivered >= draft.minDeliveredOrders,
    ).length
  }, [stores, draft.audience, draft.minDeliveredOrders])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    const picked = stores.filter((s) => draft.targetStoreIds.includes(s.id))
    const rest = stores.filter(
      (s) =>
        !draft.targetStoreIds.includes(s.id) &&
        (!q || s.name.toLowerCase().includes(q) || (s.accountId ?? '').toLowerCase().includes(q)),
    )
    return [...picked, ...rest.slice(0, 30)]
  }, [stores, query, draft.targetStoreIds])

  return (
    <Card className="flex flex-col gap-4 p-4">
      {/* النبرة */}
      <Field label="نوع الرسالة">
        <div className="flex flex-wrap gap-2">
          {TONES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setDraft({ ...draft, tone: t.key })}
              className={cn(
                'flex h-10 items-center gap-2 rounded-lg border px-3 text-sm transition-colors',
                draft.tone === t.key
                  ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]'
                  : 'border-[var(--border-strong)] text-[var(--fg-muted)]',
              )}
            >
              <t.icon className="h-4 w-4" aria-hidden="true" />
              {t.label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="العنوان" required htmlFor="n-title">
        <Input
          id="n-title"
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          placeholder="ألف مبروك — وصّلت ١٠ طلبات"
          maxLength={120}
        />
      </Field>

      <Field
        label="النص"
        required
        htmlFor="n-body"
        hint="اكتب اللي إنت عايزه بالظبط. السطر الجديد بيفضل سطرًا عند التاجر."
      >
        <Textarea
          id="n-body"
          rows={5}
          value={draft.body}
          onChange={(e) => setDraft({ ...draft, body: e.target.value })}
          placeholder={'عشان وصّلت ١٠ طلبات، شهرك الجاي علينا.\nكلّمنا على واتساب وهنفعّله لك على طول.'}
          maxLength={2000}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="نص الزرار" htmlFor="n-cta" hint="اختياري">
          <Input
            id="n-cta"
            value={draft.ctaLabel ?? ''}
            onChange={(e) => setDraft({ ...draft, ctaLabel: e.target.value })}
            placeholder="فعّل مكافأتك"
            maxLength={40}
          />
        </Field>

        <Field label="رابط الزرار" htmlFor="n-href" hint="يبدأ بـ/ أو https://">
          <Input
            id="n-href"
            dir="ltr"
            className="text-start"
            value={draft.ctaHref ?? ''}
            onChange={(e) => setDraft({ ...draft, ctaHref: e.target.value })}
            placeholder="/dashboard/subscription"
            maxLength={300}
          />
        </Field>
      </div>

      {/* الجمهور */}
      <Field label="مين يشوفها">
        <div className="flex flex-col gap-2">
          {AUDIENCES.map((a) => (
            <button
              key={a.key}
              type="button"
              onClick={() => setDraft({ ...draft, audience: a.key })}
              className={cn(
                'flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2.5 text-start transition-colors',
                draft.audience === a.key
                  ? 'border-[var(--primary)] bg-[var(--primary-soft)]'
                  : 'border-[var(--border-strong)]',
              )}
            >
              <span
                className={cn(
                  'text-sm font-medium',
                  draft.audience === a.key && 'text-[var(--primary)]',
                )}
              >
                {a.label}
              </span>
              <span className="text-xs text-[var(--fg-subtle)]">{a.hint}</span>
            </button>
          ))}
        </div>
      </Field>

      {draft.audience === 'rule' && (
        <div className="flex flex-col gap-3">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="طلبات مسلَّمة على الأقل" htmlFor="n-orders" hint="صفر = مش شرط">
              <Input
                id="n-orders"
                type="number"
                min={0}
                inputMode="numeric"
                value={draft.minDeliveredOrders}
                onChange={(e) =>
                  setDraft({ ...draft, minDeliveredOrders: Number(e.target.value) || 0 })
                }
              />
            </Field>

            <Field label="إحالات مشتركة على الأقل" htmlFor="n-refs" hint="صفر = مش شرط">
              <Input
                id="n-refs"
                type="number"
                min={0}
                inputMode="numeric"
                value={draft.minReferrals}
                onChange={(e) => setDraft({ ...draft, minReferrals: Number(e.target.value) || 0 })}
              />
            </Field>
          </div>

          {/*
            كام تاجر ينطبق عليه الشرط دلوقتي.

            الرقم ده بيمنع الإدارة تكتب شرطًا ما ينطبقش على حد
            وتفتكر إن الرسالة نزلت. وبيتحسب على الطلبات المسلَّمة
            بس — الإحالات بتتحسب على الخادم وقت العرض.
          */}
          {matching !== null && (
            <p className="rounded-lg bg-[var(--surface-2)] px-3.5 py-2.5 text-xs text-[var(--fg-muted)]">
              دلوقتي فيه <strong className="tabular">{matching}</strong> متجر وصل لعدد الطلبات ده
              {draft.minReferrals > 0 && ' (شرط الإحالات بيتفحص كمان وقت العرض)'}.
            </p>
          )}
        </div>
      )}

      {draft.audience === 'stores' && (
        <Field label="اختار المتاجر" hint={`${draft.targetStoreIds.length} مختار`}>
          <div className="flex flex-col gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="دوّر باسم المتجر أو معرّف الحساب…"
              aria-label="بحث في المتاجر"
            />
            <div className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-lg border border-[var(--border)] p-1.5">
              {shown.map((s) => {
                const on = draft.targetStoreIds.includes(s.id)
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        targetStoreIds: on
                          ? draft.targetStoreIds.filter((x) => x !== s.id)
                          : [...draft.targetStoreIds, s.id],
                      })
                    }
                    className={cn(
                      'flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 text-start text-sm transition-colors',
                      on
                        ? 'bg-[var(--primary-soft)] text-[var(--primary)]'
                        : 'hover:bg-[var(--surface-2)]',
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{s.name}</span>
                    <span dir="ltr" className="shrink-0 text-xs text-[var(--fg-subtle)]">
                      {s.accountId ?? '—'}
                    </span>
                    <span className="tabular shrink-0 text-xs text-[var(--fg-subtle)]">
                      {s.delivered} مسلَّم
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </Field>
      )}

      {/* معاينة زي ما التاجر هيشوفها */}
      {draft.title && draft.body && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-[var(--fg-muted)]">
            شكلها عند التاجر
          </span>
          <div className="rounded-xl border border-[var(--primary)]/40 bg-[var(--surface-2)] p-4">
            <p className="text-sm font-bold">{draft.title}</p>
            <p className="mt-1.5 whitespace-pre-line text-xs leading-relaxed text-[var(--fg-muted)]">
              {draft.body}
            </p>
            {draft.ctaLabel && (
              <span className="mt-3 inline-flex h-9 items-center rounded-lg bg-[var(--primary)] px-4 text-xs font-semibold text-[var(--primary-fg)]">
                {draft.ctaLabel}
              </span>
            )}
          </div>
        </div>
      )}

      <Toggle
        label="شغّالة"
        checked={draft.isActive}
        onChange={(x) => setDraft({ ...draft, isActive: x })}
      />

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="flex flex-wrap gap-2">
        <Button onClick={onSave} loading={pending}>
          {draft.id ? 'احفظ' : 'نزّلها للتجّار'}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          <X className="h-4 w-4" aria-hidden="true" />
          إلغاء
        </Button>
      </div>
    </Card>
  )
}
