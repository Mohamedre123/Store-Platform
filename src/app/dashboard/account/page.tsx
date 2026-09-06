import Link from 'next/link'
import { eq } from 'drizzle-orm'
import { Crown, MonitorSmartphone, ScrollText, Store } from 'lucide-react'
import { db } from '@/db'
import { users } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { getUserStores } from '@/lib/auth'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { Card } from '@/components/ui'
import { AccountForms } from './account-forms'

export const metadata = { title: 'حسابي' }

/**
 * حساب التاجر — مش متجره.
 *
 * ## الصفحة دي كانت ناقصة خالص
 * كل الإعدادات في اللوحة عن **المتجر**. مفيش أي مكان التاجر يغيّر
 * فيه اسمه هو ولا كلمة سرّه — واللي عايز يغيّر كلمة سرّه كان لازم
 * يسجّل خروج ويستعمل «نسيت كلمة السر» ويستنى بريدًا عشان يعمل حاجة
 * هو فاكرها أصلًا.
 *
 * ## ومن غير `guard`
 * الصفحة دي بتاعة الحساب نفسه لا المتجر، فكل من دخل اللوحة من
 * حقّه يفتحها — الموظف كمان بيغيّر كلمة سرّه.
 */
export default async function AccountPage() {
  const { user } = await getDashboardContext()

  const [[row], stores] = await Promise.all([
    db
      .select({ phone: users.phone, createdAt: users.createdAt })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1),
    getUserStores(user.id),
  ])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="حسابي"
        description="بياناتك أنت — مش بيانات المتجر. التغيير هنا بيمشي على كل متاجرك."
      />

      <Reveal>
        <AccountForms
          name={user.name}
          email={user.email}
          phone={row?.phone ?? ''}
          publicId={user.publicId}
        />
      </Reveal>

      {/* متاجره */}
      {stores.length > 0 && (
        <Reveal delay={60}>
          <Card className="flex flex-col gap-3 p-5">
            <h2 className="flex items-center gap-2 font-semibold">
              <Store className="h-4 w-4 text-[var(--primary)]" aria-hidden="true" />
              متاجرك ({stores.length})
            </h2>
            <ul className="flex flex-col gap-1.5">
              {stores.map((s) => (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg bg-[var(--surface-2)] px-3.5 py-2.5 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate font-medium">{s.name}</span>
                  <span dir="ltr" className="shrink-0 text-xs text-[var(--fg-subtle)]">
                    {s.slug}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </Reveal>
      )}

      {/* روابط ليها صفحاتها */}
      <Reveal delay={100}>
        <Card className="divide-y divide-[var(--border)]">
          {[
            {
              href: '/dashboard/subscription',
              icon: Crown,
              label: 'الاشتراك والباقة',
              hint: 'باقتك الحالية وتاريخ تجديدها',
            },
            {
              href: '/dashboard/settings/sessions',
              icon: MonitorSmartphone,
              label: 'الأجهزة والجلسات',
              hint: 'مين داخل على حسابك دلوقتي — واقفل أي جهاز',
            },
            {
              href: '/dashboard/settings/activity',
              icon: ScrollText,
              label: 'سجل النشاط',
              hint: 'كل إجراء حسّاس اتعمل على متجرك',
            },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 p-4 transition-colors hover:bg-[var(--surface-2)]"
            >
              <item.icon className="h-[18px] w-[18px] shrink-0 text-[var(--fg-muted)]" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{item.label}</span>
                <span className="block text-xs text-[var(--fg-subtle)]">{item.hint}</span>
              </span>
            </Link>
          ))}
        </Card>
      </Reveal>
    </div>
  )
}
