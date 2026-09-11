import { pgTable, uuid, text, boolean, integer, jsonb, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { stores } from './tenancy'
import { products } from './catalog'
import { createdAt, updatedAt } from './_shared'

/**
 * استوديو المحتوى — الصور والبوستات والنشر المجدوَل.
 *
 * ## المشكلة اللي بيحلّها
 * التاجر عنده بضاعة وعارف يبيعها، ومش عارف يصوّرها ولا يكتب عنها.
 * فبيدفع لمصمّم في كل بوست، أو بينزل صورة المنتج على خلفية بيضا
 * ومكتوب تحتها اسمه — والاتنين بيخلّوا الإعلان يعدّي.
 *
 * والأهم إنه بينسى ينزل. البوست اللي بينزل مرة في الأسبوع لما
 * يفتكر ما بيبنيش متابعين.
 */

/* ══════════════════════════════════════════════════════════════
   الصور المولَّدة
   ══════════════════════════════════════════════════════════════ */

/**
 * صورة اتولّدت أو اتعدّلت في الاستوديو.
 *
 * ## `parentId` — سلسلة التعديل
 * التاجر بيقول «خلّي الخلفية أغمق»، وبعدها «كبّر الخط»، وبعدها
 * «رجّع اللي قبله». من غير السلسلة، كل تعديل بيمسح اللي قبله
 * وما فيش رجوع — والتعديل التالت اللي طلع وحش بيضيّع التاني اللي
 * كان حلو.
 *
 * الصف الجديد بيتكتب لكل تعديل، وأبوه بيفضل موجود.
 */
export const studioAssets = pgTable(
  'studio_assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),

    /** الوصف اللي اتكتب — للتوليد أو للتعديل */
    prompt: text('prompt').notNull(),
    url: text('url').notNull(),
    /** مسار التخزين — للحذف */
    path: text('path').notNull(),

    /**
     * صورة ولا فيديو.
     *
     * العرض والتنزيل والنشر تلاتتهم بيختلفوا — و`<img>` على ملف
     * mp4 بيرسم أيقونة مكسورة من غير ما يقول ليه.
     */
    kind: text('kind').$type<'image' | 'video'>().notNull().default('image'),
    mimeType: text('mime_type').notNull().default('image/png'),

    /** مقاس المنصة اللي اتولّدت له: square · portrait · story · landscape */
    preset: text('preset').notNull().default('square'),

    /**
     * المنتج اللي الصورة عنه.
     *
     * `set null` لا `cascade`: التاجر اللي مسح منتجًا مش المفروض
     * يخسر الصور اللي عملها له — ممكن يكون نشرها خلاص.
     */
    productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),

    /** الصورة اللي اتعدّلت منها — فاضي يعني توليد من الصفر */
    parentId: uuid('parent_id'),

    createdBy: uuid('created_by'),
    createdAt: createdAt(),
  },
  (t) => [
    index('studio_assets_store_idx').on(t.storeId, t.createdAt),
    index('studio_assets_parent_idx').on(t.parentId),
  ],
)

/* ══════════════════════════════════════════════════════════════
   حسابات السوشيال
   ══════════════════════════════════════════════════════════════ */

export type SocialPlatform = 'facebook' | 'instagram' | 'tiktok'

/**
 * حساب سوشيال مربوط بمتجر.
 *
 * ## التوكن مشفَّر في عمود لوحده
 * ده مفتاح بينشر باسم التاجر على صفحته. تسريب صف من الجدول ده
 * معناه إن حد ينشر على صفحات التجّار كلهم — فبيتخزّن مشفّرًا زي
 * مفاتيح الـAPI بالظبط، ومش بيتقرا في أي استعلام عرض.
 *
 * ## و`expiresAt` بيتخزّن حتى لو التوكن طويل العمر
 * توكن صفحة فيسبوك «الدائم» بيتلغي لو التاجر غيّر باسوورده أو شال
 * صلاحية التطبيق. من غير التاريخ، أول نشر فاشل بيبان عطلًا عندنا
 * بدل «الربط انتهى، اربط تاني».
 */
