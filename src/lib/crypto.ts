import { createHash, randomBytes, createCipheriv, createDecipheriv, timingSafeEqual } from 'node:crypto'

/**
 * تشفير أسرار التكاملات (مفاتيح البوابات، توكنات واتساب...) قبل تخزينها.
 * لو تسرّبت نسخة من قاعدة البيانات، الأسرار تفضل غير مقروءة.
 */

const ALGO = 'aes-256-gcm'

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY
  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ENCRYPTION_KEY غير مضبوط — التكاملات لن تعمل بأمان')
    }
    // مفتاح تطوير ثابت — لا يُستخدم في الإنتاج أبدًا
    return createHash('sha256').update('zawya-dev-key').digest()
  }
  // نقبل base64 أو نص عادي، ونشتق منه 32 بايت دائمًا
  return createHash('sha256').update(raw).digest()
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGO, getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.')
}

export function decrypt(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split('.')
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('صيغة النص المشفّر غير صحيحة')
  const decipher = createDecipheriv(ALGO, getKey(), Buffer.from(ivB64, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64url')), decipher.final()]).toString('utf8')
}

/** تشفير كائن أسرار كامل */
export function encryptJson(obj: Record<string, unknown>): string {
  return encrypt(JSON.stringify(obj))
}

export function decryptJson<T = Record<string, unknown>>(payload: string | null): T | null {
  if (!payload) return null
  try {
    return JSON.parse(decrypt(payload)) as T
  } catch {
    return null
  }
}

/** هاش للتوكنات (الجلسات، مفاتيح API) — لا نخزّن القيمة الخام أبدًا */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

/** مقارنة آمنة ضد هجمات التوقيت */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

/** رمز تحقق رقمي — للـOTP */
export function generateOtp(digits = 6): string {
  const max = 10 ** digits
  const n = randomBytes(4).readUInt32BE(0) % max
  return String(n).padStart(digits, '0')
}
