/*
  طلب تأكيد الطلب تلقائيًا على واتساب.

  عمودان على `checkout_settings`:
  - `auto_confirm_enabled` — مطفي افتراضيًا لأن كل رسالة بتتحسب على
    باقة واتساب التاجر، وبعض الباقات بتسمح برسالة كل دقيقة
  - `auto_confirm_delay`   — المهلة بالدقايق من لحظة الطلب (٥ افتراضيًا)

  idempotent: تنفيذه تاني ما بيغيّرش حاجة.
*/

ALTER TABLE "checkout_settings" ADD COLUMN IF NOT EXISTS "auto_confirm_enabled" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "checkout_settings" ADD COLUMN IF NOT EXISTS "auto_confirm_delay" integer DEFAULT 5 NOT NULL;
