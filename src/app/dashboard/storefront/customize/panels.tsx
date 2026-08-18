'use client'

import { Plus, Trash2 } from 'lucide-react'
import { nanoid } from 'nanoid'
import type { Customization, PanelKey } from '@/lib/customization'
import { FONT_LABELS } from '@/lib/customization'
import {
  Choice,
  ColorField,
  Group,
  NumberField,
  TextField,
  Toggle,
} from '@/components/dashboard/controls'
import { ImageUpload } from '@/components/ui/image-upload'
import { ImageSpecHint } from '../section-editor'

type Patch = <K extends PanelKey>(panel: K, values: Partial<Customization[K]>) => void

const RADIUS_OPTIONS = [
  { value: 'none' as const, label: 'حادة' },
  { value: 'sm' as const, label: 'خفيفة' },
  { value: 'md' as const, label: 'متوسطة' },
  { value: 'lg' as const, label: 'دائرية' },
  { value: 'full' as const, label: 'كاملة' },
]

const FONT_OPTIONS = (Object.keys(FONT_LABELS) as Array<keyof typeof FONT_LABELS>).map((k) => ({
  value: k,
  label: FONT_LABELS[k],
}))

export function Panel({
  panel,
  value,
  patch,
}: {
  panel: PanelKey
  value: Customization
  patch: Patch
}) {
  /* ══════════════════ الهوية ══════════════════ */
  if (panel === 'identity') {
    const s = value.identity
    return (
      <>
        <Group title="الألوان">
          <ColorField
            label="اللون الأساسي"
            hint="لون الأزرار والأسعار والروابط. ده اللي العميل هيفتكره."
            value={s.primary}
            onChange={(v) => patch('identity', { primary: v })}
          />
          <ColorField
            label="اللون المساعد"
            hint="للشارات والتفاصيل الصغيرة."
            value={s.accent}
            onChange={(v) => patch('identity', { accent: v })}
          />
          <ColorField
            label="خلفية الصفحة"
            value={s.background}
            onChange={(v) => patch('identity', { background: v })}
          />
          <ColorField
            label="خلفية البطاقات"
            hint="لو خليتها بيضا على خلفية فاتحة، البطاقات هتختفي. خلّي بينهم فرق."
            value={s.surface}
            onChange={(v) => patch('identity', { surface: v })}
          />
          <ColorField
            label="لون النص"
            value={s.text}
            onChange={(v) => patch('identity', { text: v })}
          />
        </Group>

        <Group title="الشكل">
          <Choice
            label="حواف العناصر"
            value={s.radius}
            options={RADIUS_OPTIONS}
            onChange={(v) => patch('identity', { radius: v })}
            columns={5}
          />
          <Choice
            label="خط العناوين"
            value={s.fontHeading}
            options={FONT_OPTIONS}
            onChange={(v) => patch('identity', { fontHeading: v })}
            columns={3}
          />
          <Choice
            label="خط النصوص"
            value={s.fontBody}
            options={FONT_OPTIONS}
            onChange={(v) => patch('identity', { fontBody: v })}
            columns={3}
          />
        </Group>

        <Group title="الشعار">
          <ImageSpecHint specKey="logo" />
          <ImageUpload
            label="شعار الوضع الفاتح"
            value={s.logoLight ? [s.logoLight] : []}
            onChange={(urls) => patch('identity', { logoLight: urls[0] ?? null })}
            folder="logos"
          />
          <ImageUpload
            label="شعار الوضع الداكن"
            value={s.logoDark ? [s.logoDark] : []}
            onChange={(urls) => patch('identity', { logoDark: urls[0] ?? null })}
            folder="logos"
          />
          <ImageSpecHint specKey="favicon" />
          <ImageUpload
            label="أيقونة المتصفح"
            value={s.favicon ? [s.favicon] : []}
            onChange={(urls) => patch('identity', { favicon: urls[0] ?? null })}
            folder="logos"
          />
          <Toggle
            label="إخفاء اسم المتجر جنب الشعار"
            hint="فعّلها لو شعارك فيه الاسم مكتوب أصلًا."
            checked={s.hideNameInHeader}
            onChange={(v) => patch('identity', { hideNameInHeader: v })}
          />
        </Group>
      </>
    )
  }

  /* ══════════════════ شريط الإعلان ══════════════════ */
  if (panel === 'announcement') {
    const s = value.announcement
    return (
      <>
        <Group>
          <Toggle
            label="تشغيل الشريط"
            checked={s.enabled}
            onChange={(v) => patch('announcement', { enabled: v })}
          />
        </Group>

        {s.enabled && (
          <>
            <Group title="المحتوى">
              <TextField
                label="النص"
                value={s.text}
                onChange={(v) => patch('announcement', { text: v })}
                placeholder="شحن مجاني للطلبات فوق ١٠٠٠ جنيه"
              />
              <TextField
                label="الرابط"
                hint="اختياري — لو حطيته الشريط يبقى قابل للضغط."
                value={s.link}
                onChange={(v) => patch('announcement', { link: v })}
                placeholder="/products"
                ltr
              />
            </Group>

            <Group title="الشكل">
              <ColorField
                label="لون الخلفية"
                value={s.background}
                onChange={(v) => patch('announcement', { background: v })}
              />
              <ColorField
                label="لون النص"
                value={s.color}
                onChange={(v) => patch('announcement', { color: v })}
              />
              <Toggle
                label="يقدر العميل يقفله"
                checked={s.dismissible}
                onChange={(v) => patch('announcement', { dismissible: v })}
              />
              <Toggle
                label="يفضل ثابت مع التمرير"
                checked={s.sticky}
                onChange={(v) => patch('announcement', { sticky: v })}
              />
            </Group>
          </>
        )}
      </>
    )
  }

  /* ══════════════════ الهيدر ══════════════════ */
  if (panel === 'header') {
    const s = value.header
    return (
      <>
        <Group title="التخطيط">
          <Choice
            label="شكل الهيدر"
            value={s.layout}
            options={[
              { value: 'top', label: 'كلاسيكي' },
              { value: 'centered', label: 'الشعار في النص' },
              { value: 'split', label: 'مقسوم' },
            ]}
            onChange={(v) => patch('header', { layout: v })}
          />
          <NumberField
            label="ارتفاع الشعار"
            value={s.logoHeight}
            onChange={(v) => patch('header', { logoHeight: v })}
            min={24}
            max={72}
            suffix="بكسل"
          />
          <Toggle
            label="يفضل ثابت مع التمرير"
            hint="بيسهّل الوصول للسلة في أي وقت."
            checked={s.sticky}
            onChange={(v) => patch('header', { sticky: v })}
          />
        </Group>

        <Group title="الأدوات">
          <Toggle label="البحث" checked={s.showSearch} onChange={(v) => patch('header', { showSearch: v })} />
          <Toggle label="السلة" checked={s.showCart} onChange={(v) => patch('header', { showCart: v })} />
          <Toggle label="حساب العميل" checked={s.showAccount} onChange={(v) => patch('header', { showAccount: v })} />
          <Toggle label="المفضّلة" checked={s.showWishlist} onChange={(v) => patch('header', { showWishlist: v })} />
          <Toggle
            label="شريط الأقسام"
            hint="صف أفقي بالأقسام تحت الهيدر."
            checked={s.showCategoriesBar}
            onChange={(v) => patch('header', { showCategoriesBar: v })}
          />
        </Group>
      </>
    )
  }

  /* ══════════════════ البانر الرئيسي ══════════════════ */
  if (panel === 'hero') {
    const s = value.hero
    const setSlide = (id: string, values: Partial<(typeof s.slides)[number]>) =>
      patch('hero', { slides: s.slides.map((sl) => (sl.id === id ? { ...sl, ...values } : sl)) })

    return (
      <>
        <Group title="التخطيط">
          <Choice
            label="شكل البانر"
            value={s.style}
            options={[
              { value: 'fullbleed', label: 'بملء الشاشة' },
              { value: 'boxed', label: 'داخل حاوية' },
              { value: 'split', label: 'نصين' },
              { value: 'stacked', label: 'مع الأقسام' },
              { value: 'none', label: 'بلا بانر' },
            ]}
            onChange={(v) => patch('hero', { style: v })}
            columns={3}
          />
          {s.style !== 'none' && (
            <Choice
              label="الارتفاع"
              value={s.height}
              options={[
                { value: 'sm', label: 'قصير' },
                { value: 'md', label: 'متوسط' },
                { value: 'lg', label: 'طويل' },
                { value: 'full', label: 'ملء الشاشة' },
              ]}
              onChange={(v) => patch('hero', { height: v })}
              columns={4}
            />
          )}
        </Group>

        {s.style !== 'none' && (
          <>
            {s.slides.length > 1 && (
              <Group title="التبديل التلقائي">
                <Toggle
                  label="تبديل الشرائح تلقائيًا"
                  checked={s.autoplay}
                  onChange={(v) => patch('hero', { autoplay: v })}
                />
                {s.autoplay && (
                  <NumberField
                    label="المدة بين الشرائح"
                    value={s.intervalSeconds}
                    onChange={(v) => patch('hero', { intervalSeconds: v })}
                    min={3}
                    max={20}
                    suffix="ثانية"
                  />
                )}
              </Group>
            )}

            <Group title="الشرائح">
              <ImageSpecHint specKey="heroDesktop" />
              <ImageSpecHint specKey="heroMobile" />

              {s.slides.map((slide, i) => (
                <div key={slide.id} className="flex flex-col gap-4 rounded-lg border border-[var(--border)] p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">الشريحة {i + 1}</span>
                    <button
                      type="button"
                      onClick={() => patch('hero', { slides: s.slides.filter((x) => x.id !== slide.id) })}
                      aria-label={`حذف الشريحة ${i + 1}`}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>

                  <ImageUpload
                    label="صورة الكمبيوتر"
                    value={slide.imageDesktop ? [slide.imageDesktop] : []}
                    onChange={(urls) => setSlide(slide.id, { imageDesktop: urls[0] ?? null })}
                    folder="banners"
                  />
                  <ImageUpload
                    label="صورة الموبايل"
                    value={slide.imageMobile ? [slide.imageMobile] : []}
                    onChange={(urls) => setSlide(slide.id, { imageMobile: urls[0] ?? null })}
                    folder="banners"
                  />

                  <TextField label="العنوان" value={slide.title} onChange={(v) => setSlide(slide.id, { title: v })} />
                  <TextField
                    label="الوصف"
                    value={slide.subtitle}
                    onChange={(v) => setSlide(slide.id, { subtitle: v })}
                  />
                  <TextField
                    label="نص الزر"
                    value={slide.ctaLabel}
                    onChange={(v) => setSlide(slide.id, { ctaLabel: v })}
                    placeholder="تسوّق دلوقتي"
                  />
                  <TextField
                    label="رابط الزر"
                    value={slide.ctaUrl}
                    onChange={(v) => setSlide(slide.id, { ctaUrl: v })}
                    placeholder="/products"
                    ltr
                  />
                  <Choice
                    label="مكان النص"
                    value={slide.textPosition}
                    options={[
                      { value: 'start', label: 'يمين' },
                      { value: 'center', label: 'النص' },
                      { value: 'end', label: 'شمال' },
                    ]}
                    onChange={(v) => setSlide(slide.id, { textPosition: v })}
                  />
                  <NumberField
                    label="تعتيم الصورة"
                    hint="زوّده لو النص مش واضح فوق الصورة."
                    value={slide.overlay}
                    onChange={(v) => setSlide(slide.id, { overlay: v })}
                    min={0}
                    max={80}
                    suffix="%"
                  />
                </div>
              ))}

              <button
                type="button"
                onClick={() =>
                  patch('hero', {
                    slides: [
                      ...s.slides,
                      {
                        id: nanoid(8),
                        imageDesktop: null,
                        imageMobile: null,
                        title: '',
                        subtitle: '',
                        ctaLabel: 'تسوّق دلوقتي',
                        ctaUrl: '/products',
                        textPosition: 'start' as const,
                        overlay: 30,
                      },
                    ],
                  })
                }
                className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border-strong)] text-sm font-medium text-[var(--fg-muted)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                إضافة شريحة
              </button>

              {s.slides.length === 0 && (
                <p className="text-xs text-[var(--fg-subtle)]">
                  من غير شرائح، البانر هيعرض اسم متجرك ووصفه على خلفية بلون الهوية.
                </p>
              )}
            </Group>
          </>
        )}
      </>
    )
  }

  /* ══════════════════ صفحة المنتجات ══════════════════ */
  if (panel === 'listing') {
    const s = value.listing
    return (
      <>
        <Group title="الشبكة">
          <Choice
            label="أعمدة الكمبيوتر"
            value={s.columnsDesktop}
            options={[
              { value: 2 as const, label: '٢' },
              { value: 3 as const, label: '٣' },
              { value: 4 as const, label: '٤' },
              { value: 5 as const, label: '٥' },
            ]}
            onChange={(v) => patch('listing', { columnsDesktop: v })}
            columns={4}
          />
          <Choice
            label="أعمدة الموبايل"
            hint="عمودين بيعرضوا منتجات أكتر، وعمود واحد بيكبّر الصورة."
            value={s.columnsMobile}
            options={[
              { value: 1 as const, label: 'عمود' },
              { value: 2 as const, label: 'عمودين' },
            ]}
            onChange={(v) => patch('listing', { columnsMobile: v })}
            columns={2}
          />
          <Choice
            label="شكل البطاقة"
            value={s.cardStyle}
            options={[
              { value: 'clean', label: 'نظيفة' },
              { value: 'framed', label: 'بإطار' },
              { value: 'overlay', label: 'نص فوق الصورة' },
              { value: 'editorial', label: 'واسعة' },
              { value: 'compact', label: 'صف أفقي' },
            ]}
            onChange={(v) => patch('listing', { cardStyle: v })}
            columns={3}
          />
          <Choice
            label="نسبة الصورة"
            value={s.imageRatio}
            options={[
              { value: 'square', label: 'مربّعة' },
              { value: 'portrait', label: 'طولية' },
              { value: 'wide', label: 'عريضة' },
            ]}
            onChange={(v) => patch('listing', { imageRatio: v })}
          />
          <NumberField
            label="منتجات في الصفحة"
            value={s.perPage}
            onChange={(v) => patch('listing', { perPage: v })}
            min={8}
            max={60}
          />
        </Group>

        <Group title="الأدوات">
          <Toggle label="فلتر الأقسام" checked={s.showCategoryFilter} onChange={(v) => patch('listing', { showCategoryFilter: v })} />
          <Toggle label="الترتيب" checked={s.showSort} onChange={(v) => patch('listing', { showSort: v })} />
          <Toggle label="التقييم على البطاقة" checked={s.showRating} onChange={(v) => patch('listing', { showRating: v })} />
          <Toggle
            label="إضافة سريعة للسلة"
            hint="زر إضافة على البطاقة من غير فتح صفحة المنتج."
            checked={s.showQuickAdd}
            onChange={(v) => patch('listing', { showQuickAdd: v })}
          />
        </Group>
      </>
    )
  }

  /* ══════════════════ صفحة المنتج ══════════════════ */
  if (panel === 'productPage') {
    const s = value.productPage
    return (
      <>
        <Group title="المعرض">
          <Choice
            label="ترتيب الصور"
            value={s.galleryLayout}
            options={[
              { value: 'thumbs-bottom', label: 'مصغّرات تحت' },
              { value: 'thumbs-side', label: 'مصغّرات جنب' },
              { value: 'stacked', label: 'فوق بعض' },
            ]}
            onChange={(v) => patch('productPage', { galleryLayout: v })}
          />
        </Group>

        <Group title="المعروض">
          <Toggle label="كود المنتج (SKU)" checked={s.showSku} onChange={(v) => patch('productPage', { showSku: v })} />
          <Toggle
            label="عدّاد الكمية المتبقية"
            hint="«باقي ٣ بس» — بيخلق إحساس بالاستعجال، بس ما يتفعّلش لو مخزونك دايمًا قليل."
            checked={s.showStockCounter}
            onChange={(v) => patch('productPage', { showStockCounter: v })}
          />
          <Toggle label="ملاحظة الشحن" checked={s.showShippingNote} onChange={(v) => patch('productPage', { showShippingNote: v })} />
          <Toggle label="ملاحظة الإرجاع" checked={s.showReturnNote} onChange={(v) => patch('productPage', { showReturnNote: v })} />
          <Toggle label="زر السؤال على واتساب" checked={s.showWhatsappAsk} onChange={(v) => patch('productPage', { showWhatsappAsk: v })} />
          <Toggle
            label="شريط شراء ثابت على الموبايل"
            hint="السعر وزر الشراء يفضلوا ظاهرين وإنت بتقرأ التفاصيل."
            checked={s.stickyBuyBarOnMobile}
            onChange={(v) => patch('productPage', { stickyBuyBarOnMobile: v })}
          />
        </Group>

        <Group title="المنتجات المقترحة">
          <Toggle label="عرض منتجات مشابهة" checked={s.showRelated} onChange={(v) => patch('productPage', { showRelated: v })} />
          {s.showRelated && (
            <TextField
              label="عنوان القسم"
              value={s.relatedTitle}
              onChange={(v) => patch('productPage', { relatedTitle: v })}
            />
          )}
        </Group>
      </>
    )
  }

  /* ══════════════════ السلة ══════════════════ */
  if (panel === 'cart') {
    const s = value.cart
    return (
      <>
        <Group title="الشكل">
          <Choice
            label="طريقة العرض"
            hint="الدرج أسرع وبيخلي العميل مكمّل تسوّق."
            value={s.mode}
            options={[
              { value: 'drawer', label: 'درج جانبي' },
              { value: 'page', label: 'صفحة كاملة' },
            ]}
            onChange={(v) => patch('cart', { mode: v })}
            columns={2}
          />
          <TextField
            label="رسالة السلة الفاضية"
            value={s.emptyMessage}
            onChange={(v) => patch('cart', { emptyMessage: v })}
          />
        </Group>

        <Group title="رفع قيمة السلة">
          <Toggle
            label="اقتراح منتجات"
            hint="منتجات مقترحة داخل السلة قبل إتمام الطلب."
            checked={s.showUpsell}
            onChange={(v) => patch('cart', { showUpsell: v })}
          />
          {s.showUpsell && (
            <TextField label="عنوان الاقتراحات" value={s.upsellTitle} onChange={(v) => patch('cart', { upsellTitle: v })} />
          )}
          <Toggle
            label="شريط الشحن المجاني"
            hint="«فاضلك ٢٠٠ جنيه للشحن المجاني» — من أكتر الحاجات اللي بترفع قيمة الطلب."
            checked={s.freeShippingBar}
            onChange={(v) => patch('cart', { freeShippingBar: v })}
          />
          {s.freeShippingBar && (
            <NumberField
              label="حد الشحن المجاني"
              value={Math.round(s.freeShippingThreshold / 100)}
              onChange={(v) => patch('cart', { freeShippingThreshold: Math.round(v * 100) })}
              min={0}
              suffix="جنيه"
            />
          )}
        </Group>

        <Group title="الحقول">
          <Toggle label="خانة كود الخصم" checked={s.showCouponField} onChange={(v) => patch('cart', { showCouponField: v })} />
          <Toggle label="ملاحظات العميل" checked={s.showNotes} onChange={(v) => patch('cart', { showNotes: v })} />
        </Group>
      </>
    )
  }

  /* ══════════════════ الفوتر ══════════════════ */
  if (panel === 'footer') {
    const s = value.footer
    return (
      <>
        <Group title="المحتوى">
          <TextField
            label="نبذة عن المتجر"
            value={s.about}
            onChange={(v) => patch('footer', { about: v })}
            multiline
            placeholder="متجر متخصص في…"
          />
          <TextField
            label="حقوق النشر"
            hint="اتركها فاضية لتظهر تلقائيًا باسم متجرك والسنة."
            value={s.copyright}
            onChange={(v) => patch('footer', { copyright: v })}
          />
        </Group>

        <Group title="التواصل">
          <Toggle label="أيقونات السوشيال" checked={s.showSocial} onChange={(v) => patch('footer', { showSocial: v })} />
          {s.showSocial && (
            <>
              {(['facebook', 'instagram', 'tiktok', 'whatsapp', 'youtube'] as const).map((k) => (
                <TextField
                  key={k}
                  label={
                    { facebook: 'فيسبوك', instagram: 'إنستجرام', tiktok: 'تيك توك', whatsapp: 'واتساب', youtube: 'يوتيوب' }[k]
                  }
                  value={s.social[k]}
                  onChange={(v) => patch('footer', { social: { ...s.social, [k]: v } })}
                  placeholder={k === 'whatsapp' ? '201012345678' : 'https://…'}
                  ltr
                />
              ))}
            </>
          )}
        </Group>

        <Group title="روابط إضافية">
          {s.links.map((l, i) => (
            <div key={l.id} className="flex items-end gap-2">
              <div className="flex-1">
                <TextField
                  label={`الرابط ${i + 1}`}
                  value={l.label}
                  onChange={(v) =>
                    patch('footer', { links: s.links.map((x) => (x.id === l.id ? { ...x, label: v } : x)) })
                  }
                  placeholder="سياسة الاسترجاع"
                />
              </div>
              <div className="flex-1">
                <TextField
                  label="العنوان"
                  value={l.url}
                  onChange={(v) =>
                    patch('footer', { links: s.links.map((x) => (x.id === l.id ? { ...x, url: v } : x)) })
                  }
                  placeholder="/pages/refund"
                  ltr
                />
              </div>
              <button
                type="button"
                onClick={() => patch('footer', { links: s.links.filter((x) => x.id !== l.id) })}
                aria-label="حذف الرابط"
                className="mb-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => patch('footer', { links: [...s.links, { id: nanoid(8), label: '', url: '' }] })}
            className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border-strong)] text-sm font-medium text-[var(--fg-muted)] hover:border-[var(--primary)] hover:text-[var(--primary)]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            إضافة رابط
          </button>
        </Group>

        <Group title="أخرى">
          <Toggle label="أيقونات طرق الدفع" checked={s.showPaymentIcons} onChange={(v) => patch('footer', { showPaymentIcons: v })} />
          <Toggle label="عرض «مدعوم بـزاوية»" checked={s.showPoweredBy} onChange={(v) => patch('footer', { showPoweredBy: v })} />
        </Group>
      </>
    )
  }

  /* ══════════════════ شاشة التحميل ══════════════════ */
  if (panel === 'preloader') {
    const s = value.preloader
    return (
      <>
        <Group title="شاشة التحميل">
          <Toggle
            label="تشغيل شاشة التحميل"
            hint="بتظهر لحظة فتح المتجر بهوية متجرك بدل وميض أبيض — إحساس أكثر احترافية."
            checked={s.enabled}
            onChange={(v) => patch('preloader', { enabled: v })}
          />
          {s.enabled && (
            <>
              <Choice
                label="الشكل"
                value={s.style}
                options={[
                  { value: 'logo', label: 'شعارك' },
                  { value: 'ring', label: 'حلقة' },
                  { value: 'dots', label: 'نقاط' },
                ]}
                onChange={(v) => patch('preloader', { style: v })}
                columns={3}
              />
              <p className="rounded-lg bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--fg-muted)]">
                شكل «شعارك» بيستخدم شعار متجرك اللي رفعته في لوحة «الهوية» — مش شعار المنصة. لو
                مارفعتش شعار، هيظهر اسم متجرك. لون الحركة بينطبق على الحلقة والنقاط.
              </p>
              <ColorField
                label="لون الخلفية"
                value={s.background}
                onChange={(v) => patch('preloader', { background: v })}
              />
              <ColorField
                label="لون الحركة"
                hint="لون الحلقة أو النقاط. الشعار بيظهر بصورته."
                value={s.color}
                onChange={(v) => patch('preloader', { color: v })}
              />
            </>
          )}
        </Group>
      </>
    )
  }

  /* ══════════════════ شريط الأدوات ══════════════════ */
  const s = value.toolbar
  return (
    <>
      <Group title="زر واتساب العائم">
        <Toggle label="تشغيل الزر" checked={s.whatsappEnabled} onChange={(v) => patch('toolbar', { whatsappEnabled: v })} />
        {s.whatsappEnabled && (
          <>
            <TextField
              label="رقم واتساب"
              hint="بالصيغة الدولية بدون + وبدون مسافات. مثال: 201012345678"
              value={s.whatsappNumber}
              onChange={(v) => patch('toolbar', { whatsappNumber: v })}
              placeholder="201012345678"
              ltr
            />
            <TextField
              label="الرسالة الجاهزة"
              hint="بتتكتب تلقائيًا في محادثة العميل لما يضغط الزر."
              value={s.whatsappMessage}
              onChange={(v) => patch('toolbar', { whatsappMessage: v })}
              multiline
            />
            <Choice
              label="مكان الزر"
              value={s.position}
              options={[
                { value: 'start', label: 'يمين' },
                { value: 'end', label: 'شمال' },
              ]}
              onChange={(v) => patch('toolbar', { position: v })}
              columns={2}
            />
            <Toggle label="يظهر على الموبايل" checked={s.showOnMobile} onChange={(v) => patch('toolbar', { showOnMobile: v })} />
            <Toggle label="يظهر على الكمبيوتر" checked={s.showOnDesktop} onChange={(v) => patch('toolbar', { showOnDesktop: v })} />
          </>
        )}
      </Group>

      <Group title="أدوات أخرى">
        <Toggle
          label="شريط تنقّل سفلي على الموبايل"
          hint="الرئيسية والأقسام والسلة والحساب — زي التطبيقات."
          checked={s.mobileNavEnabled}
          onChange={(v) => patch('toolbar', { mobileNavEnabled: v })}
        />
        <Toggle label="زر الرجوع لأعلى" checked={s.backToTop} onChange={(v) => patch('toolbar', { backToTop: v })} />
      </Group>
    </>
  )
}
