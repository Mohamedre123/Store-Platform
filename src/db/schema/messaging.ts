import { pgTable, uuid, text, boolean, integer, jsonb, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { stores } from './tenancy'
import { createdAt, updatedAt, money } from './_shared'

export type Channel = 'sms' | 'whatsapp' | 'telegram' | 'email' | 'push' | 'chat'

/** أحداث الطلب التي يمكن أن تُطلق رسالة تلقائية */
export type AutomationEvent =
  | 'order_placed'
  | 'order_confirmed'
  | 'order_shipped'
  | 'order_delivered'
  | 'order_cancelled'
  | 'abandoned_cart'
  | 'otp'
  | 'welcome'
  | 'points_earned'
  | 'review_request'
  | 'back_in_stock'
  | 'birthday'

export const messagingSettings = pgTable('messaging_settings', {
  storeId: uuid('store_id')
    .primaryKey()
    .references(() => stores.id, { onDelete: 'cascade' }),

  /** رصيد الرسائل المشتراة من المنصة */
  credits: integer('credits').notNull().default(0),

  // القناة: إما مزوّد المنصة (يخصم رصيدًا) أو حساب التاجر (مجاني)
  smsProvider: text('sms_provider').$type<'platform' | 'custom' | 'off'>().notNull().default('off'),
  smsCredentials: text('sms_credentials'),
  smsSenderId: text('sms_sender_id'),

  /**
   * مزوّد واتساب.
   *
   * `wasender` بوابة بتربط رقمًا عاديًا بمسح كود — دقايق وبتشتغل.
   * `cloud` الطريق الرسمي من ميتا. و`platform`/`custom` قيم قديمة
   * بتتقرا على إنها `cloud` عشان المتاجر المحفوظة ما تتكسرش.
   */
  whatsappProvider: text('whatsapp_provider')
    .$type<'platform' | 'custom' | 'off' | 'wasender' | 'cloud'>()
    .notNull()
    .default('off'),
  whatsappCredentials: text('whatsapp_credentials'),
  whatsappPhoneId: text('whatsapp_phone_id'),

  /**
   * نصوص رسايل واتساب اللي التاجر كتبها.
   *
   * الفاضي معناه «استعمل الافتراضي» — مش «مفيش رسالة». التاجر
   * بيعدّل اللي يهمّه وسايب الباقي.
   */
  whatsappTemplates: jsonb('whatsapp_templates').$type<Record<string, string>>(),

  telegramBotToken: text('telegram_bot_token'),
  telegramChatIds: jsonb('telegram_chat_ids').$type<string[]>().notNull().default([]),

  emailProvider: text('email_provider').$type<'platform' | 'smtp' | 'off'>().notNull().default('platform'),
  emailCredentials: text('email_credentials'),
  emailFromName: text('email_from_name'),
  emailFromAddress: text('email_from_address'),

  updatedAt: updatedAt(),
})

/** مستلمو إشعارات الطلبات (موظفون/شركاء) */
export const notificationRecipients = pgTable(
  'notification_recipients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    name: text('name'),
    phone: text('phone'),
    channel: text('channel').$type<Channel>().notNull().default('telegram'),
    chatId: text('chat_id'),
    events: jsonb('events').$type<AutomationEvent[]>().notNull().default(['order_placed']),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index('notification_recipients_store_idx').on(t.storeId)],
)

/** الرسائل التلقائية — قالب لكل (حدث × قناة) */
export const automations = pgTable(
  'automations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    event: text('event').$type<AutomationEvent>().notNull(),
    channel: text('channel').$type<Channel>().notNull(),
    enabled: boolean('enabled').notNull().default(false),
    template: text('template').notNull(),
    /** تأخير الإرسال بالدقائق — يخدم تذكيرات السلة المتروكة */
    delayMinutes: integer('delay_minutes').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('automations_unique').on(t.storeId, t.event, t.channel)],
)

/**
 * محرّك القواعد — «لو حصل كذا وتحققت الشروط دي، اعمل كذا».
 * ده الفرق الحقيقي عن الأتمتة الثابتة عند المنافس.
 */
