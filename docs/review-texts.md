# نصوص المراجعة — انسخ والزق

الملف ده فيه الكلام اللي ميتا وتيك توك بيطلبوه بالإنجليزي جاهز.
اقراه وغيّر أي حاجة مش مظبوطة، وبعدين الزقه في الخانة.

---

## أولًا: ميتا — إنت **مش** محتاج مراجعة دلوقتي

الشاشة اللي طلبت منك توثيق وسجل تجاري دي بتظهر لما تدوس
**Submit for review** أو **Verify business**. **ما تدوسهاش.**

أول ٢٥ تاجر بيشتغلوا بـ**Standard Access** — من غير مراجعة ولا
توثيق. اللي تعمله:

1. سيب طلب المراجعة زي ما هو، **ما تكمّلوش**
2. من القايمة الشمال: **App roles** ← **Roles**
3. **Add people** ← **Tester** ← اسم التاجر على فيسبوك
4. التاجر يقبل من `developers.facebook.com/requests`

وبعدها بيربط وينشر تلقائي بالكامل. المراجعة والسجل التجاري بتحتاجهم
**لما تعدّي ٢٥ تاجر بس**.

> **مهم:** لازم يكون التطبيق في وضع **Development** (فوق في
> الداشبورد). ما تحوّلوش لـ**Live** قبل المراجعة — الـLive من غير
> موافقة بيوقّف حتى التيسترز.

---

## ثانيًا: تيك توك — تأكيد الدومين

سجل الـTXT بتاعك **موجود وشغّال** على الجذر:

```
tiktok-developers-site-verification=ucIzcMo1t37FtsugwOzGOK1lnjxrHoqg
```

فلو لسه بيقول «We couldn't find your verification signature»، السبب
واحد من التلاتة دول:

### ١. إنت بتتحقّق من `www` والسجل على الجذر

في تيك توك، الدومين لازم يتكتب **من غير `www`**:

```
zawyaeg.site        ✅
www.zawyaeg.site    ❌
https://zawyaeg.site ❌
```

### ٢. اخترت طريقة تانية غير DNS

تيك توك بيدّي تلات طرق: **DNS TXT** و**ملف HTML** و**وسم meta**.
إنت حطّيت TXT — فلازم تكون مختار **DNS** في الشاشة، مش الملف.

### ٣. الانتشار

السجل ظاهر دلوقتي على DNS جوجل، بس سيرفرات تيك توك ممكن تكون لسه
شايفة القديم. **استنّى ساعة ودوس Verify تاني.**

> لو فضلت فاشلة بعد ساعة: امسح السجل وضيفه تاني، وخلّي الـ**Name**
> فاضي أو `@` (مش `zawyaeg.site` ولا `www`).

---

## ثالثًا: شرح الصلاحيات لتيك توك

الخانة: *«Explain how each product and scope works within your app
or website»*

انسخ ده:

```
Zawya (zawyaeg.site) is an e-commerce platform that lets small
merchants in Egypt create and run online stores. Merchants manage
their products, orders, shipping and marketing from a single
dashboard.

We are integrating the Content Posting API so that a merchant can
publish marketing content about their own products directly to
their own TikTok account, without leaving our dashboard.

--- HOW EACH SCOPE IS USED ---

1) user.info.basic

We call this scope once, immediately after the merchant connects
their TikTok account. We use it only to read the account's display
name and avatar so we can show the merchant which account is
connected in our dashboard (for example: "Connected: @mystore").

This prevents a merchant who owns several TikTok accounts from
posting to the wrong one. We do not read, store or analyse any
other profile data, and we never display this information to
anyone except the merchant who connected the account.

2) video.publish

This is the core of the integration. The merchant creates a post
inside our Content Studio: they pick one of their own products,
our tool generates a marketing image or a short video plus the
caption, and the merchant reviews and edits it.

When the merchant presses "Publish" — or when a schedule they
configured themselves runs — we call the Content Posting API to
publish that content to their own TikTok account.

All media is hosted on our own verified domain
(zawyaeg.site) and is pulled by TikTok using PULL_FROM_URL.

We never post without an explicit action by the merchant: either
a direct click, or a recurring schedule that the merchant created,
reviewed and can pause or delete at any moment from the dashboard.

--- WHAT WE DO NOT DO ---

- We do not read, download or repost other users' content.
- We do not access followers, comments, messages or analytics.
- We do not post to any account other than the one the merchant
  personally connected via TikTok Login.
- We do not share tokens with third parties. Access tokens are
  encrypted at rest (AES-256-GCM) and used only for that
  merchant's own publishing.

--- DATA HANDLING ---

Privacy Policy: https://www.zawyaeg.site/privacy
Terms of Service: https://www.zawyaeg.site/terms
Data Deletion: https://www.zawyaeg.site/data-deletion

A merchant can disconnect their TikTok account at any time from
Marketing > Social Accounts in our dashboard. Disconnecting
immediately deletes the stored access token and cancels any
scheduled posts targeting that account.
```

