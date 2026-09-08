-- الربط عن طريق وسيط
--
-- ميتا وتيك توك بيطلبوا تطبيقًا متوافَقًا عليه وتوثيق نشاط تجاري
-- وتأكيد دومين ومراجعة بفيديو. ده أسابيع من الشغل الإداري قبل ما
-- أول بوست ينزل.
--
-- والوسيط عنده الموافقات دي جاهزة. بنبعتله المحتوى وهو بينشر —
-- والتاجر بيربط من صفحة عنده. نفس النتيجة بالظبط عند العميل.
--
-- والعمودين دول بيخلّوا الطريقين يعيشوا جنب بعض: المتجر اللي اتربط
-- مباشرةً بيفضل شغّال، والجديد بيمشي على الوسيط.

alter table social_accounts
  -- direct = تطبيقنا · uploadpost = وسيط
  add column if not exists provider text not null default 'direct',
  -- معرّف الملف عند الوسيط — الوجهة اللي بينشر عليها
  add column if not exists provider_profile text;

create index if not exists social_accounts_provider_idx
  on social_accounts (store_id, provider);