export const socialAccounts = pgTable(
  'social_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),

    platform: text('platform').$type<SocialPlatform>().notNull(),
    /** معرّف الصفحة/الحساب عند المنصة */
    externalId: text('external_id').notNull(),
    name: text('name').notNull(),
    avatar: text('avatar'),

    /** مشفَّر — بينشر باسم التاجر */
    accessToken: text('access_token').notNull(),
    refreshToken: text('refresh_token'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),

    /**
     * النشر المباشر متاح؟
     *
     * تيك توك بيسمح بالرفع للمسوّدات من غير تدقيق، والنشر المباشر
     * بعد التدقيق بس. الفرق ده لازم يبان للتاجر قبل ما يجدول — لا
     * بعد ما يستنّى بوست ما نزلش.
     */
    canPublish: boolean('can_publish').notNull().default(true),

    /**
     * مين بينشر — تطبيقنا ولا وسيط.
     *
     * ميتا وتيك توك بيطلبوا موافقة وتوثيق نشاط قبل أول بوست.
     * الوسيط عنده الموافقات جاهزة، فالتاجر بيربط وينشر من غير ما
     * نستنّى مراجعة — ونفس النتيجة عند العميل بالظبط.
     *
     * والعمود ده بيخلّي الطريقين يعيشوا جنب بعض: المتاجر اللي
     * اتربطت مباشرةً تفضل شغّالة لما موافقتنا تخلص.
     */
    provider: text('provider').$type<'direct' | 'uploadpost'>().notNull().default('direct'),
    /** معرّف الملف عند الوسيط — الوجهة اللي بينشر عليها */
    providerProfile: text('provider_profile'),

    status: text('status').$type<'active' | 'expired' | 'revoked'>().notNull().default('active'),
    lastError: text('last_error'),

    connectedBy: uuid('connected_by'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('social_accounts_unique').on(t.storeId, t.platform, t.externalId),
    index('social_accounts_store_idx').on(t.storeId),
  ],
)

/* ══════════════════════════════════════════════════════════════
   البوستات
   ══════════════════════════════════════════════════════════════ */

export type PostStatus = 'draft' | 'ready' | 'scheduled' | 'publishing' | 'published' | 'failed'

/**
 * بوست — نص وصور ووجهات.
 *
 * ## بيتخزّن حتى لو مفيش حساب مربوط
 * التاجر اللي لسه ما ربطش صفحته بياخد البوست جاهزًا في قايمة
 * «جاهز للنشر»، وبينزّله وينشره بإيده. الميزة بتفيده من أول يوم،
 * والربط بيحوّلها لتلقائية — لا بيخلّيها تشتغل.
 */
export const socialPosts = pgTable(
  'social_posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),

    caption: text('caption').notNull(),
    /** الهاشتاجات منفصلة — التاجر بيعدّلها لوحدها وبتتلزق آخر النص */
    hashtags: jsonb('hashtags').$type<string[]>().notNull().default([]),
    imageUrls: jsonb('image_urls').$type<string[]>().notNull().default([]),
    /**
     * الفيديو — عمود لوحده لا في `imageUrls`.
     *
     * كل منصة بتنشر الفيديو بمسار مختلف عن الصورة (ريلز، فيديو
     * الصفحة، فيديو تيك توك). لو اتخزّنوا مع بعض، كل ناشر كان
     * هيحتاج يخمّن النوع من امتداد الرابط — وأول رابط من غير
     * امتداد بيتنشر بالمسار الغلط ويترفض.
     */
    videoUrl: text('video_url'),

    productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),

    /** الحسابات المستهدَفة — معرّفات من `social_accounts` */
    targets: jsonb('targets').$type<string[]>().notNull().default([]),

    status: text('status').$type<PostStatus>().notNull().default('draft'),
    scheduledFor: timestamp('scheduled_for', { withTimezone: true }),
    publishedAt: timestamp('published_at', { withTimezone: true }),

    /**
     * نتيجة كل وجهة على حدة.
     *
     * البوست اللي نزل على فيسبوك وفشل على إنستجرام **مش فاشلًا
     * ولا ناجحًا** — والحالة الواحدة كانت بتخلّي التاجر يعيد نشر
     * اللي نزل خلاص أو يفتكر إن اللي ما نزلش نزل.
     */
    results: jsonb('results')
      .$type<Array<{ accountId: string; ok: boolean; externalId?: string; error?: string }>>()
      .notNull()
      .default([]),

    /** الجدول اللي ولّده — فاضي يعني التاجر عمله بإيده */
    scheduleId: uuid('schedule_id'),
    createdBy: uuid('created_by'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('social_posts_store_idx').on(t.storeId, t.createdAt),
    index('social_posts_due_idx').on(t.status, t.scheduledFor),
  ],
)

