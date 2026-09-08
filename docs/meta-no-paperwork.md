# ميتا من غير ورق — الطريق الكامل

الملف ده بيشرح إزاي تشغّل النشر التلقائي على فيسبوك وإنستجرام
**من غير سجل تجاري ولا بطاقة ضريبية ولا مراجعة**.

---

## القاعدة اللي كل حاجة مبنية عليها

ميتا عندها مستويين وصول:

| | مين يقدر يستخدمه | محتاج إيه |
|---|---|---|
| **Standard Access** | أي حد **ليه دور في تطبيقك** (أدمن · مطوّر · **تيستر**) | **لا شيء** — بيتوافَق عليه تلقائيًا |
| **Advanced Access** | أي حد في الدنيا | مراجعة + توثيق نشاط تجاري |

ده كلام ميتا نفسها في توثيقها:

> Standard Access is automatically approved for all permissions and
> features available to their app type. **No App Review or Business
> Verification required.**

**يعني `pages_manage_posts` و`instagram_content_publish` شغّالين
عندك دلوقتي بالفعل** — لأي تاجر تضيفه تيستر.

---

## ⛔ اللي ما تدوسوش أبدًا

دي الأزرار اللي بتوديك على شاشة الورق. لو دُست واحد منهم، اخرج
منه من غير ما تكمّل — مفيش حاجة بتتقفل، بس **ما تكمّلش**:

| الزرار | مكانه | بيوديك لفين |
|---|---|---|
| **Verify business** أو **Start verification** | Business Settings ← Security Center | طلب سجل تجاري وبطاقة ضريبية |
| **Submit for review** | App Review ← Requests | مراجعة بفيديو ومستندات |
| **Request advanced access** | App Review ← Permissions | نفس المراجعة |
| **Switch to Live** أو المفتاح فوق | رأس الداشبورد | بيطلب التوثيق عشان يشتغل |
| **Get advanced access** | جنب أي صلاحية | نفس الحكاية |

> **التطبيق لازم يفضل في وضع `Development`.** ده مش عيب ولا نقص —
> ده بالظبط الوضع اللي بيخلّي Standard Access شغّال. التحويل
> لـ`Live` من غير مراجعة بيوقّف حتى التيسترز.

---

## ✅ الطريق الصح — خطوة بخطوة

### خطوة ١ — التطبيق

`developers.facebook.com` ← **My Apps** ← **Create App**

- **اسم التطبيق**: `زاوية`
- **بريد التواصل**: بريدك
- لو سألك عن **Use case**: اختار **Other**
- لو سألك عن **App type**: اختار **Business**
- لو طلب **Business portfolio**: اختار اللي عندك أو
  **I don't want to connect a business portfolio now**

> لو أجبرك تختار Business portfolio، اختار أي واحد. **الربط
> بالمحفظة مش نفسه التوثيق** — التوثيق خطوة تانية إنت اللي بتبدأها.

### خطوة ٢ — المفتاحين

**App settings** ← **Basic**

| الحقل | بيروح لـ |
|---|---|
| **App ID** | `META_APP_ID` |
| **App secret** ← اضغط **Show** | `META_APP_SECRET` |

### خطوة ٣ — الروابط في نفس الصفحة

```
Privacy Policy URL:   https://www.zawyaeg.site/privacy
Terms of Service URL: https://www.zawyaeg.site/terms
User Data Deletion:   https://www.zawyaeg.site/data-deletion
App Domains:          zawyaeg.site
Category:             Business and Pages
```

**Save changes**

> الروابط دي مطلوبة في الحقول بس — **مش بتشغّل أي مراجعة**.

### خطوة ٤ — تسجيل الدخول

**Add product** ← **Facebook Login for Business** ← **Set up**

بعدها: **Facebook Login for Business** ← **Settings** ← في
**Valid OAuth Redirect URIs**:

```
https://www.zawyaeg.site/api/social/callback
```

**Save changes**

> هتشوف بانر أحمر أو أصفر بيقول «Business verification required to
> go live» أو «Advanced access required». **تجاهله.** هو بيتكلم عن
> الـLive، وإحنا مش رايحين هناك.

