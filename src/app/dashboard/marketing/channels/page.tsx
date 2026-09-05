import Link from 'next/link'
import { ArrowLeft, Check, Circle } from 'lucide-react'
import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { channelProgress, loadSalesChannels, type ChannelCard } from '@/lib/sales-channels'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { Card } from '@/components/ui'

export const metadata = { title: 'قنوات البيع' }

/**
 * قنوات البيع.
 *
 * ## شاشة تشخيص لا شاشة إعداد
 * كل قطعة من ربط القناة موجودة وشغّالة عندنا — البكسل والكتالوج
 * والرابط والواتساب — بس كل واحدة في مكان. التاجر اللي عايز «أبيع
 * على إنستجرام» ما يعرفش إن ده تلات خطوات في تلات شاشات.
 *
 * الصفحة دي **ما بتحفظش أي حاجة**: بتقرا الحالة وبتوديه للخطوة
 * الناقصة. لو خلّيناها تحفظ كمان، يبقى فيه مكانين لنفس الإعداد —
 * وأول ما يختلفوا التاجر بيغيّر الغلط منهم ويفتكر إن الميزة بايظة.
 *
 * مكوّن خادم بالكامل: مفيش أي حالة ولا تفاعل، فمفيش سبب يخلّيه
 * يتحمّل على المتصفح.
 */
export default async function ChannelsPage() {
  const { store, actor } = await getDashboardContext()
  guard(actor, 'marketing.manage')

  const channels = await loadSalesChannels({
    storeId: store.id,
    socialLinks: store.socialLinks,
    storeWhatsapp: store.whatsapp,
  })

  const totals = channels.reduce(
    (acc, c) => {
      const p = channelProgress(c)
      return { done: acc.done + p.done, total: acc.total + p.total }
    },
    { done: 0, total: 0 },
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="قنوات البيع"
        description="كل قناة وإيه اللي ناقصها عندك — والزرار بيوديك للخطوة الناقصة بالظبط."
      />

      <Reveal>
        <Card className="flex flex-wrap items-center gap-4 p-4">
          <span className="min-w-0 flex-1">
            <span className="text-sm font-semibold">
              خلّصت <span className="tabular">{totals.done}</span> خطوة من{' '}
              <span className="tabular">{totals.total}</span>
            </span>
            <span className="mt-0.5 block text-xs leading-relaxed text-[var(--fg-muted)]">
              مش لازم تخلّص كل القنوات — ركّز على اللي بتصرف عليها إعلانات فعلًا.
            </span>
          </span>
          <span className="h-2 w-full max-w-[12rem] overflow-hidden rounded-full bg-[var(--surface-2)]">
            <span
              className="block h-full rounded-full bg-[var(--primary)] transition-[width] duration-700 ease-out motion-reduce:transition-none"
              style={{
                width: `${totals.total ? Math.round((totals.done / totals.total) * 100) : 0}%`,
              }}
            />
          </span>
        </Card>
      </Reveal>

      <div className="grid gap-4 lg:grid-cols-2">
        {channels.map((c, i) => (
          <Reveal key={c.key} delay={Math.min(i, 4) * 60}>
            <ChannelBlock card={c} />
          </Reveal>
        ))}
      </div>
    </div>
  )
}

function ChannelBlock({ card }: { card: ChannelCard }) {
  const { done, total } = channelProgress(card)
  const complete = done === total

  return (
    <Card className="flex h-full flex-col gap-4 p-5">
      <div className="flex items-start gap-3">
        {/*
          نقطة بلون المنصة لا شعارها.

          شعارات المنصات علامات مسجّلة، ورسمها بأيدينا بيطلع تقريبًا
          غلط. النقطة باللون بتأدّي نفس الغرض — التعرّف بنظرة — من
          غير ما نستعمل حاجة مش بتاعتنا.
        */}
        <span
          aria-hidden="true"
          className="mt-1 h-3 w-3 shrink-0 rounded-full ring-2 ring-[var(--surface-2)]"
          style={{ background: card.color }}
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">{card.name}</h2>
            <span
              className="rounded-md px-1.5 py-0.5 text-[11px] font-medium"
              style={{
                background: complete ? 'var(--color-success-soft)' : 'var(--surface-2)',
                color: complete ? 'var(--color-success)' : 'var(--fg-muted)',
              }}
            >
              {complete ? 'جاهزة' : `${done}/${total}`}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-[var(--fg-muted)]">{card.why}</p>
        </div>
      </div>

      <ul className="flex flex-col gap-1.5">
        {card.steps.map((s) => {
          const isDone = s.status === 'done'
          return (
            <li key={s.label}>
              <Link
                href={s.href}
                className="group flex items-center gap-3 rounded-lg border border-[var(--border)] p-3 transition-colors hover:bg-[var(--surface-2)]"
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: isDone ? 'var(--color-success-soft)' : 'var(--surface-2)',
                    color: isDone ? 'var(--color-success)' : 'var(--fg-subtle)',
                  }}
                >
                  {isDone ? (
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Circle className="h-3 w-3" aria-hidden="true" />
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span
                    className={`block truncate text-sm ${isDone ? 'text-[var(--fg-muted)]' : 'font-medium'}`}
                  >
                    {s.label}
                  </span>
                  {/*
                    الشرح بيبان للناقص بس.

                    «من غيره إعلانك بيصرف على الفاضي» جملة بتقنع حد
                    لسه ما عملهاش. اللي عملها خلاص مش محتاج يقراها كل
                    مرة يفتح الصفحة.
                  */}
                  {!isDone && (
                    <span className="mt-0.5 block text-xs leading-relaxed text-[var(--fg-subtle)]">
                      {s.hint}
                    </span>
                  )}
                </span>

                {!isDone && (
                  <ArrowLeft
                    className="h-4 w-4 shrink-0 text-[var(--fg-subtle)] transition-transform group-hover:-translate-x-0.5 motion-reduce:transition-none"
                    aria-hidden="true"
                  />
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
