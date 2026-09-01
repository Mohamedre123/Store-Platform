import { pgTable, uuid, text, timestamp, index } from 'drizzle-orm/pg-core'
import { createdAt, money, updatedAt } from './_shared'
import { stores, users, type PlanKey } from './tenancy'

export type RequestStatus = 'pending' | 'approved' | 'rejected'
export type PayMethod = 'wallet' | 'instapay'

/**
 * طلبات الاشتراك — «أنا حوّلت، فعّلّي».
 *
 * ## ليه الجدول ده موجود أصلًا
 * الدفع بيتم برّه المنصة (محفظة أو إنستا باي)، فمفيش ويب هوك ولا أي
 * إشارة بتوصلنا إن حد دفع. من غير الجدول ده، الطريق الوحيد إن التاجر
 * يبعت واتساب — واللي ما بيبعتش بيفضل مجهول: دفع، واستنى، وما اتفعّلش،
 * وإحنا أصلًا مش عارفين إنه موجود.
 *
 * الصف بيتكتب **لحظة ما يدوس «تم الدفع»**، قبل ما يفتح واتساب أصلًا.
 * يعني حتى لو قفل الشباك أو الرسالة ما اتبعتتش، الطلب بيبان في لوحة
 * الإدارة باسمه ومعرّف حسابه ومتجره وباقته.
 *
 * ## ما بيفعّلش حاجة لوحده
 * الصف ده **طلب** لا اشتراك. التفعيل بيغيّر `stores` بإيد إدارة المنصة،
 * وبعدين بيتربط بالطلب هنا. لو خلّينا الصف يفعّل، أي حد يدوس الزرار
 * من غير ما يحوّل جنيه وياخد الباقة.
 */
export const subscriptionRequests = pgTable(
  'subscription_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    plan: text('plan').$type<PlanKey>().notNull(),
    /** المبلغ المطلوب وقت الطلب بالقرش — السعر ممكن يتغيّر بعدين */
    amount: money('amount'),
    method: text('method').$type<PayMethod>().notNull().default('wallet'),

    status: text('status').$type<RequestStatus>().notNull().default('pending'),

    /** ملاحظة الإدارة عند القبول أو الرفض — بتظهر للتاجر */
    note: text('note'),
    reviewedBy: uuid('reviewed_by'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),

    createdAt: createdAt(),
  },
  (t) => [
    index('subscription_requests_status_idx').on(t.status, t.createdAt),
    index('subscription_requests_store_idx').on(t.storeId, t.createdAt),
  ],
)

/**
 * إعدادات على مستوى المنصة — مش لمتجر بعينه.
 *
 * أول ساكن فيها توكن تشغيل عامل الطابور. المنبّه الزمني بيعيش جوّه
 * قاعدة البيانات (`pg_cron`)، وما بيشوفش متغيّرات بيئة الاستضافة —
 * فالتوكن لازم يكون في مكان يقدر يقراه، وده هو.
 */
export const platformSettings = pgTable('platform_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: updatedAt(),
})
