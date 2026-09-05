'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { NAV } from './sidebar'
import { cn } from '@/lib/utils'

/**
 * تبويبات القسم داخل الصفحة.
 *
 * بتتولّد من نفس قائمة التنقّل — فمفيش مصدرين للحقيقة يتفرّقوا مع
 * الوقت. الفايدة إن التاجر اللي دخل من رابط مباشر (أو من نتيجة بحث)
 * يشوف إخوان الصفحة قدامه من غير ما يفتح القائمة الجانبية.
 *
 * ما بتظهرش لو الصفحة مالهاش إخوان — تبويب واحد مش تبويبات.
 *
 * ## والشريط ده كان أسوأ حتة في اللوحة على الفون
 * قسم التسويق فيه ١١ تبويب. على شاشة ٣٧٥ بكسل بيبان منهم تلاتة،
 * وباقي التمانية كانوا **مخفيين بلا أي إشارة** — التاجر مش عارف
 * إنهم موجودين فما بيحاولش يسحب. وتحتهم اسكرول بار رمادي عريض
 * بيخلّي الشكل كأن فيه حاجة مكسورة.
 *
 * التلاشي على الحافتين (في `.tabs-x`) بيحلّ الاتنين: التبويب اللي
 * نُصّه باهت هو الإشارة، والاسكرول بار اتخفى.
 */
export function SectionTabs({
  role,
  permissions,
}: {
  /**
   * نفس فلترة القايمة الجانبية بالظبط.
   *
   * من غيرها، الموظف بيشوف تبويبات إخوان الصفحة اللي هو جوّاها
   * ويدوس على واحد بيرجّعله ٤٠٤ — فيفتكر إن فيه عطل مش إن البند
   * مش من حقّه.
   */
  role: string
  permissions: string[]
}) {
  const pathname = usePathname()
  const search = useSearchParams()
  const stripRef = useRef<HTMLDivElement>(null)

  const section = NAV.find(
    (s) =>
      s.children?.some((c) => {
        const path = c.href.split('?')[0]
        return pathname === path || pathname.startsWith(`${path}/`)
      }),
  )

  const allowed = (permission?: string) => {
    if (!permission) return true
    if (role === 'owner' || role === 'admin') return true
    if (permissions.length === 0) return true
    return permissions.includes(permission)
  }

  const children = section?.children?.filter((c) => allowed(c.permission)) ?? []
  const query = search.toString()

  /**
   * التبويب النشط بيتمرّر لمكانه لما الصفحة تفتح.
   *
   * ## المشكلة اللي بيحلّها
   * «المصروفات والأرباح» تاسع تبويب في قسم التسويق. التاجر بيدخلها
   * من القايمة الجانبية، فيلاقي الشريط واقف على أوله — يعني الصفحة
   * اللي هو جوّاها **مش ظاهرة في شريط تبويباتها**، وشكله كأن مفيش
   * حاجة نشطة. ده بيخلّي الشريط يبان زينة مش أداة تنقّل.
   *
   * `block: 'nearest'` عشان ما يحرّكش الصفحة رأسيًا معاه: التاجر
   * فتح الصفحة عشان يقرا من فوق، مش عشان ينطّ لشريط التبويبات.
   */
  useEffect(() => {
    const active = stripRef.current?.querySelector('[aria-current="page"]')
    active?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [pathname, query])

  if (children.length < 2) return null

  return (
    <div
      ref={stripRef}
      className="tabs-x -mx-4 flex gap-1 border-b border-[var(--border)] px-4 sm:-mx-1 sm:px-1"
      role="navigation"
      aria-label="أقسام الصفحة"
    >
      {children.map((child) => {
        const [childPath, childQuery] = child.href.split('?')
        const active =
          pathname === childPath
            ? (childQuery ?? '') === query
            : pathname.startsWith(`${childPath}/`)

        return (
          <Link
            key={child.href}
            href={child.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              /*
                ٤٤ بكسل ارتفاعًا على الفون — نفس أقل مساحة لمس
                في باقي اللوحة. كان ٤٠ تقريبًا، والفرق بيبان لما
                التاجر يدوس بإبهامه وهو ماشي.
              */
              'flex shrink-0 items-center whitespace-nowrap border-b-2 px-3 text-sm transition-colors',
              'min-h-11 sm:min-h-0 sm:py-2.5',
              active
                ? 'border-[var(--primary)] font-medium text-[var(--primary)]'
                : 'border-transparent text-[var(--fg-muted)] hover:text-[var(--fg)]',
            )}
          >
            {child.label}
          </Link>
        )
      })}
    </div>
  )
}
