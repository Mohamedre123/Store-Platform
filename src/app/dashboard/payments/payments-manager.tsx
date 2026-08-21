'use client'

import { useState, useTransition } from 'react'
import { Banknote, Check, Landmark, Lock, Truck } from 'lucide-react'
import { savePaymentMethodAction, type PaymentInput } from './actions'
import { Alert, Card } from '@/components/ui'
import { ProviderCard, type ProviderState } from '@/components/dashboard/provider-card'
import { PAYMENT_PROVIDERS, webhookPath } from '@/lib/providers'
import { savePaymentProviderAction } from './provider-actions'
import { fromMinorUnits } from '@/lib/utils'

export type PaymentRow = {
  gateway: string
  enabled: boolean
  displayName: string | null
  instructions: string | null
  fixedFee: number
}

type MethodDef = {
  gateway: string
  title: string
  desc: string
  icon: typeof Banknote
  defaultName: string
  hasFee?: boolean
  hasInstructions?: boolean
  instructionsLabel?: string
  instructionsHint?: string
}

const METHODS: MethodDef[] = [
  {
    gateway: 'cod',
    title: 'الدفع عند الاستلام',
    desc: 'العميل بيدفع كاش لمّا الطلب يوصله. الأكثر استخدامًا في مصر.',
    icon: Banknote,
    defaultName: 'الدفع عند الاستلام',
    hasFee: true,
  },
  {
    gateway: 'manual',
    title: 'تحويل بنكي أو محفظة',
    desc: 'العميل بيحوّل على حسابك أو محفظتك، ويبعتلك الإيصال. من غير أي عقود.',
    icon: Landmark,
    defaultName: 'تحويل بنكي / فودافون كاش',
    hasInstructions: true,
    instructionsLabel: 'تعليمات التحويل',
    instructionsHint: 'اكتب رقم حسابك أو محفظتك، والعميل هيشوفها في الشيك أوت. مثال: فودافون كاش 010xxxxxxxx باسم…',
  },
]

