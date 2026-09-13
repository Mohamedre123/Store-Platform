import { pgTable, uuid, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { stores, users } from './tenancy'
import { createdAt } from './_shared'

/**
 * أجهزة تطبيق الموبايل اللي بتستقبل إشعارات (Firebase).
 *
 * الصف = جهاز × متجر. صاحب متجرين بيسجّل نفس الجهاز للاتنين، فالطلب
 * الجديد في أي متجر فيهم بيوصله — والإشعار بيقول اسم المتجر.
 *
 * الصلاحية بتتقاس **وقت الإرسال** لا وقت التسجيل: الموظف اللي اتقفلت
 * عليه الطلبات النهارده ما يوصلوش إشعارها بكرة لمجرد إن جهازه اتسجّل
 * إمبارح.
 */
export const pushDevices = pgTable(
  'push_devices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    token: text('token').notNull(),
    /** android | ios */
    platform: text('platform').notNull(),
    createdAt: createdAt(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('push_devices_token_store_unique').on(t.token, t.storeId),
    index('push_devices_store_idx').on(t.storeId),
  ],
)
