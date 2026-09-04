'use client'

import { useState } from 'react'
import { ArrowUpRight, Layers, Plus } from 'lucide-react'
import { ProductPicker } from '../storefront/product-picker'
import type { PickerCategory } from '../storefront/picker-actions'
import { Card, Field } from '@/components/ui'

/**
 * اقتراحات المنتج — المرتبطة والترقية.
 *
 * ## الاتنين مفصولين عن قصد
 * «المرتبطة» بتتعرض تحت («خد ده كمان»)، و«الترقية» جنب زرار الشرا
 * («فيه أحسن منه بكام زيادة»). خلطهم في قايمة واحدة بيضيّع الاتنين:
 * العميل اللي بيدوّر على الأرخص مش بيدوّر على «مع»، واللي عايز يزوّد
 * سلّته مش عايز بديل.
 *
 * ## والفاضي مش معطّل
 * سايبهم فاضيين؟ المتجر بيقترح من نفس القسم لوحده. الاختيار هنا
 * بيغلب التلقائي لما التاجر يعمله — فالمتجر بألف منتج ما بيقفش عن
 * الاقتراح لحد ما يفتح كل منتج.
 */
export function SuggestionsEditor({
  categories,
  currency,
  initialRelated,
  initialUpsell,
}: {
  categories: PickerCategory[]
  currency: string
  initialRelated: string[]
  initialUpsell: string[]
}) {
  const [related, setRelated] = useState<string[]>(initialRelated)
  const [upsell, setUpsell] = useState<string[]>(initialUpsell)
  const [open, setOpen] = useState<'related' | 'upsell' | null>(null)

  return (
    <Card className="flex flex-col gap-5 p-5">
      <div className="flex flex-col gap-1">
        <h2 className="font-semibold">اقتراحات مع المنتج</h2>
        <p className="text-xs leading-relaxed text-[var(--fg-subtle)]">
          سيبهم فاضيين والمتجر هيقترح من نفس القسم لوحده. اختار بنفسك لما تعرف حاجة التلقائي مش
          هيعرفها — إن الجراب ده بتاع الموبايل ده بالذات.
        </p>
      </div>

      <input type="hidden" name="relatedProductIds" value={related.join(',')} />
      <input type="hidden" name="upsellProductIds" value={upsell.join(',')} />

      <Field
        label="بيتشافوا معاه"
        hint="بيظهروا تحت المنتج تحت عنوان «منتجات ممكن تعجبك»."
      >
        <PickButton
          icon={Layers}
          count={related.length}
          onClick={() => setOpen('related')}
          emptyLabel="اختار منتجات"
        />
      </Field>

      <Field
        label="ترقية — الأفضل منه"
        hint="بيظهروا جنب زرار الشرا بفرق السعر. المنتج الأرخص من ده بيتخطّى تلقائيًا — «رقّي لأرخص» مالهاش معنى."
      >
        <PickButton
          icon={ArrowUpRight}
          count={upsell.length}
          onClick={() => setOpen('upsell')}
          emptyLabel="اختار منتجات أغلى"
        />
      </Field>

      <ProductPicker
        open={open === 'related'}
        value={related}
        categories={categories}
        currency={currency}
        onClose={() => setOpen(null)}
        onChange={setRelated}
      />
      <ProductPicker
        open={open === 'upsell'}
        value={upsell}
        categories={categories}
        currency={currency}
        onClose={() => setOpen(null)}
        onChange={setUpsell}
      />
    </Card>
  )
}

function PickButton({
  icon: Icon,
  count,
  onClick,
  emptyLabel,
}: {
  icon: typeof Layers
  count: number
  onClick: () => void
  emptyLabel: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 w-full items-center gap-2.5 rounded-lg border border-[var(--border-strong)] px-3 text-sm font-medium transition-colors hover:bg-[var(--surface-2)]"
    >
      <Icon className="h-4 w-4 shrink-0 text-[var(--fg-subtle)]" aria-hidden="true" />
      <span className="flex-1 text-start">
        {count > 0 ? `${count} منتج مختار` : emptyLabel}
      </span>
      <Plus className="h-4 w-4 shrink-0 text-[var(--fg-subtle)]" aria-hidden="true" />
    </button>
  )
}
