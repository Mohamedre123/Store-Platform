import { and, asc, eq, gt, isNull, sql } from 'drizzle-orm'
import { db } from '@/db'
import { storeMembers, users, verificationTokens } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { can, guard } from '@/lib/permissions'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { TeamManager, type InviteRow, type MemberRow } from './team-manager'

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
      .where(eq(storeMembers.storeId, store.id))
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
              sql`${verificationTokens.identifier} like ${`${store.id}:%`}`,
              isNull(verificationTokens.usedAt),
              gt(verificationTokens.expiresAt, new Date()),
            ),
          )
      : Promise.resolve([]),
  ])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="الفريق"
        description="مين بيدخل لوحتك ويقدر يعمل إيه. كل تغيير بيتسجّل في سجل النشاط باسم صاحبه."
      />

      <Reveal>
        <TeamManager
          canManage={canManage}
          currentUserId={user.id}
          members={members.map(
            (m): MemberRow => ({
              id: m.id,
              userId: m.userId,
              name: m.name,
              email: m.email,
              role: m.role,
              permissions: m.permissions ?? [],
              isBlocked: m.isBlocked,
              joinedAt: (m.acceptedAt ?? m.createdAt)?.toISOString() ?? null,
            }),
          )}
          invites={invites.map((i): InviteRow => {
            const meta = (i.meta ?? {}) as { email?: string; role?: string }
            return {
              id: i.id,
              email: meta.email ?? i.identifier.split(':')[1] ?? '',
              role: meta.role ?? 'staff',
              expiresAt: i.expiresAt.toISOString(),
            }
          })}
        />
      </Reveal>
    </div>
  )
}
