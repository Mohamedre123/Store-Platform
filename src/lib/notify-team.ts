import 'server-only'
import { after } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { messagingSettings, notificationRecipients, stores } from '@/db/schema'
import { decrypt } from './crypto'
import { isEmailConfigured, sendEmail } from './email'
import { dashboardUrl } from './domain'
import { formatMoney } from './utils'
import type { AutomationEvent } from '@/db/schema'

/**
 * إشعارات الفريق.
 *
 * **دي مش رسايل العملاء.** العميل بيتبلّغ بحالة طلبه، والفريق
 * بيتبلّغ عشان يشتغل: اللي بيغلّف لازم يعرف إن فيه طلب جديد وهو
 * في المخزن، مش لما يفتح اللوحة بعد ساعتين.
 *
 * كل مستقبل بيختار الأحداث اللي تهمّه. إشعار واحد بيروح للكل
 * معناه إن كله بيتجاهله بعد يومين — والتاجر بيرجع يفتح اللوحة
 * كل شوية زي ما كان.
 *
 * **ما بيرميش أبدًا.** فشل الإشعار ما يصحّش يوقف طلبًا اتسجّل خلاص.
 */

export type TeamEvent = AutomationEvent

export type TeamContext = {
  storeId: string
  storeName: string
  orderNumber?: number
  orderId?: string
  total?: number
  currency?: string
  customerName?: string | null
  customerPhone?: string | null
  city?: string | null
}

const TITLES: Partial<Record<TeamEvent, string>> = {
  order_placed: 'طلب جديد',
  order_confirmed: 'طلب اتأكّد',
  order_shipped: 'طلب اتشحن',
  order_delivered: 'طلب اتسلّم',
  order_cancelled: 'طلب اتلغى',
  abandoned_cart: 'سلة متروكة',
}

function buildText(event: TeamEvent, ctx: TeamContext): string {
  const title = TITLES[event] ?? 'تنبيه'
  const lines = [`🔔 ${title} — ${ctx.storeName}`]

  if (ctx.orderNumber) lines.push(`الطلب: #${ctx.orderNumber}`)
  if (ctx.total !== undefined) lines.push(`القيمة: ${formatMoney(ctx.total, ctx.currency ?? 'EGP')}`)
  if (ctx.customerName) lines.push(`العميل: ${ctx.customerName}`)
  if (ctx.customerPhone) lines.push(`التليفون: ${ctx.customerPhone}`)
  if (ctx.city) lines.push(`المحافظة: ${ctx.city}`)

  if (ctx.orderId) lines.push('', `${dashboardUrl()}/orders/${ctx.orderId}`)

  return lines.join('\n')
}

/**
 * تيليجرام.
 *
 * أرخص قناة إشعار فريق موجودة: مجانية تمامًا، والتاجر بيعمل بوت في
 * دقيقتين. عشان كده هي الافتراضية — الواتساب بيزنس محتاج تعاقد،
 * والرسايل النصية بتتحاسب على كل رسالة.
 */
async function sendTelegram(botToken: string, chatId: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * يبلّغ كل من اختار الحدث ده.
 *
 * بيتنادى بغير `await` من مسارات الطلب — الإشعار مهم، بس مش أهم
 * من إن الطلب يخلص.
 */
/**
 * شغل خلفي بيكمّل بعد ما الاستجابة تخرج.
 *
 * `void` وحدها مش كفاية على منصة بلا خوادم: أول ما الاستجابة تخرج
 * التنفيذ بيتجمّد، وأي وعد سايب بيموت في نُصّه. الرسايل كانت
 * بتوصل صدفة لما الطلب يفضل مشغول بحاجة تانية بعدها.
 *
 * `after` بيقول للمنصة متجمّديش لحد ما ده يخلص. وبرّه سياق الطلب
 * (مهمة مجدولة مثلًا) بيرمي، فبنرجع للسلوك القديم.
 */
function background(work: Promise<unknown>, label: string) {
  const guarded = work.catch((e) => console.error(label, e))
  try {
    after(guarded)
  } catch {
    void guarded
  }
}

export function notifyTeam(event: TeamEvent, ctx: TeamContext): void {
  background(deliver(event, ctx), 'فشل إشعار الفريق:')
}

async function deliver(event: TeamEvent, ctx: TeamContext): Promise<void> {
  const rows = await db
    .select({
      channel: notificationRecipients.channel,
      phone: notificationRecipients.phone,
      chatId: notificationRecipients.chatId,
      events: notificationRecipients.events,
      name: notificationRecipients.name,
    })
    .from(notificationRecipients)
    .where(
      and(
        eq(notificationRecipients.storeId, ctx.storeId),
        eq(notificationRecipients.isActive, true),
      ),
    )

  const targets = rows.filter((r) => (r.events ?? []).includes(event))
  if (targets.length === 0) return

  const text = buildText(event, ctx)
  const title = TITLES[event] ?? 'تنبيه'

  const [settings] = await db
    .select({ telegramBotToken: messagingSettings.telegramBotToken })
    .from(messagingSettings)
    .where(eq(messagingSettings.storeId, ctx.storeId))
    .limit(1)

  /*
    توكن البوت متخزّن مشفّرًا. التاجر اللي حطّه قبل ما نشفّر (أو
    استوردناه) ممكن يكون خامًا — بنجرّب نفكّه وبنقع على القيمة زي
    ما هي بدل ما نرمي، عشان إشعاراته ما تقفش عشان تفصيلة تخزين.
  */
  let botToken: string | null = settings?.telegramBotToken ?? null
  if (botToken?.includes('.')) {
    try {
      botToken = decrypt(botToken)
    } catch {
      /* خام — نستخدمه زي ما هو */
    }
  }

  const [store] = await db
    .select({ email: stores.email })
    .from(stores)
    .where(eq(stores.id, ctx.storeId))
    .limit(1)

  for (const t of targets) {
    if (t.channel === 'telegram' && botToken && t.chatId) {
      await sendTelegram(botToken, t.chatId, text)
      continue
    }

    if (t.channel === 'email' && t.phone && isEmailConfigured()) {
      await sendEmail({
        to: t.phone,
        subject: `${title} — ${ctx.storeName}`,
        text,
        html: `<pre style="font-family:inherit;font-size:15px;line-height:1.9;white-space:pre-wrap;">${text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')}</pre>`,
        log: { storeId: ctx.storeId, event: 'team_notify', orderId: ctx.orderId },
      }).catch(() => undefined)
      continue
    }

    /*
      الواتساب والرسايل النصية محتاجين مزوّدًا مدفوعًا لسه ما اتربطش.
      بنسيبهم من غير إرسال بدل ما ندّعي إننا بعتنا — التاجر اللي
      مستنّي إشعار ما جاش أسوأ من اللي عارف إن القناة لسه مش شغّالة،
      والواجهة بتقول ده صراحةً جنب الخيار.
    */
    void store
  }
}
