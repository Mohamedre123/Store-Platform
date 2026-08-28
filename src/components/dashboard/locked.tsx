import Link from 'next/link'
import { Crown, Lock } from 'lucide-react'

/**
 * غطاء «للمشتركين فقط».
 *
 * ## ليه بلور مش إخفاء
 * الإخفاء بيخلّي التاجر مش عارف إن الميزة موجودة أصلًا، فمش هيشترك
 * عشانها. البلور بيوريه شكل اللي مستنيه من ورا زجاج — والزرار جنبه.
 *
 * ## اللي تحت البلور مش حماية
 * الغطاء ده واجهة بس. أي فعل بيغيّر بيانات لازم يتحقّق من البوابة
 * على الخادم كمان (`getEntitlements`) — لأن `pointer-events-none`
 * بتتشال من أدوات المطوّرين في تانيتين.
 */
export function Locked({
  title = 'للمشتركين فقط',
  description,
  children,
}: {
  title?: string
  description: string
  children?: React.ReactNode
}) {
  return (
    <div
      className={
        children
          ? 'relative isolate min-h-[18rem] overflow-hidden rounded-xl'
          : 'relative isolate overflow-hidden rounded-xl'
      }
    >
      {children && (
        /*
          `inert` لا `pointer-events-none` وحدها.

          `pointer-events-none` بتوقّف الماوس بس — الحقول اللي تحت
          البلور تفضل قابلة للوصول بـTab، فالتاجر بالكيبورد بيلاقي
          نفسه داخل نموذج مش شايفه. و`inert` بتشيله من ترتيب التنقّل
          ومن قارئ الشاشة معًا.
        */
        <div inert className="select-none blur-[6px] saturate-50">
          {children}
        </div>
      )}

      <div
        className={
          children
            ? 'absolute inset-0 z-10 flex items-center justify-center bg-[var(--surface)]/55 p-4 backdrop-blur-[2px]'
            : 'flex items-center justify-center p-4'
        }
      >
        <div className="surface flex w-full max-w-sm flex-col items-center gap-3 p-6 text-center shadow-lg">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)]">
            <Lock className="h-5 w-5" aria-hidden="true" />
          </span>

          <div className="flex flex-col gap-1.5">
            <h3 className="font-bold">{title}</h3>
            <p className="text-sm leading-relaxed text-[var(--fg-muted)]">{description}</p>
          </div>

          <Link
            href="/dashboard/subscription"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-fg)] transition-opacity hover:opacity-90"
          >
            <Crown className="h-4 w-4" aria-hidden="true" />
            اشترك دلوقتي
          </Link>
        </div>
      </div>
    </div>
  )
}

/** شريط تنبيه صغير — للصفحات اللي مش محتاجة غطاء كامل */
export function LockedNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-warning)]/40 bg-[var(--color-warning-soft)] p-4">
      <p className="flex items-start gap-2 text-sm font-medium text-[var(--color-warning)]">
        <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{children}</span>
      </p>
      <Link
        href="/dashboard/subscription"
        className="inline-flex min-h-9 shrink-0 items-center rounded-lg bg-[var(--color-warning)] px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        اشترك
      </Link>
    </div>
  )
}
