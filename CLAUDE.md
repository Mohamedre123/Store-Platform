@AGENTS.md

# زاوية — دليل أي شات جديد (اقراه كله قبل ما تعمل أي حاجة)

الملف ده مكتوب عشان أي شات جديد يكمّل الشغل **بنفس الطريقة** من غير ما صاحب المشروع يشرح
حاجة. فيه: المشروع إيه، الموقع والتطبيق متبنيين إزاي، إزاي تبني التطبيق وتبعته، إزاي ترفع
على GitHub للموقع وللتطبيق، القواعد، والحالة الحالية واللي لسه.

---

## 0) طريقة الشغل مع صاحب المشروع — إلزامي

- **كلّمه بالعربي المصري دايمًا** — كل رسالة، حتى رسايل المتابعة القصيرة أثناء الشغل
  («بابني التطبيق دلوقتي…»). ما تكتبش له بالإنجليزي.
- كل تقرير في الآخر يبقى فيه 3 أجزاء واضحة:
  1. **اللي اتعمل** (بكلام بسيط مش تقني).
  2. **المطلوب منك** (لو فيه حاجة يعملها هو — خطوة خطوة).
  3. **اللي جاي / لسه هيتعمل**.
- هو مش مبرمج: اشرح بالنتيجة اللي هيشوفها («لما تفتح التطبيق هتلاقي…») مش بأسماء ملفات.
- لما يقول «كمل» — كمّل من غير أسئلة. اسأل بس لو القرار فعلًا بتاعه.
- **الموقع الحي ما يتأثرش** بتعديلات مخصوصة للتطبيق. أي تعديل بيغيّر شكل أو سلوك الموقع
  للناس اللي فاتحينه من المتصفح/الكمبيوتر لازم يكون هو طالبه صراحة. التعديل اللي للتطبيق بس
  يتعمل جوّه `mobile/` أو في مسارات `/api/app/*` الجديدة.
