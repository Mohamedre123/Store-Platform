import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * شريط أفقي على الموبايل، شبكة عادية على الشاشات الكبيرة.
 *
 * ست كروت فوق بعض على الموبايل معناها تمرير طويل قبل ما التاجر
 * يوصل للي بعدها، واللي تحت الطية بيضيع. جنب بعض بتمرير بالإصبع
 * بيخلّي الست في مساحة كارت واحد، والحركة الأفقية نفسها بتقول
 * «فيه كمان» من غير ما نكتبها.
 *
 * **من غير أي جافاسكربت.** التمرير الالتقاطي (scroll-snap) في CSS
 * بيدّي نفس إحساس الكاروسيل، والمتصفح بينفّذه على كرت الشاشة —
 * فبيفضل ناعم على الأجهزة الضعيفة، ومكتبة كاروسيل كانت هتضيف حِملًا
 * على الصفحة عشان حاجة المتصفح بيعملها أصلًا.
 *
 * الهوامش السالبة بتخلّي الكارت الأخير يوصل لحرف الشاشة بدل ما
 * يقف قبلها بهامش — الوقفة دي بتخلّي المستخدم يفتكر إن دي النهاية.
 *
 * الكلاسات بتتحطّ على الابن نفسه لا على غلاف زيادة: `<ol>` ما بيقبلش
 * غير `<li>`، وغلاف `div` جوّاها كان هيكسر المعنى للقارئ الصوتي.
 */
export function Rail({
  children,
  /** كلاسات الشبكة على الشاشات الكبيرة — من `sm:` وطالع */
  desktop = 'sm:grid sm:grid-cols-3',
  /** عرض الكارت الواحد على الموبايل. الكسر بيخلّي اللي بعده يبان */
  itemWidth = 'basis-[78%]',
  className = '',
  as: Tag = 'div',
}: {
  children: ReactNode
  desktop?: string
  itemWidth?: string
  className?: string
  as?: 'div' | 'ol' | 'ul'
}) {
  return (
    <Tag
      className={cn(
        'scroll-x -mx-4 flex snap-x snap-mandatory gap-3 px-4 pb-3',
        'sm:mx-0 sm:snap-none sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0',
        desktop,
        className,
      )}
    >
      {Children.map(children, (child) => {
        if (!isValidElement(child)) return child

        const el = child as ReactElement<{ className?: string }>
        return cloneElement(el, {
          className: cn('shrink-0 snap-start sm:basis-auto', itemWidth, el.props.className),
        })
      })}
    </Tag>
  )
}
