import { getDashboardContext } from '@/lib/store-context'
import { referralSummary } from '@/lib/merchant-referrals'
import { storeStats } from '@/lib/notices'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { ReferralPanel } from './referral-panel'

export const metadata = { title: 'حِيل صاحبك' }

/**
 * إحالة التجّار — التاجر بيجيب تاجر للمنصة.
 *
 * ## من غير `guard`
 * الصفحة دي عن حساب التاجر ومكافأته، مش عن بيانات المتجر. الموظف
 * اللي بيفتحها بيشوف رابط متجره وعدّاده — مفيش فيها طلبات ولا
 * عملاء ولا فلوس.
 */
export default async function ReferralsPage() {
  const { store } = await getDashboardContext()

  const [summary, stats] = await Promise.all([
    referralSummary(store.id),
    storeStats(store.id),
  ])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="حِيل صاحبك"
        description="اللي بتشتغل معاهم وبيدوّروا على منصة — ابعتلهم رابطك. كل واحد بيسجّل بيه بيتسجّل باسمك عندنا."
      />

      <Reveal>
        <ReferralPanel
          link={summary.link}
          code={summary.code}
          signups={summary.signups}
          subscribed={summary.subscribed}
          deliveredOrders={stats.deliveredOrders}
          storeName={store.name}
        />
      </Reveal>
    </div>
  )
}
