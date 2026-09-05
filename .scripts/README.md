# أدوات محلية

## `apply-sql.mjs`

بيشغّل ملف هجرة مكتوب بإيد على القاعدة، جملة جملة.

```bash
node .scripts/apply-sql.mjs drizzle/0022_couriers.sql
```

بيقرا `DIRECT_URL` من `.env.local` (وبعدين `.env`)، وبيقسّم الملف على
`--> statement-breakpoint` زي ما drizzle بيعمل.

**ليه ده موجود:** المخطط بيتطبّق بـ`db:push` لا بـ`migrate`، فلقطة
`drizzle/meta` متأخرة عن القاعدة. الهجرات هنا مكتوبة بإيد وidempotent،
وما كانش فيه حاجة تشغّلها غير نسخ ولزق في محرّر Supabase.
