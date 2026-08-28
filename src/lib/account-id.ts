import 'server-only'
import { randomInt } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema'

/**
 * معرّف الحساب — الاسم اللي التاجر بيعرّف نفسه بيه لإدارة المنصة.
 *
 * ## ليه أبجدية ناقصة
 * من غير `O` و`0` و`I` و`1` و`L`. المعرّف ده رحلته: التاجر يقراه من
 * الشاشة، يكتبه في واتساب أو يقوله بصوته، وإحنا بندوّر بيه. كل حرف
 * ليه شبيه في الرحلة دي بيتحوّل لسؤال «صفر ولا حرف O؟» — والأبجدية
 * دي بتشيل السؤال من أصله بدل ما نعالجه بعدين.
 *
 * ٨ خانات من ٣١ حرفًا ≈ ٨٫٥×١٠¹¹ احتمال — أكبر بكتير من أي عدد تجّار
 * متوقّع، والتحقّق من التصادم موجود برضه لأن «مستبعد» مش «مستحيل».
 */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
const LENGTH = 8
const PREFIX = 'ZW-'

export function generateAccountId(): string {
  let body = ''
  for (let i = 0; i < LENGTH; i++) body += ALPHABET[randomInt(ALPHABET.length)]
  return PREFIX + body
}

/**
 * توحيد صيغة المعرّف قبل المقارنة.
 *
 * التاجر بينسخه من واتساب فبيجي معاه مسافات، وبيكتبه بحروف صغيرة،
 * وساعات بيسيب البادئة. البحث اللي ما بيوحّدش الصيغة بيقول «مش موجود»
 * لحساب قدامه — وده أسوأ من رسالة خطأ لأنه بيبان صح.
 */
export function normalizeAccountId(input: string): string {
  const raw = input.trim().toUpperCase().replace(/[\s\u200f\u200e]/g, '').replace(/^ZW-?/, '')
  return raw ? PREFIX + raw : ''
}

/** شكله سليم؟ — بيمنع استعلامًا فاضيًا على كل جدول المستخدمين */
export function looksLikeAccountId(input: string): boolean {
  return new RegExp(`^ZW-[${ALPHABET}]{${LENGTH}}$`).test(normalizeAccountId(input))
}

/** معرّف جديد مش مستخدم — التصادم مستبعد، والفحص لأنه مش مستحيل */
export async function uniqueAccountId(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const candidate = generateAccountId()
    const [clash] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.publicId, candidate))
      .limit(1)
    if (!clash) return candidate
  }
  throw new Error('تعذّر توليد معرّف حساب')
}

/**
 * معرّف الحساب لمستخدم قائم — بيتولّد ويتحفظ لو مكانش موجود.
 *
 * الحسابات اللي اتعملت قبل ما العمود ده يتضاف مالهاش معرّف. الهجرة
 * بتملاه، لكن الدالة دي بتغطّي أي صف فات منها بدل ما التاجر يشوف
 * «—» مكان المعرّف ويفضل مش عارف يبعت إيه.
 */
export async function ensureAccountId(userId: string, current: string | null): Promise<string> {
  if (current) return current
  const id = await uniqueAccountId()
  await db.update(users).set({ publicId: id }).where(eq(users.id, userId))
  return id
}
