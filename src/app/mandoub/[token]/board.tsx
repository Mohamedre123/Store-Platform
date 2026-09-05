'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  Banknote,
  Check,
  ChevronDown,
  MapPin,
  Package,
  Phone,
  Truck,
  X,
} from 'lucide-react'
import { courierDeliverAction, courierFailAction, courierPickupAction } from './actions'
import type { CourierTask } from '@/lib/couriers-meta'
import { cn, formatMoney } from '@/lib/utils'

/**
 * لوحة المندوب.
 *
 * ## مبنية للشارع لا للمكتب
 * المندوب واقف على موتوسيكل، بإيد واحدة، والشمس على الشاشة. عشان
 * كده:
 * - الأزرار كبيرة (٤٨ بكسل) ومتباعدة — الضغط الغلط هنا معناه طلب
 *   اتعلّم «اتسلّم» وهو لسه في الشنطة
 * - رقم التليفون والعنوان أول حاجة في الكارت، وكلاهما بيتضغط:
 *   التليفون بيتصل، والعنوان بيفتح خرايط
 * - المبلغ اللي هيحصّله بخط كبير — ده الرقم اللي بيغلط فيه
 * - و«اتسلّم» بيطلب تأكيدًا للتحصيل، مش بيفترضه
 *
 * ## والتجميع بالحالة لا بالتاريخ
 * «في الشنطة» فوق و«خرجت بيها» تحتها و«خلصت» في الآخر مطويّة.
 * الترتيب الزمني كان بيخلّط اللي خلص باللي لسه، والمندوب بيفضل
 * ينزّل ويطلع عشان يعرف فاضل إيه.
 */
