import 'server-only'
import { and, asc, eq, gt, isNull, sql } from 'drizzle-orm'
import { db } from '@/db'
import { storeMembers, users, verificationTokens } from '@/db/schema'

/**
 * بيانات صفحة الفريق — صفحة اللوحة ومسار التطبيق (`/api/app/team`) بيقروا من هنا.
 * الدعوات المستنية بتتقرا بس للي يقدر يدير الفريق.
 */
export async function loadTeam(storeId: string, canManage: boolean) {
  const [members, invites] = await Promise.all([
    db
      .select({
        id: storeMembers.id,
        userId: storeMembers.userId,
        role: storeMembers.role,
        permissions: storeMembers.permissions,
        isBlocked: storeMembers.isBlocked,
        acceptedAt: storeMembers.acceptedAt,
        createdAt: storeMembers.createdAt,
        name: users.name,
        email: users.email,
      })
      .from(storeMembers)
      .innerJoin(users, eq(users.id, storeMembers.userId))
      .where(eq(storeMembers.storeId, storeId))
      /* المالك أول واحد دايمًا، وبعده الأقدم — الترتيب ده بيقرا زي سلّم */
      .orderBy(sql`case when ${storeMembers.role} = 'owner' then 0 else 1 end`, asc(storeMembers.createdAt)),

    canManage
      ? db
          .select({
            id: verificationTokens.id,
            identifier: verificationTokens.identifier,
            meta: verificationTokens.meta,
            expiresAt: verificationTokens.expiresAt,
          })
          .from(verificationTokens)
          .where(
            and(
              eq(verificationTokens.purpose, 'invite'),
              /* الفلترة بالبادئة `<storeId>:` — الدعوات مخزّنة في جدول مشترك */
              sql`${verificationTokens.identifier} like ${`${storeId}:%`}`,
              isNull(verificationTokens.usedAt),
              gt(verificationTokens.expiresAt, new Date()),
            ),
          )
      : Promise.resolve([]),
  ])

  return {
    members: members.map((m) => ({
      id: m.id,
      userId: m.userId,
      name: m.name,
      email: m.email,
      role: m.role,
      permissions: m.permissions ?? [],
      isBlocked: m.isBlocked,
      joinedAt: (m.acceptedAt ?? m.createdAt)?.toISOString() ?? null,
    })),
    invites: invites.map((i) => {
      const meta = (i.meta ?? {}) as { email?: string; role?: string }
      return {
        id: i.id,
        email: meta.email ?? i.identifier.split(':')[1] ?? '',
        role: meta.role ?? 'staff',
        expiresAt: i.expiresAt.toISOString(),
      }
    }),
  }
}
