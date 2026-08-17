import { notFound } from 'next/navigation'
import { eq, or } from 'drizzle-orm'
import { db } from '@/db'
import { stores } from '@/db/schema'

// المتجر يُقرأ من قاعدة البيانات لكل طلب — لا تصيير ثابت وقت البناء
export const dynamic = 'force-dynamic'

/** واجهة المتجر — تُحلّ من النطاق الفرعي أو النطاق المخصص */
export default async function StorefrontHome({
  params,
}: {
  params: Promise<{ store: string }>
}) {
  const { store: identifier } = await params

  const [store] = await db
    .select({ name: stores.name, isPublished: stores.isPublished, status: stores.status })
    .from(stores)
    .where(or(eq(stores.slug, identifier), eq(stores.customDomain, identifier)))
    .limit(1)

  if (!store) notFound()

  return (
    <main className="min-h-screen-safe flex items-center justify-center p-6">
      <div className="flex max-w-md flex-col items-center gap-3 text-center">
        <h1 className="text-2xl font-bold tracking-tight">{store.name}</h1>
        <p className="text-[var(--fg-muted)]">
          {store.isPublished ? 'المتجر تحت الإنشاء — قريبًا.' : 'المتجر لسه مش منشور.'}
        </p>
      </div>
    </main>
  )
}
