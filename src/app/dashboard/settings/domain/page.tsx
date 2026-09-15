import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { Locked } from '@/components/dashboard/locked'
import { loadDomain } from '@/lib/domain-data'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { DomainForm } from './domain-form'

export const metadata = { title: 'النطاق المخصص' }

export default async function DomainPage() {
  const { store, actor } = await getDashboardContext()
  guard(actor, 'settings.manage')

  /*
    حالة التكامل مع المستضيف.

    من غير مفاتيحه، التاجر يقدر يضيف نطاقه ويظبّط سجلاته وكل
    حاجة تبان تمام — والنطاق يفضل واقف على 404 لأن التسجيل عند
    المستضيف ما تمّش. التنبيه ده بيمنع الساعة اللي بيضيّعها وهو
    بيراجع سجلات مظبوطة أصلًا.
  */
  const { currentHost, records, locked, link } = await loadDomain(store)

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="النطاق المخصص"
        description="اربط نطاقك الخاص بمتجرك بدل النطاق الفرعي."
      />

      <Reveal>
        <div className="surface flex flex-col gap-1 p-4">
          <span className="text-xs text-[var(--fg-muted)]">نطاق متجرك الحالي</span>
          <bdi dir="ltr" className="font-mono text-sm font-medium">
            {currentHost}
          </bdi>
          <p className="mt-1 text-xs text-[var(--fg-subtle)]">
            ده بيفضل شغّال دايمًا حتى بعد ما تربط نطاقك الخاص.
          </p>
        </div>
      </Reveal>

      {!link.ok && (
        <Reveal delay={60}>
          <div className="rounded-xl border border-[var(--color-warning)]/40 bg-[var(--color-warning-soft)] p-4">
            <p className="text-sm font-semibold text-[var(--color-warning)]">
              ربط النطاقات مش مفعّل على المنصة
            </p>
            <p className="mt-1 text-sm text-[var(--color-warning)]" style={{ opacity: 0.85 }}>
              تقدر تضيف نطاقك وتظبّط سجلاته، بس مش هيشتغل قبل ما إدارة المنصة تضبط
              التكامل مع المستضيف.
            </p>
            <p dir="ltr" className="mt-2 text-start text-xs text-[var(--color-warning)] font-mono" style={{ opacity: 0.75 }}>
              {link.reason}
            </p>
          </div>
        </Reveal>
      )}

      <Reveal delay={80}>
        {!locked ? (
          <DomainForm
            currentDomain={store.customDomain}
            verified={Boolean(store.customDomainVerifiedAt)}
            initialRecords={records}
          />
        ) : (
          <Locked description="اربط نطاقك الخاص بمتجرك — عنوانك إنت بدل النطاق الفرعي. متاح مع أي باقة.">
            <DomainForm
              currentDomain={store.customDomain}
              verified={Boolean(store.customDomainVerifiedAt)}
              initialRecords={records}
            />
          </Locked>
        )}
      </Reveal>
    </div>
  )
}
