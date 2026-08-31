/*
  تأكيد العميل للطلب قبل الشحن.

  ثلاثة أعمدة على `orders`:
  - `confirm_sent_at`   — إمتى بعتنا طلب التأكيد
  - `customer_confirm`  — رد العميل: yes أو no
  - `customer_confirm_at` — إمتى ردّ

  متعمّد إنها منفصلة عن `confirmed_at`: دي معناها «التاجر قبل الطلب»،
  ودول معناهم «العميل أكّد إنه هيستلم». الطلب اللي التاجر أكّده والعميل
  ما ردّش عليه لسه مخاطرة شحن — والتفرقة دي هي كل الفايدة.

  idempotent: تنفيذه تاني ما بيغيّرش حاجة.
*/

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "confirm_sent_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "customer_confirm" text;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "customer_confirm_at" timestamp with time zone;
--> statement-breakpoint

/*
  فهرس على الرقم لوحده — من غير store_id.

  الويب هوك الوارد بيجيله رقم ورسالة وبس؛ مش عارف المتجر. فبيدوّر
  على آخر طلب مستني تأكيد للرقم ده. الفهرس الموجود
  `orders_phone_idx` بيبدأ بـ`store_id` فما بينفعش للبحث ده.
*/
CREATE INDEX IF NOT EXISTS "orders_phone_confirm_idx"
  ON "orders" USING btree ("customer_phone","confirm_sent_at");
