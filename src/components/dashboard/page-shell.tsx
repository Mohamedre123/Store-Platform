import type { LucideIcon } from 'lucide-react'
import { Reveal } from '@/components/motion'

/**
 * إطار موحّد لكل صفحات اللوحة: عنوان ووصف ومساحة أدوات،
 * فتفضل كل الصفحات بنفس الإيقاع البصري مهما زاد عددها.
 */
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <Reveal>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && <p className="text-sm text-[var(--fg-muted)]">{description}</p>}
        </div>
        {action}
      </div>
    </Reveal>
  )
}

/**
 * حالة القسم الذي لم يُبنَ بعد.
 *
 * الغرض ألا يقابل التاجر صفحة 404 في قسم مذكور في القائمة —
 * الأصدق أن نقول «قيد الإنشاء» ونوضّح ما سيأتي فيه.
 */
export function ComingSoon({
  icon: Icon,
  title,
  description,
  features,
}: {
  icon: LucideIcon
  title: string
  description: string
  features: string[]
}) {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={title} description={description} />

      <Reveal delay={80}>
        <div className="surface flex flex-col items-center gap-5 px-6 py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)]">
            <Icon className="h-6 w-6" aria-hidden="true" />
          </span>

          <div className="flex flex-col gap-1.5">
            <h2 className="text-lg font-semibold">القسم ده قيد الإنشاء</h2>
            <p className="max-w-md text-sm leading-relaxed text-[var(--fg-muted)]">
              شغّالين عليه دلوقتي. دي الحاجات اللي هتلاقيها فيه:
            </p>
          </div>

          <ul className="flex max-w-md flex-col gap-2 text-start">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-[var(--fg-muted)]">
                <span
                  className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]"
                  aria-hidden="true"
                />
                {f}
              </li>
            ))}
          </ul>
        </div>
      </Reveal>
    </div>
  )
}
