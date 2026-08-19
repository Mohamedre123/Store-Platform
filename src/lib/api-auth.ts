import 'server-only'
import { and, eq, gt, isNull, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { apiKeys } from '@/db/schema'
import { generateToken, hashToken } from './crypto'

/**
 * مصادقة الـAPI العام.
 *
 * المفتاح بيتخزّن مهشوشًا زي كلمات المرور — لو تسرّبت نسخة من قاعدة
 * البيانات، المفاتيح تفضل غير قابلة للاستخدام. البادئة بتتخزّن خام
 * عشان التاجر يعرف أي مفتاح ده في القائمة من غير ما نعرض السر.
 */

export { API_SCOPES, type ApiScope } from './api-scopes'
import type { ApiScope } from './api-scopes'

export type ApiContext = { storeId: string; keyId: string; scopes: string[] }

/** مفتاح جديد — الخام بيترجع مرة واحدة بس */
export function createRawKey() {
  const raw = `zw_${generateToken(24)}`
  return { raw, hash: hashToken(raw), prefix: raw.slice(0, 11) }
}

/**
 * يتحقق من ترويسة Authorization ويرجّع سياق المتجر.
 *
 * بيرجّع null بدل ما يرمي استثناء: المسار هو اللي بيقرّر شكل رد الخطأ.
 */
export async function authenticateApiKey(
  authHeader: string | null,
  required?: ApiScope,
): Promise<ApiContext | null> {
  if (!authHeader?.startsWith('Bearer ')) return null

  const raw = authHeader.slice(7).trim()
  if (!raw.startsWith('zw_')) return null

  const [row] = await db
    .select({
      id: apiKeys.id,
      storeId: apiKeys.storeId,
      scopes: apiKeys.scopes,
    })
    .from(apiKeys)
    .where(
      and(
        eq(apiKeys.keyHash, hashToken(raw)),
        isNull(apiKeys.revokedAt),
        or(isNull(apiKeys.expiresAt), gt(apiKeys.expiresAt, new Date()))!,
      ),
    )
    .limit(1)

  if (!row) return null
  if (required && !row.scopes.includes(required)) return null

  // آخر استخدام — بدون انتظار عشان ما يبطّأش الرد
  void db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, row.id))
    .catch(() => {})

  return { storeId: row.storeId, keyId: row.id, scopes: row.scopes }
}
