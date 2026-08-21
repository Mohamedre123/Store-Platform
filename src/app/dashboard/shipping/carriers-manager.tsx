'use client'

import { Info, Truck } from 'lucide-react'
import { ProviderCard, type ProviderState } from '@/components/dashboard/provider-card'
import { CARRIER_PROVIDERS, webhookPath } from '@/lib/providers'
import { saveCarrierProviderAction } from '@/app/dashboard/payments/provider-actions'

/**
 * شركات الشحن.
 *
 * لما تتربط شركة، **التسعير اليدوي بيتقفل** — وده مقصود:
 * الشركة هي اللي بتقول السعر، ولو سبنا اليدوي شغّالًا معاها العميل
 * ياخد سعرًا والتاجر يتحاسب بسعر تاني، والفرق من جيبه في كل طلب.
 */
export function CarriersManager({
  providers,
  origin,
  storeId,
  currency,
}: {
  providers: Record<string, ProviderState>
  origin: string
  storeId: string
  currency: string
}) {
  /*
    الشركات اللي سعرها بيغلب التسعير اليدوي — المربوطة من غير سعر
    ما بتغيّرش حاجة، فما ينفعش تظهر في تحذير القفل.
  */
  const active = CARRIER_PROVIDERS.filter(
    (c) => providers[c.slug]?.enabled && (providers[c.slug]?.flatRate ?? 0) > 0,
  )

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-start gap-2">
        <Truck className="mt-1 h-4 w-4 shrink-0 text-[var(--fg-subtle)]" aria-hidden="true" />
        <div>
          <h2 className="font-semibold">شركات الشحن</h2>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            افتح حسابك عند الشركة، هات مفاتيحك، والزقها هنا. أول ما تربط، الطلب
            بيتسجّل عندهم لوحده وحالته بتتحدّث في متجرك لوحدها.
          </p>
        </div>
      </div>

      {active.length > 0 && (
        <p className="flex items-start gap-2 rounded-lg bg-[var(--color-info-soft)] px-3 py-2.5 text-xs leading-relaxed text-[var(--color-info)]">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            <strong>{active.map((c) => c.name).join('، ')}</strong> مربوطة، فأسعارها هي
            اللي بتحكم — والتسعير اليدوي تحت اتقفل. لو أوقفت الشركات كلها، بيرجع
            يشتغل زي ما هو من غير ما تفقد أسعارك.
          </span>
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {CARRIER_PROVIDERS.map((def) => (
          <ProviderCard
            key={def.slug}
            def={def}
            state={providers[def.slug]}
            webhookUrl={def.webhook ? origin + webhookPath('ship', def.slug, storeId) : null}
            onSave={saveCarrierProviderAction}
            kindLabel="شركة شحن"
            showPricing
            currency={currency}
          />
        ))}
      </div>
    </section>
  )
}
