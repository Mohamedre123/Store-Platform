/*
  الشكاوى — تذاكر دعم من العميل للتاجر.

  مكتوب بإيد وidempotent زي باقي الهجرات هنا.
  التطبيق: `node .scripts/apply-sql.mjs drizzle/0023_support_tickets.sql`
*/

CREATE TABLE IF NOT EXISTS "support_tickets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
  "ticket_number" integer NOT NULL,
  "customer_id" uuid REFERENCES "customers"("id") ON DELETE SET NULL,
  "order_id" uuid,
  "subject" text NOT NULL,
  "category" text DEFAULT 'other' NOT NULL,
  "status" text DEFAULT 'open' NOT NULL,
  "customer_name" text,
  "customer_phone" text,
  "customer_email" text,
  "last_message_by" text DEFAULT 'customer' NOT NULL,
  "last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
  "resolved_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "support_tickets_store_number_unique"
  ON "support_tickets" ("store_id", "ticket_number");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "support_tickets_store_status_idx"
  ON "support_tickets" ("store_id", "status", "last_message_at");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "support_tickets_customer_idx"
  ON "support_tickets" ("customer_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "support_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ticket_id" uuid NOT NULL REFERENCES "support_tickets"("id") ON DELETE CASCADE,
  "store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
  "body" text NOT NULL,
  "author" text NOT NULL,
  "author_user_id" uuid,
  "author_name" text,
  "images" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "support_messages_ticket_idx"
  ON "support_messages" ("ticket_id", "created_at");
