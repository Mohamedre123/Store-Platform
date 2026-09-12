@AGENTS.md

# تطبيق الموبايل — اقرا ده قبل ما تعدّل

المشروع ده فيه **الموقع والتطبيق مع بعض**. التطبيق (أندرويد وiOS) في مجلد `mobile/`،
وبيفتح المنصة الحيّة نفسها وفوقها شاشات أصلية. تفاصيله كلها في `mobile/README.md`.

## ملفات بيقرا منها الموقع والتطبيق مع بعض

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
| `src/app/dashboard/orders/actions.ts` و `confirm-actions.ts` | أزرار الطلب | `/api/app/orders/[id]/status|note|confirm` بتناديهم |
| `src/app/dashboard/products/actions.ts` (`toggleProductStatusAction` و `deleteProductAction`) | أزرار المنتج | `/api/app/products/[id]/status|delete` بتناديهم |

## القواعد

- **ما تمسحش ولا تغيّر اسم** أي مسار تحت `src/app/api/app/` — التطبيق المتسطّب على موبايلات
  التجّار بيناديه، ومش كل الناس بتحدّث التطبيق.
- **إضافة** حقل جديد للرد آمنة دايمًا. **حذف** أو **تغيير** حقل موجود = شاشة التطبيق تتعدّل
  في نفس التعديل.
- صفحات اللوحة اللي **مالهاش** شاشة أصلية بتظهر في التطبيق زي ما هي — تعديلها بيوصل للتطبيق
  لوحده من غير أي شغل.
- التعديل على أي شاشة في `mobile/src/` محتاج نسخة جديدة من التطبيق (`mobile/README.md`).
- قبل الرفع: `npx tsc --noEmit` للموقع، و`npm run typecheck` جوّه `mobile/`.
- **الريبوهات:** `origin` (Store-Platform) = الموقع الحي على Vercel — أي رفع عليه بينشر.
  `zawyaapk` = نسخة التطبيق. نفس الكود في الاتنين.
