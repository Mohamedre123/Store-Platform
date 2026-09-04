'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { ImageOff, RotateCcw, Trash2, X } from 'lucide-react'
import { purgeProductAction, restoreProductAction } from '../actions'
import { Button, Card } from '@/components/ui'
import { toast } from '@/components/dashboard/toast'
import { formatDate, formatMoney } from '@/lib/utils'

export type TrashRow = {
  id: string
  name: string
  price: number
  image: string | null
  deletedAt: string
}

/**
 * سلة المهملات.
 *
 * ## ليه الاسترجاع بيرجّعه مسوّدة
 * المنتج اللي اتحذف من شهر ممكن يكون سعره اتغيّر أو مخزونه خلص.
 * رجوعه للمتجر فورًا معناه إن عميلًا يشتري حاجة التاجر مش مستعد
 * يبيعها — والمسوّدة بتخلّيه يراجع وينشر بإيده.
 *
 * ## ومفيش مسح تلقائي
 * المنتجات بتفضل هنا لحد ما التاجر يمسحها. المسح التلقائي بعد شهر
 * بيبان مرتبًا في الورق، لكنه بيمسح شغل حد من غير ما يقوله — والتاجر
 * اللي رجع يدوّر على منتج بعد إجازة بيلاقيه راح بلا سبب واضح.
 */
export function TrashManager({ rows, currency }: { rows: TrashRow[]; currency: string }) {
  if (rows.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 px-6 py-14 text-center">
        <Trash2 className="h-8 w-8 text-[var(--fg-subtle)]" aria-hidden="true" />
        <h2 className="text-lg font-semibold">السلة فاضية</h2>
        <p className="max-w-md text-sm leading-relaxed text-[var(--fg-muted)]">
          أي منتج تحذفه بيقعد هنا بصوره وبياناته لحد ما ترجّعه أو تمسحه نهائيًا. الطلبات القديمة
          عليه ما بتتأثرش في الحالتين — الفاتورة شايلة لقطة من المنتج وقت الشرا.
        </p>
      </Card>
    )
  }

  return (
    <Card className="divide-y divide-[var(--border)]">
      {rows.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center gap-3 p-4">
          {r.image ? (
            <Image
              src={r.image}
              alt=""
              width={44}
              height={44}
              className="h-11 w-11 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-2)] text-[var(--fg-subtle)]">
              <ImageOff className="h-4 w-4" aria-hidden="true" />
            </span>
          )}

          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{r.name}</span>
            <span className="tabular mt-0.5 block text-xs text-[var(--fg-subtle)]">
              {formatMoney(r.price, currency)} · اتحذف {formatDate(r.deletedAt)}
            </span>
          </span>

          <span className="flex shrink-0 gap-2">
            <RestoreButton id={r.id} />
            <PurgeButton id={r.id} name={r.name} />
          </span>
        </div>
      ))}
    </Card>
  )
}

function RestoreButton({ id }: { id: string }) {
  const [pending, start] = useTransition()
  return (
    <Button
      size="sm"
      variant="secondary"
      loading={pending}
      onClick={() =>
        start(async () => {
          await restoreProductAction(id)
          toast('رجع مسوّدة — راجعه وانشره')
        })
      }
    >
      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
      رجّعه
    </Button>
  )
}

function PurgeButton({ id, name }: { id: string; name: string }) {
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
              await purgeProductAction(id)
              toast('اتمسح نهائيًا')
            })
          }
          className="h-9 rounded-lg bg-[var(--color-danger)] px-3 text-xs font-semibold text-white disabled:opacity-60"
        >
          امسحه خالص
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
    <Button size="sm" variant="ghost" onClick={() => setConfirming(true)} aria-label={`امسح ${name} نهائيًا`}>
      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
      امسح
    </Button>
  )
}
