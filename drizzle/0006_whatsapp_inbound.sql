/*
  استقبال ردود العملاء على واتساب — تلات أعطال في مسار واحد.

  ١) الرقم اللي بيوصلنا مش رقم. واتساب بقى بيبعت معرّفًا داخليًا
     (`129446489145533@lid`) بدل `201012345678@s.whatsapp.net`.
     المعرّف ثابت للعميل بس ما بيدلّش على رقمه — فالبحث عن الطلب بيه
     ما بيلاقيش حاجة. `whatsapp_contacts` بيحفظ الترجمة أول ما نشوف
     الاتنين مع بعض، وبعدها المعرّف لوحده بيكفي.

  ٢) الرسالة بتوصل مرتين. الحدث كان متسجّل باسمين عند البوابة،
     والبوابة كمان بتعيد المحاولة. الفهرس الجزئي بيخلّي معرّف الرسالة
     مفتاحًا: التسجيل التاني بيقع على التعارض وبنخرج من غير ما نرد
     مرتين ولا نحرّك الحالة مرتين.

  idempotent: تنفيذه تاني ما بيغيّرش حاجة.
*/

CREATE TABLE IF NOT EXISTS "whatsapp_contacts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
  "lid" text NOT NULL,
  "phone" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_contacts_unique"
  ON "whatsapp_contacts" USING btree ("store_id","lid");
--> statement-breakpoint

/*
  الصفوف المكرّرة اللي اتسجّلت قبل الفهرس لازم تتشال الأول، وإلا
  إنشاء الفهرس نفسه بيفشل والهجرة كلها بتقف.
*/
DELETE FROM "message_log" a
  USING "message_log" b
  WHERE a."event" = 'inbound'
    AND b."event" = 'inbound'
    AND a."provider_ref" IS NOT NULL
    AND b."provider_ref" IS NOT NULL
    AND a."store_id" = b."store_id"
    AND a."provider_ref" = b."provider_ref"
    AND a."ctid" > b."ctid";
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "message_log_inbound_ref_idx"
  ON "message_log" USING btree ("store_id","provider_ref")
  WHERE "event" = 'inbound' AND "provider_ref" IS NOT NULL;
