-- مكافأة الرسالة — الزرار بينفّذ لا بيودّي على رابط
--
-- الإدارة كانت بتكتب `ctaHref` بإيدها، وده حقل لمبرمج: اللي بيكتب
-- الرسالة ما يعرفش مسارات اللوحة، والزرار اللي بيودّي على صفحة
-- اشتراك مش بيدّي المكافأة — بيسيب التاجر يدوّر عليها.
--
-- `reward_kind` بيخلّي الزرار يعمل الحاجة نفسها.

alter table platform_notices
  add column if not exists reward_kind text not null default 'none',
  add column if not exists reward_days integer not null default 0;

-- سجل التفعيل — ومفتاح منع التكرار في نفس الوقت
--
-- الفهرس الفريد هو الحارس: التاجر اللي بيدوس مرتين بسرعة بيبعت
-- طلبين متوازيين، والاتنين بيقروا «لسه ماخدهاش» قبل ما أي واحد
-- يكتب. من غير القيد ده كان بياخد شهرين.
create table if not exists notice_redemptions (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references platform_notices(id) on delete cascade,
  store_id uuid not null references stores(id) on delete cascade,
  granted_days integer not null default 0,
  granted_until timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists notice_redemptions_unique
  on notice_redemptions (notice_id, store_id);

create index if not exists notice_redemptions_store_idx
  on notice_redemptions (store_id);

-- الرسايل اللي اتكتبت قبل الأنواع
--
-- الافتراضي `none` بيمسح زرار أي رسالة قديمة من غير ما حد يلاحظ:
-- الإدارة كتبتها بزرار، والتاجر بقى يشوف النص من غير طريق.
-- اللي ليها رابط بقت `link` — ولو الرابط مش في القايمة المقفولة،
-- الحفظة الجاية هي اللي بتطلب اختيار من القايمة.
update platform_notices
set reward_kind = 'link'
where reward_kind = 'none'
  and cta_href is not null
  and length(trim(cta_href)) > 0;