---

## رابعًا: الفيديو التوضيحي لتيك توك

الخانة: *«Upload at least one demo video that shows the complete
end-to-end flow»*

سجّل شاشتك (أي برنامج تسجيل شاشة، أو `Win + G` في ويندوز).
**من دقيقة لتلاتة**، وبالترتيب ده بالظبط:

| # | تعمل إيه | ليه |
|---|---|---|
| ١ | افتح `zawyaeg.site` وسجّل دخول للوحة | بيوري إن الموقع حقيقي |
| ٢ | روح **التسويق ← حسابات السوشيال** | بيوري مكان الربط |
| ٣ | دوس **اربط** جنب تيك توك | بيبدأ الرحلة |
| ٤ | **ورّي شاشة موافقة تيك توك كاملة** واقرا الصلاحيات | ⭐ دي أهم لقطة |
| ٥ | وافق، وارجع للوحة وورّي الحساب اتربط | بيوري نجاح الربط |
| ٦ | روح **استوديو المحتوى**، اختار منتج، اعمل صورة وكونتنت | بيوري المحتوى بيتعمل منين |
| ٧ | اختار حساب تيك توك ودوس **انشر** | الاستخدام الفعلي للصلاحية |
| ٨ | **افتح تيك توك وورّي البوست نزل** | ⭐ دي تانية أهم لقطة |
| ٩ | ارجع لحسابات السوشيال ودوس **فصل** | بيوري إن التاجر متحكّم |

**نصايح بتفرق:**

- **من غير صوت مشكلة؟** لأ، بس الأحسن تتكلم بالإنجليزي وتشرح كل
  خطوة. لو مش مرتاح، حطّ **ترجمة مكتوبة** على الشاشة.
- **ما تقصّش الفيديو.** لقطة واحدة متصلة من أول تسجيل الدخول لآخر
  البوست. القص بيخلّيهم يشكّوا.
- **الحساب لازم يكون حقيقي** — حساب تيك توك فعلي وبوست فعلي نزل
  عليه.
- ارفعه على **يوتيوب (Unlisted)** أو جوجل درايف بصلاحية «أي حد
  عنده الرابط»، والزق الرابط.

---

## خامسًا: نفس الفيديو بيصلح لميتا

لما توصل ٢٥ تاجر وتقدّم مراجعة ميتا، هيطلبوا نفس الحاجة — سجّل
نسخة تانية بنفس الترتيب بس بفيسبوك وإنستجرام.

ولكل صلاحية بيطلبوا شرح، الزق ده وغيّر اسم الصلاحية:

```
pages_show_list
We use this to display the list of Facebook Pages the merchant
administers, so they can choose which Page to publish to. Without
it the merchant cannot select a destination for their posts.

pages_manage_posts
The merchant creates marketing content about their own products
inside our Content Studio and publishes it to their own Facebook
Page, either immediately or on a schedule they configured. This
permission performs that publish.

pages_read_engagement
We use this only to confirm the merchant has an admin role on the
Page before we attempt to publish, so we can show a clear error
instead of a failed post.

instagram_basic
We use this to identify the Instagram Business account linked to
the merchant's Page and show its username in our dashboard, so the
merchant knows which account they are publishing to.

instagram_content_publish
This publishes the merchant's own marketing image, carousel or
Reel to their own Instagram Business account, on their explicit
action or on their own schedule.

business_management
Required to read the Page-to-Instagram link so publishing to
Instagram works. We do not manage or modify any business assets.
```

---

## ملخّص: إيه اللي تعمله دلوقتي

| | ميتا | تيك توك |
|---|---|---|
| المفاتيح | ✅ عندك | ✅ عندك |
| الصفحات القانونية | الزقها في **Basic** | الزقها في إعدادات التطبيق |
| Redirect URI | `https://www.zawyaeg.site/api/social/callback` | نفسه |
| تأكيد الدومين | مش مطلوب | ⏳ استنّى ساعة ودوس Verify |
| المراجعة | ❌ **ما تقدّمهاش** — استخدم Testers | ⏳ قدّم بالنصوص فوق |
| الحد | ٢٥ تاجر | مسوّدات لحد ما التدقيق يخلص |

وحطّ الأربع متغيّرات في **Vercel ← Settings ← Environment
Variables** وأعد الديبلوي.