export const automationRules = pgTable(
  'automation_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    trigger: text('trigger').notNull(),
    /** [{ field, op, value }] — مثال: عدد الطلبات >= 2 و آخر طلب من 30 يوم */
    conditions: jsonb('conditions').$type<Array<{ field: string; op: string; value: unknown }>>().notNull().default([]),
    /** [{ type: 'send_message' | 'issue_coupon' | 'add_tag' | 'add_points', config }] */
    actions: jsonb('actions').$type<Array<{ type: string; config: Record<string, unknown> }>>().notNull().default([]),
    delayMinutes: integer('delay_minutes').notNull().default(0),
    cooldownHours: integer('cooldown_hours').notNull().default(24),
    enabled: boolean('enabled').notNull().default(false),
    runCount: integer('run_count').notNull().default(0),
    lastRunAt: timestamp('last_run_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('automation_rules_store_idx').on(t.storeId, t.enabled)],
)

export const messageLog = pgTable(
  'message_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    channel: text('channel').$type<Channel>().notNull(),
    event: text('event'),
    recipient: text('recipient').notNull(),
    body: text('body'),
    status: text('status').$type<'queued' | 'sent' | 'delivered' | 'read' | 'failed'>().notNull().default('queued'),
    provider: text('provider'),
    providerRef: text('provider_ref'),
    creditsUsed: integer('credits_used').notNull().default(0),
    cost: money('cost'),
    errorMessage: text('error_message'),
    orderId: uuid('order_id'),
    customerId: uuid('customer_id'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index('message_log_store_idx').on(t.storeId, t.createdAt),
    index('message_log_order_idx').on(t.orderId),
  ],
)

/** رموز التحقق */
export const otpCodes = pgTable(
  'otp_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    phone: text('phone').notNull(),
    codeHash: text('code_hash').notNull(),
    purpose: text('purpose').$type<'order' | 'login' | 'verify'>().notNull().default('order'),
    attempts: integer('attempts').notNull().default(0),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('otp_codes_lookup_idx').on(t.storeId, t.phone, t.purpose)],
)

/**
 * طابور المهام الخلفية.
 * كل حاجة بطيئة أو قابلة للفشل تتحط هنا: إرسال رسالة، إشعار بكسل من السيرفر،
 * إنشاء شحنة، مزامنة كتالوج. المسار اللي بيخدم العميل ما يستناش حد.
 */
export const jobQueue = pgTable(
  'job_queue',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').references(() => stores.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    status: text('status').$type<'pending' | 'running' | 'done' | 'failed'>().notNull().default('pending'),
    runAt: timestamp('run_at', { withTimezone: true }).notNull().defaultNow(),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(5),
    lastError: text('last_error'),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index('job_queue_pending_idx').on(t.status, t.runAt),
    index('job_queue_store_idx').on(t.storeId, t.type),
  ],
)

/**
 * محادثات الذكاء الاصطناعي في اللوحة.
 *
 * جدول واحد بيخدم كل المساعدين — مساعد التاجر ومولّد الثيمات ومولّد
 * صفحات الهبوط — بـ`kind` بتفرّق بينهم. جدول لكل مساعد كان هيكرّر
 * نفس المنطق تلات مرات، وأي تحسين في الحفظ يتعمل في واحد وينسى في
 * التانيين.
 */
export const aiConversations = pgTable(
  'ai_conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    /** assistant = مساعد اللوحة · theme = مولّد الثيمات · landing = صفحات الهبوط */
    kind: text('kind').$type<'assistant' | 'theme' | 'landing'>().notNull().default('assistant'),
    title: text('title').notNull().default('محادثة جديدة'),
    /** معرّف العنصر اللي المحادثة شغّالة عليه (ثيم أو صفحة هبوط) */
    targetId: uuid('target_id'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('ai_conversations_store_idx').on(t.storeId, t.kind, t.updatedAt)],
)

export type AiToolCall = {
  name: string
  args: Record<string, unknown>
  /**
   * توقيع الموديل للنداء ده.
   *
   * بيتخزّن عشان يترجّع لجوجل لما المحادثة تكمّل — موديلات جيميني ٣
   * بترفض الطلب لو النداء رجع من غيره. إحنا مش بنقراه ولا بنفسّره.
   */
  thoughtSignature?: string
  /** pending = مستنية موافقة التاجر · done = اتنفّذت · rejected = رفضها */
  status: 'pending' | 'done' | 'rejected' | 'failed'
  result?: string
}

export const aiMessages = pgTable(
  'ai_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => aiConversations.id, { onDelete: 'cascade' }),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    role: text('role').$type<'user' | 'model'>().notNull(),
    text: text('text').notNull().default(''),
    /** صور مرفقة — روابط بعد الرفع لا بايتات */
    images: jsonb('images').$type<string[]>().notNull().default([]),
    /** الإجراءات اللي المساعد اقترحها وحالتها */
    toolCalls: jsonb('tool_calls').$type<AiToolCall[]>().notNull().default([]),
    createdAt: createdAt(),
  },
  (t) => [index('ai_messages_conversation_idx').on(t.conversationId, t.createdAt)],
)