export function CourierBoard({
  token,
  courierName,
  storeName,
  storePhone,
  currency,
  feePerOrder,
  tasks,
}: {
  token: string
  courierName: string
  storeName: string
  storePhone: string | null
  currency: string
  feePerOrder: number
  tasks: CourierTask[]
}) {
  const [showDone, setShowDone] = useState(false)

  const { pending, out, done } = useMemo(() => {
    const pending: CourierTask[] = []
    const out: CourierTask[] = []
    const done: CourierTask[] = []
    for (const t of tasks) {
      if (t.status === 'delivered' || t.status === 'failed' || t.status === 'returned') done.push(t)
      else if (t.status === 'out_for_delivery') out.push(t)
      else pending.push(t)
    }
    return { pending, out, done }
  }, [tasks])

  const open = [...pending, ...out]
  /* اللي المفروض يرجع بيه — التحصيل اللي لسه ما اتعلّمش */
  const toCollect = open.reduce((s, t) => s + (t.isCodCollected ? 0 : t.codAmount), 0)
  const collected = tasks.reduce((s, t) => s + (t.isCodCollected ? t.codAmount : 0), 0)
  const earned = done.filter((t) => t.status === 'delivered').length * feePerOrder

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-4 bg-[var(--bg)] p-4 pb-24">
      {/* ────────── الرأس ────────── */}
      <header className="flex flex-col gap-1">
        <p className="text-xs text-[var(--fg-subtle)]">{storeName}</p>
        <h1 className="text-xl font-bold">أهلًا {courierName}</h1>
      </header>

      {/* ────────── أرقام اليوم ────────── */}
      <div className="grid grid-cols-3 gap-2">
        <Tile label="معاك" value={String(open.length)} />
        <Tile label="حصّلت" value={formatMoney(collected, currency)} tone="success" />
        {feePerOrder > 0 ? (
          <Tile label="أجرتك" value={formatMoney(earned, currency)} tone="primary" />
        ) : (
          <Tile label="وصّلت" value={String(done.filter((t) => t.status === 'delivered').length)} />
        )}
      </div>

      {toCollect > 0 && (
        <div className="flex items-center gap-2 rounded-xl bg-[var(--color-warning-soft)] px-3.5 py-2.5 text-sm text-[var(--color-warning)]">
          <Banknote className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            لسه هتحصّل <strong className="tabular">{formatMoney(toCollect, currency)}</strong> من
            الطلبات اللي معاك.
          </span>
        </div>
      )}

      {/* ────────── الطلبات ────────── */}
      {open.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--border)] px-6 py-14 text-center">
          <Package className="h-8 w-8 text-[var(--fg-subtle)]" aria-hidden="true" />
          <h2 className="text-lg font-semibold">مفيش طلبات معاك</h2>
          <p className="text-sm text-[var(--fg-muted)]">
            أول ما {storeName} يسندلك طلب هيبان هنا على طول.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {open.map((t) => (
            <TaskCard key={t.shipmentId} task={t} token={token} currency={currency} />
          ))}
        </div>
      )}

      {/* ────────── اللي خلص ────────── */}
      {done.length > 0 && (
        <section className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setShowDone((v) => !v)}
            className="flex h-11 items-center justify-between rounded-xl border border-[var(--border)] px-4 text-sm font-medium"
            aria-expanded={showDone}
          >
            <span>خلصت النهاردة ({done.length})</span>
            <ChevronDown
              className={cn('h-4 w-4 transition-transform', showDone && 'rotate-180')}
              aria-hidden="true"
            />
          </button>

          {showDone && (
            <div className="flex flex-col gap-2">
              {done.map((t) => (
                <div
                  key={t.shipmentId}
                  className="flex items-center gap-3 rounded-xl border border-[var(--border)] p-3"
                >
                  <span
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                      t.status === 'delivered'
                        ? 'bg-[var(--color-success-soft)] text-[var(--color-success)]'
                        : 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]',
                    )}
                  >
                    {t.status === 'delivered' ? (
                      <Check className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <X className="h-4 w-4" aria-hidden="true" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {t.customerName || 'بلا اسم'}
                    </span>
                    <span className="tabular block text-xs text-[var(--fg-subtle)]">
                      #{t.orderNumber} · {t.status === 'delivered' ? 'اتسلّم' : 'ما اتسلّمش'}
                    </span>
                  </span>
                  {t.isCodCollected && t.codAmount > 0 && (
                    <span className="tabular shrink-0 text-xs text-[var(--color-success)]">
                      {formatMoney(t.codAmount, currency)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {storePhone && (
        <a
          href={`tel:${storePhone}`}
          className="mt-2 flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border-strong)] text-sm font-medium"
        >
          <Phone className="h-4 w-4" aria-hidden="true" />
          كلّم {storeName}
        </a>
      )}
    </div>
  )
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'success' | 'primary'
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border border-[var(--border)] px-3 py-2.5">
      <span className="text-[11px] text-[var(--fg-subtle)]">{label}</span>
      <span
        className={cn(
          'tabular truncate text-sm font-bold',
          tone === 'success' && 'text-[var(--color-success)]',
          tone === 'primary' && 'text-[var(--primary)]',
        )}
      >
        {value}
      </span>
    </div>
  )
}

/* ────────────────────────── كارت طلب ────────────────────────── */

function TaskCard({
  task,
  token,
  currency,
}: {
  task: CourierTask
  token: string
  currency: string
}) {
  const [busy, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<'deliver' | 'fail' | null>(null)

  const mapsUrl = task.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        [task.address, task.city].filter(Boolean).join('، '),
      )}`
    : null

  function run(fn: () => Promise<{ ok?: boolean; error?: string } | null>) {
    setError(null)
    start(async () => {
      const res = await fn()
      if (res?.error) setError(res.error)
      else setConfirming(null)
    })
  }

  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] p-4">
      {/* العميل */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-bold">{task.customerName || 'بلا اسم'}</h2>
          <p className="tabular text-xs text-[var(--fg-subtle)]">#{task.orderNumber}</p>
        </div>
        {task.status === 'out_for_delivery' && (
          <span className="shrink-0 rounded-full bg-[var(--primary-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--primary)]">
            في الطريق
          </span>
        )}
      </div>

      {/* المبلغ — أكبر حاجة في الكارت */}
      {task.codAmount > 0 ? (
        <div className="flex items-baseline gap-2 rounded-xl bg-[var(--color-warning-soft)] px-3 py-2.5">
          <span className="text-xs text-[var(--color-warning)]">تحصّل</span>
          <span className="tabular text-xl font-bold text-[var(--color-warning)]">
            {formatMoney(task.codAmount, currency)}
          </span>
        </div>
      ) : (
        <div className="rounded-xl bg-[var(--color-success-soft)] px-3 py-2 text-xs font-medium text-[var(--color-success)]">
          مدفوع — ما تاخدش منه فلوس
        </div>
      )}

      {/* التواصل والعنوان */}
      <div className="flex flex-col gap-2">
        {task.customerPhone && (
          <a
            href={`tel:${task.customerPhone}`}
            className="flex h-12 items-center gap-2.5 rounded-xl border border-[var(--border-strong)] px-3.5 text-sm font-medium"
          >
            <Phone className="h-4 w-4 shrink-0 text-[var(--fg-muted)]" aria-hidden="true" />
            <span dir="ltr" className="text-start">
              {task.customerPhone}
            </span>
          </a>
        )}

        {task.address && (
          <a
            href={mapsUrl ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-12 items-start gap-2.5 rounded-xl border border-[var(--border-strong)] px-3.5 py-3 text-sm"
          >
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--fg-muted)]" aria-hidden="true" />
            <span className="min-w-0 leading-relaxed">
              {task.address}
              {task.city && <span className="text-[var(--fg-muted)]">، {task.city}</span>}
            </span>
          </a>
        )}
      </div>

      {task.itemsSummary && (
        <p className="text-xs leading-relaxed text-[var(--fg-muted)]">{task.itemsSummary}</p>
      )}

      {task.notes && (
        <p className="rounded-lg bg-[var(--surface-2)] px-3 py-2 text-xs leading-relaxed">
          <strong>ملاحظة العميل:</strong> {task.notes}
        </p>
      )}

      {error && (
        <p className="rounded-lg bg-[var(--color-danger-soft)] px-3 py-2 text-xs text-[var(--color-danger)]" role="alert">
          {error}
        </p>
      )}

      {/* ────────── الأفعال ────────── */}
      {confirming === 'deliver' ? (
        <div className="flex flex-col gap-2 rounded-xl border border-[var(--border-strong)] p-3">
          <p className="text-sm font-medium">
            {task.codAmount > 0
              ? `خدت ${formatMoney(task.codAmount, currency)} من العميل؟`
              : 'العميل استلم الطلب؟'}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => courierDeliverAction(token, task.shipmentId, task.codAmount > 0))}
              className="h-12 flex-1 rounded-xl bg-[var(--color-success)] text-sm font-bold text-white disabled:opacity-50"
            >
              {task.codAmount > 0 ? 'أيوه خدت الفلوس' : 'أيوه استلم'}
            </button>
            {task.codAmount > 0 && (
              <button
                type="button"
                disabled={busy}
                onClick={() => run(() => courierDeliverAction(token, task.shipmentId, false))}
                className="h-12 flex-1 rounded-xl border border-[var(--border-strong)] text-sm font-medium disabled:opacity-50"
              >
                سلّمته من غير فلوس
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setConfirming(null)}
            className="h-9 text-xs text-[var(--fg-muted)]"
          >
            رجوع
          </button>
        </div>
      ) : confirming === 'fail' ? (
        <FailForm
          busy={busy}
          onCancel={() => setConfirming(null)}
          onSubmit={(reason) => run(() => courierFailAction(token, task.shipmentId, reason))}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {task.status !== 'out_for_delivery' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => courierPickupAction(token, task.shipmentId))}
              className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] text-sm font-bold text-[var(--primary-fg)] disabled:opacity-50"
            >
              <Truck className="h-4 w-4" aria-hidden="true" />
              خرجت بيه
            </button>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirming('deliver')}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--color-success)] text-sm font-bold text-white disabled:opacity-50"
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              اتسلّم
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirming('fail')}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--border-strong)] text-sm font-medium text-[var(--color-danger)] disabled:opacity-50"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              معرفتش
            </button>
          </div>
        </div>
      )}
    </article>
  )
}

/**
 * سبب الفشل — أزرار جاهزة لا خانة كتابة.
 *
 * المندوب مش هيكتب على الموبايل وهو واقف. الأسباب الأربعة دي هي
 * اللي بتحصل فعلًا، والتاجر محتاج يفرّق بينهم: «الرقم غلط» بيروح
 * لقايمة الحظر، و«مردّش» بيتعاد تاني بكرة.
 */
function FailForm({
  busy,
  onCancel,
  onSubmit,
}: {
  busy: boolean
  onCancel: () => void
  onSubmit: (reason: string) => void
}) {
  const REASONS = ['مردّش على التليفون', 'رفض يستلم', 'العنوان غلط', 'مش موجود دلوقتي']

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[var(--border-strong)] p-3">
      <p className="text-sm font-medium">إيه اللي حصل؟</p>
      {REASONS.map((r) => (
        <button
          key={r}
          type="button"
          disabled={busy}
          onClick={() => onSubmit(r)}
          className="h-12 rounded-xl border border-[var(--border-strong)] px-3 text-start text-sm disabled:opacity-50"
        >
          {r}
        </button>
      ))}
      <button type="button" onClick={onCancel} className="h-9 text-xs text-[var(--fg-muted)]">
        رجوع
      </button>
    </div>
  )
}
