'use client'

import { Check } from 'lucide-react'
import { useCart } from './cart'
import { OptionChips, useVariantChoice } from './option-chips'
import type { ProductOptionSet } from '@/lib/product-options'

/**
 * اختيار الخيارات من جوّه السلة.
 *
 * العميل اللي ضاف منتج ليه مقاسات بضغطة واحدة من الصفحة الرئيسية،
 * لازم يقدر يحدّد مقاسه من مكانه. تحويله لصفحة المنتج معناه إنه
 * يسيب سلته ويبدأ من الأول — وده أكتر مكان بيسيب فيه العملاء
 * الطلب.
 *
 * الاختيار **بيستبدل السطر**: بنشيل السطر بلا مقاس ونحطّ سطرًا
 * بالمقاس وسعره وكميته. سعر المقاس ساعات بيختلف عن سعر المنتج،
 * فتعديل الاسم وحده كان هيخلّي العميل يدفع رقمًا والمعروض رقمًا تاني.
 */
export function CartLineOptions({
  productId,
  name,
  slug,
  image,
  quantity,
  optionSet,
}: {
  productId: string
  name: string
  slug: string
  image?: string
  quantity: number
  optionSet: ProductOptionSet
}) {
  const { remove, add } = useCart()
  const { picked, pick, selected, available } = useVariantChoice(optionSet.options, optionSet.variants)

  const ready = Boolean(selected && selected.stock > 0)

  return (
    <div className="mt-1 flex flex-col gap-2 rounded-[var(--sf-radius)] bg-[var(--sf-primary)]/6 p-2.5">
      <span className="text-xs font-medium text-[var(--sf-primary)]">
        اختار الخيارات عشان نكمّل الطلب
      </span>

      <OptionChips options={optionSet.options} picked={picked} pick={pick} available={available} />

      <button
        type="button"
        disabled={!ready}
        onClick={() => {
          if (!selected) return
          /*
            الترتيب مهم: بنشيل الأول عشان لو كان فيه سطر بنفس المقاس
            أصلًا، الإضافة تجمّع الكميتين بدل ما يفضل سطران لنفس
            الحاجة.
          */
          remove(productId, undefined)
          add(
            {
              productId,
              variantId: selected.id,
              name: `${name} — ${selected.title}`,
              slug,
              image: selected.image ?? image,
              price: selected.price,
              maxStock: selected.stock,
            },
            quantity,
          )
        }}
        className="flex min-h-9 items-center justify-center gap-1.5 rounded-[var(--sf-radius)] bg-[var(--sf-primary)] px-3 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-45"
      >
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
        {ready ? 'تأكيد الاختيار' : 'اختار الأول'}
      </button>
    </div>
  )
}