/* ══════════════════════════════════════════════════════════════
   الجدولة
   ══════════════════════════════════════════════════════════════ */

export type ScheduleSource = 'auto' | 'category' | 'products'

/**
 * جدول نشر — «كل يوم الساعة كذا».
 *
 * ## الأيام مصفوفة أرقام لا نص
 * `[0,2,4]` = الأحد والتلات والخميس. النص («يوميًا») كان بيحتاج
 * تفسيرًا في كل مكان بيقرا الجدول، وأول تفسير يختلف بيخلّي البوست
 * ينزل يوم مش مطلوب.
 *
 * ## و`nextRunAt` محسوب لا مستنتَج
 * لو حسبناه وقت القراءة، كل نبضة كانت هتلفّ على كل الجداول وتحسب.
 * التخزين بيخلّي الاستعلام فهرسًا واحدًا: «هات اللي ميعاده فات».
 */
export const contentSchedules = pgTable(
  'content_schedules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),

    name: text('name').notNull(),
    isActive: boolean('is_active').notNull().default(true),

    /** أيام الأسبوع — ٠ الأحد */
    days: jsonb('days').$type<number[]>().notNull().default([]),
    /** «HH:MM» بتوقيت المتجر */
    timeOfDay: text('time_of_day').notNull().default('10:00'),

    targets: jsonb('targets').$type<string[]>().notNull().default([]),

    /**
     * منين بيجيب المنتج.
     *
     * `auto` = بالدور على منتجات المتجر النشطة. ده الافتراضي لأنه
     * اللي بيخلّي الجدول يشتغل من غير ما التاجر يفضل يختار كل
     * أسبوع — والجدول اللي محتاج صيانة أسبوعية بيقف بعد أسبوعين.
     */
    source: text('source').$type<ScheduleSource>().notNull().default('auto'),
    categoryId: uuid('category_id'),
    productIds: jsonb('product_ids').$type<string[]>().notNull().default([]),

    /** آخر منتج اتنشر — عشان الدور ما يعيدش نفس المنتج */
    lastProductId: uuid('last_product_id'),

    /** نبرة الكتابة وتوجيه الصورة — بيتلزق في الوصف */
    style: text('style'),
    preset: text('preset').notNull().default('square'),
    /**
     * الجدول بيعمل صور ولا فيديو.
     *
     * الافتراضي صورة: الفيديو أغلى بمراحل، والجدول اليومي عليه
     * بيطلّع فاتورة التاجر ما توقّعهاش. بيختاره بإيده وهو شايف
     * التنبيه.
     */
    media: text('media').$type<'image' | 'carousel' | 'video'>().notNull().default('image'),
    /** عدد شرايح الكاروسيل — بيتقرا لما `media = 'carousel'` بس */
    slides: integer('slides').notNull().default(5),
    /**
     * شكل الصورة — `STYLES` في `studio-meta`.
     *
     * `auto` افتراضي: المدير الفني بيختار على حسب المنتج. والكلام
     * المكتوب في `style` بيغلبه لو فيه شكل صريح («خلفية سادة») — عشان
     * الجداول اللي اتعملت قبل العمود ده تمشي بكلام التاجر.
     */
    imageStyle: text('image_style').notNull().default('auto'),
    /**
     * Gemini أو ChatGPT — فاضي يعني اختيار التاجر المحفوظ في المساعد.
     *
     * نص مش enum: المزوّد اللي ما بقاش ليه مفتاح بيرجع للموجود بدل ما
     * الجدول يقع.
     */
    aiProvider: text('ai_provider'),

    /**
     * ينشر لوحده ولا يستنّى موافقة؟
     *
     * الافتراضي **يستنّى**. النشر باسم التاجر من غير ما يشوف أول
     * مرة بيخلّي أول غلطة تنزل على صفحته قدام متابعينه — والثقة
     * دي بتتاخد بالتجربة لا بالافتراض.
     */
    autoPublish: boolean('auto_publish').notNull().default(false),

    lastRunAt: timestamp('last_run_at', { withTimezone: true }),
    nextRunAt: timestamp('next_run_at', { withTimezone: true }),
    lastError: text('last_error'),

    createdBy: uuid('created_by'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('content_schedules_due_idx').on(t.isActive, t.nextRunAt),
    index('content_schedules_store_idx').on(t.storeId),
  ],
)
