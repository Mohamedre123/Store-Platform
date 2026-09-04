/*
  توفّر المتجر وسيوه.

  مكتوب بإيد و idempotent — للسبب المشروح في `0001_subscriptions.sql`.
  كله إضافة صافية: أعمدة جديدة بقيم افتراضية بتخلّي المتاجر القايمة
  تشتغل زي ما هي بالظبط (مفتوحة، ومفهرسة، وبسيو افتراضي من اسمها).
*/

/* ── الصيانة و«قريبًا» ─────────────────────────────────────────── */

/*
  الاتنين مقفولين افتراضيًا. لو واحد فيهم كان `true` بالغلط، كل متجر
  على المنصة كان هيقفل في نفس اللحظة — وده أخطر سطر ممكن يتكتب هنا.
*/
ALTER TABLE "stores"
  ADD COLUMN IF NOT EXISTS "maintenance_mode" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "maintenance_message" text;
--> statement-breakpoint
ALTER TABLE "stores"
  ADD COLUMN IF NOT EXISTS "coming_soon" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "coming_soon_message" text;
--> statement-breakpoint

/* ── السيو ────────────────────────────────────────────────────── */

ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "seo_title" text;
--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "seo_description" text;
--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "seo_keywords" text;
--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "og_image" text;
--> statement-breakpoint

/*
  الفهرسة مفتوحة افتراضيًا: المتاجر الشغّالة دلوقتي مفهرسة فعلًا،
  وقفلها كان هيشيلهم من جوجل من غير ما حد يطلب.
*/
ALTER TABLE "stores"
  ADD COLUMN IF NOT EXISTS "allow_indexing" boolean NOT NULL DEFAULT true;
