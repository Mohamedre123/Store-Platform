'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { storePlugins } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { getPlugin } from '@/lib/plugins'

export type PluginState = { ok?: boolean; error?: string } | null

/**
 * حفظ إعدادات إضافة.
 *
 * معرّفات البكسل مش أسرار — بتظهر في كود الصفحة عند أي زائر أصلًا —
 * فبتتخزّن في config العادي. الأسرار الحقيقية (مفاتيح API) ليها عمود
 * secrets مشفّر لما نوصل للتكاملات اللي بتحتاجها.
 */
export async function savePluginAction(input: {
  slug: string
  enabled: boolean
  config: Record<string, string>
}): Promise<PluginState> {
  const { store } = await getDashboardContext()

  const def = getPlugin(input.slug)
  if (!def) return { error: 'الإضافة دي مش موجودة' }

  // تنظيف: بنقبل بس الحقول المعرّفة للإضافة، ونشيل المسافات
  const config: Record<string, string> = {}
  for (const field of def.fields) {
    const value = (input.config[field.key] ?? '').trim()
    if (value) config[field.key] = value
  }

  // التفعيل من غير المعرّف الأساسي مش هيعمل حاجة — نمنعه بدل ما التاجر
  // يفتكر إنه شغّال وهو مش شغّال
  const required = def.fields[0]
  if (input.enabled && !config[required.key]) {
    return { error: `اكتب ${required.label} الأول` }
  }

  const values = { enabled: input.enabled, config }

  const [existing] = await db
    .select({ id: storePlugins.id })
    .from(storePlugins)
    .where(and(eq(storePlugins.storeId, store.id), eq(storePlugins.pluginSlug, input.slug)))
    .limit(1)

  if (existing) {
    await db.update(storePlugins).set(values).where(eq(storePlugins.id, existing.id))
  } else {
    await db.insert(storePlugins).values({ ...values, storeId: store.id, pluginSlug: input.slug })
  }

  revalidatePath('/dashboard/plugins')
  return { ok: true }
}
