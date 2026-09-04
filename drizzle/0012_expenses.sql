/*
  مصروفات المتجر.

  مكتوب بإيد و idempotent — للسبب المشروح في `0001_subscriptions.sql`.

  جدول جديد بالكامل: مفيش أي تعديل على جدول موجود، فالتنفيذ مالوش
  أثر على أي بيانات قايمة.
*/

CREATE TABLE IF NOT EXISTS "expenses" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id"     uuid NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
  "title"        text NOT NULL,
  "category"     text NOT NULL DEFAULT 'other',
  "amount"       integer NOT NULL DEFAULT 0,
  /*
    تاريخ الصرف لا تاريخ التسجيل — التاجر بيسجّل مصاريف أسبوعه
    مرة واحدة، ولو حسبناها بيوم الإدخال تقرير الربح اليومي بيبقى
    سنّة منشار مالهاش معنى.
  */
  "spent_at"     timestamp with time zone DEFAULT now() NOT NULL,
  "note"         text,
  "receipt_url"  text,
  "is_recurring" boolean NOT NULL DEFAULT false,
  "created_by"   uuid,
  "created_at"   timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"   timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

/* الفهرسان دول هما اللي تقرير الربح بيقرا بيهم — من غيرهم مسح كامل للجدول */
CREATE INDEX IF NOT EXISTS "expenses_store_date_idx"
  ON "expenses" ("store_id", "spent_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expenses_store_category_idx"
  ON "expenses" ("store_id", "category");
