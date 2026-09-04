/*
  إيقاف عضو الفريق.

  مكتوب بإيد و idempotent — للسبب المشروح في `0001_subscriptions.sql`.

  عمود واحد بقيمة افتراضية: كل الأعضاء الحاليين بيبقوا «مش موقوفين»،
  وهو الواقع فعلًا. عمود `permissions` موجود من الأول (jsonb افتراضيه
  `[]`)، والفاضي بيتقرا «افتراضيات دورك» لا «مفيش صلاحيات» — فالشركاء
  اللي اتضافوا قبل نظام الصلاحيات ما بيتقفلش عليهم حاجة.
*/

ALTER TABLE "store_members"
  ADD COLUMN IF NOT EXISTS "is_blocked" boolean NOT NULL DEFAULT false;
