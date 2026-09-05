/*
  طرق الشحن المتعددة.

  مكتوب بإيد و idempotent — للسبب المشروح في `0001_subscriptions.sql`.
  جدول جديد بالكامل، مفيش أي تعديل على بيانات قايمة.

  **الجدول الفاضي = السلوك القديم بالحرف**: سعر شحن واحد لكل محافظة
  ومفيش أي اختيار في الشيك أوت. الميزة بتتفتح لما التاجر يضيف أول
  طريقة — فكل المتاجر الشغّالة دلوقتي ما بيتغيّرش عندها سطر.

  و`price_delta` **فرق** لا سعر كامل: التاجر سعّر ٢٧ محافظة مرة،
  ولو كل طريقة طلبت تسعيرة كاملة كانت «سريع» هتبقى ٢٧ سطر تاني
  بإيد — وأول تغيير في التعريفة يبقى لازم يتعمل في مكانين.
*/

CREATE TABLE IF NOT EXISTS "shipping_methods" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id"    uuid NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
  "name"        text NOT NULL,
  "hint"        text,
  /* ممكن يكون سالبًا — «استلام من الفرع» بيقلّل السعر. والقصّ عند صفر وقت الحساب */
  "price_delta" integer NOT NULL DEFAULT 0,
  "min_days"    integer,
  "max_days"    integer,
  "enabled"     boolean NOT NULL DEFAULT true,
  "sort_order"  integer NOT NULL DEFAULT 0,
  "created_at"  timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"  timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "shipping_methods_store_idx"
  ON "shipping_methods" ("store_id", "sort_order");
