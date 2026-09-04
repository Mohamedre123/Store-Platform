'use client'

import Link from 'next/link'
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
  if (children.length < 2) return null

  const query = search.toString()

  return (
    <div className="scroll-x -mx-1 flex gap-1 border-b border-[var(--border)] px-1 pb-px">
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
              'shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors',
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
