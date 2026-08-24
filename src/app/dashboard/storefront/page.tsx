import Link from 'next/link'
import { eq } from 'drizzle-orm'
import { ExternalLink, Paintbrush } from 'lucide-react'
import { db } from '@/db'
import { storeThemes, type Section } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { getTheme } from '@/lib/themes'
import { publicStoreUrl } from '@/lib/domain'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { ThemeGallery } from './theme-gallery'
import { PublishControl } from './publish-control'
import { ImageSpecHint, SectionEditor } from './section-editor'
import { ThemeDesigner } from './theme-designer'
import { getClaudeConfig, isClaudeReady } from '@/lib/ai/settings'

export const metadata = { title: 'المتجر' }

export default async function StorefrontPage() {
  const { store } = await getDashboardContext()

  const [theme] = await db
    .select()
    .from(storeThemes)
    .where(eq(storeThemes.storeId, store.id))
    .limit(1)

  const claude = await getClaudeConfig(store.id)
  const current = getTheme(theme?.themeSlug ?? 'zawya')
  const sections = (theme?.homeSections ?? []) as Section[]

  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title="المتجر"
        description="اختار شكل متجرك، ورتّب أقسام صفحته الرئيسية."
        action={
          <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/storefront/customize"
            className="zw-lift zw-press inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-fg)] shadow-sm"
          >
            <Paintbrush className="h-4 w-4" aria-hidden="true" />
            تخصيص المتجر
          </Link>
          <a
            href={publicStoreUrl(store)}
            target="_blank"
            rel="noopener noreferrer"
            className="zw-lift inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border-strong)] px-4 text-sm font-medium text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            عرض المتجر
          </a>
          </div>
        }
      />

      <Reveal>
        <PublishControl initialPublished={store.isPublished} />
      </Reveal>

      {/* الثيمات */}
      <section className="flex flex-col gap-4">
        <Reveal>
          <div>
            <h2 className="text-lg font-semibold">الثيم</h2>
            <p className="mt-1 text-sm text-[var(--fg-muted)]">
              الثيم بيحدّد تخطيط متجرك وشكل بطاقات المنتجات. تقدر تغيّره في أي وقت من غير ما تفقد
              منتجاتك أو طلباتك.
            </p>
          </div>
        </Reveal>
        <ThemeGallery currentSlug={current.slug} />

        {/*
          المصمّم تحت المعرض لا فوقه: أغلب التجّار هيلاقوا اللي عايزينه
          في الجاهز، واللي مش لاقي بينزل ويلاقي البديل.
        */}
        <Reveal delay={80}>
          <ThemeDesigner enabled={isClaudeReady(claude)} />
        </Reveal>
      </section>

      {/* أقسام الصفحة الرئيسية */}
      <section className="flex flex-col gap-4">
        <Reveal>
          <div>
            <h2 className="text-lg font-semibold">أقسام الصفحة الرئيسية</h2>
            <p className="mt-1 text-sm text-[var(--fg-muted)]">
              رتّب الأقسام وشغّل أو أطفي اللي مش محتاجه. الترتيب هنا هو نفسه اللي هيشوفه العميل.
            </p>
          </div>
        </Reveal>
        <Reveal delay={80}>
          <SectionEditor initial={sections} />
        </Reveal>
      </section>

      {/* مقاسات الصور */}
      <section className="flex flex-col gap-4">
        <Reveal>
          <div>
            <h2 className="text-lg font-semibold">مقاسات الصور</h2>
            <p className="mt-1 text-sm text-[var(--fg-muted)]">
              دي المقاسات اللي المتجر مبني عليها. لو رفعت بمقاس تاني الصورة هتتقص أو تطلع مش
              واضحة — والمقاسات دي بتظهرلك برضو جنب كل خانة رفع.
            </p>
          </div>
        </Reveal>

        <Reveal delay={80}>
          <div className="grid gap-3 sm:grid-cols-2">
            <ImageSpecHint specKey="heroDesktop" />
            <ImageSpecHint specKey="heroMobile" />
            <ImageSpecHint specKey="promoBanner" />
            <ImageSpecHint specKey="categoryImage" />
            <ImageSpecHint specKey="productImage" />
            <ImageSpecHint specKey="logo" />
          </div>
        </Reveal>
      </section>
    </div>
  )
}
