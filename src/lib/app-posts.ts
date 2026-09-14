import 'server-only'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { storePlugins } from '@/db/schema'
import { loadPosts } from '@/lib/posts-data'
import { platformOf } from '@/lib/studio-meta'

/* نفس `STATUS` في `src/app/dashboard/studio/posts/posts-list.tsx` (ملف client) — أي تعديل هناك يتعدّل هنا */
const STATUS_LABEL: Record<string, string> = {
  draft: 'مسوّدة',
  ready: 'جاهز للنشر',
  scheduled: 'مجدوَل',
  publishing: 'بينشر…',
  published: 'اتنشر',
  failed: 'فشل',
}

/** شكل شاشة البوستات اللي تطبيق الموبايل بيستلمه */
export async function postsPayload(storeId: string) {
  const [{ posts, accounts }, [plugin]] = await Promise.all([
    loadPosts(storeId),
    db
      .select({ enabled: storePlugins.enabled })
      .from(storePlugins)
      .where(and(eq(storePlugins.storeId, storeId), eq(storePlugins.pluginSlug, 'studio')))
      .limit(1),
  ])
  const byId = new Map(accounts.map((a) => [a.id, a]))

  return {
    /* النشر والحذف بيفحصوا الإضافة (`studioContext`) — الشاشة بتقول قبل ما التاجر يدوس */
    studioEnabled: Boolean(plugin?.enabled),
    accounts: accounts.map((a) => ({
      id: a.id,
      name: a.name,
      platform: a.platform,
      platformLabel: platformOf(a.platform).label,
      color: platformOf(a.platform).color,
      status: a.status,
    })),
    posts: posts.map((p) => ({
      id: p.id,
      caption: p.caption,
      hashtags: p.hashtags,
      imageUrls: p.imageUrls,
      videoUrl: p.videoUrl,
      status: p.status,
      statusLabel: STATUS_LABEL[p.status] ?? STATUS_LABEL.draft,
      targets: p.targets,
      publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
      createdAt: p.createdAt.toISOString(),
      results: (p.results ?? []).map((r) => {
        const acc = byId.get(r.accountId)
        return {
          accountId: r.accountId,
          accountName: acc?.name ?? 'حساب متشال',
          color: platformOf(acc?.platform ?? '').color,
          ok: r.ok,
          error: r.error ?? null,
        }
      }),
    })),
  }
}
