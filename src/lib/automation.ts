import 'server-only'
import { and, eq, gt, sql } from 'drizzle-orm'
import { db } from '@/db'
import { automationRules, coupons, orderEvents, orders } from '@/db/schema'
import { getStoreTheme } from './storefront'
import { isEmailConfigured, sendEmail } from './email'
import { recordPoints } from './loyalty'
import { generateToken } from './crypto'
import { formatMoney } from './utils'
import { storeUrl } from './domain'
import type { TriggerKey } from './automation-defs'

/**
 * محرّك الأتمتة.
 *
 * لما يحصل حدث، بنجيب القواعد المفعّلة للمحفّز ده، نتأكد إن شروطها
 * متحققة، وننفّذ إجراءاتها. كله بيحصل في الخلفية بدون انتظار: الطلب
 * اللي سبّب الحدث ما ينفعش يستنى إرسال بريد أو نداء رابط خارجي.
 *
 * ثلاث ضمانات بتحمي التاجر وعملاءه:
 *
 * 1. **فترة تهدئة لكل قاعدة.** من غيرها قاعدة على «طلب جديد» تبعت
 *    عشرين رسالة لعميل عمل عشرين طلب في ساعة.
 * 2. **فشل إجراء ما يوقفش الباقي.** لو البريد وقع، النقاط تتحط برضه.
 * 3. **مفيش استثناءات بتطلع برّه.** المحرّك بيبلع أخطاءه ويسجّلها —
 *    قاعدة أتمتة معطوبة ما ينفعش توقّف بيعة.
 */

type Condition = { field: string; op: string; value: unknown }
type Action = { type: string; config: Record<string, unknown> }

/** سياق الحدث — الحقول اللي الشروط والرسائل بتقرأ منها */
export type AutomationContext = {
  storeId: string
  storeName: string
  orderId?: string
  orderNumber?: number
  orderTotal?: number
  itemCount?: number
  city?: string
  paymentMethod?: string
  customerId?: string
  customerName?: string | null
  customerEmail?: string | null
  customerPhone?: string | null
  customerOrders?: number
  customerSpent?: number
  productId?: string
  productName?: string
  stock?: number
  currency: string
  storeSlug: string
  recoveryToken?: string | null
}

/** نقطة الدخول الوحيدة — بترجع فورًا والتنفيذ بيكمّل في الخلفية */
export function runAutomations(trigger: TriggerKey, ctx: AutomationContext) {
  void execute(trigger, ctx).catch((e) =>
    console.error('فشل تشغيل الأتمتة:', trigger, e),
  )
}

/**
 * نفس التنفيذ بس بانتظار — لطابور المهام.
 *
 * المهمة المؤجَّلة لازم تعرف نجحت ولا لأ عشان الطابور يقرّر يعيد
 * المحاولة. النسخة اللي فوق بترجع فورًا وبتبلع الخطأ، وده صح لما
 * اللي بينادي طلب عميل — وغلط لما اللي بينادي عامل بيحاسب على
 * النتيجة.
 */
export async function runAutomationsNow(trigger: TriggerKey, ctx: AutomationContext) {
  await execute(trigger, ctx)
}

async function execute(trigger: TriggerKey, ctx: AutomationContext) {
  const rules = await db
    .select()
    .from(automationRules)
    .where(
      and(
        eq(automationRules.storeId, ctx.storeId),
        eq(automationRules.trigger, trigger),
        eq(automationRules.enabled, true),
      ),
    )

  for (const rule of rules) {
    try {
      // فترة التهدئة — بتمنع القاعدة تشتغل مرات كتير في وقت قصير
      if (rule.cooldownHours > 0 && rule.lastRunAt) {
        const elapsed = Date.now() - new Date(rule.lastRunAt).getTime()
        if (elapsed < rule.cooldownHours * 3_600_000) continue
      }

      if (!matches(rule.conditions as Condition[], ctx)) continue

      for (const action of rule.actions as Action[]) {
        try {
          await runAction(action, ctx)
        } catch (e) {
          console.error('فشل إجراء في الأتمتة:', rule.name, action.type, e)
        }
      }

      await db
        .update(automationRules)
        .set({ runCount: sql`${automationRules.runCount} + 1`, lastRunAt: new Date() })
        .where(eq(automationRules.id, rule.id))
    } catch (e) {
      console.error('فشل تنفيذ قاعدة:', rule.name, e)
    }
  }
}

/** كل الشروط لازم تتحقق — الشروط الفاضية معناها «دايمًا» */
function matches(conditions: Condition[], ctx: AutomationContext): boolean {
  if (!conditions?.length) return true

  return conditions.every((c) => {
    const actual = (ctx as unknown as Record<string, unknown>)[c.field]
    if (actual === undefined || actual === null) return false

    // المقارنات الرقمية على أرقام، والنصية على نصوص — من غير خلط
    if (['gte', 'lte'].includes(c.op)) {
      const a = Number(actual)
      const b = Number(c.value)
      if (!Number.isFinite(a) || !Number.isFinite(b)) return false
      return c.op === 'gte' ? a >= b : a <= b
    }

    const a = String(actual).trim().toLowerCase()
    const b = String(c.value).trim().toLowerCase()

    switch (c.op) {
      case 'eq':
        return a === b
      case 'neq':
        return a !== b
      case 'contains':
        return a.includes(b)
      default:
        return false
    }
  })
}

