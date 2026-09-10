import Link from 'next/link'
import { Inbox } from 'lucide-react'
import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { listPosts } from '@/lib/content-schedules'
import { listAccounts } from '@/lib/social'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { Card } from '@/components/ui'
import { PostsList } from './posts-list'

export const metadata = { title: 'البوستات' }

/**
 * طابور البوستات.
 *
 * ## بيفيد اللي ما ربطش صفحاته كمان
 * البوست بيتحفظ جاهزًا: صورة ونص وهاشتاجات. اللي مربوط بيدوس نشر،
 * واللي مش مربوط بينزّل الصورة وينسخ الكلام وينشر بإيده. الميزة
 * بتشتغل من أول يوم، والربط بيحوّلها لتلقائية.
 */
export default async function PostsPage() {
  const { store, actor } = await getDashboardContext()
  guard(actor, 'marketing.manage')

  const [posts, accounts] = await Promise.all([listPosts(store.id, 60), listAccounts(store.id)])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="البوستات"
        description="اللي اتعمل — جاهز للنشر أو اتنشر خلاص."
      />

      {posts.length === 0 ? (
        <Reveal>
          <Card className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <Inbox className="h-7 w-7 text-[var(--fg-subtle)]" aria-hidden="true" />
            <h2 className="font-semibold">مفيش بوستات لسه</h2>
            <p className="max-w-md text-sm leading-relaxed text-[var(--fg-muted)]">
              اعمل أول واحد من الاستوديو، أو ظبّط جدول نشر وهو هيعملهم لوحده كل يوم.
            </p>
            <div className="mt-1 flex flex-wrap justify-center gap-2">
              <Link
                href="/dashboard/studio"
                className="flex h-11 items-center rounded-lg bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-fg)]"
              >
                افتح الاستوديو
              </Link>
              <Link
                href="/dashboard/studio/schedules"
                className="flex h-11 items-center rounded-lg border border-[var(--border-strong)] px-5 text-sm font-semibold"
              >
                ظبّط جدول
              </Link>
            </div>
          </Card>
        </Reveal>
      ) : (
        <Reveal>
          <PostsList
            posts={posts.map((p) => ({
              id: p.id,
              caption: p.caption,
              hashtags: p.hashtags,
              imageUrls: p.imageUrls,
              videoUrl: p.videoUrl,
              status: p.status,
              targets: p.targets,
              publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
              createdAt: p.createdAt.toISOString(),
              results: p.results,
            }))}
            accounts={accounts.map((a) => ({
              id: a.id,
              name: a.name,
              platform: a.platform,
              status: a.status,
            }))}
          />
        </Reveal>
      )}
    </div>
  )
}
