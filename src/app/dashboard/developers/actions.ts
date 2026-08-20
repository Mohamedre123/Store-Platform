'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { apiKeys, webhooks } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { recordAudit } from '@/lib/audit'
import { createRawKey } from '@/lib/api-auth'
import { generateToken } from '@/lib/crypto'

export type DevState = { ok?: boolean; error?: string; rawKey?: string; secret?: string } | null

/**
 * مفتاح API جديد.
 *
 * المفتاح الخام بيترجع مرة واحدة بس وما بيتخزّنش — بنخزّن هاشه. لو
 * التاجر ضيّعه، بيعمل واحدًا جديدًا ويلغي القديم. ده نفس مبدأ كلمات
 * المرور: مفيش «استرجاع»، فيه «استبدال» بس.
 */
export async function createApiKeyAction(input: {
  name: string
  scopes: string[]
}): Promise<DevState> {
  const { store, user } = await getDashboardContext()

  const name = input.name.trim()
  if (!name) return { error: 'اكتب اسمًا للمفتاح' }
  if (input.scopes.length === 0) return { error: 'اختار صلاحية واحدة على الأقل' }

  const { raw, hash, prefix } = createRawKey()

  await db.insert(apiKeys).values({
    storeId: store.id,
    name,
    keyHash: hash,
    prefix,
    scopes: input.scopes,
    createdBy: user.id,
  })

  revalidatePath('/dashboard/developers')
  return { ok: true, rawKey: raw }
}

export async function revokeApiKeyAction(id: string): Promise<DevState> {
  const { store, user } = await getDashboardContext()

  await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, id), eq(apiKeys.storeId, store.id)))

  await recordAudit({
    storeId: store.id,
    userId: user.id,
    action: 'apikey.revoke',
    resource: 'api_key',
    resourceId: id,
  })

  revalidatePath('/dashboard/developers')
  return { ok: true }
}

/* ────────────────────────── الويب هوكس ────────────────────────── */

export async function saveWebhookAction(input: {
  id?: string
  url: string
  events: string[]
}): Promise<DevState> {
  const { store } = await getDashboardContext()

  const url = input.url.trim()
  if (!/^https:\/\/.+/i.test(url)) {
    // HTTPS إجباري: الحمولة فيها بيانات عملاء، وHTTP بتبعتها مكشوفة
    return { error: 'الرابط لازم يبدأ بـhttps://' }
  }
  if (input.events.length === 0) return { error: 'اختار حدثًا واحدًا على الأقل' }

  if (input.id) {
    const updated = await db
      .update(webhooks)
      .set({ url, events: input.events, isActive: true, failureCount: 0 })
      .where(and(eq(webhooks.id, input.id), eq(webhooks.storeId, store.id)))
      .returning({ id: webhooks.id })
    if (!updated.length) return { error: 'الويب هوك مش موجود' }
    return { ok: true }
  }

  const secret = `whsec_${generateToken(24)}`
  await db.insert(webhooks).values({ storeId: store.id, url, events: input.events, secret })

  revalidatePath('/dashboard/developers')
  return { ok: true, secret }
}

export async function deleteWebhookAction(id: string): Promise<DevState> {
  const { store } = await getDashboardContext()
  await db.delete(webhooks).where(and(eq(webhooks.id, id), eq(webhooks.storeId, store.id)))
  revalidatePath('/dashboard/developers')
  return { ok: true }
}

/** إعادة تفعيل ويب هوك اتوقف بسبب الأعطال */
export async function reactivateWebhookAction(id: string): Promise<DevState> {
  const { store } = await getDashboardContext()
  await db
    .update(webhooks)
    .set({ isActive: true, failureCount: 0 })
    .where(and(eq(webhooks.id, id), eq(webhooks.storeId, store.id)))
  revalidatePath('/dashboard/developers')
  return { ok: true }
}
