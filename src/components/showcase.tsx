import { Check, Package, Send, Sparkles, Wand2 } from 'lucide-react'

/**
 * المشاهد المتحرّكة في الصفحة الرئيسية.
 *
 * **CSS خالص، مفيش فيديو ولا جافاسكربت.** الفيديو التوضيحي بيوزن
 * ميجابايتات، وبيحتاج تحميل قبل ما يبدأ، وبيتقطّع على النت الضعيف —
 * والزائر المصري بيفتح من الموبايل على بيانات. الأنيميشن بالـCSS
 * بيبدأ فورًا، وزنه صفر، وبيتظبّط على أي مقاس.
 *
 * وكل مشهد بيعرض ميزة **حقيقية موجودة في المنصة** — مش رسم توضيحي.
 * اللي الزائر بيشوفه هنا هو اللي هيلاقيه لما يسجّل.
 *
 * الحركة كلها بتقف مع `prefers-reduced-motion` — الحركة المستمرة
 * بتسبّب دوخة لناس فعلًا، والصفحة لازم تفضل مقروءة من غيرها.
 */

/** إطار المتصفح — مشترك بين المشاهد */
function Browser({
  title,
  children,
  className = '',
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`zw-mock ${className}`} aria-hidden="true">
      <div className="zw-mock__bar">
        <span className="zw-mock__dots">
          <i style={{ background: '#ff5f57' }} />
          <i style={{ background: '#febc2e' }} />
          <i style={{ background: '#28c840' }} />
        </span>
        <span className="zw-mock__title">{title}</span>
      </div>
      <div className="zw-mock__body">{children}</div>
    </div>
  )
}

/**
 * ١) مولّد صفحات الهبوط.
 *
 * دورة: يكتب وصف → يفتح قايمة المنتجات → يختار → شريط تقدّم →
 * الصفحة بتظهر وبتتمرّر لوحدها → علامة نجاح.
 */
export function ShowcaseLanding() {
  return (
    <Browser title="مولّد صفحات الهبوط" className="zw-scene zw-scene--landing">
      <div className="zw-scene__stage zw-stage--type">
        <span className="zw-field">
          <span className="zw-field__label">اوصف حملتك</span>
          <span className="zw-typed">
            <span className="zw-typed__text">صفحة لتيشيرت القطن بخصم ٣٠٪</span>
            <span className="zw-typed__caret" />
          </span>
        </span>
      </div>

      <div className="zw-scene__stage zw-stage--pick">
        <span className="zw-field">
          <span className="zw-field__label">اختار منتج من متجرك</span>
          <span className="zw-select">
            <Package className="h-3.5 w-3.5 shrink-0 opacity-50" />
            <span className="zw-select__value">تيشيرت قطن أساسي</span>
            <span className="zw-select__caret" />
          </span>
        </span>
        <ul className="zw-menu">
          {[
            ['تيشيرت قطن أساسي', '٤٩٠ ج'],
            ['بولو تريكو', '٧٢٠ ج'],
            ['تيشيرت أوفر سايز', '٥٥٠ ج'],
          ].map(([name, price], i) => (
            <li key={name} className={`zw-menu__item${i === 0 ? ' is-picked' : ''}`}>
              <span className="zw-menu__thumb" />
              <span className="zw-menu__name">{name}</span>
              <span className="zw-menu__price">{price}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="zw-scene__stage zw-stage--build">
        <span className="zw-spark">
          <Sparkles className="h-6 w-6" />
        </span>
        <span className="zw-scene__caption">جاري إنشاء صفحة الهبوط…</span>
        <span className="zw-progress">
          <span className="zw-progress__fill" />
        </span>
      </div>

      <div className="zw-scene__stage zw-stage--done">
        <div className="zw-preview">
          <div className="zw-preview__scroll">
            <span className="zw-preview__hero" />
            <span className="zw-preview__line" style={{ width: '72%' }} />
            <span className="zw-preview__line" style={{ width: '54%' }} />
            <span className="zw-preview__row">
              <i /> <i /> <i />
            </span>
            <span className="zw-preview__cta" />
            <span className="zw-preview__line" style={{ width: '64%' }} />
            <span className="zw-preview__row">
              <i /> <i />
            </span>
            <span className="zw-preview__cta" />
          </div>
        </div>
        <span className="zw-badge">
          <Check className="h-3.5 w-3.5" />
          تم الإنشاء
        </span>
      </div>

      <span className="zw-pill">
        <Sparkles className="h-3.5 w-3.5" />
        توليد بالذكاء الاصطناعي
      </span>
    </Browser>
  )
}

/**
 * ٢) مصمّم الثيمات.
 *
 * دورة: وصف بالعربي → الألوان بتتبدّل → التخطيط بيعيد ترتيب نفسه.
 */
export function ShowcaseTheme() {
  return (
    <Browser title="مصمّم الثيم" className="zw-scene zw-scene--theme">
      <div className="zw-theme">
        <div className="zw-theme__ask">
          <span className="zw-typed zw-typed--slow">
            <span className="zw-typed__text">ثيم فخم بالأسود والدهبي</span>
            <span className="zw-typed__caret" />
          </span>
        </div>

        <div className="zw-theme__swatches">
          {['a', 'b', 'c', 'd'].map((k, i) => (
            <span key={k} className={`zw-swatch zw-swatch--${k}`} style={{ animationDelay: `${i * 90}ms` }} />
          ))}
        </div>

        <div className="zw-theme__canvas">
          <span className="zw-theme__header" />
          <span className="zw-theme__hero" />
          <span className="zw-theme__grid">
            <i /> <i /> <i />
          </span>
        </div>
      </div>
    </Browser>
  )
}

/**
 * ٣) المساعد اللي بينفّذ.
 *
 * دورة: التاجر بيطلب → المساعد بيقترح إجراء → التاجر بيوافق →
 * المنتج بيتضاف في القايمة.
 *
 * المشهد ده بيوري **حاجز الموافقة** تحديدًا — أهم تفصيلة في المساعد،
 * والزائر لازم يشوفها قبل ما يقلق من فكرة «أداة بتغيّر في متجري».
 */
export function ShowcaseAssistant() {
  return (
    <Browser title="مساعدك في اللوحة" className="zw-scene zw-scene--agent">
      <div className="zw-chat">
        <div className="zw-chat__msg zw-chat__msg--me">
          <span className="zw-typed zw-typed--fast">
            <span className="zw-typed__text">ضيف تيشيرت قطن بـ٤٩٠</span>
            <span className="zw-typed__caret" />
          </span>
        </div>

        <div className="zw-chat__msg zw-chat__msg--bot">تمام — دي التفاصيل، وافق وأضيفه.</div>

        <div className="zw-action">
          <span className="zw-action__title">
            <Wand2 className="h-3.5 w-3.5" />
            إضافة منتج «تيشيرت قطن» بسعر ٤٩٠ ج
          </span>
          <span className="zw-action__hint">مش هيتنفّذ غير لما توافق.</span>
          <span className="zw-action__buttons">
            <span className="zw-action__yes">
              <Check className="h-3 w-3" />
              نفّذها
            </span>
            <span className="zw-action__no">لأ</span>
          </span>
          <span className="zw-action__done">
            <Check className="h-3.5 w-3.5" />
            اتضاف «تيشيرت قطن» بسعر ٤٩٠ ج
          </span>
        </div>
      </div>

      <span className="zw-send">
        <Send className="h-3.5 w-3.5" />
      </span>
    </Browser>
  )
}
