'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, gt, isNull, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { storeMembers, users, verificationTokens } from '@/db/schema'
import { getDashboardContext, type DashboardContext } from '@/lib/store-context'
import { assertCan, defaultPermissions, PERMISSIONS, ROLE_LABELS } from '@/lib/permissions'
import { generateToken, hashToken } from '@/lib/crypto'
import { recordAudit } from '@/lib/audit'
import { appUrl } from '@/lib/domain'
import { safeReplyTo, sendEmail } from '@/lib/email'
import { teamInviteEmail } from '@/lib/email-templates'

/**
 * إدارة الفريق.
 *
 * ## الدعوة رابط **وإيميل**
 * كل دعوة بترجّع رابط التاجر بينسخه أو يبعته على واتساب (بيوصل في ثانية)، وفي
 * نفس الوقت بتتبعت على بريد الموظف باسم المتجر — لو التاجر ما بعتش الرابط، أو
 * الموظف مش على واتساب معاه، الدعوة بتوصله برضه.
 *
 * ## الرابط مربوط ببريد بعينه
 * أي حد يفتحه بحساب بريده مختلف بيترفض. من غير الشرط ده، رابط اتسرّب في مجموعة
 * واتساب بيدخّل أي حد لوحة التاجر.
 */

export type TeamState = { ok?: boolean; error?: string; inviteUrl?: string; emailed?: boolean } | null

const permissionKeys = PERMISSIONS.map((p) => p.key) as [string, ...string[]]

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email('اكتب بريدًا صحيحًا').max(120),
  role: z.enum(['admin', 'staff']),
  permissions: z.array(z.enum(permissionKeys)).max(PERMISSIONS.length),
})

/** مدّة الدعوة — أسبوع كفاية، وبعده التاجر بيبعت واحدة جديدة */
const INVITE_DAYS = 7

type InviteInput = { email: string; role: 'admin' | 'staff'; permissions: string[] }

/**
 * بيعمل الدعوة: يلغي أي دعوة قديمة لنفس البريد، رمز جديد، سجل النشاط، والإيميل.
 * مشترك بين «ضيف عضو» و«ابعت الدعوة تاني».
 */
