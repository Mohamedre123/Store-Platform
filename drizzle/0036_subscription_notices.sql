-- رسايل الاشتراك للتاجر (تفعيل/تجديد/تذكير/انتهاء/إيقاف) — المفتاح بيمنع التكرار
CREATE TABLE IF NOT EXISTS "subscription_notices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "period_end" timestamp with time zone NOT NULL,
  "channels" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "subscription_notices_unique" ON "subscription_notices" ("store_id", "kind", "period_end");--> statement-breakpoint
ALTER TABLE "subscription_notices" ENABLE ROW LEVEL SECURITY;
