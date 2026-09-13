import 'server-only'
import { createSign } from 'node:crypto'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { platformSettings, pushDevices, storeMembers } from '@/db/schema'
import { decrypt } from './crypto'
import { can, type Permission } from './permissions'
import { formatMoney } from './utils'

/**
 * إشعارات تطبيق الموبايل — Firebase Cloud Messaging (HTTP v1).
 *
 * ## ليه من غير firebase-admin
 * المكتبة كبيرة وبتسحب نص جوجل كلود معاها، واللي محتاجينه طلبين بس:
 * توكن دخول (JWT موقّع بمفتاح حساب الخدمة) وإرسال رسالة. الاتنين
 * بـ`node:crypto` و`fetch`.
 *
 * ## مفتاح حساب الخدمة فين
 * `FIREBASE_SERVICE_ACCOUNT` في بيئة الاستضافة لو موجود (JSON أو base64)،
 * وإلا من `platform_settings` مشفّرًا بـ`ENCRYPTION_KEY` — بيتحط هناك
 * بـ`.scripts/set-firebase.mjs`. عمره ما بيدخل الكود ولا git.
 *
 * **ما بيرميش أبدًا** — الطلب اتسجّل خلاص، والإشعار تحسين فوقه.
 */

type ServiceAccount = { project_id: string; client_email: string; private_key: string; token_uri?: string }

const SETTING_KEY = 'firebase_service_account'
const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging'

let accountCache: { value: ServiceAccount | null; error?: string; at: number } | null = null

function parseAccount(raw: string): ServiceAccount | null {
  const text = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8')
  const parsed = JSON.parse(text) as Partial<ServiceAccount>
  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) return null
  return parsed as ServiceAccount
}

async function serviceAccount(): Promise<{ value: ServiceAccount | null; error?: string }> {
  if (accountCache && Date.now() - accountCache.at < 10 * 60 * 1000) return accountCache
  let value: ServiceAccount | null = null
  let error: string | undefined
  try {
    let raw = process.env.FIREBASE_SERVICE_ACCOUNT ?? null
    if (!raw) {
      const [row] = await db
        .select({ value: platformSettings.value })
        .from(platformSettings)
        .where(eq(platformSettings.key, SETTING_KEY))
        .limit(1)
      if (row) raw = decrypt(row.value)
    }
    if (raw) value = parseAccount(raw)
    if (!value) error = 'not_configured'
  } catch (e) {
    error = e instanceof Error ? e.message : 'invalid'
  }
  accountCache = { value, error, at: Date.now() }
  return accountCache
}

let tokenCache: { token: string; exp: number; email: string } | null = null

async function accessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  if (tokenCache && tokenCache.email === sa.client_email && tokenCache.exp - 120 > now) return tokenCache.token

  const b64 = (obj: object) => Buffer.from(JSON.stringify(obj)).toString('base64url')
  const aud = sa.token_uri || 'https://oauth2.googleapis.com/token'
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: sa.client_email, scope: SCOPE, aud, iat: now, exp: now + 3600 })}`
  const signature = createSign('RSA-SHA256').update(unsigned).sign(sa.private_key, 'base64url')

  const res = await fetch(aud, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${signature}`,
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new Error(`oauth ${res.status}`)
  const body = (await res.json()) as { access_token: string; expires_in: number }
  tokenCache = { token: body.access_token, exp: now + (body.expires_in || 3600), email: sa.client_email }
  return body.access_token
}

/** للتشخيص بس: الإعداد موجود؟ والدخول على جوجل شغّال؟ — من غير أي سر في الرد */
export async function pushStatus(): Promise<{ configured: boolean; auth: boolean; project?: string; error?: string }> {
  const { value, error } = await serviceAccount()
  if (!value) return { configured: false, auth: false, error }
  try {
    await accessToken(value)
    return { configured: true, auth: true, project: value.project_id }
  } catch (e) {
    return { configured: true, auth: false, project: value.project_id, error: e instanceof Error ? e.message : 'auth' }
  }
}

export type PushMessage = {
  title: string
  body: string
  /** مسار جوّه المنصة بيتفتح لما التاجر يضغط على الإشعار */
  url: string
  /** إشعارات بنفس الوسم بتستبدل بعض بدل ما تتكوّم */
  tag?: string
}

type SendResult = 'ok' | 'gone' | 'fail'

async function sendOne(sa: ServiceAccount, bearer: string, token: string, msg: PushMessage): Promise<SendResult> {
  try {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: 'POST',
      headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        message: {
          token,
          notification: { title: msg.title, body: msg.body },
          data: { url: msg.url },
          android: {
            priority: 'HIGH',
            notification: { channel_id: 'orders', sound: 'default', ...(msg.tag ? { tag: msg.tag } : {}) },
          },
          apns: { payload: { aps: { sound: 'default' } } },
        },
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
    if (res.ok) return 'ok'
    const text = await res.text().catch(() => '')
    /* التطبيق اتمسح أو التوكن اتجدّد — الصف ملوش لازمة */
    if (res.status === 404 || text.includes('UNREGISTERED')) return 'gone'
    console.error('FCM رفض الإشعار:', res.status, text.slice(0, 300))
    return 'fail'
  } catch (e) {
    console.error('FCM مش متاح:', e)
    return 'fail'
  }
}

/** يبعت لكل أجهزة المتجر اللي أصحابها ليهم الصلاحية دي دلوقتي */
export async function pushToStore(storeId: string, permission: Permission, msg: PushMessage): Promise<number> {
  try {
    const rows = await db
      .select({
        token: pushDevices.token,
        role: storeMembers.role,
        permissions: storeMembers.permissions,
      })
      .from(pushDevices)
      .innerJoin(
        storeMembers,
        and(
          eq(storeMembers.userId, pushDevices.userId),
          eq(storeMembers.storeId, pushDevices.storeId),
          eq(storeMembers.isBlocked, false),
        ),
      )
      .where(eq(pushDevices.storeId, storeId))

    const tokens = [
      ...new Set(rows.filter((r) => can({ role: r.role, permissions: r.permissions ?? [] }, permission)).map((r) => r.token)),
    ]
    if (tokens.length === 0) return 0

    const { value: sa } = await serviceAccount()
    if (!sa) return 0
    const bearer = await accessToken(sa)

    const results = await Promise.all(tokens.map((t) => sendOne(sa, bearer, t, msg)))
    const gone = tokens.filter((_, i) => results[i] === 'gone')
    if (gone.length) await db.delete(pushDevices).where(inArray(pushDevices.token, gone))
    return results.filter((r) => r === 'ok').length
  } catch (e) {
    console.error('فشل إشعار التطبيق:', e)
    return 0
  }
}

/** طلب جديد — للي بيشوف الطلبات في المتجر */
export function pushOrderPlaced(ctx: {
  storeId: string
  storeName: string
  orderId?: string
  orderNumber?: number
  total?: number
  currency?: string
  customerName?: string | null
  city?: string | null
}): Promise<number> {
  const parts = [
    ctx.customerName || 'عميل جديد',
    ctx.total !== undefined ? formatMoney(ctx.total, ctx.currency ?? 'EGP') : null,
    ctx.city || null,
  ].filter(Boolean)

  return pushToStore(ctx.storeId, 'orders.view', {
    title: `🛍️ طلب جديد${ctx.orderNumber ? ` #${ctx.orderNumber}` : ''} — ${ctx.storeName}`,
    body: parts.join(' · '),
    url: ctx.orderId ? `/dashboard/orders/${ctx.orderId}` : '/dashboard/orders',
    tag: ctx.orderId ? `order-${ctx.orderId}` : undefined,
  })
}
