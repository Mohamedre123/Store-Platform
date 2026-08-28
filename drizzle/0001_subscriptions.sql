/*
  اشتراكات المنصة ومعرّف الحساب.

  الملف ده **مكتوب بإيد لا مولّد**، وكل جملة فيه idempotent
  (IF NOT EXISTS / IF EXISTS). السبب: المخطط اتطبّق على Supabase
  بـ`drizzle-kit push` مش بالهجرات، فلقطة الهجرات كانت متأخرة عن
  القاعدة الحقيقية — والملف المولّد كان بيحاول يضيف أعمدة موجودة
  أصلًا ويقع من أول سطر. الشكل ده بيعدّي على قاعدة قديمة وجديدة
  بنفس النتيجة، وينفع يتنفّذ أكتر من مرة من غير ضرر.

  التطبيق: من SQL Editor في Supabase، أو `npm run db:push`.
*/

/* ── معرّف الحساب على المستخدم ────────────────────────────────── */

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "public_id" text;
--> statement-breakpoint

/*
  ملء المعرّف للحسابات القديمة.

  المعرّف مشتقّ من الـuuid فبيفضل ثابت لو الهجرة اتنفّذت تاني،
  والحلقة بتزوّد بذرة لو حصل تصادم — والفهرس الفريد جاي بعدها
  على طول، فأي تصادم كان هيوقّع الهجرة كلها.

  الحروف: md5 بيدّي 0-9a-f، وبنبدّل «0» و«1» بحرفين مالهمش شبيه
  عشان المعرّف يتقرا بالصوت من غير سؤال «صفر ولا O».
*/
DO $$
DECLARE
  r record;
  candidate text;
  n int;
BEGIN
  FOR r IN SELECT id FROM users WHERE public_id IS NULL LOOP
    n := 0;
    LOOP
      candidate := 'ZW-' || upper(translate(substr(md5(r.id::text || n::text || 'zawya'), 1, 8), '01', 'gh'));
      EXIT WHEN NOT EXISTS (SELECT 1 FROM users WHERE public_id = candidate);
      n := n + 1;
    END LOOP;
    UPDATE users SET public_id = candidate WHERE id = r.id;
  END LOOP;
END $$;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "users_public_id_unique" ON "users" USING btree ("public_id");
--> statement-breakpoint

/* ── أعمدة الاشتراك على المتجر ────────────────────────────────── */

ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "plan" text;
--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "activated_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "activated_by" uuid;
--> statement-breakpoint

/* المتاجر القديمة بتاخد باقة تطابق حالتها الحالية بدل ما تفضل فاضية */
UPDATE "stores" SET "plan" = 'trial' WHERE "plan" IS NULL AND "status" = 'trial';
--> statement-breakpoint
UPDATE "stores" SET "plan" = 'monthly' WHERE "plan" IS NULL AND "status" = 'active';
--> statement-breakpoint

/* ── طلبات الاشتراك ───────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS "subscription_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"plan" text NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL,
	"method" text DEFAULT 'wallet' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"note" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscription_requests_store_id_stores_id_fk'
  ) THEN
    ALTER TABLE "subscription_requests"
      ADD CONSTRAINT "subscription_requests_store_id_stores_id_fk"
      FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscription_requests_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "subscription_requests"
      ADD CONSTRAINT "subscription_requests_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade;
  END IF;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "subscription_requests_status_idx" ON "subscription_requests" USING btree ("status","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscription_requests_store_idx" ON "subscription_requests" USING btree ("store_id","created_at");
--> statement-breakpoint

/* ── حساب إدارة المنصة ────────────────────────────────────────── */

/*
  العلامة دي مرساة تانية جنب البريد المكتوب في `src/lib/admin.ts`.
  الاتنين بيتجمعوا، فالإدارة شغّالة حتى لو الجملة دي ما اتنفّذتش —
  والجملة دي بتخلّي `is_platform_admin` يطابق الواقع في القاعدة
  عشان استعلامات لوحة الإدارة تلاقيه.
*/
UPDATE "users" SET "is_platform_admin" = true WHERE lower("email") = 'iaomn8406@gmail.com';