- الحاجات الكبيرة (أدوات، تحميلات، ملفات بناء) على **`H:\for claude`** — درايف C: مليان.
- بعد ما تبني نسخة APK جديدة ابعتها له بـ`SendUserFile` (ولو الإرسال فشل/طوّل، قوله مسار
  الملف على `H:\for claude\zawya-release\`).
- **بعد أي مهمة تخلص: حدّث الملف ده** — اللي اتعمل (قسم 8)، واللي لسه (قسم 9)، وأي فهم جديد
  للمشروع (ملفات جديدة، قواعد، مشاكل واتحلّت). الهدف إن الشات اللي بعدك يعرف كل حاجة حرفيًا
  لو الكونتكست خلص. ده طلب صريح من صاحب المشروع.

---

## 1) المشروع إيه

**زاوية** منصة لإنشاء متاجر أونلاين (مصر، عربي RTL). الموقع الحي: **https://www.zawyaeg.site**
- التاجر بيسجّل، بيعمل متجر، بيضيف منتجات، وبيدير الطلبات والعملاء والشحن والتسويق من
  **لوحة التحكم** `/dashboard`.
- متجر كل تاجر على `/s/<slug>` (أو دومين خاص).
- فيه استوديو محتوى بالذكاء الاصطناعي (Gemini / Gemini Pro / ChatGPT) ونشر تلقائي على
  السوشيال (Upload-Post) بجداول.

**التقنيات:** Next.js 16 (App Router — نسخة مختلفة عن اللي تعرفها، اقرا `AGENTS.md`)،
TypeScript، Tailwind، Drizzle ORM + Postgres (Supabase)، مستضاف على **Vercel**.

---

## 2) الريبوهات والنشر — مهم جدًا

| الريموت | الريبو | معناه |
|---|---|---|
| `origin` | `Mohamedre123/Store-Platform` | **الموقع الحي**. أي `git push origin main` = Vercel بينشر على zawyaeg.site خلال ~1–2 دقيقة |
| `zawyaapk` | `Mohamedre123/zawyaapk` | **نسخة التطبيق** على GitHub (نفس الكود كله). فيه workflows بتبني APK/iOS |

نفس فرع `main` بيترفع على الاتنين. التطبيق **بيفتح الموقع الحي نفسه**، فأي تعديل على
الموقع بيوصل للتطبيق لوحده (من غير نسخة جديدة) — إلا الشاشات الأصلية (تحت).

### خطوات الرفع (بالترتيب ده دايمًا)

```bash
npx tsc --noEmit                                  # الموقع
(cd mobile && npx tsc --noEmit -p tsconfig.json)  # التطبيق
npx next build > "H:/FORCLA~1/zawya-tools/next-build.log" 2>&1; grep -n "Compiled successfully\|Error\|error" "H:/FORCLA~1/zawya-tools/next-build.log" | head
git fetch origin && git status -sb                # اتأكد إن مفيش commits جديدة على origin مش عندك
git add <الملفات> && git commit -m "رسالة بالعربي بتوصف النتيجة"   # + سطر Co-Authored-By
git push zawyaapk main
git push origin main                              # ده اللي بينشر الموقع
```

- لو التعديل **ما بيأثرش على الموقع** (ملفات `mobile/` بس، أو توثيق) — ارفع على الاتنين عادي.
- لو **بيغيّر الموقع** — لازم صاحب المشروع يكون طالبه/موافق.
- بعد النشر بدقيقتين: اختبار سريع بـ curl:
  `/` و`/login` و`/signup` = 200، `/dashboard` = 307 (من غير جلسة)، `/api/app/home` و`/api/app/me` = 401.
- رسايل الـcommit بالعربي وبتوصف النتيجة (شوف `git log`)، وآخرها:
  `Co-Authored-By: Claude <noreply@anthropic.com>` (بالموديل الحالي).

### تعديلات قاعدة البيانات (Migrations)

- اكتب ملف SQL يدوي: `drizzle/00NN_name.sql` (آخر رقم حاليًا **0036**)، والجمل مفصولة بـ
  `--> statement-breakpoint`، واستخدم `IF NOT EXISTS`.
- عدّل الـschema في `src/db/schema/*.ts`.
- **طبّقه على قاعدة الإنتاج قبل رفع الكود** اللي بيقرا الأعمدة الجديدة:
  `node .scripts/apply-sql.mjs drizzle/00NN_name.sql` (بيقرا `DIRECT_URL`/`DATABASE_URL` من `.env.local`).
- اتأكد إن الأعمدة اتعملت، وبعدين ارفع.

---

## 3) التطبيق — متبني إزاي

المجلد: **`mobile/`** (تفاصيل إضافية في `mobile/README.md`).

- **Capacitor 8**. `appId = site.zawyaeg.app`، الاسم «زاوية».
- `mobile/capacitor.config.ts`: `server.url = https://www.zawyaeg.site` و
  `appStartPath: '/dashboard'` (**لازم بالشرطة** — من غيرها التطبيق بيعلّق)، وصفحة
  `offline.html` لما النت يقطع.
- **الطبقة (layer):** سكربت `www/zawya-app.js` بيتحقن في كل صفحة من الموقع جوّه التطبيق
  (بيتبني بـesbuild من `mobile/src/layer/`). بيضيف: انيميشن تنقّل، شريط تحميل، زرار رجوع،
  splash، onboarding، إيماءات، شبكة/أوفلاين، ملفات وطباعة، شريط تبويبات سفلي أصلي،
  و**شاشات أصلية** مكتوبة بـPreact جوّه Shadow DOM (`zawya-app-layer`).
- **البلجن الأصلي `ZawyaShell`:**
  - أندرويد: `mobile/android/app/src/main/java/site/zawyaeg/app/ZawyaShellPlugin.java` و`MainActivity.java`
    — حقن السكربت من أول الصفحة، توجيه الروابط (روابط المنصة جوّه التطبيق، متاجر `/s/`
    والمواقع الخارجية في Custom Tabs، واتساب والسوشيال في تطبيقاتهم)، ألوان شريط الحالة،
    طباعة، تحميل/حفظ/مشاركة ملفات.
  - iOS: `mobile/ios/App/App/ZawyaShellPlugin.swift` و`ZawyaViewController.swift`.
- **تطبيق فقط:** شعار زاوية في التطبيق بيودّي `/dashboard` (ولو مش مسجّل → `/login`)،
  مش صفحة التسويق. الصفحة `/` جوّه التطبيق بتتحوّل للوحة (`navigation.ts` و`index.ts`).

### الشاشات الأصلية (اتعملت)

`mobile/src/layer/shell/`:
| الشاشة | الملفات | الـAPI |
|---|---|---|
| الرئيسية | `home.tsx`, `chart.tsx` | `/api/app/home` |
| الطلبات + تفاصيل الطلب (تغيير حالة، ملاحظة، تأكيد) | `orders.tsx`, `orders-api.ts`, `order-detail.tsx` | `/api/app/orders*` |
| المنتجات + تفاصيل (تفعيل/إيقاف، حذف) | `products.tsx`, `products-api.ts`, `product-detail.tsx` | `/api/app/products*` |
| العملاء + صفحة عميل | `customers.tsx`, `customers-api.ts`, `customer-detail.tsx` | `/api/app/customers*` |
| «المزيد» (لوحة سفلية بكل الأقسام + المستخدم + خروج) | `more.tsx`, `nav-data.ts` | `/api/app/me`, `/api/app/logout` |
| شريط صفحة تأكيد البريد `/verify` (رجوع + «غيّر البريد» + «سجّل بحساب تاني» + «الغِ التسجيل») | `verify.tsx`, `styles-verify.ts` | `/api/app/account/change-email`, `/api/app/account/abandon` |
| التحليلات (مؤشرات، رسم إيرادات بالسحب، قُمع، توزيع الطلبات، الأكثر مبيعًا) | `analytics.tsx`, `analytics-api.ts`, `styles-analytics.ts` | `/api/app/analytics` |
| الشحنات (إحصائيات، مستني يتشحن، قايمة بفلاتر، تتبّع/نسخ بوليصة) — **من 2.4:** دوسة على طلب مستني = لوحة «شحنة للطلب» (سجّل عند الشركة المربوطة بضغطة، أو يدوي: الشركة/البوليصة/التكلفة/التحصيل — التحصيل بيتعبّى تلقائي)، زرار «شحنة» = اختيار الطلب، دوسة على شحنة = لوحة: الخطوة الجاية بزرار كبير، أي حالة، «استلمت الفلوس من الشركة»، افتح الطلب/تتبّع/اتصال. لو الموقع ما بيبعتش `carriers` الأزرار بتفتح `?web=1` زي الأول | `shipments.tsx`, `shipment-sheets.tsx`, `shipments-api.ts` (الستايل في `styles-analytics.ts` و`styles-ops.ts`) | `/api/app/shipments` (بقى فيه `carriers` و`statuses` و`codDefault` و`nextStatus/nextLabel`)، `POST /api/app/shipments/{create,dispatch}`، `POST /api/app/shipments/:id/{status,settle}` |
| الكوبونات والعروض (كروت كوبونات بنسخ الكود + تشغيل/إيقاف، عروض الكمية، الباقات) — **من 2.4:** «+ كوبون» والقلم على أي كوبون = فورم الكوبون في لوحة (`coupon-editor.tsx`: الكود أو «ولّد»، النوع والقيمة وأقصى خصم، أقل طلب، ينطبق على كل/منتجات/أقسام باختيار بالبحث، أول طلب، حدود الاستخدام، التواريخ، التفعيل، الحذف بتأكيد). **من 2.5:** «+ عرض» و«+ باقة» والقلم جنب كل عرض/باقة = لوحات (`offer-editor.tsx`: عرض الكمية بالشرائح «اشترِ X ووفّر Y٪» والمنتجات (فاضي = الكل)؛ الباقة بالمنتجات (٢+، المختارين فوق) وسعر الطقم مع «العميل هيوفّر كام» وتحذير لو السعر مش أقل) — لو `editsOffers` مش موجود ← `?web=1` | `marketing.tsx`, `coupon-editor.tsx`, `offer-editor.tsx` | `/api/app/marketing` (بقى فيه `form` لكل كوبون وعرض وباقة، و`pickProducts` بالسعر، و`pickCategories`، و`editsOffers`)، `POST /api/app/marketing/coupons/save`، `POST /api/app/marketing/coupons/:id/{toggle,delete}`، `POST /api/app/marketing/{offers,bundles}/save`، `POST /api/app/marketing/offers/:id/{toggle,delete}` (الباقات في نفس جدول العروض) |
| المخزون (أرقام، فلتر نافد/منخفض، بحث، تعديل الكمية بـ−/+ أو كتابة الرقم — بيتحفظ بعد ٧٠٠ms، والمتغيّرات، وسجل الحركة) | `inventory.tsx` | `/api/app/inventory`، `POST /api/app/inventory/stock` |
| سجل الرسايل (أرقام، فلتر اللي فشلت، سبب الفشل بدوسة، فتح الطلب) | `messages.tsx` | `/api/app/messages` |
| الاشتراك (الحالة وكام يوم فاضل، عدّاد الطلبات، بدء التجربة بضغطة، الباقات، معرّف الحساب، الطلبات والسجل) — الدفع بزرار «اشترك» ← `?web=1` | `subscription.tsx` | `/api/app/subscription`، `POST /api/app/subscription/trial` |
| الإعدادات (قايمة مجمّعة بكل صفحات الإعدادات، متفلترة بالصلاحيات من `/api/app/me`) — «بيانات المتجر» ← `/dashboard/settings?web=1` | `settings.tsx` | `/api/app/me` |

| منتج جديد `/dashboard/products/new` (صور بالكاميرا أو المعرض — بتتصغّر لـ١٦٠٠px JPEG على الموبايل وتترفع على `/api/upload` وهو بيكتب، اسم وسعر وقبل الخصم ووصف، تتبّع مخزون وكمية، قسم، نشر/مسوّدة) — المقاسات والسيو ← `?web=1` | `product-new.tsx` | `/api/app/products/form`، `POST /api/app/products/new` (بينادي `saveProductAction` بـFormData وبيعتبر `NEXT_REDIRECT` نجاح) |
| المراجعات (مستنية موافقتك/منشورة، نجوم، وافق/اخفي، رد، امسح بتأكيد) | `reviews.tsx` | `/api/app/reviews`، `POST /api/app/reviews/:id/{approve,reply,delete}` |
| المرتجعات (محتاجة إجراء/الكل، تغيير الحالة من لوحة، ملاحظة داخلية، اتصال) | `returns.tsx` | `/api/app/returns`، `POST /api/app/returns/:id/{status,note}` |
| الشكاوى (مستنية ردّك/الكل، محادثة في لوحة طويلة، رد، اتحلّت/اقفلها/افتحها تاني) | `complaints.tsx` | `/api/app/complaints`، `/api/app/complaints/:id` (الرسايل)، `POST /api/app/complaints/:id/{reply,status}` |
| **تعديل منتج** `/dashboard/products/:uuid?edit=1` (نفس فورم «منتج جديد» — `ProductEditor` في `product-new.tsx` بـ`editing`: بيتعبّى من الخادم كل مرة يتفتح، «خليها الغلاف» لأي صورة، المنتج اللي ليه مقاسات الكمية بتاعته مش بتتعدّل هنا) — زرار «تعديل المنتج» في تفاصيل المنتج بيفتحه؛ لو المسار مش منشور نفس الرابط بيفتح فورم المنصة | `product-new.tsx` (`EditProductScreen`) | `GET/POST /api/app/products/:id/edit` — **الـPOST بيقرا المنتج ومتغيّراته من القاعدة ويعبّي كل خانات الفورم** (التكلفة، الكود، الماركة، السيو، المقترحات، `variants`) قبل `saveProductAction`، لأن الفعل بيكتب المنتج كله وأي خانة ناقصة بتتمسح. بيرجّع `detail` |
| الحظر `/dashboard/customers/blocked` (رفضوا الاستلام أكتر من مرة + احظره/فُكّ، قايمة الحظر بعدّاد المنع وشيل، «ضيف للحظر» في لوحة: النوع/القيمة/ارفض أو علّم/السبب) | `blocked.tsx` | `/api/app/blocked`، `POST /api/app/blocked/add`، `POST /api/app/blocked/:id/{remove,block,unblock}` (block/unblock = معرّف عميل) |
| المندوبون `/dashboard/couriers` (أرقام، طلبات مستنية مندوب ← «اسند» بلوحة مرتّبة بالمنطقة، كارت لكل مندوب بحسابه + «اقفل الحساب» بتأكيد، «ابعتله الرابط» على واتساب، انسخ، ⋯ = اتصل/عدّل/وقّفه/رابط جديد، إضافة وتعديل في لوحة) | `couriers.tsx` | `/api/app/couriers`، `POST /api/app/couriers/{save,assign}`، `POST /api/app/couriers/:id/{toggle,settle,rotate}` |
| الحجوزات `/dashboard/bookings` (مواعيد العمل كارت ← لوحة تعديل: تشغيل/أيام/من-لحد/مدة المعاد، الجاية واللي فات متقسّمين بالأيام «النهارده/بكرة»، تغيير الحالة، اتصال) | `bookings.tsx` | `/api/app/bookings`، `POST /api/app/bookings/hours`، `POST /api/app/bookings/:id/status` |

| المصروفات والأرباح `/dashboard/expenses` (صافي ربح ٣٠ يوم بهامشه، «فلوسك رايحة فين» بشرايط ملوّنة، فلتر بالتصنيف، دوسة على المصروف = لوحة تعديل فيها «احذف» بتأكيد، «سجّل مصروف»: تصنيف/على إيه/المبلغ/التاريخ/ملاحظة/شهري) | `expenses.tsx` | `/api/app/expenses` (`finance.view`)، `POST /api/app/expenses/save`، `POST /api/app/expenses/:id/delete` |
| الموردون `/dashboard/suppliers` («محتاج تطلبه» متجمّع على المورّد + «ابعتله الطلبية» على واتساب بقايمة الأصناف + اتصال، قايمة الموردين، «المنتجات» = لوحة ربط/فكّ ربط بالبحث، ⋯ = اتصال/واتساب/إيميل/تعديل/حذف بتأكيد) | `suppliers.tsx` | `/api/app/suppliers` (`inventory.manage`)، `POST /api/app/suppliers/{save,link}`، `POST /api/app/suppliers/:id/delete` |
| الأقسام `/dashboard/products/categories` (رئيسي وتحته الفرعي بمسافة، صورة وعدد منتجات، دوسة = لوحة: صورة بالكاميرا/المعرض على `/api/upload` فولدر `categories`، الاسم، «تحت قسم» (القسم اللي ليه فرعيين بيفضل رئيسي)، الوصف، الظهور، «امسح القسم» بتأكيد) | `categories.tsx` | `/api/app/categories` (`products.view`)، `POST /api/app/categories/save` (FormData ← `saveCategoryAction` + `NEXT_REDIRECT` = نجاح)، `POST /api/app/categories/:id/delete` (`products.manage`) |
| سلة المهملات `/dashboard/products/trash` («رجّعه» = مسوّدة + زرار «افتحه»، امسح نهائي بتأكيد) | `trash.tsx` | `/api/app/trash` (`products.manage`)، `POST /api/app/trash/:id/{restore,purge}` |

| الولاء والنقاط `/dashboard/loyalty` (أرقام، مفتاح تشغيل النقاط، القواعد بمثال حي في لوحة، متجر المكافآت إضافة/تعديل/حذف، مفتاح تشغيل عجلة الحظ، آخر الحركات — **من 2.5:** «عدّل مستويات العملاء» (النوع/الاسم/من كام نقطة/الخصم، لحد ٤) و«عدّل العجلة» (التشغيل/العنوان/السطر/تظهر بعد/لفّات يوميًا/الجوايز من ٢ لـ٨ بالنوع والقيمة والفرصة واللون + مجموع الفرص) في لوحات `loyalty-editors.tsx` — لو `editsTiers` مش موجود ← `?web=1`) | `loyalty.tsx`, `loyalty-editors.tsx` | `/api/app/loyalty` (`customers.view` — بقى فيه `editsTiers` و`wheel.{subtitle,triggerAfterSeconds,freeSpinsPerDay,prizeInputs}`)، `POST /api/app/loyalty/{settings,wheel,tiers}` (`wheel` بيقبل `{enabled}` بس للنسخ القديمة أو كل الخانات والجوايز من 2.5؛ `tiers` بياخد اللون والمزايا من المستوى القديم بنفس المفتاح)، `POST /api/app/loyalty/rewards/save`، `POST /api/app/loyalty/rewards/:id/delete` — **`settings` بيبعت المستويات الموجودة (أو `DEFAULT_TIERS` من `src/lib/loyalty-meta.ts`) و`wheel` بيبعت العنوان والجوايز الموجودين**، لأن الأفعال بتكتب كل حاجة من الأول |
| المسوّقون بالعمولة `/dashboard/affiliates` (مستحق/بيعات، كارت لكل مسوّق بكوده وضغطاته وبيعاته ومستحقه، «سجّل صرف» بتأكيد، «ابعتله رابطه» واتساب، انسخ، ⋯ = اتصل/عدّل/وقّفه/احذف، إضافة وتعديل في لوحة) | `affiliates.tsx` | `/api/app/affiliates` (`marketing.manage`)، `POST /api/app/affiliates/save`، `POST /api/app/affiliates/:id/{pay,delete}` |
| حِيل صاحبك `/dashboard/referrals` (رابط الإحالة بنسخة، واتساب برسالة جاهزة، شارك، انسخ الرسالة، الكود، سجّلوا/اشتركوا/طلبات وصّلتها) | `referrals.tsx` | `/api/app/referrals` (من غير صلاحية — زي الصفحة) |
| معرض الوسائط `/dashboard/media` (شبكة صور ٣ أعمدة بفلتر المجلد و«في X منتج»، «صوّر»/«من المعرض» بيرفعوا لحد ١٠ صور على `/api/upload` في المجلد المختار (الكل = `misc`)، دوسة = لوحة: معاينة، تغيير الاسم، انسخ/شارك/افتح، الحذف بتأكيد — المستعملة في منتج مالهاش زرار حذف) | `media.tsx` | `/api/app/media` (`storefront.manage` — بيعمل `syncFromStorage` زي الصفحة)، `POST /api/app/media/:id/{rename,delete}` |
| البانرات `/dashboard/storefront/banners` (البانرات بالصورة والمكان وتاريخ الانتهاء و«انتهى»، مفتاح تشغيل، «بانر جديد» والدوسة = لوحة: المكان (ترويجي/قسم — الرئيسي والمنبثق بيظهروا بس لو البانر منهم)، صورة الكمبيوتر وصورة الموبايل بالكاميرا/المعرض (مجلد `banners`)، العنوان والسطر، نص الزرار ورابطه، التواريخ، التفعيل، الحذف بتأكيد) | `banners.tsx` | `/api/app/banners` (`storefront.manage`)، `POST /api/app/banners/save`، `POST /api/app/banners/:id/{toggle,delete}` |
| الأتمتة `/dashboard/automations` (حالة واتساب وتيليجرام، «مين يتبلّغ» بمفتاح + لوحة «ابعت إشعار تجريبي» وشيل بتأكيد، القواعد «لما ← اعمل» بعدد التشغيل ومفتاح + لوحة بالشروط والإجراءات وحذف بتأكيد) — إضافة مستقبِل وبناء قاعدة ← `?web=1` | `automations.tsx` | `/api/app/automations` (`marketing.manage`)، `POST /api/app/automations/rules/:id/{toggle,delete}`، `POST /api/app/automations/recipients/:id/{toggle,delete,test}` |
| المدوّنة `/dashboard/blog` (المقالات بالغلاف والمشاهدات ومفتاح نشر، «مقال جديد» والدوسة = لوحة كتابة: الغلاف بالكاميرا/المعرض (مجلد `misc`)، العنوان، المقدّمة، المحتوى، الكاتب، الرابط، النشر، «شارك رابط المقال»، الحذف بتأكيد) | `blog.tsx` | `/api/app/blog` (`storefront.manage`)، `POST /api/app/blog/save`، `POST /api/app/blog/:id/{toggle,delete}` |

شاشات الحظر والمندوبين والحجوزات والمصروفات والموردين والأقسام والسلة والولاء والمسوّقين والإحالة بياناتهم في `shell/ops-api.ts` (فيه كمان `copyText` و`COPY_ICON`/`WALLET_ICON`) (فيه كمان `waNumber` لرقم واتساب دولي و`toLatin` للأرقام العربي) وستايلهم في `shell/styles-ops.ts`. رفع الصور (`shrink` و`upload(file, folder)`) متصدّر من `shell/product-new.tsx`.
الشاشات دي كلها بيقروا بياناتهم من `shell/business-api.ts` (أنواع البيانات + `cachedResource`)، والطلبات من
`shell/http.ts` (`useResource` = كاش + تحديث + رجوع لصفحة المنصة لو المسار مش منشور، و`postAppJson` = POST برسايل عربي)،
والستايل في `shell/styles-business.ts`. **أي شاشة جديدة استخدم `cachedResource` + `useResource` بدل ما تكرر الكود.**

باقي الملفات: `index.tsx` (التوجيه بين الشاشات + TabBar)، `screen.tsx` (`Screen` مع
`overlay` للأزرار العايمة، و`Sheet` مع `tall`)، `tabbar.tsx`، `navigate.ts`، `ui.tsx`،
`format.ts`، `api.ts`، `styles*.ts`.

أي صفحة في اللوحة **مالهاش** شاشة أصلية (التحليلات، التسويق، الشحن، الإعدادات، الإضافات،
الاستوديو…) بتظهر في التطبيق كصفحة الموقع نفسها بانيميشن التطبيق.

### نمط عمل شاشة أصلية جديدة (امشي عليه بالظبط)

1. **لودر مشترك** `src/lib/<x>-data.ts` — صفحة اللوحة والـAPI الاتنين بيستخدموه (عشان
   البيانات تفضل واحدة). اعمل refactor لصفحة اللوحة تستخدمه **من غير ما شكلها يتغيّر**.
2. **شكل الرد** `src/lib/app-<x>.ts`.
3. **مسارات** `src/app/api/app/<x>/route.ts` (و`[id]`، وأفعال POST) — بتستخدم
   `src/lib/app-api.ts`: `appContext('<permission>')`، `json()`، `NO_STORE`،
   `sameOrigin(req)` لكل POST، `isRecordId`. الأفعال بتنادي الـserver actions الموجودة
   بتاعة اللوحة (ما تكررش المنطق).
4. **الشاشة** `mobile/src/layer/shell/<x>.tsx`: كاش في localStorage، `previews` للانتقال
   السريع للتفاصيل، `Screen`/`Sheet`، سحب للتحديث، ولو الـAPI رجّع 404 مش JSON
   (`onUnavailable`) → ترجع لصفحة الموقع العادية. `?web=1` على أي رابط بيفتح صفحة الموقع.
5. سجّلها في `shell/index.tsx` (regex للمسار + `ScreenKey` + `unavailable` + مسح الكاش عند الخروج) وستايلها في
   `styles-<x>.ts`، **وضيف المسار في `mobile/src/layer/native-paths.ts`** (من غيره الهيكل المؤقت هيظهر فوق الشاشة الأصلية).
6. أضف mock في `mobile/dev/mock-api.mjs` و`mobile/scripts/serve-www.mjs`، وجرّب في المتصفح
   (فاتح وداكن) وفي الإيموليتر.
7. حدّث جدول «الملفات المشتركة» تحت.

---

## 4) بناء التطبيق وإرساله (ويندوز — الجهاز ده)

**مشكلة:** مسار المشروع عربي فـGradle/Java بيقعوا → بنعمل `subst Z:` على جذر المشروع ونبني من `Z:`.
الأدوات كلها على `H:\for claude\zawya-tools` (اسمه القصير `H:/FORCLA~1/`):
JDK 21 في `jdk/jdk-21.0.12.1+1`، Android SDK في `sdk`، Gradle `gradle-8.14.3` (**استخدمه، مش gradlew**)،
`gradle-home`، `tmp`، `avd` (إيموليتر اسمه `zawya`).

### الخطوات (Git Bash)

```bash
# 0) رقّم النسخة: mobile/package.json (version) + mobile/android/app/build.gradle
#    (versionName و الرقم الافتراضي في versionCode = (System.getenv("ZAWYA_VERSION_CODE") ?: "N") as Integer)
#    لازم versionCode يزيد كل نسخة وإلا جوجل بلاي ترفض.

# 1) درايف Z:
powershell.exe -NoProfile -Command "if (-not (Test-Path Z:\\mobile)) { subst Z: 'E:\شغل\شغل خارجي لسابقة اعمالي\تطبيق منصة زاوية\منصة انشاء المتاجر' }"

# 2) الطبقة + مزامنة Capacitor
cd Z:/mobile && npx tsc --noEmit -p tsconfig.json && node scripts/build-layer.mjs && npx cap sync

# 3) البناء (APK للتثبيت المباشر + AAB لجوجل بلاي)
cd Z:/mobile/android && export JAVA_HOME="H:/FORCLA~1/zawya-tools/jdk/jdk-21.0.12.1+1" GRADLE_USER_HOME="H:/FORCLA~1/zawya-tools/gradle-home" ANDROID_HOME="H:/FORCLA~1/zawya-tools/sdk" TMP="H:\\FORCLA~1\\zawya-tools\\tmp" TEMP="H:\\FORCLA~1\\zawya-tools\\tmp" && JAVA_TOOL_OPTIONS="-Djava.io.tmpdir=H:\\FORCLA~1\\zawya-tools\\tmp -Djdk.net.unixdomain.tmpdir=H:\\FORCLA~1\\zawya-tools\\tmp" "H:/FORCLA~1/zawya-tools/gradle-8.14.3/bin/gradle" assembleRelease bundleRelease --no-daemon --console=plain > "H:/FORCLA~1/zawya-tools/build-release.log" 2>&1; tail -5 "H:/FORCLA~1/zawya-tools/build-release.log"

# 4) نسخ + تحقق
cp Z:/mobile/android/app/build/outputs/apk/release/app-release.apk "H:/FORCLA~1/zawya-release/zawya-X.Y.apk"
cp Z:/mobile/android/app/build/outputs/bundle/release/app-release.aab "H:/FORCLA~1/zawya-release/zawya-X.Y.aab"
"H:/FORCLA~1/zawya-tools/sdk/build-tools/36.0.0/apksigner.bat" verify "H:/FORCLA~1/zawya-release/zawya-X.Y.apk"
"H:/FORCLA~1/zawya-tools/sdk/build-tools/36.0.0/aapt2.exe" dump badging "H:/FORCLA~1/zawya-release/zawya-X.Y.apk" | head -1
```

5) ابعت الـAPK: `SendUserFile({ files: ["H:/for claude/zawya-release/zawya-X.Y.apk"], status: "proactive" })`.
6) ارفع الكود على الريموتين (قسم 2).

**التحديث عند التاجر:** النسخة الجديدة بتتسطّب فوق القديمة (نفس مفتاح التوقيع). تعديلات
الموقع بتوصل من غير تحديث؛ تعديلات `mobile/` محتاجة APK جديد.

### مفتاح التوقيع — ⚠ أخطر حاجة في المشروع

- `mobile/android/release.keystore` و`mobile/android/keystore.properties` — **ممنوع يدخلوا git**
  (في `.gitignore`). نسخة احتياطية في `H:\for claude\zawya-tools\signing\`.
- لو ضاع المفتاح التطبيق مش هيقدر يتحدّث على جوجل بلاي تاني أبدًا. ما تعيدش توليده.
- الـworkflow على GitHub (`.github/workflows/mobile-android.yml`) بيوقّع لو السيكرتس موجودة:
  `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
  و`mobile-ios.yml` بيبني iOS على macOS (محاكي).

### التجربة قبل البناء

- **في المتصفح:** `node mobile/scripts/build-layer.mjs --dev` وبعدين `preview_start` باسم
  `zawya-app-www` (بورت 4455، من `.claude/launch.json`) — بيعرض الشاشات الأصلية ببيانات
  وهمية من `mobile/dev/mock-api.mjs`. **لو عدّلت `serve-www.mjs` اقفل السيرفر وشغّله تاني.**
  جرّب الوضع الفاتح والداكن ومقاس موبايل.
- **إيموليتر أندرويد:** env `ANDROID_SDK_ROOT=H:\FORCLA~1\zawya-tools\sdk`,
  `ANDROID_AVD_HOME=H:\FORCLA~1\zawya-tools\avd`, `ANDROID_EMULATOR_HOME=H:\FORCLA~1\zawya-tools\emu-home`
  ثم `sdk/emulator/emulator.exe -avd zawya -no-window -gpu swiftshader_indirect`، و`adb` في `sdk/platform-tools/adb.exe`
  (`adb install -r`، `adb exec-out screencap -p > shot.png`).

---

## 5) ملفات بيقرا منها الموقع والتطبيق مع بعض

تعديل أي حاجة هنا بيأثر على الاتنين. غيّر بحرص، ولو غيّرت **شكل البيانات الراجعة**
(اسم حقل، حذف حقل، تغيير نوعه) لازم شاشة التطبيق المقابلة تتعدّل معاه:

| الملف | الموقع | التطبيق |
|---|---|---|
| `src/lib/home-data.ts` | `src/app/dashboard/page.tsx` | `/api/app/home` ← `mobile/src/layer/shell/home.tsx` |
| `src/lib/orders-data.ts` | `src/app/dashboard/orders/page.tsx` و `[id]/page.tsx` | `/api/app/orders*` ← `mobile/src/layer/shell/orders*.tsx` و `order-detail.tsx` |
| `src/lib/app-orders.ts` | — | شكل رد `/api/app/orders*` |
| `src/lib/app-api.ts` | — | الجلسة والصلاحيات وحماية الأصل لكل `/api/app/*` |
| `src/lib/products-data.ts` | `src/app/dashboard/products/page.tsx` | `/api/app/products*` ← `mobile/src/layer/shell/products*.tsx` و `product-detail.tsx` |
| `src/lib/app-products.ts` | — | شكل رد `/api/app/products*` |
| `src/lib/customers-data.ts` | `src/app/dashboard/customers/page.tsx` | `/api/app/customers*` ← `mobile/src/layer/shell/customers*.tsx` و `customer-detail.tsx` |
| `src/lib/app-customers.ts` | — | شكل رد `/api/app/customers*` |
| `src/app/dashboard/orders/actions.ts` و `confirm-actions.ts` | أزرار الطلب | `/api/app/orders/[id]/status\|note\|confirm` بتناديهم |
| `src/app/dashboard/products/actions.ts` (`toggleProductStatusAction` و `deleteProductAction`) | أزرار المنتج | `/api/app/products/[id]/status\|delete` بتناديهم |
| `src/components/dashboard/sidebar.tsx` (`NAV`) | القايمة الجانبية و«المزيد» | **منسوخة** في `mobile/src/layer/shell/nav-data.ts` — أي قسم يتضاف أو يتغيّر هنا يتعدّل هناك |
| `/api/app/me` و `/api/app/logout` | — | قايمة «المزيد» في التطبيق (المستخدم وصلاحياته، وتسجيل الخروج) |
| `src/lib/store-context.ts` (`getOptionalDashboardContext`) | — | سياق من غير redirect للـAPI |
| `src/lib/otp.ts` (`issueEmailOtp`) | صفحة `/verify` | `/api/app/account/change-email` بيناديها بعد تغيير البريد |
| `src/lib/analytics-data.ts` (`loadAnalytics`) | `src/app/dashboard/analytics/page.tsx` | `/api/app/analytics` ← `src/lib/app-analytics.ts` ← `shell/analytics.tsx` |
| `src/lib/shipments-data.ts` (`loadShipments`) | `src/app/dashboard/shipments/page.tsx` | `/api/app/shipments` ← `src/lib/app-shipments.ts` ← `shell/shipments.tsx` |
| `src/lib/marketing-data.ts` (`loadMarketing`) | `src/app/dashboard/marketing/page.tsx` | `/api/app/marketing` ← `src/lib/app-marketing.ts` ← `shell/marketing.tsx` |
| `src/app/dashboard/marketing/actions.ts` (`toggleCouponAction`, `saveCouponAction`, `deleteCouponAction`) و`offer-actions.ts` (`toggleOfferAction`, `saveOfferAction`, `saveBundleAction`, `deleteOfferAction` — بتتنادى من `/api/app/marketing/{offers,bundles}/save` و`offers/:id/delete`) | فورم الكوبون وأزرار التشغيل في اللوحة | `POST /api/app/marketing/{coupons,offers}/:id/toggle` و`coupons/save` و`coupons/:id/delete` بيناديهم (لو اتغيّر `CouponInput` عدّل `coupons/save/route.ts` و`coupon-editor.tsx`) |
| `src/app/dashboard/shipments/actions.ts` (`createShipmentAction`, `dispatchShipmentAction`, `updateShipmentStatusAction`, `settleCodAction`) + `src/lib/carriers.ts` (`CARRIERS`, `SHIPMENT_STATUSES`, `nextShipmentStatus`) | فورم الشحنة وأزرارها في اللوحة | `POST /api/app/shipments/{create,dispatch}` و`/api/app/shipments/:id/{status,settle}` ← `shell/shipment-sheets.tsx` |
| `src/lib/inventory-data.ts` (`loadInventory`, `MOVEMENT_REASONS`) | `src/app/dashboard/inventory/page.tsx` | `/api/app/inventory` ← `src/lib/app-inventory.ts` ← `shell/inventory.tsx` |
| `src/app/dashboard/inventory/actions.ts` (`setStockAction`) | خانة الكمية في اللوحة | `POST /api/app/inventory/stock` بيناديها |
| `src/lib/messages-data.ts` (`loadMessages`) و`src/lib/message-labels.ts` | `src/app/dashboard/messages/page.tsx` | `/api/app/messages` ← `src/lib/app-messages.ts` ← `shell/messages.tsx` |
| `src/lib/subscription-data.ts` (`loadSubscription`, `SUB_STATUS`, `REQUEST_STATUS`) | `src/app/dashboard/subscription/page.tsx` | `/api/app/subscription` ← `src/lib/app-subscription.ts` ← `shell/subscription.tsx` |
| `src/app/dashboard/subscription/actions.ts` (`startTrialAction`) | زرار التجربة في اللوحة | `POST /api/app/subscription/trial` بيناديها |

| `src/lib/reviews-data.ts` (`loadReviews`) + `reviews/actions.ts` | `src/app/dashboard/reviews/page.tsx` | `/api/app/reviews*` ← `src/lib/app-reviews.ts` ← `shell/reviews.tsx` |
| `src/lib/returns-data.ts` (`loadReturns`) + `returns/actions.ts` + `src/lib/returns-meta.ts` | `src/app/dashboard/returns/page.tsx` | `/api/app/returns*` ← `src/lib/app-returns.ts` ← `shell/returns.tsx` |
| `src/lib/tickets.ts` (`listTickets`, `ticketMessages`) + `complaints/actions.ts` + `tickets-meta.ts` | `src/app/dashboard/complaints/page.tsx` | `/api/app/complaints*` ← `src/lib/app-complaints.ts` ← `shell/complaints.tsx` |
| `src/app/dashboard/products/actions.ts` (`saveProductAction`) + `/api/upload` | فورم المنتج في اللوحة | `POST /api/app/products/new` و`/api/app/products/:id/edit` ← `shell/product-new.tsx` (**لو اتضافت خانة جديدة لفورم المنتج في اللوحة، لازم تتضاف في `edit/route.ts` كمان وإلا التعديل من التطبيق هيمسحها**) |
| `src/lib/blocked-data.ts` (`loadBlocked`) + `customers/block-actions.ts` | `src/app/dashboard/customers/blocked/page.tsx` | `/api/app/blocked*` ← `src/lib/app-blocked.ts` ← `shell/blocked.tsx` |
| `src/lib/couriers-data.ts` (`loadCouriers`) + `couriers/actions.ts` + `src/lib/couriers-meta.ts` | `src/app/dashboard/couriers/page.tsx` | `/api/app/couriers*` ← `src/lib/app-couriers.ts` ← `shell/couriers.tsx` |
| `src/lib/bookings-data.ts` (`loadBookings`) + `bookings/actions.ts` + `src/lib/bookings-meta.ts` | `src/app/dashboard/bookings/page.tsx` | `/api/app/bookings*` ← `src/lib/app-bookings.ts` ← `shell/bookings.tsx` |
| `src/lib/expenses-data.ts` (`loadExpenses` — فيه حساب الربح) + `expenses/actions.ts` + `src/lib/expenses.ts` | `src/app/dashboard/expenses/page.tsx` | `/api/app/expenses*` ← `src/lib/app-expenses.ts` ← `shell/expenses.tsx` |
| `src/lib/suppliers-data.ts` (`loadSuppliers`) + `suppliers/actions.ts` | `src/app/dashboard/suppliers/page.tsx` | `/api/app/suppliers*` ← `src/lib/app-suppliers.ts` ← `shell/suppliers.tsx` |
| `src/lib/categories-data.ts` (`loadCategories`) + `products/actions.ts` (`saveCategoryAction`, `deleteCategoryAction`) | `src/app/dashboard/products/categories/page.tsx` | `/api/app/categories*` ← `src/lib/app-categories.ts` ← `shell/categories.tsx` |
| `src/lib/trash-data.ts` (`loadTrash`) + `products/actions.ts` (`restoreProductAction`, `purgeProductAction`) | `src/app/dashboard/products/trash/page.tsx` | `/api/app/trash*` ← `shell/trash.tsx` |
| `src/lib/loyalty-data.ts` (`loadLoyalty`, `wheelPrizeInputs`) + `src/lib/loyalty-meta.ts` (`DEFAULT_TIERS` — فورم اللوحة بيستوردها منه) + `loyalty/{actions,rewards-actions,wheel-actions}.ts` + `src/lib/rewards-meta.ts` | `src/app/dashboard/loyalty/page.tsx` | `/api/app/loyalty*` ← `src/lib/app-loyalty.ts` ← `shell/loyalty.tsx` |
| `src/lib/affiliates-data.ts` (`loadAffiliates`) + `affiliates/actions.ts` | `src/app/dashboard/affiliates/page.tsx` | `/api/app/affiliates*` ← `src/lib/app-affiliates.ts` ← `shell/affiliates.tsx` |
| `src/lib/merchant-referrals.ts` (`referralSummary`) + `src/lib/notices.ts` (`storeStats`) | `src/app/dashboard/referrals/page.tsx` | `/api/app/referrals` ← `shell/referrals.tsx` |
| `src/lib/media.ts` (`syncFromStorage`, `listMedia`, `usageFor`) + `src/lib/media-meta.ts` + `media/actions.ts` | `src/app/dashboard/media/page.tsx` | `/api/app/media*` ← `src/lib/app-media.ts` ← `shell/media.tsx` |
| `src/lib/blog-data.ts` (`loadBlogPosts`) + `blog/actions.ts` (`savePostAction`, `togglePostAction`, `deletePostAction`) | `src/app/dashboard/blog/page.tsx` | `/api/app/blog*` ← `src/lib/app-blog.ts` ← `shell/blog.tsx` |
| `src/lib/banners-data.ts` (`loadBanners`) + `storefront/banners/actions.ts` | `src/app/dashboard/storefront/banners/page.tsx` | `/api/app/banners*` ← `src/lib/app-banners.ts` ← `shell/banners.tsx` |
| `src/lib/automations-data.ts` (`loadAutomations` — القواعد والمستقبلين وحالة واتساب/تيليجرام) + `automations/actions.ts` و`recipient-actions.ts` + `src/lib/automation-defs.ts` | `src/app/dashboard/automations/page.tsx` | `/api/app/automations*` ← `src/lib/app-automations.ts` (فيه نسخة من أسماء الأحداث والقنوات بتاعة `recipients-manager.tsx`) ← `shell/automations.tsx` |

⚠ **ما تصدّرش ثوابت من ملف `page.tsx`** (Next بيرفض أي export غير المعروفين) — الثوابت المشتركة مكانها `src/lib/*-data.ts`.
و**ما تستوردش قيم (مش أنواع) من ملف فيه `'use client'` في كود الخادم** — بتوصل كمرجع مش كقيمة. `import type` بس.
| `src/lib/subscription.ts` (`activateStore`/`deactivateStore`) | الإدارة + صفحة الاشتراك | بتبعت رسايل الاشتراك تلقائي (قسم 7ب) — ما تشيلش نداء `notifySubscription` |

## 6) القواعد

- **ما تمسحش ولا تغيّر اسم** أي مسار تحت `src/app/api/app/` — التطبيق المتسطّب على موبايلات
  التجّار بيناديه، ومش كل الناس بتحدّث التطبيق.
- **إضافة** حقل جديد للرد آمنة دايمًا. **حذف** أو **تغيير** حقل موجود = شاشة التطبيق تتعدّل
  في نفس التعديل.
- صفحات اللوحة اللي **مالهاش** شاشة أصلية بتظهر في التطبيق زي ما هي — تعديلها بيوصل للتطبيق
  لوحده من غير أي شغل.
- التعديل على أي شاشة في `mobile/src/` محتاج نسخة جديدة من التطبيق (قسم 4).
- قبل الرفع: `npx tsc --noEmit` للموقع، و`npx tsc --noEmit -p tsconfig.json` جوّه `mobile/`، و`next build`.
- **أسرار:** ما تحطش أي مفتاح في الكود ولا git ولا تبعته لأي مكان. ملف Firebase service
  account (`H:\for claude\zawyaeg-1-firebase-adminsdk-*.json`) سرّي — مكانه متغيّرات بيئة
  Vercel بس. ما تقراش مفاتيح API بتاعة التجّار من قاعدة البيانات.
- ما تمسحش بيانات إنتاج. الـmigrations إضافية بس (`ADD COLUMN IF NOT EXISTS`، جداول جديدة).

### نصايح تقنية اتعلمناها

- `node -e` مع عربي/علامات تنصيص بيبوظ في bash → اكتب السكربت `.cjs` في الـscratchpad
  وشغّله. والملفات فيها CRLF أحيانًا — خلي بالك في الاستبدال.
- `browser_batch` أقصاه 25 خطوة.
- مجلدات الموارد في أندرويد: الترتيب `drawable-land-night-*` مش `night-land`
  (`mobile/scripts/generate-assets.mjs` بيولّد الأيقونات والـsplash من `mobile/resources/source/logo.png`).
- `gradle.properties` فيه `android.overridePathCheck=true` و`-Dfile.encoding=UTF-8`.

---

## 7) الذكاء الاصطناعي والنشر التلقائي (آخر حاجة اتعملت في الموقع)

- `src/lib/ai/gemini.ts`: قراءة رسايل الحصّة من جوجل (`readQuota`/`quotaError`)، إعادة
  المحاولة على 429 القصير، الموديل اللي حصّته صفر بيتعامل كموديل واقف وبيتجرّب بديل،
  و`generateImage` بيجرّب لحد 3 موديلات صور (المختار أولًا، ثم المستقر قبل المعاينة).
- `src/lib/ai/settings.ts`: `AiConfig.imageModel/openaiImageModel`، `Engine.imageModel`، `modelFitsProvider`.
- **اختيار الموديل:**
  - افتراضي لكل مفتاح في **الإضافات** (Gemini وGemini Pro، والكلام والصور، وChatGPT):
    `src/app/dashboard/plugins/model-defaults.tsx` + `ai-actions.ts` (`listSavedModelsAction`).
  - يدوي في **الاستوديو** ولكل **جدول نشر**: `src/app/dashboard/studio/model-picker.tsx`
    (`listAiModelsAction`)، والجداول ليها أعمدة `ai_text_model`/`ai_image_model` (migration 0034 متطبّقة).
  - الاختيار اليدوي **ما بيغيّرش** الإضافات. `studioEngine(storeId, prefer, {text, image})`.

---

## 7ب) رسايل الاشتراك للتاجر (إيميل + واتساب) — اتعملت 2026-09-13

- **إمتى بتتبعت:**
  | الحدث | منين | النوع (`kind`) |
  |---|---|---|
  | التاجر بدأ التجربة المجانية (٣ أيام) | `startTrialAction` ← `activateStore` | `trial_started` |
  | الإدارة فعّلت باقة لأول مرة | `activateAction` ← `activateStore` | `activated` |
  | الإدارة فعّلت/جدّدت لمتجر دفع قبل كده (`subscribedUntil` مش فاضي) | `activateAction` أو زرار **«جدّد الاشتراك»** (`renewAction`) | `renewed` |
  | الإدارة وقفت الاشتراك | `deactivateAction` ← `deactivateStore` | `cancelled` |
  | فاضل ٧ / ٣ / ١ يوم (مدفوع) — ويوم واحد بس للتجربة | `runSubscriptionLifecycle` | `reminder_7/3/1` |
  | الاشتراك انتهى / التجربة انتهت (خلال ٣ أيام من الانتهاء) | `runSubscriptionLifecycle` | `expired` / `trial_ended` |
- **الملفات:** `src/lib/subscription-notify.ts` (`deliverSubscriptionNotice` / `notifySubscription` بـ`after()`)،
  `src/lib/subscription-email.ts` (القالب بهوية المنصة — بيستخدم `layout`/`COLORS`/`SITE` المصدّرين من
  `email-templates.ts`)، `src/lib/subscription-lifecycle.ts` (انتهاء + تذكيرات)،
  جدول `subscription_notices` (migration **0036** متطبّقة) بمفتاح فريد (متجر، نوع، نهاية الفترة) = **مفيش تكرار أبدًا**.
- **بتشتغل منين:** `/api/cron/jobs` (العامل اللي بيشتغل طول اليوم — بحد أقصى كل ٣٠ دقيقة بمفتاح
  `subscription_lifecycle_at` في `platform_settings`) و`/api/cron/abandoned-carts` (اليومي). **مش بتبعت من ١٠ بالليل
  لـ١٠ الصبح بتوقيت القاهرة.**
- **الإيميل:** لبريد صاحب الحساب (أو بريد المتجر)، معاملاتي (من غير List-Unsubscribe)، نسخة نصية، اسم المتجر متهرّب
  (escape). بيتسجّل في `message_log` باسم متجر التاجر بحدث `subscription_<kind>`.
- **الواتساب:** بيخرج من **واتساب متجر الإدارة** (صاحب بريد في `src/lib/admin.ts` أو `is_platform_admin`) لو مربوط
  من «الإعدادات ← واتساب» — لرقم `stores.whatsapp` أو `users.phone` أو `stores.phone`. **حاليًا واتساب متجر الإدارة
  (atlosa) مش مربوط** ← الإيميل بس اللي بيوصل لحد ما يتربط.
- متجر الإدارة نفسه ما بيوصلوش أي رسالة اشتراك.
- التجربة **مش تلقائية عند التسجيل** (قرار قديم مقصود في `signupAction`) — التاجر بيبدأها من صفحة الاشتراك، والإيميل
  بيوصله لحظتها.

## 7ج) صفحة تأكيد البريد في التطبيق + السلاسة — اتعملت في نسخة 1.7

- **المشكلة:** التاجر في `/verify` كان محبوس (مفيش رجوع ولا تغيير بريد). **الحل للتطبيق بس:** `shell/verify.tsx`
  بيحط شريط مكان هيدر الموقع (الهيدر بيتخفي بـ`html.zw-verify header{visibility:hidden}`) + لوحة خيارات، ورجوع أندرويد
  بيفتحها.
  - `POST /api/app/account/change-email` — للحساب اللي لسه ما اتأكدش بس؛ بيرفض البريد المستخدم وبريد الإدارة؛
    حد ٦ رموز في الساعة؛ بيغيّر `users.email` و`stores.email` (لو كان زي القديم) وبيبعت رمز جديد.
  - `POST /api/app/account/abandon` — بيخرج، ولو الحساب **لسه ما اتأكدش** بيمسحه هو والمتجر (لو مفيهوش عضو تاني ولا
    طلبات) — فالبريد والرابط يرجعوا متاحين. الحساب المتأكّد عمره ما بيتمسح من هنا.
- **السلاسة (التطبيق بس — كل القواعد مشروطة بـ`html.zw-app`):**
  - اتشال `backdrop-filter` (تغبيش) من شريط التبويبات وشريط العنوان والرسايل الصغيرة، ومن أي عنصر في الموقع فيه
    `backdrop-blur` — ده كان أكبر سبب لسقوط الفريمات مع التمرير.
  - خلفية الموقع المتحركة (`.zw-aurora`) مخفية جوّه التطبيق.
  - حركة الصفحات بقت شفافية على `main` نفسه بدل transform على كل عنصر جوّاه.
  - `will-change` اتشال من الشاشات الأصلية المخفية (كانت ماسكة ذاكرة كرت الشاشة) — مكانه `contain:layout paint`.
  - هياكل التحميل (`.sk`) بقت نبض شفافية بدل لمعة بتعيد الرسم.
  - شريط التبويبات بيتحدّث كل ١٢٠ms بالكتير بدل مع كل تغيير في الصفحة.
  - أندرويد: `setOffscreenPreRaster(true)` و`RENDERER_PRIORITY_IMPORTANT` في `ZawyaShellPlugin.configureWebView`.
  - `.launch,.ob{z-index:40}` عشان الافتتاح يفضل فوق أي شريط.
- **قاعدة للجاي:** ما ترجعش `backdrop-filter` ولا `will-change` دايم ولا حركة على عناصر كتير جوّه التطبيق.

## 7د) سرعة التنقّل وشاشة الافتتاح المتحركة — نسخة 1.8

- **سبب البطء بين الصفحات:** صفحات اللوحة ديناميكية ومفيش `loading.tsx` — Next (16.3) ما بيغيّرش الصفحة غير لما
  الخادم يرد (موثّق في `node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md`).
  **ما ضفناش `loading.tsx`** لأنه كان هيغيّر سلوك الموقع للمتصفح.
- **الحل (تطبيق بس):** `mobile/src/layer/page-placeholder.ts` — لحظة الضغط على رابط لصفحة منصة (من `navigation.ts`
  `watchLinkClicks` أو من `shell/navigate.ts`) بيظهر هيكل الصفحة الجاية بعنوانها الحقيقي (من `nav-data.ts`) وكتل بتنبض،
  تحت شريط اللوحة العلوي (`.safe-top`)؛ بيظهر بعد ٧٠ms (مفيش وميض لو الخادم سريع) وبيتلاشى بعد تغيّر الرابط بفريمين
  (`handleUrlChange`)، وسقف أمان ١٢ ثانية. الشاشات الأصلية مستثناة بـ`native-paths.ts`.
- **الحل الجذري لأي صفحة لسه بطيئة:** تحويلها لشاشة أصلية (بتفتح فورًا من الكاش).
- **شاشة الافتتاح (أندرويد):** `LaunchOverlay.java` — فوق الـWebView من `MainActivity.onCreate`: نفس `splash_icon`
  (240dp زي أيقونة شاشة النظام بالظبط) بتتنفّس + هالة بتنبض + «زاوية» (`res/drawable-nodpi/splash_word.png` و
  `drawable-night-nodpi` — منسوخين من `www/brand/zawya-typo*.png`) + شريط تحميل. `capacitor.config.ts`:
  `launchShowDuration: 1` (شاشة النظام الثابتة بتختفي من أول فريم). **⚠ ما تخليهاش 0 أبدًا**: إضافة SplashScreen
  بتخرج بدري لو المدة صفر ومش بتركّب شاشة أندرويد ١٢ — التطبيق بيقف على اللوجو الثابت للأبد (حصل في أول بناء 1.8). بتتقفل من الطبقة (`index.ts` `launchSequence` ←
  `ZawyaShell.hideLaunch`) لما اللوحة/التعريف تجهز، واحتياطي بعد تحميل الصفحة بـ٦ ثواني، وسقف ١٥ ثانية.
  على أندرويد الطبقة **ما بتركّبش** شاشة الافتتاح بتاعة الويب. iOS لسه بيستخدم شاشة الويب (`launch.ts`)، واللوجو فيها
  بقى بيتنفّس ولمعته بتتكرر.

## 7هـ) قفل التطبيق بالبصمة (أندرويد) — نسخة 2.0

- **Java:** `ZawyaShellPlugin.biometricStatus` و`biometricAuthenticate` (BiometricPrompt؛ أندرويد ١١+ بصمة/وش أو
  قفل الشاشة، أقدم بصمة بس بزرار «إلغاء»). المكتبة `androidx.biometric:biometric:1.1.0` في `android/app/build.gradle`.
  الرد دايمًا `resolve` بـ`{ok}` — الإلغاء مش استثناء.
- **الطبقة:** `mobile/src/layer/lock.ts` — مفتاح `zw-lock` في localStorage. بيقفل عند فتح التطبيق من جديد (`zw-unlocked`
  في sessionStorage بيمنع القفل مع كل تحميل صفحة)، وبيغطّي المحتوى لحظة الخروج، ولو الرجوع بعد أكتر من ٣٠ ثانية بيطلب
  البصمة. نافذة البصمة نفسها بتعمل pause/resume — متجاهَلة بـ`authenticating`. الغطا `z-index:45`.
- **التفعيل:** شاشة الإعدادات الأصلية ← «الأمان» ← «قفل التطبيق بالبصمة» (بيظهر بس لو الجهاز يدعم). التفعيل والإلغاء
  الاتنين محتاجين بصمة. iOS: مش مدعوم لسه (محتاج Face ID plugin).

## 8) الحالة الحالية (آخر تحديث: 2026-09-13)

- **الموقع:** آخر نشر = commit `51e8067` (رسايل الاشتراك + زرار «جدّد الاشتراك» + مسارات `/api/app/account/*`).
  اتختبر على الحي: المسارات الجديدة 403 من غير Origin، و`abandon` من غير جلسة `{"ok":true,"deleted":false}`،
  و`/api/cron/jobs` بيرجّع `subscriptions: {"expired":0,"sent":0}`. أقرب اشتراك بينتهي 2026-09-28 (matjar) — أول تذكير
  «فاضل ٧ أيام» هيتبعت يوم 2026-09-21 تقريبًا.
- **آخر نشر للموقع بعده:** commit `f20bed6` (لودرات التحليلات والشحنات المشتركة + `/api/app/analytics` و`/api/app/shipments`).
  اتختبر على الحي: المسارين الجداد 401 من غير جلسة، والصفحات 200/307 زي ما هي.
- **آخر نشر للموقع (2.6):** commit `0306005` — اتنشر لوحده. اتختبر على الحي: `/api/app/{media,blog}` = 401،
  و`blog/save` و`blog/:id/toggle` و`media/:id/rename` = 403 من غير Origin، والصفحات 200/307 زي ما هي.
- **نشر الموقع (2.5):** commit `726051c` — اتنشر لوحده. اتختبر على الحي: `marketing/{offers,bundles}/save`
  و`marketing/offers/:id/delete` و`loyalty/{tiers,wheel}` = 403 من غير Origin، و`/api/app/{marketing,loyalty}` = 401،
  والصفحات 200/307 زي ما هي.
- **نشر الموقع (2.4):** commit `e93a323` — اتنشر لوحده. اتختبر على الحي: `coupons/save` و`coupons/:id/delete`
  و`shipments/{create,dispatch}` و`shipments/:id/status` = 403 من غير Origin، و`/api/app/{marketing,shipments}` = 401،
  والصفحات 200/307 زي ما هي.
- **نشر الموقع (2.3):** commit `3a16800` — اتنشر لوحده. اتختبر على الحي: `/api/app/{loyalty,affiliates,referrals}` = 401،
  والـPOST من غير Origin = 403، والصفحات 200/307 زي ما هي.
- **نشر الموقع (2.2):** commit `7f93584` — اتنشر لوحده المرة دي. اتختبر على الحي: `/api/app/{expenses,suppliers,categories,trash}`
  = 401، والـPOST من غير Origin = 403، والصفحات 200/307 زي ما هي.
- **نشر الموقع (2.1):** commit `4cb078c` + commit فاضي `977556c` (Vercel ما نشرش الأول لوحده — حصلت مرتين، لو المسارات
  الجديدة فضلت 404 بعد ١٠ دقايق ارفع commit فاضي). اتختبر على الحي: `/api/app/{blocked,bookings,couriers}` و`products/:id/edit`
  = 401، والـPOST من غير Origin = 403، والصفحات 200/307 زي ما هي.
- **التطبيق:** آخر نسخة مبنية **2.7 (versionCode 18)** في `H:\for claude\zawya-release\zawya-2.7.apk` و`.aab`
  (البانرات بالصور من الكاميرا، الأتمتة: تشغيل/إيقاف وإشعار تجريبي — فوق 2.6: معرض الوسائط بالرفع من الكاميرا، المدوّنة بالكتابة والنشر — فوق 2.5: عروض الكمية والباقات من التطبيق، تعديل مستويات الولاء وجوايز العجلة من التطبيق — فوق 2.4: إنشاء/تعديل/حذف كوبون من التطبيق، تسجيل شحنة وتغيير حالتها والتحصيل من التطبيق — فوق 2.3: الولاء والنقاط، المسوّقون بالعمولة، حِيل صاحبك — فوق 2.2: المصروفات والأرباح، الموردون، الأقسام، سلة المهملات — فوق 2.1: تعديل منتج بالكاميرا، الحظر، المندوبون، الحجوزات —
  فوق 2.0: منتج جديد بالكاميرا، المراجعات، المرتجعات، الشكاوى، قفل البصمة — فوق 1.9: الكوبونات والمخزون والرسايل
  والاشتراك والإعدادات، وفوق 1.8: التحليلات والشحنات والهيكل الفوري وشاشة الافتتاح المتحركة). النسخة الجاية **2.8 / versionCode 19**.
- **درس من 2.6:** رفع الصور يتجرّب في المتصفح من غير كاميرا: اعمل `File` من `canvas.toBlob`، حطّه في `DataTransfer`،
  واكتب `input.files = dt.files` وابعت `change` — سيرفر التجربة بيرد على `/api/upload` برابط وهمي.
- **درس من 2.5:** سيرفر التجربة بيستورد `mock-*.mjs` بـ`import()` وNode بيحفظ الموديول — أي تعديل في ملفات الـmock
  محتاج `preview_stop` + `preview_start` عشان يبان.
- **درس من 2.4:** في سكربتات الاختبار دوّر على اللوحة المفتوحة بـ`.sheet--open` مش بنص جوّاها — لوحات شاشات تانية
  (زي «غيّر حالة الطلب») فيها نفس الكلام. وأي خطأ في ملفات `mobile/dev/mock-*.mjs` بيوقّع سيرفر التجربة كله
  (الشاشة بتقول «مش قادرين نجيب…») — شوف `preview_logs`.
- **قاعدة 2.4 للحقول الجديدة:** أي حقل اتضاف لرد موجود (زي `form` في الكوبونات و`carriers` في الشحنات) خلّيه اختياري في
  نوع التطبيق، والشاشة ترجع لـ`?web=1` لو مش موجود — عشان النسخة الجديدة تشتغل حتى لو الموقع لسه ما اتنشرش.
- **درايف `Z:`** مش بارتشن — اختصار `subst` لفولدر المشروع عشان Gradle ما يقعش من المسار العربي. صاحب المشروع لاحظه وسأل؛
  اتشرحله إنه بيختفي مع الريستارت وبيتشال بـ`subst Z: /d` من غير ما يمسح حاجة.
- **درس من 2.2:** الشاشات الأصلية المخفية بتفضل في الـDOM (`visibility:hidden`) — أي سكربت اختبار بيدوّر على زرار لازم
  يدوّر جوّه الشاشة الظاهرة بس (`[...r.querySelectorAll('.screen')].filter(s => getComputedStyle(s).visibility !== 'hidden')`)،
  وإلا بيدوس زرار في شاشة تانية مستخبية.
- **درس من 2.1:** في صفحة التجربة (`serve-www`) مفيش راوتر Next، فـ`navigate()` بيعمل تحميل كامل — أي سكربت اختبار بيدوس
  زرار بيتنقّل بيتقطع. اختبر على خطوات: دوس في سكربت، استنى، واقرا النتيجة في سكربت تاني.
- **درس من 2.1:** الأرقام جنب كلام عربي في نفس السطر لازم `<bdi dir="ltr">` — من غيرها علامة `+` بتروح آخر الرقم.
- **درس من 2.0:** أي حركة بتبدأ بـ`requestAnimationFrame` بتقف لو نافذة الـWebView مش ظاهرة (والاختبار في المتصفح
  المستخبي بيبان كأنه باظ) — لفتح لوحة بعد أول رسم استخدم `setTimeout(…, 30)`.
- **دروس من 1.9 (خليك فاكرها):**
  - الـswitch (`<span class="switch">`) جوّه `<button>` عادي بيبقى inline ومقاسه صفر والدايرة بتطير لطرف الشاشة — الزرار
    اللي حواليه لازم `display:inline-flex` (`.switch-btn`). جوّه `.switch-row` شغّال لأنه flex أصلًا.
  - أي زرار بيتداس بسرعة ورا بعض (−/+) لازم يقرا القيمة الحالية من `useRef` مش من الـstate — الضغطة التانية بتحصل قبل
    ما الـstate يتحدّث وبتضيع (اتصلّحت في `inventory.tsx` بـ`editsRef`).
  - لما نافذة التطبيق مستخبية، سكرين شوت المتصفح بيفشل — اختبر بـ`javascript_exec` جوّه `shadowRoot` بتاع `zawya-app-layer`.
- **ملحوظة محاكي:** المحاكي (swiftshader) بطيء جدًا — الـWebView ممكن ياخد دقيقة يرسم لو فيه بناء Gradle أو Next شغّال
  في نفس الوقت. جرّب التطبيق على المحاكي والجهاز فاضي، واستنى ٦٠–٩٠ ثانية قبل ما تحكم إن فيه مشكلة.
- **اتعمل:** التطبيق كامل بيفتح المنصة بلمسة تطبيق + شاشات أصلية (الرئيسية، الطلبات،
  المنتجات، العملاء، المزيد) + شعار زاوية بيودّي للوحة + إصلاح «المزيد» + إصلاح حصّة Gemini
  + اختيار الموديل يدوي/افتراضي.
- **Firebase:** مشروع `zawyaeg-1`. `google-services.json` موجود في `H:\for claude\`، وملف
  الـservice account (`zawyaeg-1-firebase-adminsdk-*.json`) موجود هناك برضو.

### إشعارات الطلبات الجديدة (Push) — اتعملت في نسخة 1.6 (commit `537568a`)

- **التطبيق:** `@capacitor/push-notifications` + `mobile/src/layer/push.ts` (قناة `orders`، طلب الإذن بعد
  دخول اللوحة، تسجيل الجهاز مرة كل تشغيل، الضغط على الإشعار بيفتح الطلب، ولو التطبيق مفتوح بتظهر رسالة
  صغيرة بزرار «افتح»، و`unregisterPush()` قبل الخروج في `more.tsx`). أيقونة الإشعار
  `res/drawable/ic_stat_zawya.xml` وإعداداتها في `AndroidManifest.xml` (+ `POST_NOTIFICATIONS`).
- `mobile/android/app/google-services.json` **مش في git** (في `.gitignore`) — قبل أي بناء محلي اتأكد إنه
  موجود، ولو مش موجود انسخه من `H:\for claude\google-services.json`. من غيره البناء بيعدّي بس الإشعارات ما تشتغلش
  (وده حال بناء GitHub Actions حاليًا).
- **الخادم:** جدول `push_devices` (migration 0035 متطبّقة) — `src/db/schema/push.ts`؛
  `src/lib/push.ts` (FCM HTTP v1 بـJWT من `node:crypto`، من غير firebase-admin؛ الصلاحية `orders.view`
  بتتقاس وقت الإرسال؛ التوكنات الميتة بتتمسح)؛ مسارات `POST /api/app/push/register` و`unregister`،
  و`GET /api/app/push/status` (بـ`Authorization: Bearer <CRON_SECRET أو jobs_cron_token من platform_settings>` —
  تشخيص من غير أسرار؛ اتجرّب على الحي ورجّع `{"configured":true,"auth":true,"project":"zawyaeg-1"}`).
  **الإشعارات اتجرّبت على موبايل صاحب المشروع وشغّالة.**
  الإرسال من `notifyTeam('order_placed')` في `src/lib/notify-team.ts`.
- **مفتاح حساب الخدمة:** متخزّن مشفّر في `platform_settings` بالمفتاح `firebase_service_account`
  بواسطة `node .scripts/set-firebase.mjs "<مسار الملف>"` (أو env `FIREBASE_SERVICE_ACCOUNT` على Vercel لو اتحط — ليه الأولوية).
- **iOS:** لسه — محتاج مفتاح APNs في Firebase + حساب Apple Developer + `GoogleService-Info.plist` وتعديل AppDelegate.

## 9) اللي لسه (بالترتيب)

1. صاحب المشروع يثبّت **2.1** ويجرّب على موبايله الحقيقي: الكاميرا (منتج جديد + تعديل منتج)، قفل البصمة، الحظر،
   المندوبين («ابعتله الرابط» بيفتح واتساب)، الحجوزات — بالبيانات الحقيقية (اتجرّبوا ببيانات وهمية بس).
2. صاحب المشروع يربط واتساب متجر الإدارة (atlosa) من «الإعدادات ← واتساب» عشان رسايل الاشتراك توصل واتساب كمان،
   ويجرّب «جدّد الاشتراك» من «إدارة المنصة» على متجر تجريبي ويتأكد الإيميل وصل الوارد.
3. الجاي في التطبيق: باقي صفحات اللوحة اللي لسه موقع — بالترتيب المقترح: الدفع `/dashboard/payments` والشحن
   `/dashboard/shipping` (إعدادات)، البوستات `/dashboard/studio/posts`، إضافة مستقبِل إشعارات من التطبيق، ثم الاستوديو
   والإضافات وواجهة المتجر (كبار — ممكن يفضلوا موقع).
4. iOS: Face ID للقفل + إشعارات APNs (محتاج حساب Apple Developer + ماك).
5. **جوجل بلاي مؤجّل** (صاحب المشروع قال مفيش ميزانية دلوقتي) — ما تفتحش الموضوع غير لو طلبه.
