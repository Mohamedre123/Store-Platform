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

- اكتب ملف SQL يدوي: `drizzle/00NN_name.sql` (آخر رقم حاليًا **0034**)، والجمل مفصولة بـ
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
5. سجّلها في `shell/index.tsx` (regex للمسار) وستايلها في `styles-<x>.ts`.
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

## 8) الحالة الحالية (آخر تحديث: 2026-09-13)

- **الموقع:** آخر نشر = commit `e3fff92` (اختيار الموديل). شغّال ومتختبر.
- **التطبيق:** آخر نسخة مبنية **1.5 (versionCode 6)** في `H:\for claude\zawya-release\zawya-1.5.apk`
  و`.aab`. النسخة الجاية **1.6 / versionCode 7**.
- **اتعمل:** التطبيق كامل بيفتح المنصة بلمسة تطبيق + شاشات أصلية (الرئيسية، الطلبات،
  المنتجات، العملاء، المزيد) + شعار زاوية بيودّي للوحة + إصلاح «المزيد» + إصلاح حصّة Gemini
  + اختيار الموديل يدوي/افتراضي.
- **Firebase:** مشروع `zawyaeg-1`. `google-services.json` موجود في `H:\for claude\`، وملف
  الـservice account (`zawyaeg-1-firebase-adminsdk-*.json`) موجود هناك برضو.

## 9) اللي لسه (بالترتيب)

1. **إشعارات الطلبات الجديدة (Push)** — شغّال عليها دلوقتي. التصميم:
   - `@capacitor/push-notifications` في `mobile/`، و`google-services.json` في `mobile/android/app/`
     (ملف عام مش سرّي، بس ما يترفعش لو فيه قلق — مسموح في git عادةً).
   - جدول `push_devices` (user/store/token/platform) + `POST /api/app/push/register` و`unregister`.
   - الإرسال عبر FCM HTTP v1 (JWT من الـservice account في env `FIREBASE_SERVICE_ACCOUNT` على Vercel)
     من `notifyTeam` في `src/lib/notify-team.ts` عند `order_placed`.
   - الضغط على الإشعار يفتح `/dashboard/orders/<id>` في التطبيق.
   - نسخة التطبيق 1.6 وابعتها.
2. صاحب المشروع يجرّب: يختار موديل صور مستقر في الإضافات، يعدّل جدول «بوست يومي»، يضغط «جرّبه».
3. شاشات أصلية تانية: التحليلات، التسويق، الشحن، الإعدادات، وإضافة/تعديل منتج بالكاميرا.
4. قفل بالبصمة.
5. الرفع على جوجل بلاي (حساب مطوّر 25$ — هو اللي يعمله) و App Store (حساب Apple + ماك).
