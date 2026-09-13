import 'server-only'
import { after } from 'next/server'
import { and, eq, inArray, isNotNull, ne, or } from 'drizzle-orm'
import { db } from '@/db'
import { messagingSettings, storeMembers, stores, subscriptionNotices, users } from '@/db/schema'
import { adminEmails, isAdminEmail } from './admin'
import { brand } from './brand'
import { dashboardUrl } from './domain'
import { sendEmail } from './email'
import { formatArDate, subscriptionEmail, type SubscriptionNoticeKind } from './subscription-email'
import { getPlan } from './plans'
import { normalizePhone } from './utils'
import { sendWhatsapp } from './whatsapp'

/**
 * رسايل الاشتراك للتاجر — بريد، وواتساب لو واتساب المنصة مربوط.
 *
 * ## مين بيبعت الواتساب
 * المنصة مالهاش رقم منفصل: الرقم هو واتساب متجر الإدارة نفسه (الحساب
 * اللي بريده في `admin.ts`). لو الإدارة ربطت واتساب متجرها، الرسايل
 * بتخرج منه — ولو ما ربطتش، البريد لوحده.
 *
 * ## والتكرار ممنوع من القاعدة لا من الذاكرة
 * كل رسالة بتتسجّل في `subscription_notices` **قبل** الإرسال بمفتاح
 * (متجر، نوع، نهاية الفترة). ضغطتين على «فعّل» أو مهمتين شغّالين في
 * نفس اللحظة — واحدة بس اللي بتكسب الصف وتبعت.
 *
 * **ما بيرميش أبدًا** — التفعيل اتسجّل خلاص، والرسالة تحسين فوقه.
 */

export type NoticeKind =
  | 'trial_started'
  | 'activated'
  | 'renewed'
  | 'reminder_7'
  | 'reminder_3'
  | 'reminder_1'
  | 'expired'
  | 'trial_ended'
  | 'cancelled'

const DAY = 86_400_000

type Target = {
  storeId: string
  storeName: string
  storeEmail: string | null
  storePhone: string | null
  storeWhatsapp: string | null
  country: string | null
  plan: string | null
  ownerName: string | null
  ownerEmail: string | null
  ownerPhone: string | null
  ownerIsAdmin: boolean | null
}

async function target(storeId: string): Promise<Target | null> {
  const [row] = await db
    .select({
      storeId: stores.id,
      storeName: stores.name,
      storeEmail: stores.email,
      storePhone: stores.phone,
      storeWhatsapp: stores.whatsapp,
      country: stores.country,
      plan: stores.plan,
      ownerName: users.name,
      ownerEmail: users.email,
      ownerPhone: users.phone,
      ownerIsAdmin: users.isPlatformAdmin,
    })
    .from(stores)
    .leftJoin(storeMembers, and(eq(storeMembers.storeId, stores.id), eq(storeMembers.role, 'owner')))
    .leftJoin(users, eq(users.id, storeMembers.userId))
    .where(eq(stores.id, storeId))
    .limit(1)
  return row ?? null
}

/** متجر الإدارة اللي واتسابه مربوط — منه بتخرج رسايل المنصة */
async function platformWhatsappStore(): Promise<string | null> {
  const [row] = await db
    .select({ storeId: stores.id })
    .from(users)
    .innerJoin(storeMembers, and(eq(storeMembers.userId, users.id), eq(storeMembers.role, 'owner')))
    .innerJoin(stores, eq(stores.id, storeMembers.storeId))
    .innerJoin(messagingSettings, eq(messagingSettings.storeId, stores.id))
    .where(
      and(
        or(inArray(users.email, adminEmails()), eq(users.isPlatformAdmin, true)),
        ne(messagingSettings.whatsappProvider, 'off'),
        isNotNull(messagingSettings.whatsappCredentials),
      ),
    )
    .limit(1)
  return row?.storeId ?? null
}

