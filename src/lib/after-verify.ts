import 'server-only'
import { cookies } from 'next/headers'

/**
 * الوجهة بعد تأكيد البريد.
 *
 * موظف فتح دعوة فريق وعمل حساب: لازم يأكّد بريده الأول، وصفحة التأكيد كانت
 * بتوديه `/dashboard` — وهو لسه ما انضمّش لأي متجر، فاللوحة بتحوّله على «افتح
 * متجرك» ويتوه. الكوكي دي بتفتكر «رجّعني للدعوة» لحد ما البريد يتأكّد.
 *
 * بتتكتب من أفعال الخادم بس (الصفحات ما بتكتبش كوكيز)، ومسارات داخلية بس.
 */
export const AFTER_VERIFY_COOKIE = 'zw_after_verify'

export function safeInternalPath(raw: string | null | undefined): string | null {
  return raw && /^\/(?!\/)[\w\-/?=&%.]*$/.test(raw) ? raw : null
}

export async function rememberAfterVerify(path: string): Promise<void> {
  const safe = safeInternalPath(path)
  if (!safe) return
  ;(await cookies()).set(AFTER_VERIFY_COOKIE, safe, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })
}

export async function afterVerifyPath(): Promise<string | null> {
  return safeInternalPath((await cookies()).get(AFTER_VERIFY_COOKIE)?.value)
}

export async function clearAfterVerify(): Promise<void> {
  ;(await cookies()).delete(AFTER_VERIFY_COOKIE)
}
