/*
  مفاتيح رسايل البريد.

  مكتوب بإيد و idempotent — للسبب المشروح في `0001_subscriptions.sql`.

  **كلها `DEFAULT true`** وده مش تفصيلة: الرسايل دي كانت بتتبعت بلا
  أي مفتاح، فكل متجر شغّال دلوقتي بيبعتها. أي افتراضي غير «مفتوح»
  كان هيوقّف رسايل تجّار شغّالين في لحظة النشر وهم مش طالبين حاجة.

  والأعمدة دي بتدّي تحكّمًا لأول مرة لا بتغيّر سلوكًا.
*/

ALTER TABLE "messaging_settings"
  ADD COLUMN IF NOT EXISTS "email_on_confirmed" boolean NOT NULL DEFAULT true;
--> statement-breakpoint
ALTER TABLE "messaging_settings"
  ADD COLUMN IF NOT EXISTS "email_on_processing" boolean NOT NULL DEFAULT true;
--> statement-breakpoint
ALTER TABLE "messaging_settings"
  ADD COLUMN IF NOT EXISTS "email_on_shipped" boolean NOT NULL DEFAULT true;
--> statement-breakpoint
ALTER TABLE "messaging_settings"
  ADD COLUMN IF NOT EXISTS "email_on_delivered" boolean NOT NULL DEFAULT true;
--> statement-breakpoint
ALTER TABLE "messaging_settings"
  ADD COLUMN IF NOT EXISTS "email_on_cancelled" boolean NOT NULL DEFAULT true;
--> statement-breakpoint
ALTER TABLE "messaging_settings"
  ADD COLUMN IF NOT EXISTS "email_on_returned" boolean NOT NULL DEFAULT true;
--> statement-breakpoint
ALTER TABLE "messaging_settings"
  ADD COLUMN IF NOT EXISTS "email_new_order_to_merchant" boolean NOT NULL DEFAULT true;
