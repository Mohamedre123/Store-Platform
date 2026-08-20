import { desc, eq } from 'drizzle-orm'
import { ShieldCheck } from 'lucide-react'
import { db } from '@/db'
import { auditLog, users } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { auditLabel } from '@/lib/audit'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { Card } from '@/components/ui'
import { ActivityList, type ActivityRow } from './activity-list'

export const metadata = { title: 'سجل النشاط' }
export const dynamic = 'force-dynamic'

export default async function ActivityPage() {
  const { store } = await getDashboardContext()

  const rows = await db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      resource: auditLog.resource,
      resourceId: auditLog.resourceId,
      before: auditLog.before,
      after: auditLog.after,
      ip: auditLog.ip,
      createdAt: auditLog.createdAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.userId))
    .where(eq(auditLog.storeId, store.id))
    .orderBy(desc(auditLog.createdAt))
    .limit(200)

  const items: ActivityRow[] = rows.map((r) => ({
    ...r,
    label: auditLabel(r.action),
  }))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="سجل النشاط"
        description="مين عمل إيه في اللوحة — الإجراءات اللي بتلمس فلوس أو مخزون أو صلاحيات."
      />

      {items.length === 0 ? (
        <Reveal>
          <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <ShieldCheck className="h-10 w-10 text-[var(--fg-subtle)]" aria-hidden="true" />
            <h2 className="text-lg font-semibold">مافيش نشاط مسجّل</h2>
            <p className="max-w-sm text-sm text-[var(--fg-muted)]">
              أول ما حد يغيّر حالة طلب أو يحذف منتج أو ينشر المتجر، هيتسجّل هنا
              باسمه ووقته.
            </p>
          </Card>
        </Reveal>
      ) : (
        <Reveal>
          <ActivityList items={items} />
        </Reveal>
      )}
    </div>
  )
}
