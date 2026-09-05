import fs from 'node:fs'

// ١) نوع الأسعار بياخد فرق الطريقة الافتراضية
let f = 'src/lib/checkout-ui.ts'
let s = fs.readFileSync(f, 'utf8')
s = s.replace(`/** أسعار الشحن اللي المتصفح بيحسب بيها — نفس مصدر الخادم */
export type ShippingRates = {
  byCity: Record<string, number>
  defaultPrice: number
  freeOver: number | null
}

export function shippingFor(rates: ShippingRates, city: string, subtotal: number): number {
  if (rates.freeOver !== null && subtotal >= rates.freeOver) return 0
  return rates.byCity[city] ?? rates.defaultPrice
}`,
`/** أسعار الشحن اللي المتصفح بيحسب بيها — نفس مصدر الخادم */
export type ShippingRates = {
  byCity: Record<string, number>
  defaultPrice: number
  freeOver: number | null
  /**
   * فرق الطريقة الافتراضية — أول طريقة شحن مفعّلة عند التاجر.
   *
   * ## ليه لازم يكون هنا
   * الدفع السريع مالوش منتقي طرق عن قصد: هو مسار «منتج واحد من إعلان»
   * وأي شاشة زيادة بتنزّل التحويل. لكن الخادم بيحاسب بأول طريقة —
   * فلو الشاشة حسبت من غير الفرق، العميل يشوف ٥٠ ويتحاسب ٨٠.
   *
   * والفرق ده هو **نفس** اللي `resolveShippingMethod` بيختاره على
   * الخادم لما ما يجيش معرّف.
   */
  methodDelta?: number
}

export function shippingFor(rates: ShippingRates, city: string, subtotal: number): number {
  if (rates.freeOver !== null && subtotal >= rates.freeOver) return 0
  /* الفرق قبل الشحن المجاني — نفس ترتيب الخادم بالحرف */
  return Math.max(0, (rates.byCity[city] ?? rates.defaultPrice) + (rates.methodDelta ?? 0))
}`)
fs.writeFileSync(f, s)

// ٢) صفحة المنتج بتمرّر الفرق
f = 'src/app/s/[store]/products/[slug]/page.tsx'
s = fs.readFileSync(f, 'utf8')
s = s.replace(`            shipping: {
              byCity: ship.byCity,
              defaultPrice: ship.defaultPrice,
              freeOver: ship.freeOver,
            },`, `            shipping: {
              byCity: ship.byCity,
              defaultPrice: ship.defaultPrice,
              freeOver: ship.freeOver,
              /*
                فرق الطريقة الافتراضية — عشان الرقم اللي العميل شافه
                هو اللي بيتحاسب. الخادم بياخد أول طريقة لما ما يجيش
                معرّف، والدفع السريع مالوش منتقي.
              */
              methodDelta: defaultShippingDelta,
            },`)
fs.writeFileSync(f, s)
console.log('ok')
