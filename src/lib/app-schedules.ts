import 'server-only'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { db } from '@/db'
import { categories, products, storePlugins } from '@/db/schema'
import type { ActiveStore } from '@/lib/store-context'
import { listSchedules } from '@/lib/content-schedules'
import { listAccounts } from '@/lib/social'
import { resolveEngines } from '@/lib/ai/settings'
import { AI_PROVIDERS } from '@/lib/ai/providers-meta'
import { PRESETS, STYLES, WEEKDAYS, describeSchedule, platformOf } from '@/lib/studio-meta'

/** إضافة «استوديو المحتوى» مفعّلة؟ — أفعال الاستوديو كلها بتفحصها (`studioContext`) */
export async function studioEnabled(storeId: string): Promise<boolean> {
  const [row] = await db
    .select({ enabled: storePlugins.enabled })
    .from(storePlugins)
    .where(and(eq(storePlugins.storeId, storeId), eq(storePlugins.pluginSlug, 'studio')))
    .limit(1)
  return Boolean(row?.enabled)
}

/**
 * شكل شاشة «النشر التلقائي» اللي تطبيق الموبايل بيستلمه — نفس اللي صفحة
 * `/dashboard/studio/schedules` بتعرضه، ومعاه القوايم الثابتة (الأيام والمقاسات والأشكال)
 * عشان الشاشة ما تكتبش نسخة منها.
 */
export async function schedulesPayload(store: ActiveStore) {
  const [schedules, accounts, cats, prods, engines, enabled] = await Promise.all([
    listSchedules(store.id),
    listAccounts(store.id),
    db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(and(eq(categories.storeId, store.id), eq(categories.isActive, true)))
      .limit(100),
    db
      .select({ id: products.id, name: products.name, images: products.images })
      .from(products)
      .where(and(eq(products.storeId, store.id), eq(products.status, 'active'), isNull(products.deletedAt)))
      .orderBy(desc(products.createdAt))
      .limit(80),
    resolveEngines(store.id, 'tools'),
    studioEnabled(store.id),
  ])

  const available = engines.ok ? engines.available : []

  return {
    studioEnabled: enabled,
    timezone: store.timezone,
    providers: available.map((key) => ({ key, label: AI_PROVIDERS.find((p) => p.key === key)?.label ?? key })),
    weekdays: WEEKDAYS.map((w) => ({ day: w.day, label: w.label })),
    presets: PRESETS.map((p) => ({ key: p.key, label: p.label, hint: p.hint })),
    styles: STYLES.map((s) => ({ key: s.key, label: s.label, hint: s.hint })),
    accounts: accounts
      .filter((a) => a.status === 'active')
      .map((a) => ({ id: a.id, name: a.name, platform: a.platform, color: platformOf(a.platform).color })),
    categories: cats,
    products: prods.map((p) => ({ id: p.id, name: p.name, image: p.images?.[0] ?? null })),
    schedules: schedules.map((s) => ({
      ...s,
      summary: describeSchedule(s.days, s.timeOfDay),
      lastRunAt: s.lastRunAt ? s.lastRunAt.toISOString() : null,
      nextRunAt: s.nextRunAt ? s.nextRunAt.toISOString() : null,
    })),
  }
}
