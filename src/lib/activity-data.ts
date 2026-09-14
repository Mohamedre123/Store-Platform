import 'server-only'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { auditLog, users } from '@/db/schema'
import { auditLabel } from '@/lib/audit'

/** آخر ٢٠٠ إجراء في المتجر — صفحة «سجل النشاط» ومسار التطبيق (`/api/app/activity`) */
export async function loadActivity(storeId: string) {
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
    .where(eq(auditLog.storeId, storeId))
    .orderBy(desc(auditLog.createdAt))
    .limit(200)

  return rows.map((r) => ({ ...r, label: auditLabel(r.action) }))
}
