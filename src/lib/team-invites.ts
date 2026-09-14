import 'server-only'
import { and, eq, gt, isNull, sql } from 'drizzle-orm'
import { db } from '@/db'
import { storeMembers, stores, users, verificationTokens } from '@/db/schema'
import { hashToken } from '@/lib/crypto'

/** دعوة فريق شغّالة — الرمز موجود وما استُخدمش وما انتهاش، والمتجر موجود */
export type TeamInvite = {
  id: string
  storeId: string
  storeName: string
  email: string
  role: 'admin' | 'staff'
  permissions: string[]
  invitedBy: string | null
  inviterName: string | null
  expiresAt: Date
}

export async function findInvite(token: string): Promise<TeamInvite | null> {
  if (!token || token.length > 200) return null

  const [row] = await db
    .select({ id: verificationTokens.id, meta: verificationTokens.meta, expiresAt: verificationTokens.expiresAt })
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.tokenHash, hashToken(token)),
        eq(verificationTokens.purpose, 'invite'),
        isNull(verificationTokens.usedAt),
        gt(verificationTokens.expiresAt, new Date()),
      ),
    )
    .limit(1)
  if (!row) return null

  const meta = (row.meta ?? {}) as {
    storeId?: string
    email?: string
    role?: 'admin' | 'staff'
    permissions?: string[]
    invitedBy?: string
  }
  if (!meta.storeId || !meta.email) return null

  const [store] = await db.select({ id: stores.id, name: stores.name }).from(stores).where(eq(stores.id, meta.storeId)).limit(1)
  if (!store) return null

  const [inviter] = meta.invitedBy
    ? await db.select({ name: users.name }).from(users).where(eq(users.id, meta.invitedBy)).limit(1)
    : []

  return {
    id: row.id,
    storeId: store.id,
    storeName: store.name,
    email: meta.email.toLowerCase(),
    role: meta.role === 'admin' ? 'admin' : 'staff',
    permissions: meta.permissions ?? [],
    invitedBy: meta.invitedBy ?? null,
    inviterName: inviter?.name ?? null,
    expiresAt: row.expiresAt,
  }
}

/** فيه حساب بالبريد ده؟ — صفحة الدعوة بتختار «سجّل دخول» ولا «اعمل حساب» */
export async function accountExists(email: string): Promise<boolean> {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${email.toLowerCase()}`)
    .limit(1)
  return Boolean(user)
}

/**
 * الانضمام والاستهلاك في معاملة واحدة.
 *
 * لو الرمز اتستهلك والعضوية وقعت، الموظف بيفضل برّه ومعاه رابط ميّت — وبيتصل
 * بالتاجر يقول له «مش شغّال» والتاجر شايف إنه اتبعت.
 */
export async function acceptInvite(invite: TeamInvite, userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .insert(storeMembers)
      .values({
        storeId: invite.storeId,
        userId,
        role: invite.role,
        permissions: invite.permissions,
        invitedBy: invite.invitedBy,
        acceptedAt: new Date(),
      })
      /* اللي دخل مرتين بالرابط نفسه ما يتكسرش — العضوية موجودة وخلاص */
      .onConflictDoNothing()

    await tx.update(verificationTokens).set({ usedAt: new Date() }).where(eq(verificationTokens.id, invite.id))
  })
}
