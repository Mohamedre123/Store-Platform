/*
  مندوبو التاجر نفسه.

  مكتوب بإيد وidempotent زي باقي الهجرات هنا — المخطط بيتطبّق
  بـ`drizzle-kit push` فلقطة `drizzle/meta` متأخرة عن القاعدة،
  والملف المولّد بيحاول يضيف حاجات موجودة ويقع من أول سطر.

  التطبيق: من SQL Editor في Supabase، أو `npm run db:push`.
*/

/* ── جدول المندوبين ───────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS "couriers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "phone" text NOT NULL,
  "vehicle" text DEFAULT 'motorcycle' NOT NULL,
  "zones" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "fee_per_order" integer DEFAULT 0 NOT NULL,
  "access_token" text NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "couriers_token_unique" ON "couriers" ("access_token");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "couriers_store_idx" ON "couriers" ("store_id", "is_active");
--> statement-breakpoint

/* ── ربط الشحنة بالمندوب ──────────────────────────────────────── */

/*
  على الشحنة لا على الطلب: الطلب اللي رجع واتبعت تاني ممكن يمشي مع
  مندوب غير الأول، والتاريخ ده لازم يفضل مقروءًا عشان حساب كل واحد
  فيهم يقفل صح.

  من غير REFERENCES عن قصد: حذف المندوب مالوش داعي يمسح تاريخ
  شحناته — والإيقاف (`is_active = false`) هو المسار المقصود أصلًا.
*/
ALTER TABLE "shipments" ADD COLUMN IF NOT EXISTS "courier_id" uuid;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "shipments_courier_idx" ON "shipments" ("courier_id", "status");
