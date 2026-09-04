/*
  اقتراحات المنتجات ومقترحات السلة.

  مكتوب بإيد و idempotent — للسبب المشروح في `0001_subscriptions.sql`.

  كلها مصفوفات فاضية افتراضيًا، والفاضي معناه **«رجّع للتلقائي»** لا
  «مفيش اقتراحات»: المنتج بيقترح من نفس قسمه، والسلة بتقترح الأكثر
  مبيعًا. يعني كل المتاجر القايمة بتشتغل بالظبط زي ما هي، والاختيار
  اليدوي بيغلب لما التاجر يعمله.
*/

ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "related_product_ids" jsonb NOT NULL DEFAULT '[]'::jsonb;
--> statement-breakpoint
ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "upsell_product_ids" jsonb NOT NULL DEFAULT '[]'::jsonb;
--> statement-breakpoint
ALTER TABLE "checkout_settings"
  ADD COLUMN IF NOT EXISTS "cart_upsell_product_ids" jsonb NOT NULL DEFAULT '[]'::jsonb;
