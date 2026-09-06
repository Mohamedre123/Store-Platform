import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  integer,
  boolean,
  jsonb,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
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

/**
 * رسالة من إدارة المنصة لتاجر — أو لشريحة من التجّار.
 *
 * ## المشكلة اللي بيحلّها الجدول ده
 * الإدارة عايزة تكافئ التاجر اللي وصل لحاجة: «وصّلت ١٠ طلبات، خد
 * شهر ببلاش»، أو «حِيل خمسة وياخدوا اشتراك، والشهر عليّنا». الكلام
 * ده كان لازم يتبعت على واتساب لكل واحد بإيده — يعني عمليًّا ما
 * بيتبعتش.
 *
 * ## والشرط بيتقاس لحظة العرض لا وقت الكتابة
 * الإدارة بتكتب «لكل واحد وصّل ١٠ طلبات»، والتاجر اللي بيوصل بكرة
 * بيشوفها بكرة لوحده. القايمة الثابتة كانت هتحتاج حد يفتحها كل يوم
 * ويضيف الجداد.
 *
 * ## والنص بإيد الإدارة بالكامل
 * مفيش قوالب جاهزة ولا متغيّرات إجبارية. المكافأة بتتغيّر حسب
 * الموسم والتاجر والمزاج، وأي قالب كان هيقيّد ده.
 */
export const platformNotices = pgTable(
  'platform_notices',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    title: text('title').notNull(),
    body: text('body').notNull(),
    /** نص الزرار — «فعّل مكافأتك» أو «افتح الصفحة» */
    ctaLabel: text('cta_label'),
    /** وجهة الزرار — لـ`link` وحده، ومسار داخلي بيتختار من قايمة */
    ctaHref: text('cta_href'),

    /**
     * الزرار بيعمل إيه.
     *
     * `none`: مفيش زرار (تهنئة) · `free_days`: بيمدّ اشتراك
     * التاجر بالمدة دي فورًا · `link`: بيوديه لصفحة في لوحته.
     *
     * ## ليه نوع مش رابط مكتوب بالإيد
     * اللي بيكتب الرسالة مش مبرمج. الرابط الخام كان بيخلّي الزرار
     * أحسن حالاته إنه يوصّل التاجر لصفحة يدوّر فيها على مكافأته —
     * وأسوأ حالاته إنه يوديه على ٤٠٤.
     */
    rewardKind: text('reward_kind')
      .$type<'none' | 'free_days' | 'link'>()
      .notNull()
      .default('none'),
    /** أيام الاشتراك المجاني — لـ`free_days` وحده */
    rewardDays: integer('reward_days').notNull().default(0),

    /** offer: عرض ومكافأة · praise: تهنئة · info: خبر */
    tone: text('tone').$type<'offer' | 'praise' | 'info'>().notNull().default('offer'),

    /**
     * مين يشوفها.
     *
     * `all`: كل التجّار · `stores`: متاجر محدّدة بأسمائها ·
     * `rule`: اللي حقّقوا شرطًا (طلبات مسلَّمة أو إحالات)
     */
    audience: text('audience').$type<'all' | 'stores' | 'rule'>().notNull().default('all'),
    targetStoreIds: jsonb('target_store_ids').$type<string[]>().notNull().default([]),

    /**
     * الشروط — **صفر يعني «مش شرط»** لا «شرط بصفر».
     *
     * لو خزّنّا `null` كان لازم كل مقارنة تفحص الاتنين. الصفر بيمرّ
     * دايمًا لأن أي تاجر عنده صفر أو أكتر، فالشرط بيختفي لوحده.
     */
    minDeliveredOrders: integer('min_delivered_orders').notNull().default(0),
    minReferrals: integer('min_referrals').notNull().default(0),

    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    isActive: boolean('is_active').notNull().default(true),

    createdBy: uuid('created_by'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('platform_notices_active_idx').on(t.isActive, t.startsAt)],
)

/**
 * التاجر قفل الرسالة.
 *
 * صف لكل (متجر، رسالة) — والغياب معناه «لسه ما شافهاش». الحقل على
 * المتجر لا على المستخدم: الشريك اللي بيشتغل على نفس المتجر مالوش
 * دعوة يشوف عرضًا صاحبه قفله.
 */
export const noticeDismissals = pgTable(
  'notice_dismissals',
  {
    noticeId: uuid('notice_id').notNull().references(() => platformNotices.id, { onDelete: 'cascade' }),
    storeId: uuid('store_id').notNull(),
    dismissedAt: timestamp('dismissed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('notice_dismissals_unique').on(t.noticeId, t.storeId)],
)

/**
 * التاجر فعّل المكافأة.
 *
 * ## الفهرس الفريد هو الحارس لا الفحص
 * التاجر اللي بيدوس مرتين بسرعة بيبعت طلبين متوازيين، والاتنين
 * بيقروا «لسه ماخدهاش» قبل ما أي واحد فيهم يكتب. الفحص وحده كان
 * بيديله شهرين — القيد في القاعدة هو اللي بيمنعها فعلًا.
 *
 * ## وبيتكتب **قبل** المنح لا بعده
 * الصف بيتحجز الأول؛ لو الحجز رجع فاضي يبقى حد سبقنا وبنقف. لو
 * منحنا الأول وفشل التسجيل، التاجر بياخد المكافأة ومفيش أثر إنه
 * خدها.
 */
export const noticeRedemptions = pgTable(
  'notice_redemptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    noticeId: uuid('notice_id').notNull().references(() => platformNotices.id, { onDelete: 'cascade' }),
    storeId: uuid('store_id').notNull(),
    grantedDays: integer('granted_days').notNull().default(0),
    /** لحد إمتى امتدّ اشتراكه — للسجل ولرسالة التأكيد */
    grantedUntil: timestamp('granted_until', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('notice_redemptions_unique').on(t.noticeId, t.storeId),
    index('notice_redemptions_store_idx').on(t.storeId),
  ],
)
