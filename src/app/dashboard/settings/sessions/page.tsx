import { getDashboardContext } from '@/lib/store-context'
import { loadSessions } from '@/lib/sessions-data'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { SessionsList } from './sessions-list'

export const metadata = { title: 'الأجهزة والجلسات' }

export default async function SessionsPage() {
  const { user } = await getDashboardContext()

  /* البيانات مشتركة مع تطبيق الموبايل (`/api/app/sessions`) */
  const rows = await loadSessions(user.id)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="الأجهزة والجلسات"
        description="مين داخل على حسابك دلوقتي. لو فيه جهاز مش بتاعك، اقفله من هنا."
      />

      <Reveal>
        <SessionsList rows={rows} />
      </Reveal>
    </div>
  )
}