async function createInvite({ store, user }: Pick<DashboardContext, 'store' | 'user'>, input: InviteInput): Promise<TeamState> {
  if (input.email === user.email.toLowerCase()) {
    return { error: 'ده بريدك إنت — إنت في الفريق أصلًا.' }
  }

  /*
    لو صاحب البريد عنده حساب وهو عضو فعلًا، بنقول كده بدل ما
    نبعت دعوة ما هتعملش حاجة.
  */
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${input.email}`)
    .limit(1)

  if (existingUser) {
    const [member] = await db
      .select({ id: storeMembers.id })
      .from(storeMembers)
      .where(and(eq(storeMembers.storeId, store.id), eq(storeMembers.userId, existingUser.id)))
      .limit(1)
    if (member) return { error: 'الشخص ده في فريقك بالفعل.' }
  }

  /*
    دعوة قديمة لنفس البريد بتتلغي.

    من غير كده يبقى فيه رابطين شغّالين بصلاحيات مختلفة، والتاجر
    اللي غيّر رأيه وبعت دعوة أضيق يلاقي الموظف دخل بالأوسع.
  */
  await db
    .update(verificationTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(verificationTokens.identifier, `${store.id}:${input.email}`),
        eq(verificationTokens.purpose, 'invite'),
        isNull(verificationTokens.usedAt),
      ),
    )

  const token = generateToken(24)
  const permissions = input.permissions.length > 0 ? input.permissions : defaultPermissions(input.role)

  await db.insert(verificationTokens).values({
    identifier: `${store.id}:${input.email}`,
    tokenHash: hashToken(token),
    purpose: 'invite',
    meta: { storeId: store.id, email: input.email, role: input.role, permissions, invitedBy: user.id },
    expiresAt: new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000),
  })

  await recordAudit({
    storeId: store.id,
    userId: user.id,
    action: 'member.role_change',
    resource: 'invite',
    after: { email: input.email, role: input.role },
  })

  /*
    الرابط على النطاق الجذري لا على مضيف اللوحة.

    الوكيل بيعيد كتابة أي مسار على مضيف اللوحة تحت «dashboard/»،
    فالصفحة كانت هتدخل جوّه تخطيط اللوحة — واللي اتدعى ومعندوش متجر
    بتاعه كان بيتحوّل على التسجيل قبل ما الانضمام يحصل أصلًا.
  */
  const inviteUrl = appUrl(`/join?t=${encodeURIComponent(token)}`)

  /* فشل الإيميل ما يوقّعش الدعوة — الرابط لسه قدام التاجر يبعته بنفسه */
  const message = teamInviteEmail({
    storeName: store.name,
    inviterName: user.name,
    roleLabel: ROLE_LABELS[input.role],
    url: inviteUrl,
    email: input.email,
    days: INVITE_DAYS,
  })
  const emailed = await sendEmail({
    to: input.email,
    ...message,
    sender: { name: store.name, slug: store.slug },
    replyTo: safeReplyTo(user.email),
    log: { storeId: store.id, event: 'team_invite' },
  })
    .then((r) => r.ok)
    .catch(() => false)

  revalidatePath('/dashboard/settings/team')
  return { ok: true, inviteUrl, emailed }
}

export async function inviteMemberAction(raw: unknown): Promise<TeamState> {
  const parsed = inviteSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'بيانات ناقصة' }

  const ctx = await getDashboardContext()
  assertCan(ctx.actor, 'team.manage')
  return createInvite(ctx, parsed.data)
}

/**
 * «ابعت الدعوة تاني» — نفس البريد والدور والصلاحيات.
 *
 * الرمز متخزّن هاش بس، فالرابط القديم ما بيترجعش — بيتعمل رابط جديد والقديم
 * بيتلغي، والإيميل بيتبعت تاني.
 */
export async function resendInviteAction(tokenId: string): Promise<TeamState> {
  const ctx = await getDashboardContext()
  assertCan(ctx.actor, 'team.manage')

  const [row] = await db
    .select({ meta: verificationTokens.meta })
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.id, tokenId),
        eq(verificationTokens.purpose, 'invite'),
        sql`${verificationTokens.identifier} like ${`${ctx.store.id}:%`}`,
        isNull(verificationTokens.usedAt),
      ),
    )
    .limit(1)

  const meta = (row?.meta ?? {}) as { email?: string; role?: 'admin' | 'staff'; permissions?: string[] }
  if (!row || !meta.email) return { error: 'الدعوة دي اتقبلت أو اتلغت.' }

  return createInvite(ctx, {
    email: meta.email,
    role: meta.role === 'admin' ? 'admin' : 'staff',
    permissions: meta.permissions ?? [],
  })
}

const updateSchema = z.object({
  memberId: z.string().uuid(),
  role: z.enum(['admin', 'staff']),
  permissions: z.array(z.enum(permissionKeys)).max(PERMISSIONS.length),
})

export async function updateMemberAction(raw: unknown): Promise<TeamState> {
  const parsed = updateSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'بيانات ناقصة' }
  const input = parsed.data

  const { store, user, actor } = await getDashboardContext()
  assertCan(actor, 'team.manage')

  const [member] = await db
    .select({ id: storeMembers.id, role: storeMembers.role, userId: storeMembers.userId })
    .from(storeMembers)
    .where(and(eq(storeMembers.id, input.memberId), eq(storeMembers.storeId, store.id)))
    .limit(1)

  if (!member) return { error: 'العضو مش موجود' }

  /*
    المالك ما بيتغيّرش دوره من هنا.

    لو اتغيّر، المتجر ممكن يفضل من غير مالك خالص — ومحدّش يقدر
    يرجّع الصلاحيات لأن اللي بيرجّعها لازم يكون مالكًا.
  */
  if (member.role === 'owner') return { error: 'صلاحيات المالك ما بتتغيّرش.' }

  await db
    .update(storeMembers)
    .set({ role: input.role, permissions: input.permissions })
    .where(and(eq(storeMembers.id, member.id), eq(storeMembers.storeId, store.id)))

  await recordAudit({
    storeId: store.id,
    userId: user.id,
    action: 'member.role_change',
    resource: 'member',
    resourceId: member.id,
    before: { role: member.role },
    after: { role: input.role, permissions: input.permissions },
  })

  revalidatePath('/dashboard/settings/team')
  return { ok: true }
}

/**
 * إيقاف عضو أو رجوعه.
 *
 * إيقاف لا حذف: الحذف بيشيل الصف اللي سجل التدقيق بيوصل بيه أفعال
 * الموظف القديمة لصاحبها. اللي مشي النهارده لازم يفضل مربوطًا
 * باللي عمله إمبارح.
 */
export async function setMemberBlockedAction(
  memberId: string,
  blocked: boolean,
): Promise<TeamState> {
  const { store, user, actor } = await getDashboardContext()
  assertCan(actor, 'team.manage')

  const [member] = await db
    .select({ id: storeMembers.id, role: storeMembers.role })
    .from(storeMembers)
    .where(and(eq(storeMembers.id, memberId), eq(storeMembers.storeId, store.id)))
    .limit(1)

  if (!member) return { error: 'العضو مش موجود' }
  if (member.role === 'owner') return { error: 'مينفعش توقف المالك.' }

  await db
    .update(storeMembers)
    .set({ isBlocked: blocked })
    .where(and(eq(storeMembers.id, member.id), eq(storeMembers.storeId, store.id)))

  await recordAudit({
    storeId: store.id,
    userId: user.id,
    action: 'member.role_change',
    resource: 'member',
    resourceId: member.id,
    after: { blocked },
  })

  revalidatePath('/dashboard/settings/team')
  return { ok: true }
}

/** إلغاء دعوة لسه ما اتقبلتش */
export async function cancelInviteAction(tokenId: string): Promise<TeamState> {
  const { store, actor } = await getDashboardContext()
  assertCan(actor, 'team.manage')

  await db
    .update(verificationTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(verificationTokens.id, tokenId),
        eq(verificationTokens.purpose, 'invite'),
        /* الشرط ده هو اللي بيمنع تاجر يلغي دعوة تاجر تاني */
        sql`${verificationTokens.identifier} like ${`${store.id}:%`}`,
        gt(verificationTokens.expiresAt, new Date()),
      ),
    )

  revalidatePath('/dashboard/settings/team')
  return { ok: true }
}
