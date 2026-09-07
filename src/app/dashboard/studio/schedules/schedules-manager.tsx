'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { CalendarClock, Loader2, Play, Plus, Trash2, X } from 'lucide-react'
import {
  deleteScheduleAction,
  runScheduleNowAction,
  saveScheduleAction,
} from '../actions'
import {
  PRESETS,
  WEEKDAYS,
  describeSchedule,
  platformOf,
  type PresetKey,
} from '@/lib/studio-meta'
import { Alert, Button, Card, Field, Input, Textarea } from '@/components/ui'
import { Toggle } from '@/components/dashboard/controls'
import { toast } from '@/components/dashboard/toast'
import { cn, formatDateTime } from '@/lib/utils'

type Schedule = {
  id: string
  name: string
  isActive: boolean
  days: number[]
  timeOfDay: string
  targets: string[]
  source: 'auto' | 'category' | 'products'
  categoryId: string | null
  productIds: string[]
  style: string | null
  preset: string
  media: 'image' | 'video'
  autoPublish: boolean
  lastRunAt: string | null
  nextRunAt: string | null
  lastError: string | null
}

type Draft = Omit<Schedule, 'id' | 'lastRunAt' | 'nextRunAt' | 'lastError'> & { id?: string }

const empty = (): Draft => ({
  name: 'بوست يومي',
  isActive: true,
  /* كل يوم — التاجر بيشيل اللي مش عايزه أسهل من إنه يضيف سبعة */
  days: [0, 1, 2, 3, 4, 5, 6],
  timeOfDay: '10:00',
  targets: [],
  source: 'auto',
  categoryId: null,
  productIds: [],
  style: null,
  preset: 'square',
  /* الصورة الافتراضي — الفيديو أغلى بمراحل والتاجر بيختاره وهو شايف */
  media: 'image',
  autoPublish: false,
})

const SOURCES = [
  { key: 'auto' as const, label: 'كل منتجاتي بالدور', hint: 'بيلفّ عليها واحد ورا التاني' },
  { key: 'category' as const, label: 'قسم معيّن', hint: 'منتجات القسم بس' },
  { key: 'products' as const, label: 'منتجات أختارها', hint: 'اللي تحدّده إنت' },
]

/**
 * محرّر جداول النشر.
 *
 * ## الافتراضي «يستنّى موافقتك»
 * النشر باسم التاجر من غير ما يشوف أول مرة بيخلّي أول غلطة تنزل
 * على صفحته قدام متابعينه. فالجدول بيولّد ويحطّ في «البوستات»،
 * والتاجر بيفتح المفتاح بعد ما يشوف الناتج مرة أو اتنين.
 */
