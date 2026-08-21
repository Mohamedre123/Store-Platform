import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * التحقّق من توقيع الويب هوك.
 *
 * **ده مش تفصيلة أمنية — ده الفرق بين مسار شغّال ومسار مفتوح.**
 *
 * الويب هوك مسار عام: أي حد يعرف الرابط يقدر ينده عليه. من غير
 * تحقّق، حد يبعت «الطلب اتدفع» فالتاجر يشحن بضاعة محدش دفع تمنها،
 * أو يبعت «اتسلّم» فنقاط الولاء وعمولة المسوّق تتصرف على طلب واقف.
 *
 * كل مزوّد بيوقّع بطريقته — بس المبدأ واحد: بنحسب التوقيع من الحمولة
 * بالسرّ اللي عندنا، ونقارنه باللي جالنا **مقارنة ثابتة الزمن**.
 * المقارنة العادية (===) بتخرج من أول حرف مختلف، والفرق في الزمن
 * بيسرّب التوقيع حرفًا حرفًا.
 */

export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

/**
 * توقيع باي موب.
 *
 * بيحسب HMAC-SHA512 على حقول محدّدة **بترتيب معيّن** — مش على
 * الحمولة كلها. الترتيب ده من توثيقهم، وأي تغيير فيه بيخلّي كل
 * التأكيدات تترفض.
 */
export function verifyPaymob(
  payload: Record<string, unknown>,
  received: string,
  hmacSecret: string,
): boolean {
  const obj = (payload.obj ?? payload) as Record<string, unknown>

  const order = obj.order as Record<string, unknown> | undefined
  const source = obj.source_data as Record<string, unknown> | undefined

  const fields = [
    obj.amount_cents,
    obj.created_at,
    obj.currency,
    obj.error_occured,
    obj.has_parent_transaction,
    obj.id,
    obj.integration_id,
    obj.is_3d_secure,
    obj.is_auth,
    obj.is_capture,
    obj.is_refunded,
    obj.is_standalone_payment,
    obj.is_voided,
    order?.id,
    obj.owner,
    obj.pending,
    source?.pan,
    source?.sub_type,
    source?.type,
    obj.success,
  ]

  const concatenated = fields.map((v) => String(v ?? '')).join('')
  const expected = createHmac('sha512', hmacSecret).update(concatenated).digest('hex')

  return safeCompare(expected.toLowerCase(), received.trim().toLowerCase())
}

/** توقيع فوري — SHA-256 على حقول الرد */
export function verifyFawry(
  payload: Record<string, unknown>,
  securityKey: string,
): boolean {
  const received = String(payload.messageSignature ?? '')
  if (!received) return false

  const concatenated =
    String(payload.fawryRefNumber ?? '') +
    String(payload.merchantRefNumber ?? '') +
    String(payload.paymentAmount ?? '') +
    String(payload.orderAmount ?? '') +
    String(payload.orderStatus ?? '') +
    String(payload.paymentMethod ?? '') +
    String(payload.paymentRefrenceNumber ?? '') +
    securityKey

  const { createHash } = require('node:crypto') as typeof import('node:crypto')
  const expected = createHash('sha256').update(concatenated).digest('hex')

  return safeCompare(expected.toLowerCase(), received.trim().toLowerCase())
}

/** HMAC عام على النص الخام — سترايب وكاشير وتابي بيستخدموا الشكل ده */
export function verifyHmac(
  rawBody: string,
  received: string,
  secret: string,
  algo: 'sha256' | 'sha512' = 'sha256',
): boolean {
  if (!received) return false
  const expected = createHmac(algo, secret).update(rawBody, 'utf8').digest('hex')

  // بعضهم بيبعت التوقيع في ترويسة مركّبة زي «t=123,v1=abc»
  const candidate = received.includes('v1=')
    ? (received.split('v1=')[1]?.split(',')[0] ?? '')
    : received

  return safeCompare(expected.toLowerCase(), candidate.trim().toLowerCase())
}

/**
 * توكن بسيط في الترويسة.
 *
 * بوسطة وشركات شحن كتير بتبعت توكنًا ثابتًا بدل توقيع. أضعف من
 * HMAC (مفيش ربط بالحمولة) لكنه أحسن كتير من مسار مفتوح — والمقارنة
 * لازم تفضل ثابتة الزمن برضه.
 */
export function verifyToken(received: string | null, expected: string): boolean {
  if (!received || !expected) return false
  return safeCompare(received.trim(), expected.trim())
}
