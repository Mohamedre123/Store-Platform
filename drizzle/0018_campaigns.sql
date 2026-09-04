/*
  حملات البريد.

  مكتوب بإيد و idempotent — للسبب المشروح في `0001_subscriptions.sql`.
  جدول جديد بالكامل، مفيش تعديل على أي بيانات قايمة.

  الإرسال نفسه بيمرّ على `sendEmail` زي ما هو — مفيش أي لمسة على نقل
  البريد ولا ترويساته ولا نطاق الإرسال.
*/

CREATE TABLE IF NOT EXISTS "campaigns" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id"        uuid NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
  "name"            text NOT NULL,
  "subject"         text NOT NULL,
  "body"            text NOT NULL,
  "cta_label"       text,
  "cta_url"         text,
  "audience"        text NOT NULL DEFAULT 'all',
  "status"          text NOT NULL DEFAULT 'draft',
  /* لقطة وقت الإرسال — التقرير ما يتغيّرش بعدها لما مشترك جديد ييجي */
  "audience_count"  integer NOT NULL DEFAULT 0,
  "sent_count"      integer NOT NULL DEFAULT 0,
  "failed_count"    integer NOT NULL DEFAULT 0,
  "started_at"      timestamp with time zone,
  "finished_at"     timestamp with time zone,
  "created_by"      uuid,
  "created_at"      timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"      timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "campaigns_store_idx"
  ON "campaigns" ("store_id", "created_at");
