-- استوديو المحتوى — صور وبوستات ونشر مجدوَل
--
-- التاجر عنده بضاعة وعارف يبيعها، ومش عارف يصوّرها ولا يكتب عنها.
-- والأهم إنه بينسى ينزل — والبوست اللي بينزل لما يفتكر ما بيبنيش
-- متابعين.

create table if not exists studio_assets (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  prompt text not null,
  url text not null,
  path text not null,
  preset text not null default 'square',
  -- المنتج بيتشال ولا بيمسح صوره: التاجر ممكن يكون نشرها خلاص
  product_id uuid references products(id) on delete set null,
  -- سلسلة التعديل — «رجّع اللي قبله» محتاجة الأب يفضل موجود
  parent_id uuid,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists studio_assets_store_idx on studio_assets (store_id, created_at);
create index if not exists studio_assets_parent_idx on studio_assets (parent_id);

-- حسابات السوشيال
--
-- التوكن بينشر باسم التاجر على صفحته، فبيتخزّن مشفّرًا زي مفاتيح
-- الـAPI بالظبط. تسريب صف من هنا معناه النشر على صفحات التجّار كلهم.
create table if not exists social_accounts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  platform text not null,
  external_id text not null,
  name text not null,
  avatar text,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  -- تيك توك بيسمح بالمسوّدات من غير تدقيق والنشر المباشر بعده
  can_publish boolean not null default true,
  status text not null default 'active',
  last_error text,
  connected_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists social_accounts_unique
  on social_accounts (store_id, platform, external_id);
create index if not exists social_accounts_store_idx on social_accounts (store_id);

-- البوستات
create table if not exists social_posts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  caption text not null,
  hashtags jsonb not null default '[]'::jsonb,
  image_urls jsonb not null default '[]'::jsonb,
  product_id uuid references products(id) on delete set null,
  targets jsonb not null default '[]'::jsonb,
  status text not null default 'draft',
  scheduled_for timestamptz,
  published_at timestamptz,
  -- نتيجة كل وجهة على حدة: اللي نزل على فيسبوك وفشل على إنستجرام
  -- مش فاشلًا ولا ناجحًا، والحالة الواحدة كانت بتخلّي التاجر يعيد
  -- نشر اللي نزل خلاص
  results jsonb not null default '[]'::jsonb,
  schedule_id uuid,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists social_posts_store_idx on social_posts (store_id, created_at);
create index if not exists social_posts_due_idx on social_posts (status, scheduled_for);

-- الجدولة
create table if not exists content_schedules (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  -- أيام الأسبوع، ٠ الأحد — الرقم مالوش تفسير يختلف من مكان لمكان
  days jsonb not null default '[]'::jsonb,
  time_of_day text not null default '10:00',
  targets jsonb not null default '[]'::jsonb,
  source text not null default 'auto',
  category_id uuid,
  product_ids jsonb not null default '[]'::jsonb,
  last_product_id uuid,
  style text,
  preset text not null default 'square',
  -- الافتراضي يستنّى موافقة: النشر باسم التاجر من غير ما يشوف
  -- بيخلّي أول غلطة تنزل قدام متابعينه
  auto_publish boolean not null default false,
  last_run_at timestamptz,
  -- محسوب لا مستنتَج: النبضة بتقرا فهرسًا واحدًا بدل ما تلفّ على
  -- كل الجداول وتحسب
  next_run_at timestamptz,
  last_error text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists content_schedules_due_idx on content_schedules (is_active, next_run_at);
create index if not exists content_schedules_store_idx on content_schedules (store_id);