async function runAction(action: Action, ctx: AutomationContext) {
  const cfg = action.config ?? {}

  switch (action.type) {
    case 'send_email': {
      if (!ctx.customerEmail || !isEmailConfigured()) return
      const theme = await getStoreTheme(ctx.storeId)
      const subject = fill(String(cfg.subject ?? 'رسالة من {{store}}'), ctx)
      const body = fill(String(cfg.body ?? ''), ctx)
      if (!body.trim()) return

      await sendEmail({
        log: { storeId: ctx.storeId, event: 'automation', orderId: ctx.orderId },
        to: ctx.customerEmail,
        subject,
        html: simpleEmail(ctx.storeName, theme.custom.identity.primary, body),
        text: body,
      })
      return
    }

    case 'add_points': {
      if (!ctx.customerId) return
      const points = Math.trunc(Number(cfg.points) || 0)
      if (points === 0) return
      await recordPoints({
        storeId: ctx.storeId,
        customerId: ctx.customerId,
        points,
        type: 'manual',
        reason: String(cfg.reason ?? 'مكافأة تلقائية'),
        orderId: ctx.orderId,
      })
      return
    }

    case 'issue_coupon': {
      const percent = Math.round((Number(cfg.percent) || 0) * 100)
      if (percent <= 0) return

      const code = `AUTO${generateToken(4).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)}`
      const days = Math.max(1, Math.trunc(Number(cfg.days) || 14))

      await db.insert(coupons).values({
        storeId: ctx.storeId,
        code,
        description: 'كوبون تلقائي',
        type: 'percent',
        value: percent,
        usageLimit: 1,
        usageLimitPerCustomer: 1,
        isAutoGenerated: true,
        endsAt: new Date(Date.now() + days * 86_400_000),
        isActive: true,
      })

      // نبعت الكود للعميل — كوبون محدش يعرفه مالوش لازمة
      if (ctx.customerEmail && isEmailConfigured() && cfg.email !== false) {
        const theme = await getStoreTheme(ctx.storeId)
        await sendEmail({
          log: { storeId: ctx.storeId, event: 'automation', orderId: ctx.orderId },
          to: ctx.customerEmail,
          subject: `كود خصم ${percent / 100}٪ من ${ctx.storeName}`,
          html: simpleEmail(
            ctx.storeName,
            theme.custom.identity.primary,
            `كود خصمك: ${code}\nخصم ${percent / 100}٪ — صالح ${days} يوم.`,
          ),
          text: `كود خصمك: ${code} — خصم ${percent / 100}٪ صالح ${days} يوم.`,
        })
      }
      return
    }

    case 'order_note': {
      if (!ctx.orderId) return
      await db.insert(orderEvents).values({
        orderId: ctx.orderId,
        storeId: ctx.storeId,
        type: 'note',
        message: fill(String(cfg.text ?? ''), ctx) || 'ملاحظة تلقائية',
        actorType: 'system',
      })
      return
    }

    case 'set_status': {
      if (!ctx.orderId) return
      const status = String(cfg.status ?? '')
      if (!['confirmed', 'processing', 'cancelled'].includes(status)) return

      await db
        .update(orders)
        .set({ status: status as never })
        .where(and(eq(orders.id, ctx.orderId), eq(orders.storeId, ctx.storeId)))

      await db.insert(orderEvents).values({
        orderId: ctx.orderId,
        storeId: ctx.storeId,
        type: 'status_changed',
        message: `الأتمتة غيّرت الحالة إلى «${status}»`,
        actorType: 'system',
      })
      return
    }

    case 'call_webhook': {
      const url = String(cfg.url ?? '')
      if (!/^https:\/\//i.test(url)) return

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 8000)
      try {
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ctx),
          signal: controller.signal,
        })
      } finally {
        clearTimeout(timer)
      }
      return
    }
  }
}

/**
 * استبدال المتغيّرات في نص التاجر.
 *
 * التاجر بيكتب «أهلًا {{name}}» ونحن بنملاها. أي متغيّر مش معروف
 * بيتشال بدل ما يظهر للعميل كـ{{xyz}}.
 */
function fill(text: string, ctx: AutomationContext): string {
  const map: Record<string, string> = {
    name: ctx.customerName ?? '',
    store: ctx.storeName,
    order: ctx.orderNumber ? `#${ctx.orderNumber}` : '',
    total: ctx.orderTotal ? formatMoney(ctx.orderTotal, ctx.currency) : '',
    product: ctx.productName ?? '',
    link:
      ctx.orderNumber && ctx.recoveryToken
        ? `${storeUrl(ctx.storeSlug)}/order/${ctx.orderNumber}?t=${encodeURIComponent(ctx.recoveryToken)}`
        : storeUrl(ctx.storeSlug),
  }

  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => map[key] ?? '')
}

/** قالب بريد بسيط بهوية المتجر — نفس مبدأ باقي رسائل التاجر */
function simpleEmail(storeName: string, primary: string, body: string): string {
  const escaped = body
    .replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] as string)
    .replace(/\n/g, '<br>')

  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f3f9;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f3f9;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
<tr><td align="center" style="padding-bottom:20px;font-family:'Segoe UI',Tahoma,Arial,sans-serif;font-size:18px;font-weight:bold;color:${primary};">${storeName}</td></tr>
<tr><td style="background:#fff;border:1px solid #e2e4ec;border-radius:14px;padding:28px;font-family:'Segoe UI',Tahoma,Arial,sans-serif;font-size:15px;line-height:1.9;color:#222540;">
${escaped}
</td></tr>
</table></td></tr></table></body></html>`
}
