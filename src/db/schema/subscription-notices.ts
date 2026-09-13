import { pgTable, uuid, text, timestamp, jsonb, uniqueIndex } from 'drizzle-orm/pg-core'
import { stores } from './tenancy'
import { createdAt } from './_shared'

/**
 * رسايل الاشتراك اللي اتبعتت للتاجر (تفعيل، تجديد، تذكير، انتهاء، إيقاف).
 *
 * الصف = رسالة واحدة لفترة واحدة. المفتاح (متجر، نوع، نهاية الفترة)
 * هو اللي بيمنع التكرار: المهمة بتشتغل أكتر من مرة في اليوم، وتذكير
 * «فاضل ٣ أيام» ما يصحّش يوصل كل ساعة. ولما التاجر يجدّد، نهاية الفترة
 * بتتغيّر — فالتذكيرات بتتبعت تاني للفترة الجديدة لوحدها.
 */
export const subscriptionNotices = pgTable(
  'subscription_notices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    /** trial_started | activated | renewed | reminder_7 | reminder_3 | reminder_1 | expired | trial_ended | cancelled */
    kind: text('kind').notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
    /** القنوات اللي وصلت عليها فعلًا: email, whatsapp */
    channels: jsonb('channels').$type<string[]>().notNull().default([]),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('subscription_notices_unique').on(t.storeId, t.kind, t.periodEnd)],
)
