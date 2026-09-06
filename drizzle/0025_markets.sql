/*
  الأسواق — واجهة المتجر لكل بلد بعملته.

  مكتوب بإيد وidempotent.
  التطبيق: `node .scripts/apply-sql.mjs drizzle/0025_markets.sql`
*/

CREATE TABLE IF NOT EXISTS "markets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "country" text NOT NULL,
  "currency" text NOT NULL,
  "rate_micros" integer DEFAULT 1000000 NOT NULL,
  "rounding" text DEFAULT 'nearest' NOT NULL,
  "is_default" boolean DEFAULT false NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "markets_store_country_unique"
  ON "markets" ("store_id", "country");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "markets_store_active_idx"
  ON "markets" ("store_id", "is_active");
--> statement-breakpoint

/*
  السوق على الطلب — **لقطة لا مرجع حيّ**.

  `total` وكل مبلغ تاني على الطلب بيفضلوا بعملة المتجر الأساسية،
  لأن كل تقرير في المنصة بيجمعهم. الأعمدة دي بتسجّل اللي العميل
  شافه ودفع بيه، وسعر التحويل وقتها — فالطلب القديم بيفضل بيعرض
  نفس الرقم حتى لو التاجر غيّر السعر بعده بشهر.
*/
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "market_id" uuid;
--> statement-breakpoint

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "display_currency" text;
--> statement-breakpoint

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "display_total" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "market_rate" integer;
