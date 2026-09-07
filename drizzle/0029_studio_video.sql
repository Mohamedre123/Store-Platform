-- فيديو في الاستوديو
--
-- الصورة الثابتة بتتعدّى في التايم لاين. الفيديو القصير هو اللي
-- بيوقّف الإصبع — وده اللي ريلز وتيك توك مبنيّين عليه أصلًا.

alter table studio_assets
  -- image · video — العرض والتنزيل والنشر كلهم بيختلفوا
  add column if not exists kind text not null default 'image',
  add column if not exists mime_type text not null default 'image/png';

alter table social_posts
  -- الفيديو عمود لوحده لا في `image_urls`
  --
  -- كل منصة بتنشر الفيديو بمسار مختلف عن الصورة (ريلز، فيديو
  -- الصفحة، فيديو تيك توك). لو اتخزّنوا مع بعض، كل ناشر كان هيحتاج
  -- يخمّن نوع الرابط من امتداده — وأول رابط من غير امتداد بيتنشر
  -- بالمسار الغلط ويترفض.
  add column if not exists video_url text;

-- والجدول بيحدّد بيعمل إيه
alter table content_schedules
  add column if not exists media text not null default 'image';
