'use server'

import { getStore } from '@/lib/storefront'
import { getCurrentCustomer } from '@/lib/customer-auth'
import { captureIncompleteOrder } from './checkout/actions'

/**
 * التقاط السلة **لحظة الإضافة** لا لحظة الشيك أوت.
 *
 * ## المشكلة اللي بيحلّها
 * الطلب الناقص كان بيتسجّل أول ما العميل يكتب رقمه في الشيك أوت. يعني
 * اللي حطّ في سلته وسابها من غير ما يوصل للشيك أوت أصلًا — وده أغلب
 * اللي بيسيبوا — كان بيختفي تمامًا: التاجر ما يعرفش إن حد كان قرّب
 * يشتري، ولا عنده رقم يكلّمه.
 *
 * دلوقتي أول ما العميل المسجَّل يضيف منتج، السلة بتظهر في «السلات
 * المتروكة» على طول، وبتتحدّث مع كل تغيير فيها.
 *
 * ## العميل المسجَّل بس
 * الالتقاط محتاج رقم أو بريد — من غيرهم مفيش صف ينفع يتسجّل ولا حد
 * ينفع يتكلّم معاه. الزائر اللي لسه ما سجّلش دخول مالوش الاتنين،
 * فبنرجّع null وخلاص. والشيك أوت بيطلب الدخول أصلًا، فأي حد قرّب
 * يشتري فعلًا بيعدّي من هنا.
 *
 * ## ما بيغيّرش أي حاجة في التذكيرات
 * بيستخدم نفس `captureIncompleteOrder` بنفس رمز المسوّدة، فالمهمة
 * اليومية شايفة نفس الصف بنفس شروطها: تذكيرة واحدة، بعد ساعة من آخر
 * نشاط، وقبل ٧ أيام. ولأن كل التقاط بيحدّث `abandonedAt`، العميل
 * اللي لسه بيتفرّج ما بيتبعتلوش «سيبت سلتك» وهو جوّه المتجر.
 */
export async function captureCartAction(input: {
  storeIdentifier: string
  lines: Array<{ productId: string; quantity: number; variantId?: string }>
  draftToken?: string
}): Promise<{ token: string } | null> {
  if (input.lines.length === 0) return null

  const store = await getStore(input.storeIdentifier)
  if (!store) return null

  const customer = await getCurrentCustomer(store.id)
  if (!customer) return null

  /*
    الرقم شرط الالتقاط، والبريد بديل مقبول.

    `captureIncompleteOrder` بيرفض أي رقم أقصر من ١٠ أرقام، فالعميل
    اللي مسجَّل ببريد بس بيرجع null من غير ما نعمل حاجة — وده صح:
    الصف من غير وسيلة تواصل مالوش لازمة للتاجر.
  */
  if (!customer.phone) return null

  return captureIncompleteOrder({
    storeIdentifier: input.storeIdentifier,
    phone: customer.phone,
    name: customer.name ?? undefined,
    email: customer.email ?? undefined,
    lines: input.lines,
    draftToken: input.draftToken,
    stage: 'cart',
  })
}
