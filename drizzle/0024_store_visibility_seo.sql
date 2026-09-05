/*
  عنوان المشاركة، ووسوم التوثيق، وإخفاء النافد.

  مكتوب بإيد وidempotent.
  التطبيق: `node .scripts/apply-sql.mjs drizzle/0024_store_visibility_seo.sql`
*/

ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "og_title" text;
--> statement-breakpoint

ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "og_description" text;
--> statement-breakpoint

/*
  وسوم الرأس — `meta` بس، والفحص في `src/lib/head-html.ts`.

  السكربتات ممنوعة لأن متاجر التجّار على نطاقات فرعية من نطاقنا:
  سكربت متحقون هنا بيجري على نطاق فيه سمعة كل تاجر تاني على
  المنصة، مش على نطاق صاحبه وحده.
*/
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "head_html" text;
--> statement-breakpoint

ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "hide_out_of_stock" boolean DEFAULT false NOT NULL;
