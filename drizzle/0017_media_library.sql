/*
  مكتبة الوسائط.

  مكتوب بإيد و idempotent — للسبب المشروح في `0001_subscriptions.sql`.
  جدول جديد بالكامل، مفيش تعديل على أي بيانات قايمة.

  الملفات اللي اترفعت قبل الجدول ده مالهاش صفوف، وبتتسجّل لوحدها أول
  ما التاجر يفتح المعرض (`syncFromStorage`) — فما يفتحش فاضيًا على
  تاجر شغّال من شهور.
*/

CREATE TABLE IF NOT EXISTS "media_assets" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id"    uuid NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
  /* المسار جوّه دلو التخزين — `<storeId>/<folder>/<file>` */
  "path"        text NOT NULL,
  "url"         text NOT NULL,
  /* الاسم اللي التاجر رفع بيه — اسم التخزين طابع زمني مالوش معنى له */
  "name"        text NOT NULL,
  "folder"      text NOT NULL DEFAULT 'misc',
  "size_bytes"  integer NOT NULL DEFAULT 0,
  "mime_type"   text,
  "uploaded_by" uuid,
  "created_at"  timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

/* الفريد ده بيخلّي المزامنة المتكررة ما تعملش صفوفًا مكرّرة */
CREATE UNIQUE INDEX IF NOT EXISTS "media_assets_store_path_unique"
  ON "media_assets" ("store_id", "path");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_assets_store_idx"
  ON "media_assets" ("store_id", "created_at");