function whatsappText(input: {
  kind: NoticeKind
  ownerName: string
  storeName: string
  planName: string
  until: Date
  daysLeft: number
  trial: boolean
  link: string
}): string {
  const hi = input.ownerName ? `أهلًا ${input.ownerName} 👋` : 'أهلًا 👋'
  const date = formatArDate(input.until)
  const lines: string[] = [hi, '']
  switch (input.kind) {
    case 'trial_started':
      lines.push(`🎁 تجربتك المجانية لمتجر *${input.storeName}* على ${brand.name} بدأت — كل المميزات مفتوحة لحد ${date}.`)
      break
    case 'activated':
      lines.push(`✅ اشتراك متجر *${input.storeName}* اتفعّل`, `الباقة: ${input.planName}`, `صالح لحد: ${date}`, '', 'شكرًا لثقتك في زاوية 💜')
      break
    case 'renewed':
      lines.push(`✅ اشتراك متجر *${input.storeName}* اتجدّد`, `الباقة: ${input.planName}`, `صالح لحد: ${date}`)
      break
    case 'reminder_7':
    case 'reminder_3':
    case 'reminder_1': {
      const left = input.daysLeft <= 1 ? 'بكرة' : `بعد ${input.daysLeft} أيام`
      lines.push(
        input.trial
          ? `⏳ تجربتك المجانية لمتجر *${input.storeName}* بتنتهي ${left} (${date}).`
          : `⏳ اشتراك متجر *${input.storeName}* بينتهي ${left} (${date}).`,
        '',
        input.trial ? 'اشترك قبلها عشان المميزات تفضل شغّالة عندك.' : 'جدّد قبل ما يخلص عشان المميزات ما تتوقفش.',
      )
      break
    }
    case 'expired':
      lines.push(`اشتراك متجر *${input.storeName}* انتهى يوم ${date} والمميزات المدفوعة اتوقفت.`, 'بياناتك كلها محفوظة — جدّد وكل حاجة ترجع فورًا.')
      break
    case 'trial_ended':
      lines.push(`تجربة متجر *${input.storeName}* المجانية انتهت.`, 'اشترك وكمّل — كل اللي عملته محفوظ.')
      break
    case 'cancelled':
      lines.push(`اشتراك متجر *${input.storeName}* اتوقف.`, 'لو ده حصل بالغلط، رُد علينا هنا.')
      break
  }
  lines.push('', input.link)
  return lines.join('\n')
}

/**
 * يسجّل الرسالة ويبعتها. بيرجّع `false` لو اتبعتت قبل كده (أو المتجر
 * للإدارة) — والمهمة بتعدّي عليه عادي.
 */
export async function deliverSubscriptionNotice(input: {
  storeId: string
  kind: NoticeKind
  until: Date
  planKey?: string | null
  /** التجربة ولا باقة مدفوعة — للتذكير والانتهاء */
  trial?: boolean
}): Promise<boolean> {
  try {
    const t = await target(input.storeId)
    if (!t) return false
    /* متجر الإدارة دايمًا مفتوح — ما بيوصلوش تذكير تجديد */
    if (t.ownerIsAdmin || isAdminEmail(t.ownerEmail)) return false

    const [claimed] = await db
      .insert(subscriptionNotices)
      .values({ storeId: t.storeId, kind: input.kind, periodEnd: input.until })
      .onConflictDoNothing()
      .returning({ id: subscriptionNotices.id })
    if (!claimed) return false

    const trial = input.trial ?? (input.kind === 'trial_started' || input.kind === 'trial_ended')
    const plan = getPlan(input.planKey ?? t.plan)
    const planName = trial ? 'تجربة مجانية' : (plan?.name ?? 'باقة زاوية')
    const daysLeft =
      input.kind === 'activated' || input.kind === 'renewed' || input.kind === 'trial_started'
        ? Math.max(1, Math.round((input.until.getTime() - Date.now()) / DAY))
        : Math.max(1, Math.ceil((input.until.getTime() - Date.now()) / DAY))

    const base = dashboardUrl()
    const dashboardLink = base
    const subscriptionLink = `${base}/subscription`
    const channels: string[] = []

    const to = t.ownerEmail || t.storeEmail
    if (to) {
      const message = subscriptionEmail({
        kind: (input.kind.startsWith('reminder_') ? 'reminder' : input.kind) as SubscriptionNoticeKind,
        ownerName: t.ownerName ?? '',
        storeName: t.storeName,
        planName,
        until: input.until,
        daysLeft,
        trial,
        dashboardLink,
        subscriptionLink,
      })
      const sent = await sendEmail({
        to,
        ...message,
        log: { storeId: t.storeId, event: `subscription_${input.kind}` },
      })
      if (sent.ok) channels.push('email')
    }

    const phone = t.storeWhatsapp || t.ownerPhone || t.storePhone
    if (phone) {
      const from = await platformWhatsappStore()
      if (from) {
        const text = whatsappText({
          kind: input.kind,
          ownerName: t.ownerName ?? '',
          storeName: t.storeName,
          planName,
          until: input.until,
          daysLeft,
          trial,
          link: input.kind === 'activated' || input.kind === 'renewed' || input.kind === 'trial_started' ? dashboardLink : subscriptionLink,
        })
        const res = await sendWhatsapp(from, normalizePhone(phone, t.country === 'SA' ? '966' : '20'), text, {
          event: `subscription_${input.kind}`,
        })
        if (res.ok) channels.push('whatsapp')
      }
    }

    await db.update(subscriptionNotices).set({ channels }).where(eq(subscriptionNotices.id, claimed.id))
    return true
  } catch (e) {
    console.error('فشل رسالة الاشتراك:', e)
    return false
  }
}

/** من غير انتظار — بيكمّل بعد ما رد الزرار يخرج */
export function notifySubscription(input: Parameters<typeof deliverSubscriptionNotice>[0]): void {
  const work = deliverSubscriptionNotice(input)
  try {
    after(work)
  } catch {
    void work
  }
}
