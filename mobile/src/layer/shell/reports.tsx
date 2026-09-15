/**
 * تقارير مفصّلة — شاشة أصلية (`/dashboard/analytics/reports`).
 *
 * نفس صفحة اللوحة: قنوات البيع، الطلبات جاية منين (زيارات وتحويل)، أداء شركات الشحن (نسبة التسليم ومتوسط الأيام
 * والتحصيل)، وشغل الفريق. جدول اللوحة بقى كارت لكل صف بأرقامه — والأعمدة المالية بتختفي للي مالوش `finance.view`.
 */
import type { ComponentChildren } from 'preact'
import { icons } from '../icons'
import { formatMoney, formatNumber } from './format'
import { useResource } from './http'
import { reportsData } from './reports-api'
import { Screen } from './screen'
import { LoadState } from './settings-forms'
import { Icon } from './ui'

type Fact = { label: string; value: string; bad?: boolean } | null

function Section({ icon, title, hint, empty, rows }: { icon: string; title: string; hint: string; empty: string; rows: Array<{ name: string; facts: Fact[] }> }) {
  return (
    <section class="rp-sec rise">
      <div class="rp-sec-head">
        <b>
          <Icon svg={icon} />
          {title}
        </b>
        <small>{hint}</small>
      </div>
      {rows.length === 0 ? (
        <p class="card an-none rp-empty">{empty}</p>
      ) : (
        <div class="card rp-list">
          {rows.map((r, i) => (
            <div key={i} class="rp-row">
              <b>{r.name}</b>
              <div class="rp-facts">
                {r.facts.filter((f): f is NonNullable<Fact> => Boolean(f)).map((f) => (
                  <span key={f.label} class={`rp-fact${f.bad ? ' rp-fact--bad' : ''}`}>
                    <small>{f.label}</small>
                    <b>{f.value}</b>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function Wrap({ children }: { children: ComponentChildren }) {
  return <>{children}</>
}

export function ReportsScreen({ visible, onUnavailable }: { visible: boolean; onUnavailable: () => void }) {
  const { data, failed, load } = useResource(reportsData, visible, onUnavailable, 60_000)
  const money = (v: number | null) => (v === null || !data ? null : formatMoney(v, data.currency))

  return (
    <Screen visible={visible} title="تقارير مفصّلة" onRefresh={load}>
      <div class="home-body">
        <header class="page-head rise">
          <div class="page-head-text">
            <h1 class="page-title">تقارير مفصّلة</h1>
            <p class="page-sub">الطلبات جاية منين، وأنهي شركة شحن بتوصّل فعلًا، ومين شغّال على إيه.</p>
          </div>
        </header>

        {!data ? (
          <LoadState failed={failed} what="التقارير" />
        ) : (
          <Wrap>
            <Section
              icon={icons.megaphone()}
              title="قنوات البيع"
              hint="الشاشة اللي الطلب اتعمل منها. «الدفع السريع» بيبيع فعلًا ولا بيشتّت؟ الإجابة هنا."
              empty="مافيش طلبات في آخر ٣٠ يوم."
              rows={data.channels.map((c) => ({
                name: c.label,
                facts: [
                  { label: 'طلبات', value: formatNumber(c.orders) },
                  data.showMoney ? { label: 'إيراد', value: money(c.revenue) ?? '—' } : null,
                  { label: 'مرفوض', value: c.refused > 0 ? formatNumber(c.refused) : '—', bad: c.refused > 0 },
                ],
              }))}
            />

            <Section
              icon={icons.globe()}
              title="الطلبات جاية منين"
              hint="الإعلان اللي جاب العميل — بيتقرا من أول زيارة له، مش من آخر صفحة فتحها."
              empty="لسه مافيش بيانات مصدر. أول ما زائر ييجي من إعلان أو رابط مشاركة، هيظهر هنا."
              rows={data.sources.map((s) => ({
                name: s.label,
                facts: [
                  { label: 'زيارات', value: s.visits > 0 ? formatNumber(s.visits) : '—' },
                  { label: 'طلبات', value: formatNumber(s.orders) },
                  data.showMoney ? { label: 'إيراد', value: money(s.revenue) ?? '—' } : null,
                  { label: 'تحويل', value: s.rate === null ? '—' : `${formatNumber(s.rate)}%` },
                ],
              }))}
            />

            <Section
              icon={icons.truck()}
              title="أداء شركات الشحن"
              hint="أهم رقم مش عدد الشحنات — نسبة التسليم. الشركة اللي بتوصّل ٧٠٪ بتكلّفك أضعاف الفرق في السعر."
              empty="مافيش شحنات مسجّلة في آخر ٩٠ يوم."
              rows={data.carriers.map((c) => ({
                name: c.label,
                facts: [
                  { label: 'شحنات', value: formatNumber(c.shipments) },
                  { label: 'نسبة التسليم', value: `${formatNumber(c.rate)}%`, bad: c.shipments > 0 && c.rate < 70 },
                  c.failed > 0 ? { label: 'فشل', value: formatNumber(c.failed), bad: true } : null,
                  { label: 'متوسط الأيام', value: c.avgDays === null ? '—' : `${formatNumber(c.avgDays)} يوم` },
                  data.showMoney ? { label: 'محصَّل', value: money(c.codTotal) ?? '—' } : null,
                  data.showMoney ? { label: 'مورّد لك', value: money(c.codSettled) ?? '—' } : null,
                ],
              }))}
            />

            <Section
              icon={icons.users()}
              title="شغل الفريق"
              hint="مين سجّل طلبات ومين بيحرّك الحالات. بيتقرا من سجل الطلب نفسه."
              empty="مافيش نشاط مسجّل من أعضاء الفريق في آخر ٣٠ يوم."
              rows={data.team.map((t) => ({
                name: t.name,
                facts: [
                  { label: 'طلبات سجّلها', value: formatNumber(t.ordersCreated) },
                  data.showMoney ? { label: 'إيرادها', value: money(t.revenue) ?? '—' } : null,
                  { label: 'تغييرات حالة', value: formatNumber(t.statusChanges) },
                ],
              }))}
            />
          </Wrap>
        )}
      </div>
    </Screen>
  )
}
