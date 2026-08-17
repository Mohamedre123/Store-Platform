import Image from 'next/image'
import { brand } from '@/lib/brand'
import { cn } from '@/lib/utils'

/**
 * قفل شعار زاوية: العلامة + كلمة «زاوية» بتايبوجرافي العلامة.
 *
 * الاسم صورة وليس نصًا بخط. السبب إن الخطوط بتختلف من جهاز لجهاز
 * ومن متصفح لمتصفح — الصورة بتضمن إن الاسم يظهر بنفس الشكل بالظبط
 * في كل مكان، وده المطلوب من أي علامة تجارية.
 *
 * لكل نسخة مقابلها الأبيض، والتبديل بينهما بالـCSS حسب وضع الجهاز
 * لا بالجافاسكربت، فما يحصلش وميض عند التحميل.
 */

const MARK_SIZES = {
  sm: 'h-9 w-9',
  md: 'h-12 w-12',
  lg: 'h-16 w-16',
} as const

/** ارتفاع الكلمة بالبكسل — العرض يُحسب من نسبة الأبعاد */
const WORD_HEIGHTS = {
  sm: 18,
  md: 26,
  lg: 34,
} as const

export function Logo({
  size = 'md',
  markOnly = false,
  className,
  priority = false,
}: {
  size?: 'sm' | 'md' | 'lg'
  markOnly?: boolean
  className?: string
  priority?: boolean
}) {
  const height = WORD_HEIGHTS[size]
  const width = Math.round(height * brand.wordmarkRatio)

  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span className={cn('relative shrink-0', MARK_SIZES[size])}>
        <Image
          src={brand.mark}
          alt=""
          aria-hidden="true"
          fill
          priority={priority}
          sizes="64px"
          className="object-contain dark:hidden"
        />
        <Image
          src={brand.markDark}
          alt=""
          aria-hidden="true"
          fill
          priority={priority}
          sizes="64px"
          className="hidden object-contain dark:block"
        />
      </span>

      {!markOnly && (
        <>
          <Image
            src={brand.wordmark}
            alt={brand.name}
            width={width}
            height={height}
            priority={priority}
            style={{ height, width: 'auto' }}
            className="shrink-0 object-contain dark:hidden"
          />
          <Image
            src={brand.wordmarkDark}
            alt=""
            aria-hidden="true"
            width={width}
            height={height}
            priority={priority}
            style={{ height, width: 'auto' }}
            className="hidden shrink-0 object-contain dark:block"
          />
        </>
      )}
    </span>
  )
}