export function PaymentsManager({
  methods,
  providers,
  origin,
  storeId,
  codEnabled,
}: {
  methods: PaymentRow[]
  /** حالة كل بوابة — من غير أي مفتاح */
  providers: Record<string, ProviderState>
  /** أصل المنصة — الويب هوك لازم يكون رابطًا مطلقًا عشان يشتغل عندهم */
  origin: string
  storeId: string
  /**
   * الدفع عند الاستلام مفتوح؟
   *
   * مفتاحه في إعدادات الشحن لا هنا: هو قرار شحن قبل ما يبقى قرار
   * دفع — التاجر بيقفله لما شركة الشحن ما بتحصّلش، أو لما نسبة
   * الرفض تعلى. مفتاحين لنفس الحاجة في صفحتين بيخلّي الحالة غامضة.
   */
  codEnabled: boolean
}) {
  const byGateway = new Map(methods.map((m) => [m.gateway, m]))

  return (
    <div className="flex flex-col gap-8">
      {/*
        الطرق المباشرة الأول: دي اللي شغّالة من غير أي طرف تالت،
        والدفع عند الاستلام هو أغلب مبيعات المتجر المصري.
      */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="font-semibold">طرق من غير وسيط</h2>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            شغّالة على طول — من غير حساب ولا مفاتيح ولا عمولة لحد.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {METHODS.map((def) => (
            <MethodCard
              key={def.gateway}
              def={def}
              saved={byGateway.get(def.gateway)}
              codEnabled={codEnabled}
            />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-start gap-2">
          <Lock className="mt-1 h-4 w-4 shrink-0 text-[var(--fg-subtle)]" aria-hidden="true" />
          <div>
            <h2 className="font-semibold">بوابات الدفع الإلكتروني</h2>
            <p className="mt-1 text-sm text-[var(--fg-muted)]">
              افتح حسابك عند البوابة، هات مفاتيحك، والزقها هنا — وفلوس طلباتك بتنزل
              حسابك إنت مباشرة. إحنا مش وسيط ومش بناخد عمولة.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {PAYMENT_PROVIDERS.map((def) => (
            <ProviderCard
              key={def.slug}
              def={def}
              state={providers[def.slug]}
              webhookUrl={def.webhook ? origin + webhookPath('pay', def.slug, storeId) : null}
              onSave={savePaymentProviderAction}
              kindLabel="بوابة دفع"
            />
          ))}
        </div>
      </section>
    </div>
  )
}

function MethodCard({
  def,
  saved,
  codEnabled,
}: {
  def: MethodDef
  saved?: PaymentRow
  codEnabled: boolean
}) {
  // الدفع عند الاستلام بيتفتح ويتقفل من إعدادات الشحن
  const controlled = def.gateway === 'cod'
  const [enabled, setEnabled] = useState(controlled ? codEnabled : (saved?.enabled ?? false))
  const [displayName, setDisplayName] = useState(saved?.displayName ?? def.defaultName)
  const [instructions, setInstructions] = useState(saved?.instructions ?? '')
  const [fee, setFee] = useState(saved?.fixedFee ? String(fromMinorUnits(saved.fixedFee)) : '')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()

  const Icon = def.icon

  function save(nextEnabled?: boolean) {
    const payload: PaymentInput = {
      gateway: def.gateway,
      enabled: controlled ? codEnabled : (nextEnabled ?? enabled),
      displayName,
      instructions,
      fixedFee: def.hasFee ? fee : '',
    }
    setMsg(null)
    start(async () => {
      const res = await savePaymentMethodAction(payload)
      setMsg(res?.error ? { ok: false, text: res.error } : { ok: true, text: 'اتحفظ' })
    })
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">{def.title}</h2>
          <p className="mt-0.5 text-sm text-[var(--fg-muted)]">{def.desc}</p>
        </div>
        {controlled ? (
          <a
            href="/dashboard/shipping"
            className={`mt-0.5 flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors ${
              enabled
                ? 'bg-[var(--color-success-soft)] text-[var(--color-success)]'
                : 'bg-[var(--surface-2)] text-[var(--fg-muted)]'
            }`}
            title="بيتفتح ويتقفل من إعدادات الشحن"
          >
            <Truck className="h-3.5 w-3.5" aria-hidden="true" />
            {enabled ? 'مفتوح' : 'مقفول'}
          </a>
        ) : (
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label={enabled ? `إيقاف ${def.title}` : `تفعيل ${def.title}`}
            disabled={pending}
            onClick={() => {
              setEnabled(!enabled)
              save(!enabled)
            }}
            className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${
              enabled ? 'bg-[var(--primary)]' : 'bg-[var(--border-strong)]'
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                enabled ? 'start-0.5' : 'start-[1.375rem]'
              }`}
            />
          </button>
        )}
      </div>

      {(enabled || controlled) && (
        <div className="flex flex-col gap-4 border-t border-[var(--border)] pt-4">
          {msg && <Alert tone={msg.ok ? 'success' : 'danger'}>{msg.text}</Alert>}

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">الاسم اللي يشوفه العميل</span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="h-11 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm focus:border-[var(--primary)] focus:outline-none"
            />
          </label>

          {controlled && (
            <p className="rounded-lg bg-[var(--surface-2)] px-3 py-2 text-xs leading-relaxed text-[var(--fg-muted)]">
              فتح الدفع عند الاستلام وقفله من{' '}
              <a href="/dashboard/shipping" className="font-medium text-[var(--primary)] hover:underline">
                إعدادات الشحن
              </a>
              . هنا بتظبّط اسمه ورسومه بس.
            </p>
          )}

          {def.hasFee && (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">رسوم إضافية (اختياري)</span>
              <input
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                inputMode="decimal"
                dir="ltr"
                placeholder="0"
                className="h-11 w-40 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-start text-sm tabular-nums focus:border-[var(--primary)] focus:outline-none"
              />
              <span className="text-xs text-[var(--fg-subtle)]">بتتضاف على إجمالي الطلب. سيبها فاضية لو مفيش رسوم.</span>
            </label>
          )}

          {def.hasInstructions && (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">{def.instructionsLabel}</span>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={3}
                className="rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2.5 text-sm leading-relaxed focus:border-[var(--primary)] focus:outline-none"
              />
              {def.instructionsHint && (
                <span className="text-xs text-[var(--fg-subtle)]">{def.instructionsHint}</span>
              )}
            </label>
          )}

          <button
            type="button"
            onClick={() => save()}
            disabled={pending}
            className="flex min-h-10 w-fit items-center gap-2 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-fg)] transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            حفظ
          </button>
        </div>
      )}
    </Card>
  )
}
