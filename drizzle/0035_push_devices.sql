-- أجهزة تطبيق الموبايل اللي بتستقبل إشعارات الطلبات
CREATE TABLE IF NOT EXISTS "push_devices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
  "token" text NOT NULL,
  "platform" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "push_devices_token_store_unique" ON "push_devices" ("token", "store_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "push_devices_store_idx" ON "push_devices" ("store_id");--> statement-breakpoint
-- جدول داخلي للخادم بس — نفس حماية باقي الجداول من واجهة Supabase العامة
ALTER TABLE "push_devices" ENABLE ROW LEVEL SECURITY;
