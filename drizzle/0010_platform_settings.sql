/*
  إعدادات على مستوى المنصة — مش لمتجر بعينه.

  أول ساكن فيها: توكن تشغيل عامل الطابور.

  ## ليه محتاجينه
  المهام المؤجّلة (طلب تأكيد الطلب بعد دقيقة) محتاجة منبّهًا **زمنيًا**
  يشغّلها. والسحب من حركة الموقع مش كفاية: العميل بيطلب ويمشي، والمتجر
  بيفضل ساكت، فالمهمة بتستنّى زائر مش جاي.

  والجدولة كل دقيقة مش متاحة على خطة الاستضافة الحالية — فالمنبّه بيتعمل
  جوّه قاعدة البيانات نفسها (`pg_cron`)، وبينده على مسار العامل عبر
  `pg_net`.

  ## وليه توكن في القاعدة مش متغيّر بيئة
  المنبّه جوّه القاعدة، وما بيشوفش متغيّرات بيئة الاستضافة. والتوكن هنا
  بيتقرا منها مباشرةً — فالمنبّه بيشتغل من غير ما حد يظبّط حاجة في
  لوحة الاستضافة.

  والمسار بيقبل الاتنين: `CRON_SECRET` بتاع الاستضافة، والتوكن ده. فأي
  منبّه من أي ناحية بيشتغل.

  idempotent: تنفيذه تاني ما بيغيّرش حاجة.
*/

CREATE TABLE IF NOT EXISTS "platform_settings" (
  "key" text PRIMARY KEY,
  "value" text NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

/*
  ── المنبّه الزمني جوّه قاعدة البيانات ──

  التوكن نفسه بيتولّد مرة واحدة وبيتخزّن في الجدول فوق (مش مكتوب هنا
  عشان ما يتسرّبش في المستودع):

      insert into platform_settings (key, value)
      values ('jobs_cron_token', <توكن عشوائي ٣٢ بايت>)
      on conflict (key) do update set value = excluded.value;

  وبعدها الامتدادات والجدولة. `pg_net` بيقرا التوكن من الجدول وقت
  التنفيذ، فتغييره بيسري على طول من غير إعادة جدولة.
*/

CREATE EXTENSION IF NOT EXISTS pg_cron;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_net;
--> statement-breakpoint

/*
  كل دقيقة. لو المهمة موجودة بنفس الاسم، `cron.schedule` بتستبدلها —
  فتنفيذه تاني ما بيعملش نسخة تانية.

  والعنوان لازم يكون المضيف اللي **مش بيحوّل**: التحويل بيسقّط ترويسة
  التصريح، والعامل بيرد ٤٠١ من غير ما ينفّذ حاجة.
*/
SELECT cron.schedule(
  'zawya_jobs_worker',
  '* * * * *',
  $CRON$
    select net.http_get(
      url := 'https://www.zawyaeg.site/api/cron/jobs',
      headers := jsonb_build_object(
        'Authorization',
        'Bearer ' || (select value from platform_settings where key = 'jobs_cron_token')
      )
    )
  $CRON$
);
