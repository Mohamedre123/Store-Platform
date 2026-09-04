import { Megaphone, Truck, Users } from 'lucide-react'
import { getDashboardContext } from '@/lib/store-context'
import { can, guard } from '@/lib/permissions'
import {
  carrierPerformance,
  channelLabel,
  salesByChannel,
  salesBySource,
  sessionsBySource,
  teamActivity,
} from '@/lib/reports'
import { mediumLabel, sourceLabel } from '@/lib/attribution'
import { carrierMeta } from '@/lib/carriers'
import { formatMoney } from '@/lib/utils'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { Card } from '@/components/ui'

export const metadata = { title: 'تقارير مفصّلة' }

export default async function ReportsPage() {
  const { store, actor } = await getDashboardContext()
  guard(actor, 'reports.view')

  /*
    الإيرادات مقفولة على `finance.view`.

    الموظف اللي بيشوف التقارير عشان يعرف أنهي شركة شحن بتوصّل أحسن
    مالوش دعوة بمبيعات المتجر. الأعمدة المالية بتختفي بدل ما الصفحة
    كلها تتقفل — التقرير التشغيلي هو اللي بيخصّه.
  */
  const showMoney = can(actor, 'finance.view')

  const [channels, sources, sessions, carriers, team] = await Promise.all([
    salesByChannel(store.id),
    salesBySource(store.id),
    sessionsBySource(store.id),
    carrierPerformance(store.id),
    teamActivity(store.id),
  ])

  const sessionsBy = new Map(sessions.map((s) => [s.source, s.sessions]))

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="تقارير مفصّلة"
        description="الطلبات جاية منين، وأنهي شركة شحن بتوصّل فعلًا، ومين شغّال على إيه."
      />

      {/* ───────── قنوات البيع ───────── */}
      <ReportSection
        icon={Megaphone}
        title="قنوات البيع"
        hint="الشاشة اللي الطلب اتعمل منها. «الدفع السريع» بيبيع فعلًا ولا بيشتّت؟ الإجابة هنا."
      >
        {channels.length === 0 ? (
          <Empty>مافيش طلبات في آخر ٣٠ يوم.</Empty>
        ) : (
          <Table
            head={['القناة', 'طلبات', ...(showMoney ? ['إيراد'] : []), 'مرفوض']}
            rows={channels.map((c) => [
              channelLabel(c.key),
              String(c.orders),
              ...(showMoney ? [formatMoney(c.revenue, store.currency)] : []),
              c.refused > 0 ? `${c.refused}` : '—',
            ])}
          />
        )}
      </ReportSection>

      {/* ───────── مصادر الزيارات ───────── */}
      <ReportSection
        icon={Megaphone}
        title="الطلبات جاية منين"
        hint="الإعلان اللي جاب العميل — بيتقرا من أول زيارة له، مش من آخر صفحة فتحها."
      >
        {sources.length === 0 ? (
          <Empty>
            لسه مافيش بيانات مصدر. أول ما زائر ييجي من إعلان أو رابط مشاركة، هيظهر هنا.
          </Empty>
        ) : (
          <Table
            head={[
              'المصدر',
              'زيارات',
              'طلبات',
              ...(showMoney ? ['إيراد'] : []),
              'تحويل',
            ]}
            rows={sources.map((s) => {
              const visits = sessionsBy.get(s.source) ?? 0
              const rate = visits > 0 ? Math.round((s.orders / visits) * 1000) / 10 : null
              const medium = mediumLabel(s.medium)
              return [
                medium ? `${sourceLabel(s.source)} · ${medium}` : sourceLabel(s.source),
                visits > 0 ? String(visits) : '—',
                String(s.orders),
                ...(showMoney ? [formatMoney(s.revenue, store.currency)] : []),
                rate === null ? '—' : `${rate}%`,
              ]
            })}
          />
        )}
      </ReportSection>

      {/* ───────── شركات الشحن ───────── */}
      <ReportSection
        icon={Truck}
        title="أداء شركات الشحن"
        hint="أهم رقم مش عدد الشحنات — نسبة التسليم. الشركة اللي بتوصّل ٧٠٪ بتكلّفك أضعاف الفرق في السعر."
      >
        {carriers.length === 0 ? (
          <Empty>مافيش شحنات مسجّلة في آخر ٩٠ يوم.</Empty>
        ) : (
          <Table
            head={[
              'الشركة',
              'شحنات',
              'نسبة التسليم',
              'متوسط الأيام',
              ...(showMoney ? ['محصَّل', 'مورّد لك'] : []),
            ]}
            rows={carriers.map((c) => {
              const rate = c.shipments > 0 ? Math.round((c.delivered / c.shipments) * 100) : 0
              return [
                carrierMeta(c.carrier).label,
                String(c.shipments),
                `${rate}%${c.failed > 0 ? ` · ${c.failed} فشل` : ''}`,
                c.avgDays === null ? '—' : `${c.avgDays} يوم`,
                ...(showMoney
                  ? [
                      formatMoney(c.codTotal, store.currency),
                      formatMoney(c.codSettled, store.currency),
                    ]
                  : []),
              ]
            })}
          />
        )}
      </ReportSection>

      {/* ───────── الفريق ───────── */}
      <ReportSection
        icon={Users}
        title="شغل الفريق"
        hint="مين سجّل طلبات ومين بيحرّك الحالات. بيتقرا من سجل الطلب نفسه."
      >
        {team.length === 0 ? (
          <Empty>مافيش نشاط مسجّل من أعضاء الفريق في آخر ٣٠ يوم.</Empty>
        ) : (
          <Table
            head={[
              'العضو',
              'طلبات سجّلها',
              ...(showMoney ? ['إيرادها'] : []),
              'تغييرات حالة',
            ]}
            rows={team.map((t) => [
              t.name,
              String(t.ordersCreated),
              ...(showMoney ? [formatMoney(t.revenue, store.currency)] : []),
              String(t.statusChanges),
            ])}
          />
        )}
      </ReportSection>
    </div>
  )
}

function ReportSection({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon: typeof Truck
  title: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <Reveal>
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="flex items-center gap-2 font-semibold">
            <Icon className="h-4 w-4 text-[var(--primary)]" aria-hidden="true" />
            {title}
          </h2>
          <p className="text-xs leading-relaxed text-[var(--fg-subtle)]">{hint}</p>
        </div>
        {children}
      </section>
    </Reveal>
  )
}

/**
 * جدول التقرير.
 *
 * في حاوية تمرير مستقلة: الجداول دي بتوصل لستة أعمدة، وعلى الموبايل
 * ده أعرض من الشاشة. من غير الحاوية، الصفحة كلها بتمشي يمين وشمال
 * وباقي المحتوى بيتزحلق معاها.
 */
function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <Card className="scroll-x">
      <table className="w-full min-w-[34rem] text-sm">
        <thead>
          <tr className="border-b border-[var(--border)]">
            {head.map((h, i) => (
              <th
                key={h}
                className={`px-4 py-3 text-xs font-medium text-[var(--fg-muted)] ${
                  i === 0 ? 'text-start' : 'text-end'
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-b border-[var(--border)] last:border-0">
              {r.map((cell, ci) => (
                <td
                  key={ci}
                  className={`px-4 py-3 ${
                    ci === 0 ? 'font-medium' : 'tabular text-end text-[var(--fg-muted)]'
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <Card className="px-4 py-8 text-center text-sm text-[var(--fg-muted)]">{children}</Card>
  )
}