### خطوة ٥ — الصلاحيات (من غير طلب مراجعة)

**App Review** ← **Permissions and Features**

هتلاقي قايمة طويلة. جنب كل صلاحية عمودين:

- **Standard Access** ← ✅ **دي اللي عايزينها**
- **Advanced Access** ← ⛔ ما تطلبهاش

دوّر على الخمسة دول وتأكد إن **Standard Access** مكتوب جنبهم
**Ready to use** أو **Granted**:

```
pages_show_list
pages_manage_posts
pages_read_engagement
instagram_basic
instagram_content_publish
```

**غالبًا هتلاقيهم متاحين خلاص من غير ما تعمل حاجة** — ده معنى
«بيتوافَق عليه تلقائيًا».

> لو لقيت واحدة مش متاحة في Standard، فيه زرار **Get Standard
> Access** — دوسه. ده **مش** طلب مراجعة، ده تفعيل فوري.

### خطوة ٦ — Vercel

**Settings** ← **Environment Variables** ← ضيف اتنين على
**Production**:

```
META_APP_ID
META_APP_SECRET
```

وبعدها **Deployments** ← آخر واحد ← **Redeploy**.

---

## تشغيل تاجر

### إنت بتعمل (دقيقتين)

1. تطبيقك ← **App roles** ← **Roles**
2. **Add people**
3. اختار **Tester**
4. اكتب اسم التاجر على فيسبوك أو بريده
5. **Add**

### والتاجر بيعمل (دقيقة)

1. يفتح `developers.facebook.com/requests`
2. يلاقي دعوة باسم تطبيقك ← **Confirm**
3. يرجع للوحته ← **التسويق ← حسابات السوشيال** ← **اربط**
4. يوافق على الشاشة

**وخلاص — من هنا كل حاجة تلقائية.**

---

## لو التاجر عايز إنستجرام كمان

إنستجرام ليه قايمة تيسترز منفصلة:

1. تطبيقك ← **App roles** ← **Roles** ← انزل تحت لـ
   **Instagram Testers**
2. **Add Instagram Testers** ← اكتب اسم المستخدم بتاعه
3. التاجر يفتح **تطبيق إنستجرام** ← الإعدادات ← **Website
   permissions** ← **Tester invites** ← **Accept**

> والحد هنا **٢٥ حساب إنستجرام**. ده الرقم الوحيد اللي ميتا
> بتحدّده صراحةً — فيسبوك مالوش حد منشور.

---

## الشاشات اللي هتخوّفك (وهي مش مشكلة)

| اللي هيظهر | معناه | تعمل إيه |
|---|---|---|
| بانر «Business verification required» | بيتكلم عن الـLive | تجاهله |
| «This app is in development mode» | ده وضعنا الصح | تجاهله |
| «Advanced access required for public use» | للناس اللي مش تيسترز | تجاهله |
| صفحة بتطلب سجل تجاري | إنت دخلت على Verification | اخرج من غير ما تكمّل |
| «App not active» عند التاجر | مش متضاف تيستر | ضيفه من App roles |
| «Insufficient developer role» | نفس الحكاية | نفس الحل |

---

## لو حاجة فضلت واقفة

ابعت **صورة الشاشة** اللي واقف عندها. أغلب المشاكل بتكون:

- التاجر **ما قبلش** دعوة التيستر
- حساب إنستجرام **مش أعمال** أو مش مربوط بصفحة فيسبوك
- الـRedirect URI مكتوب بحرف غلط
- التطبيق اتحوّل لـ**Live** بالغلط ← رجّعه **Development**

---

## وامتى تحتاج الورق فعلًا

لما تعدّي حدود التيسترز — يعني **لما يكون عندك عشرات التجّار
بيستخدموا الميزة فعلًا**. ساعتها:

- هتكون عارف إن الميزة تستاهل
- وهتكون محتاج السجل التجاري برضو لبوابات الدفع (باي موب وفوري
  كلهم بيطلبوه)

فمش مصروف زيادة على الميزة دي وحدها — بس مؤجَّل لحد ما يستاهل.