export function SchedulesManager({
  storeTimezone,
  schedules,
  accounts,
  categories,
  products,
}: {
  storeTimezone: string
  schedules: Schedule[]
  accounts: Array<{ id: string; name: string; platform: string }>
  categories: Array<{ id: string; name: string }>
  products: Array<{ id: string; name: string }>
}) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function save() {
    if (!draft) return
    setError(null)
    start(async () => {
      const res = await saveScheduleAction({
        id: draft.id,
        name: draft.name,
        days: draft.days,
        timeOfDay: draft.timeOfDay,
        targets: draft.targets,
        source: draft.source,
        categoryId: draft.categoryId,
        productIds: draft.productIds,
        style: draft.style,
        preset: draft.preset as PresetKey,
        media: draft.media,
        autoPublish: draft.autoPublish,
        isActive: draft.isActive,
      })
      if (res.error) setError(res.error)
      else {
        toast(draft.id ? 'اتحفظ' : 'الجدول اشتغل')
        setDraft(null)
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm leading-relaxed text-[var(--fg-muted)]">
          بيتنفّذ بتوقيت متجرك ({storeTimezone}).
        </p>
        {!draft && (
          <Button size="sm" onClick={() => setDraft(empty())}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            جدول جديد
          </Button>
        )}
      </div>

      {draft && (
        <Card className="flex flex-col gap-4 p-4">
          <Field label="اسم الجدول" htmlFor="s-name">
            <Input
              id="s-name"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              maxLength={60}
            />
          </Field>

          {/* الأيام والميعاد */}
          <Field label="امتى" hint={describeSchedule(draft.days, draft.timeOfDay)}>
            <div className="flex flex-col gap-2.5">
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((w) => {
                  const on = draft.days.includes(w.day)
                  return (
                    <button
                      key={w.day}
                      type="button"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          days: on
                            ? draft.days.filter((d) => d !== w.day)
                            : [...draft.days, w.day].sort(),
                        })
                      }
                      className={cn(
                        'flex h-11 min-w-11 items-center justify-center rounded-lg border px-2.5 text-sm transition-colors',
                        on
                          ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]'
                          : 'border-[var(--border-strong)] text-[var(--fg-muted)]',
                      )}
                    >
                      {w.label}
                    </button>
                  )
                })}
              </div>

              <input
                type="time"
                value={draft.timeOfDay}
                onChange={(e) => setDraft({ ...draft, timeOfDay: e.target.value })}
                aria-label="الساعة"
                className="h-11 w-40 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm focus:border-[var(--primary)] focus:outline-none"
              />
            </div>
          </Field>

          {/* المنتجات */}
          <Field label="ينشر عن إيه">
            <div className="flex flex-col gap-2">
              {SOURCES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setDraft({ ...draft, source: s.key })}
                  className={cn(
                    'flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2.5 text-start transition-colors',
                    draft.source === s.key
                      ? 'border-[var(--primary)] bg-[var(--primary-soft)]'
                      : 'border-[var(--border-strong)]',
                  )}
                >
                  <span
                    className={cn(
                      'text-sm font-medium',
                      draft.source === s.key && 'text-[var(--primary)]',
                    )}
                  >
                    {s.label}
                  </span>
                  <span className="text-xs text-[var(--fg-subtle)]">{s.hint}</span>
                </button>
              ))}
            </div>
          </Field>

          {draft.source === 'category' && (
            <Field label="القسم" htmlFor="s-cat">
              <select
                id="s-cat"
                value={draft.categoryId ?? ''}
                onChange={(e) => setDraft({ ...draft, categoryId: e.target.value || null })}
                className="h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-2.5 text-sm focus:border-[var(--primary)] focus:outline-none"
              >
                <option value="">اختار قسم…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {draft.source === 'products' && (
            <Field label="المنتجات" hint={`${draft.productIds.length} مختار`}>
              <div className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-lg border border-[var(--border)] p-1.5">
                {products.map((p) => {
                  const on = draft.productIds.includes(p.id)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          productIds: on
                            ? draft.productIds.filter((x) => x !== p.id)
                            : [...draft.productIds, p.id],
                        })
                      }
                      className={cn(
                        'flex min-h-11 items-center rounded-lg px-2.5 text-start text-sm transition-colors',
                        on
                          ? 'bg-[var(--primary-soft)] text-[var(--primary)]'
                          : 'hover:bg-[var(--surface-2)]',
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate">{p.name}</span>
                    </button>
                  )
                })}
              </div>
            </Field>
          )}

          {/*
            صورة ولا فيديو.

            التنبيه على التكلفة مكتوب هنا لا في المساعدة: الجدول
            اليومي على الفيديو بيطلّع فاتورة التاجر ما توقّعهاش،
            والرقم ده لازم يشوفه قبل ما يحفظ لا بعد أول فاتورة.
          */}
          <Field
            label="بيعمل إيه"
            hint={
              draft.media === 'video'
                ? 'الفيديو أغلى من الصورة بمراحل — راجع تسعير Veo عند جوجل قبل ما تخلّيه يومي'
                : undefined
            }
          >
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { key: 'image' as const, label: 'صورة', hint: 'أسرع وأرخص' },
                { key: 'video' as const, label: 'فيديو', hint: 'ريلز وتيك توك — بياخد دقايق' },
              ].map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setDraft({ ...draft, media: m.key })}
                  className={cn(
                    'flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2.5 text-start transition-colors',
                    draft.media === m.key
                      ? 'border-[var(--primary)] bg-[var(--primary-soft)]'
                      : 'border-[var(--border-strong)]',
                  )}
                >
                  <span
                    className={cn(
                      'text-sm font-medium',
                      draft.media === m.key && 'text-[var(--primary)]',
                    )}
                  >
                    {m.label}
                  </span>
                  <span className="text-xs text-[var(--fg-subtle)]">{m.hint}</span>
                </button>
              ))}
            </div>
          </Field>

          {/* الشكل */}
          <Field label={draft.media === 'video' ? 'مقاس الفيديو' : 'مقاس الصورة'}>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setDraft({ ...draft, preset: p.key })}
                  className={cn(
                    'flex h-10 items-center rounded-lg border px-3 text-sm transition-colors',
                    draft.preset === p.key
                      ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]'
                      : 'border-[var(--border-strong)] text-[var(--fg-muted)]',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </Field>

          <Field
            label="نبرة البوستات"
            htmlFor="s-style"
            hint="اختياري — بيتلزق في كل بوست بيتولّد"
          >
            <Textarea
              id="s-style"
              rows={3}
              value={draft.style ?? ''}
              onChange={(e) => setDraft({ ...draft, style: e.target.value })}
              placeholder="مثال: خلّي الصور بخلفية فاتحة وبسيطة، والكلام قصير ومباشر، واذكر الشحن المجاني فوق ٥٠٠."
              maxLength={600}
            />
          </Field>

          {/* الوجهات */}
          <Field label="ينشر فين" hint={accounts.length === 0 ? 'مفيش حسابات مربوطة' : undefined}>
            {accounts.length === 0 ? (
              <Link
                href="/dashboard/studio/accounts"
                className="flex h-11 w-fit items-center rounded-lg border border-[var(--border-strong)] px-4 text-sm font-medium"
              >
                اربط صفحاتك
              </Link>
            ) : (
              <div className="flex flex-wrap gap-2">
                {accounts.map((a) => {
                  const on = draft.targets.includes(a.id)
                  const p = platformOf(a.platform)
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          targets: on
                            ? draft.targets.filter((x) => x !== a.id)
                            : [...draft.targets, a.id],
                        })
                      }
                      className={cn(
                        'flex h-11 items-center gap-2 rounded-lg border px-3 text-sm transition-colors',
                        on
                          ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]'
                          : 'border-[var(--border-strong)] text-[var(--fg-muted)]',
                      )}
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: p.color }}
                        aria-hidden="true"
                      />
                      <span className="max-w-[9rem] truncate">{a.name}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </Field>

          {/*
            النشر التلقائي — والافتراضي مقفول.

            التاجر بيشوف الناتج مرة أو اتنين وبعدين بيوثق فيه. الفتح
            من الأول بيخلّي أول غلطة تنزل على صفحته قدام متابعينه.
          */}
          <Toggle
            label="انشر لوحدك من غير ما تستأذنّي"
            hint="مقفول = البوست بيستنّاك في «البوستات» وتدوس نشر."
            checked={draft.autoPublish}
            onChange={(v) => setDraft({ ...draft, autoPublish: v })}
          />

          <Toggle
            label="الجدول شغّال"
            checked={draft.isActive}
            onChange={(v) => setDraft({ ...draft, isActive: v })}
          />

          {error && <Alert tone="danger">{error}</Alert>}

          <div className="flex flex-wrap gap-2">
            <Button onClick={save} loading={pending}>
              {draft.id ? 'احفظ' : 'شغّل الجدول'}
            </Button>
            <Button variant="ghost" onClick={() => setDraft(null)}>
              <X className="h-4 w-4" aria-hidden="true" />
              إلغاء
            </Button>
          </div>
        </Card>
      )}

      {/* ── القايمة ────────────────────────────────────── */}
      {schedules.length === 0 && !draft ? (
        <Card className="flex flex-col items-center gap-2 px-6 py-10 text-center">
          <CalendarClock className="h-7 w-7 text-[var(--fg-subtle)]" aria-hidden="true" />
          <h2 className="font-semibold">مفيش جداول</h2>
          <p className="max-w-md text-sm leading-relaxed text-[var(--fg-muted)]">
            ظبّط واحد وهو هيعمل بوست بصورة وكلام كل يوم في ميعاده — من غير ما تفتح حاجة.
          </p>
        </Card>
      ) : (
        schedules.map((s) => (
          <Card
            key={s.id}
            className={cn('flex flex-wrap items-start gap-3 p-4', !s.isActive && 'opacity-60')}
          >
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{s.name}</span>
                {!s.isActive && (
                  <span className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[11px] text-[var(--fg-muted)]">
                    متوقّف
                  </span>
                )}
                {s.media === 'video' && (
                  <span className="rounded bg-[var(--color-info-soft)] px-1.5 py-0.5 text-[11px] text-[var(--color-info)]">
                    فيديو
                  </span>
                )}
                {s.autoPublish ? (
                  <span className="rounded bg-[var(--color-success-soft)] px-1.5 py-0.5 text-[11px] text-[var(--color-success)]">
                    بينشر لوحده
                  </span>
                ) : (
                  <span className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[11px] text-[var(--fg-muted)]">
                    بيستنّى موافقتك
                  </span>
                )}
              </span>

              <span className="mt-0.5 block text-xs text-[var(--fg-subtle)]">
                {describeSchedule(s.days, s.timeOfDay)}
                {s.nextRunAt && ` · الجاي ${formatDateTime(s.nextRunAt)}`}
              </span>

              {s.lastError && (
                <span className="mt-1 block text-xs text-[var(--color-danger)]">{s.lastError}</span>
              )}
            </span>

            <div className="flex shrink-0 flex-wrap gap-1">
              <Button
                size="sm"
                variant="ghost"
                loading={busy === s.id}
                onClick={() => {
                  setBusy(s.id)
                  start(async () => {
                    const res = await runScheduleNowAction(s.id)
                    setBusy(null)
                    toast(res.error ?? 'اتعمل — شوفه في البوستات')
                  })
                }}
              >
                <Play className="h-4 w-4" aria-hidden="true" />
                جرّبه
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setDraft({
                    id: s.id,
                    name: s.name,
                    isActive: s.isActive,
                    days: s.days,
                    timeOfDay: s.timeOfDay,
                    targets: s.targets,
                    source: s.source,
                    categoryId: s.categoryId,
                    productIds: s.productIds,
                    style: s.style,
                    preset: s.preset,
                    media: s.media,
                    autoPublish: s.autoPublish,
                  })
                }
              >
                تعديل
              </Button>

              <Button
                size="sm"
                variant="ghost"
                aria-label={`احذف ${s.name}`}
                onClick={() => {
                  if (!confirm(`هتحذف «${s.name}»؟`)) return
                  start(async () => {
                    await deleteScheduleAction(s.id)
                    toast('اتحذف')
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
