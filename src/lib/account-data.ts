import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema'
import { getUserStores, type SessionUser } from '@/lib/auth'

/** حساب التاجر نفسه (مش متجره) ومتاجره — صفحة «حسابي» ومسار التطبيق (`/api/app/account`) بيقروا من هنا */
export async function loadAccount(user: SessionUser) {
  const [[row], stores] = await Promise.all([
    db.select({ phone: users.phone, createdAt: users.createdAt }).from(users).where(eq(users.id, user.id)).limit(1),
    getUserStores(user.id),
  ])
  return {
    name: user.name,
    email: user.email,
    phone: row?.phone ?? '',
    publicId: user.publicId ?? null,
    stores: stores.map((s) => ({ id: s.id, name: s.name, slug: s.slug })),
  }
}
