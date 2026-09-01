'use client'

import { useState } from 'react'
import { Check, Minus, Plus, ShoppingBag } from 'lucide-react'
import { useCart, type CartItem } from './cart'
import { QuickCheckout, type QuickCheckoutSettings } from './quick-checkout'
import { WhatsappIcon } from './whatsapp-icon'

/**
 * زر الإضافة للسلة.
 *
 * بيتحوّل لـ«اتضاف ✓» ثانيتين بعد الضغط — تأكيد فوري في نفس المكان
 * اللي العميل بيبص فيه، بدل ما يستنى الدرج يفتح عشان يعرف إن الطلب نجح.
 *
 * ## والدفع السريع جنبه
 * الكمية والمتغيّر المختار موجودين هنا أصلًا، فتركيب زرار «اشتري
 * دلوقتي» في نفس المكان بيخلّي المنتج بمتغيّرات والمنتج العادي ياخدوا
 * الميزة من غير أي تكرار — `VariantPicker` بيمرّرها لنفس المكوّن.
 */
export function AddToCart({
  item,
  soldOut,
  whatsapp,
  whatsappOrder,
  productUrl,
  productName,
  quick,
}: {
  item: Omit<CartItem, 'quantity'>
  soldOut: boolean
  whatsapp?: string | null
  /** رقم الطلب على واتساب — فاضي لما التاجر قافل الميزة أو مالوش رقم */
  whatsappOrder?: string | null
  /** رابط المنتج — بيتحط في الرسالة عشان التاجر يعرفه من غير ما يسأل */
  productUrl?: string | null
  productName: string
  /** إعدادات الدفع السريع — `null` لما التاجر قافله */
  quick?: QuickCheckoutSettings | null
}) {
  const { add } = useCart()
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)

  const max = item.maxStock ?? 99

  if (soldOut) {
    return (
      <button
        type="button"
        disabled
        className="flex min-h-13 w-full cursor-not-allowed items-center justify-center rounded-[var(--sf-radius)] bg-[var(--sf-text)]/10 px-6 font-semibold opacity-60"
      >
        نفدت الكمية
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="text-sm opacity-70">الكمية</span>
        <div className="flex items-center rounded-[var(--sf-radius)] border border-[var(--sf-text)]/15">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            aria-label="تقليل الكمية"
            className="flex h-11 w-11 items-center justify-center"
          >
            <Minus className="h-4 w-4" aria-hidden="true" />
          </button>
          <span className="tabular w-10 text-center font-medium">{quantity}</span>
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(max, q + 1))}
            disabled={quantity >= max}
            aria-label="زيادة الكمية"
            className="flex h-11 w-11 items-center justify-center disabled:opacity-35"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          add(item, quantity)
          setAdded(true)
          setTimeout(() => setAdded(false), 2000)
        }}
        className="flex min-h-13 w-full items-center justify-center gap-2 rounded-[var(--sf-radius)] bg-[var(--sf-primary)] px-6 font-semibold text-white transition-opacity hover:opacity-90"
      >
        {added ? (
          <>
            <Check className="h-5 w-5" aria-hidden="true" />
            اتضاف للسلة
          </>
        ) : (
          <>
            <ShoppingBag className="h-5 w-5" aria-hidden="true" />
            أضف للسلة
          </>
        )}
      </button>

      {quick && (
        <QuickCheckout
          item={{
            productId: item.productId,
            variantId: item.variantId,
            name: item.name,
            slug: item.slug,
            image: item.image,
            price: item.price,
            maxStock: item.maxStock,
          }}
          quantity={quantity}
          soldOut={soldOut}
          settings={quick}
        />
      )}

      {/*
        الطلب على واتساب — مسار كامل لا سؤال.

        ## ليه ده مختلف عن «اسأل على واتساب»
        السؤال بيفتح محادثة فاضية والعميل بيكتب هو. والطلب بيفتحها
        **بالمنتج والكمية والرابط جاهزين** — التاجر بيرد بسعر الشحن
        ويتفقوا، وخلاص.

        ## وليه بيستاهل يبقى موجود
        فيه تجّار سوقهم كله بيشتري بالمحادثة: بيسأل عن المقاس، وبيتفاوض،
        وبيطمّن على الشحن قبل ما يدفع. الشيك أوت عندهم بيقف قدام البيعة
        بدل ما يسهّلها. ده مش بديل للشيك أوت — ده الطريق التاني جنبه.

        الرسالة بتتكتب بالرابط عشان التاجر يعرف المنتج من غير ما يسأل،
        والكمية معاها لأن «عايز ٣» و«عايز واحد» طلبين مختلفين.
      */}
      {whatsappOrder && (
        <a
          href={`https://wa.me/${whatsappOrder.replace(/[^\d]/g, '')}?text=${encodeURIComponent(
            [
              `السلام عليكم، عايز أطلب:`,
              `• ${item.name}`,
              `• الكمية: ${quantity}`,
              productUrl ? `\n${productUrl}` : '',
            ]
              .filter(Boolean)
              .join('\n'),
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--sf-radius)] bg-[#25D366] px-6 font-semibold text-white transition-opacity hover:opacity-90"
        >
          <WhatsappIcon className="h-5 w-5" />
          اطلب على واتساب
        </a>
      )}

      {whatsapp && (
        <a
          href={`https://wa.me/${whatsapp.replace(/[^\d]/g, '')}?text=${encodeURIComponent(
            `مرحبًا، عايز أستفسر عن: ${productName}`,
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--sf-radius)] border border-[var(--sf-text)]/15 px-6 font-medium transition-colors hover:bg-[var(--sf-text)]/5"
        >
          اسأل على واتساب
        </a>
      )}
    </div>
  )
}
