/*
  رسايل إدارة المنصة، وإحالة التجّار.

  مكتوب بإيد وidempotent.
  التطبيق: `node .scripts/apply-sql.mjs drizzle/0026_notices_referrals.sql`
*/

CREATE TABLE IF NOT EXISTS "platform_notices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "cta_label" text,
  "cta_href" text,
  "tone" text DEFAULT 'offer' NOT NULL,
  "audience" text DEFAULT 'all' NOT NULL,
  "target_store_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "min_delivered_orders" integer DEFAULT 0 NOT NULL,
  "min_referrals" integer DEFAULT 0 NOT NULL,
  "starts_at" timestamp with time zone,
  "ends_at" timestamp with time zone,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "platform_notices_active_idx"
  ON "platform_notices" ("is_active", "starts_at");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "notice_dismissals" (
  "notice_id" uuid NOT NULL REFERENCES "platform_notices"("id") ON DELETE CASCADE,
  "store_id" uuid NOT NULL,
  "dismissed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "notice_dismissals_unique"
  ON "notice_dismissals" ("notice_id", "store_id");
--> statement-breakpoint

/*
  إحالة التجّار — كود لكل متجر، ومين جابه.

  `referred_by_store_id` بيتكتب مرة واحدة وقت التسجيل: من غير الشرط
  ده، تاجر يعدّل الكوكي بعد شهر وينسب نفسه لحد تاني، والمكافأة
  بتتصرف مرتين على نفس التسجيل.
*/
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "referral_code" text;
--> statement-breakpoint

ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "referred_by_store_id" uuid;
--> statement-breakpoint

ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "referred_at" timestamp with time zone;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "stores_referral_code_unique"
  ON "stores" ("referral_code") WHERE "referral_code" IS NOT NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "stores_referred_by_idx"
  ON "stores" ("referred_by_store_id");
