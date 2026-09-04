/*
  قايمة الحظر.

  مكتوب بإيد و idempotent — للسبب المشروح في `0001_subscriptions.sql`.
  جدول جديد بالكامل، مفيش أي تعديل على بيانات قايمة.

  ليه الجدول ده لازم يبقى منفصل عن `customers.is_blocked`: العلم اللي
  على العميل بيمنع حسابًا موجودًا، وأغلب الطلبات الوهمية بتيجي من ضيف
  أول مرة يطلب — بلا صف عميل أصلًا.
*/

CREATE TABLE IF NOT EXISTS "blocklist" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id"    uuid NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
  "match"       text NOT NULL DEFAULT 'phone',
  /* مخزّنة مطبّعة — نفس التطبيع اللي الفحص بيعمله، وإلا ما بتطابقش أبدًا */
  "value"       text NOT NULL,
  "action"      text NOT NULL DEFAULT 'reject',
  "reason"      text,
  "hits"        integer NOT NULL DEFAULT 0,
  "last_hit_at" timestamp with time zone,
  "created_by"  uuid,
  "created_at"  timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

/* الفريد ده هو اللي بيخلّي «احظر نفس الرقم تاني» تحديثًا لا خطأ */
CREATE UNIQUE INDEX IF NOT EXISTS "blocklist_store_value_unique"
  ON "blocklist" ("store_id", "match", "value");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "blocklist_store_idx" ON "blocklist" ("store_id");
