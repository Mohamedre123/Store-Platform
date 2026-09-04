import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { and, eq, gt, isNull } from 'drizzle-orm'
import { UserPlus } from 'lucide-react'
import { db } from '@/db'
import { storeMembers, stores, verificationTokens } from '@/db/schema'
import { getCurrentUser } from '@/lib/auth'
import { hashToken } from '@/lib/crypto'
import { Card } from '@/components/ui'

export const metadata = { title: 'انضمام لفريق' }

const ACTIVE_STORE_COOKIE = 'zawya_store'

/**
 * قبول دعوة الانضمام لفريق متجر.
 *
 * ## ليه صفحة مش فعل
 * الرابط بيتفتح من واتساب، يعني بطلب GET من متصفح الموظف. الفعل
 * (`'use server'`) محتاج نموذج ودوسة — والموظف اللي فتح الرابط
 * ولقى شاشة فيها زرار تاني بيسأل نفسه هو ده مكان صح ولا لأ.
 *
 * ## الشروط اللي لازم تتحقّق كلها
 * - الرمز موجود وما استُخدمش وما انتهتش صلاحيته
 * - المستخدم داخل بحسابه (وإلا بيروح يسجّل الأول ويرجع)
 * - **بريده هو بريد الدعوة** — ده اللي بيمنع رابط اتسرّب في مجموعة
 *   واتساب من إنه يدخّل أي حد لوحة التاجر
 */
export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>
}) {
  const { t } = await searchParams
  if (!t) return <Problem title="الرابط ناقص" body="الرابط اللي معاك مش كامل. اطلب من صاحب المتجر يبعتلك واحدًا جديدًا." />

  const user = await getCurrentUser()
  if (!user) {
    /*
      بيروح يسجّل ويرجع بنفس الرمز.

      من غير الرجوع ده، الموظف بيسجّل دخوله وبيلاقي نفسه على لوحة
      فاضية ومش فاهم راح فين الرابط — وبيرجع يطلب واحدًا جديدًا.
    */
    redirect(`/login?next=${encodeURIComponent(`/join?t=${t}`)}`)
  }

  const [invite] = await db
    .select({
      id: verificationTokens.id,
      identifier: verificationTokens.identifier,
      meta: verificationTokens.meta,
    })
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.tokenHash, hashToken(t)),
        eq(verificationTokens.purpose, 'invite'),
        isNull(verificationTokens.usedAt),
        gt(verificationTokens.expiresAt, new Date()),
      ),
    )
    .limit(1)

  if (!invite) {
    return (
      <Problem
        title="الدعوة مش شغّالة"
        body="الرابط انتهت صلاحيته أو اتلغى أو اتستخدم قبل كده. اطلب من صاحب المتجر يبعتلك واحدًا جديدًا."
      />
    )
  }

  const meta = (invite.meta ?? {}) as {
    storeId?: string
    email?: string
    role?: 'admin' | 'staff'
    permissions?: string[]
    invitedBy?: string
  }

  if (!meta.storeId || !meta.email) {
    return <Problem title="الدعوة مش مكتملة" body="اطلب من صاحب المتجر يبعتلك دعوة جديدة." />
  }

  if (meta.email !== user.email.toLowerCase()) {
    return (
      <Problem
        title="الدعوة مش لبريدك"
        body={`الدعوة دي متبعوتة لـ${meta.email}، وإنت داخل بـ${user.email}. سجّل خروج وادخل بالبريد الصح.`}
      />
    )
  }

  const [store] = await db
    .select({ id: stores.id, name: stores.name })
    .from(stores)
    .where(eq(stores.id, meta.storeId))
    .limit(1)

  if (!store) return <Problem title="المتجر مش موجود" body="المتجر اتحذف أو اتوقّف." />

  /**
   * الانضمام والاستهلاك في معاملة واحدة.
   *
   * لو الرمز اتستهلك والعضوية وقعت، الموظف بيفضل برّه ومعاه رابط
   * ميّت — وبيتصل بالتاجر يقول له «مش شغّال» والتاجر شايف إنه اتبعت.
   */
  await db.transaction(async (tx) => {
    await tx
      .insert(storeMembers)
      .values({
        storeId: store.id,
        userId: user.id,
        role: meta.role ?? 'staff',
        permissions: meta.permissions ?? [],
        invitedBy: meta.invitedBy ?? null,
        acceptedAt: new Date(),
      })
      /* اللي دخل مرتين بالرابط نفسه ما يتكسرش — العضوية موجودة وخلاص */
      .onConflictDoNothing()

    await tx
      .update(verificationTokens)
      .set({ usedAt: new Date() })
      .where(eq(verificationTokens.id, invite.id))
  })

  /* بيفتح على المتجر اللي انضم له لا على أول متجر في قايمته */
  const jar = await cookies()
  jar.set(ACTIVE_STORE_COOKIE, store.id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })

  redirect('/dashboard')
}

function Problem({ title, body }: { title: string; body: string }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-16">
      <Card className="flex max-w-md flex-col items-center gap-4 p-8 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)]">
          <UserPlus className="h-5 w-5" aria-hidden="true" />
        </span>
        <h1 className="text-lg font-bold">{title}</h1>
        <p className="text-sm leading-relaxed text-[var(--fg-muted)]">{body}</p>
        <Link
          href="/dashboard"
          className="inline-flex h-11 items-center rounded-lg bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-fg)]"
        >
          روح للوحة
        </Link>
      </Card>
    </main>
  )
}
