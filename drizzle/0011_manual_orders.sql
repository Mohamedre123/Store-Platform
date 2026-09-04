/*
  الطلب اليدوي وترقيم الطلبات.

  الملف ده **مكتوب بإيد لا مولّد**، وكل جملة فيه idempotent
  (IF NOT EXISTS). السبب مشروح في `0001_subscriptions.sql`: المخطط
  بيتطبّق بـ`push` فلقطة الهجرات متأخرة عن القاعدة، والملف المولّد
  بيحاول يضيف أعمدة موجودة ويقع من أول سطر.

  كل الأعمدة هنا **إضافة صافية**: ما فيش عمود بيتشال ولا نوع
  بيتغيّر، والقيم الافتراضية بتخلّي المتاجر القديمة تشتغل زي ما هي
  من غير أي كتابة عليها.

  التطبيق: من SQL Editor في Supabase، أو `npm run db:push`.
*/

/* ── تنسيق رقم الطلب — عرض بس، الرقم نفسه ما اتغيّرش ──────────── */

ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "order_prefix" text;
--> statement-breakpoint
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "order_suffix" text;
--> statement-breakpoint

/* ── مفاتيح الطلب اليدوي ──────────────────────────────────────── */

/*
  مفتوح افتراضيًا: التاجر اللي بياخد طلباته على واتساب لازم يلاقي
  الشاشة موجودة من غير ما يدوّر على إعداد يشغّلها.
*/
ALTER TABLE "stores"
  ADD COLUMN IF NOT EXISTS "manual_orders_enabled" boolean NOT NULL DEFAULT true;
--> statement-breakpoint

/*
  التلاتة دول مقفولين افتراضيًا لأنهم بيفكّوا قيودًا:
  البيع بالسالب بيوعد بحاجة مش موجودة، وتعديل السعر بيخلّي أي موظف
  يبيع بأي رقم. التاجر بيفتحهم لما يحتاجهم.
*/
ALTER TABLE "stores"
  ADD COLUMN IF NOT EXISTS "manual_oversell" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "stores"
  ADD COLUMN IF NOT EXISTS "manual_custom_pricing" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "stores"
  ADD COLUMN IF NOT EXISTS "manual_deposit_enabled" boolean NOT NULL DEFAULT false;
--> statement-breakpoint

/* ── العربون على الطلب ────────────────────────────────────────── */

/*
  صفر للطلبات القديمة كلها — يعني «مفيش عربون»، وهو الواقع فعلًا
  لأن الميزة ما كانتش موجودة. `NOT NULL DEFAULT 0` بيخلّي الحساب
  في الكود من غير فحص null في كل مكان.
*/
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "deposit_paid" integer NOT NULL DEFAULT 0;
