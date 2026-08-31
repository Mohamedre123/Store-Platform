/*
  تشغيل طلب التأكيد التلقائي افتراضيًا.

  الميزة سبب وجودها إن الرفض عند الاستلام بيكلّف التاجر شحن رايح
  وجاي — فتشغيلها هو السلوك اللي بيفيده. والمتجر اللي واتسابه مش
  مربوط، المهمة بتخرج عنده بهدوء من غير إعادة محاولة ومن غير أثر.

  بيغيّر الافتراضي وبيشغّلها على الصفوف الموجودة اللي لسه على القيمة
  القديمة. idempotent.
*/

ALTER TABLE "checkout_settings" ALTER COLUMN "auto_confirm_enabled" SET DEFAULT true;
--> statement-breakpoint
UPDATE "checkout_settings" SET "auto_confirm_enabled" = true WHERE "auto_confirm_enabled" = false;
