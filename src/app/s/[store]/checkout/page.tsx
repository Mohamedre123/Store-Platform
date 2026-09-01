import { notFound } from 'next/navigation'
import { getStore } from '@/lib/storefront'
import { getCurrentCustomer } from '@/lib/customer-auth'
import { CustomerLoginForm } from '../account/login-form'
import { getCheckoutSettings, getDisplayShipping, listPaymentOptions } from '@/lib/checkout'
import { regionsFor } from '@/lib/regions'
import { CheckoutForm } from './checkout-form'
import { EmptyCart } from './empty-cart'
import { ResumeCart } from './resume-cart'

export const dynamic = 'force-dynamic'

/**
 * مهلة تأكيد الطلب.
 *
 * أفعال الخادم بتاخد إعدادات الصفحة اللي بتتنادى منها، والافتراضي
 * على المضيف **عشر ثواني**. تأكيد الطلب بيعمل معاملة كاملة (طلب،
 * سطور، مخزون، حركات، إحصاءات العميل) وبعدها بيفتح جلسة دفع عند
 * البوابة — والبوابة طرف خارجي مالوش سقف نضمنه.
 *
 * أول ما المجموع يعدّي العشرة، المضيف بيقطع الاستدعاء ويرجّع صفحة
 * خطأ عامة. والعميل بيشوف «This page couldn't load» بعد ما دفع
 * وملأ بياناته — وما بيعرفش إذا كان طلبه اتسجّل ولا لأ.
 */
export const maxDuration = 60

export const metadata = { title: 'إتمام الطلب' }

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ store: string }>
  /** `?resume=` جاي من رسائل استرداد السلة المتروكة */
  searchParams: Promise<{ resume?: string }>
}) {
  const { store: identifier } = await params
  const { resume } = await searchParams
  const store = await getStore(identifier)
  if (!store) notFound()

  /**
   * الدخول قبل الطلب.
   *
   * **مش خطوة زيادة — هي اللي بتخلّي الطلب يبقى ليه صاحب.** من غيرها
   * الطلب بيبقى مربوطًا برابط في إيميل، وأي حد يفتح الإيميل بيشوف
   * اسم العميل وعنوانه وتليفونه. وكمان العميل ما بيقدرش يتابع طلبه
   * ولا يشوف اللي فات.
   *
   * والدخول برمز مش بكلمة سر، فالتكلفة على العميل خانة واحدة ورمز —
   * والمكسب إن بياناته مقفولة على حسابه.
   */
  const customer = await getCurrentCustomer(store.id)

  if (!customer) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 sm:px-6 sm:py-16">
        <div className="mb-8 flex flex-col gap-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight">خطوة واحدة وتكمّل</h1>
          <p className="text-sm opacity-65">
            سجّل دخولك عشان طلبك يتحفظ في حسابك وتقدر تتابع حالته. رقمك أو بريدك كفاية.
          </p>
        </div>

        {/* الرمز بيعدّي مع الدخول — وإلا يدخل ويلاقي سلّته لسه فاضية */}
        <CustomerLoginForm
          storeIdentifier={identifier}
          redirectTo={resume ? `/checkout?resume=${encodeURIComponent(resume)}` : '/checkout'}
          compact
        />
      </div>
    )
  }

  const [settings, ship] = await Promise.all([
    getCheckoutSettings(store.id),
    getDisplayShipping(store.id, store.country),
  ])

  /*
    القايمة من `listPaymentOptions` لا مبنية هنا: الدفع السريع من صفحة
    المنتج بيعرض نفس القايمة، ولو كل شاشة بنتها لوحدها أول اختلاف
    بينهم بيبقى عميل شاف طريقة دفع في مكان ومالقاهاش في التاني.
  */
  const options = await listPaymentOptions(store.id, ship.codEnabled)

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="mb-8 text-2xl font-bold tracking-tight sm:text-3xl">إتمام الطلب</h1>

      <ResumeCart storeIdentifier={identifier} token={resume ?? ''}>
        <EmptyCart>
          <CheckoutForm
            storeIdentifier={identifier}
            currency={store.currency}
            country={store.country}
            regions={regionsFor(store.country)}
            shippingByCity={ship.byCity}
            defaultShipping={ship.defaultPrice}
            freeOver={ship.freeOver}
            carrierName={ship.carrierName}
            payments={options}
            account={{ name: customer.name, phone: customer.phone, email: customer.email }}
            config={{
              fieldName: settings?.fieldName ?? 'required',
              fieldPhone: settings?.fieldPhone ?? 'required',
              fieldEmail: settings?.fieldEmail ?? 'optional',
              fieldCity: settings?.fieldCity ?? 'required',
              fieldArea: settings?.fieldArea ?? 'optional',
              fieldStreet: settings?.fieldStreet ?? 'required',
              fieldBuilding: settings?.fieldBuilding ?? 'optional',
              fieldNotes: settings?.fieldNotes ?? 'optional',
              addressMode: settings?.addressMode ?? 'structured',
              showCouponField: settings?.showCouponField ?? true,
              otpEnabled: settings?.otpEnabled ?? false,
              minOrderEnabled: settings?.minOrderEnabled ?? false,
              minOrderAmount: settings?.minOrderAmount ?? 0,
              captureIncomplete: settings?.captureIncompleteOrders ?? true,
            }}
          />
        </EmptyCart>
      </ResumeCart>
    </div>
  )
}
