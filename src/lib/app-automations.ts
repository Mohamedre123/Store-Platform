import 'server-only'
import type { ActiveStore } from '@/lib/store-context'
import { loadAutomations } from '@/lib/automations-data'
import { ACTIONS, OPERATORS, triggerDef } from '@/lib/automation-defs'

/*
  أسماء الأحداث والقنوات — نفس اللي في `recipients-manager.tsx` (ملف متصفح ما ينفعش
  يتقرا منه قيم في كود الخادم). لو اتضاف حدث أو قناة هناك، ضيفه هنا.
*/
const EVENT_LABELS: Record<string, string> = {
  order_placed: 'طلب جديد',
  order_confirmed: 'طلب اتأكّد',
  order_shipped: 'طلب اتشحن',
  order_delivered: 'طلب اتسلّم',
  order_cancelled: 'طلب اتلغى',
  abandoned_cart: 'سلة متروكة',
}
const CHANNEL_LABELS: Record<string, string> = { telegram: 'تيليجرام', whatsapp: 'واتساب', email: 'بريد', sms: 'رسالة نصية' }

/** شكل شاشة الأتمتة اللي تطبيق الموبايل بيستلمه — التشغيل والتجربة والحذف، والبناء من صفحة المنصة */
export async function automationsPayload(store: ActiveStore) {
  const { rules, recipients, whatsappReady, telegramReady } = await loadAutomations(store.id)

  return {
    whatsappReady,
    telegramReady,
    recipients: recipients.map((r) => ({
      id: r.id,
      name: r.name ?? '',
      channel: r.channel,
      channelLabel: CHANNEL_LABELS[r.channel] ?? r.channel,
      target: r.phone ?? r.chatId ?? '',
      eventsLabel: (r.events ?? []).map((e) => EVENT_LABELS[e] ?? e).join('، '),
      isActive: r.isActive,
    })),
    rules: rules.map((r) => {
      const trigger = triggerDef(r.trigger)
      return {
        id: r.id,
        name: r.name,
        triggerLabel: trigger?.label ?? r.trigger,
        conditions: r.conditions.map((c) => {
          const field = trigger?.fields.find((f) => f.key === c.field)
          const op = OPERATORS.find((o) => o.value === c.op)
          const value = field?.options?.find((o) => o.value === c.value)?.label ?? String(c.value ?? '')
          return `${field?.label ?? c.field} ${op?.label ?? c.op} ${value}`
        }),
        actions: r.actions.map((a) => ACTIONS.find((x) => x.key === a.type)?.label ?? a.type),
        cooldownHours: r.cooldownHours,
        enabled: r.enabled,
        runCount: r.runCount,
        lastRunAt: r.lastRunAt ? r.lastRunAt.toISOString() : null,
      }
    }),
  }
}
