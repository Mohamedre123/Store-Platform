import { getDashboardContext } from '@/lib/store-context'
import { can, guard } from '@/lib/permissions'
import { loadTeam } from '@/lib/team-data'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { TeamManager } from './team-manager'

export const metadata = { title: 'الفريق' }

export default async function TeamPage() {
  const { store, user, actor } = await getDashboardContext()

  /*
    الموظف يشوف زمايله ومش بيعدّل.

    الإخفاء التام كان بيخلّيه ما يعرفش مين معاه في اللوحة، وهو محتاج
    يعرف عشان يسأل مين عمل تغيير على طلب. التعديل نفسه مقفول من
    `canManage` ومن `assertCan` في كل فعل.
  */
  guard(actor, 'orders.view')

  const canManage = can(actor, 'team.manage')

  /* البيانات مشتركة مع تطبيق الموبايل (`/api/app/team`) */
  const { members, invites } = await loadTeam(store.id, canManage)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="الفريق"
        description="مين بيدخل لوحتك ويقدر يعمل إيه. كل تغيير بيتسجّل في سجل النشاط باسم صاحبه."
      />

      <Reveal>
        <TeamManager canManage={canManage} currentUserId={user.id} members={members} invites={invites} />
      </Reveal>
    </div>
  )
}
