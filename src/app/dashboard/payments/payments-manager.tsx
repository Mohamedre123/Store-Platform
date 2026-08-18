'use client'

import { useState, useTransition } from 'react'
import { Banknote, Check, Landmark, Lock, Wallet } from 'lucide-react'
import { savePaymentMethodAction, type PaymentInput } from './actions'
import { Alert, Card } from '@/components/ui'
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

// بوابات محتاجة عقد ومفاتيح API — معروضة عشان التاجر يعرف إنها جاية
const GATEWAYS = [
  { name: 'باي موب (Paymob)', desc: 'فيزا/ماستر كارد ومحافظ' },
  { name: 'فوري (Fawry)', desc: 'دفع بكود في أي فرع' },
  { name: 'كاشير (Kashier)', desc: 'بطاقات ومحافظ' },
  { name: 'تابي / تمارا', desc: 'قسّط على دفعات' },
]

export function PaymentsManager({ methods }: { methods: PaymentRow[] }) {
  const byGateway = new Map(methods.map((m) => [m.gateway, m]))

  return (
    <div className="flex flex-col gap-4">
      {METHODS.map((def) => (
        <MethodCard key={def.gateway} def={def} saved={byGateway.get(def.gateway)} />
      ))}

      <Card className="flex flex-col gap-3 p-5 opacity-95">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-[var(--fg-subtle)]" aria-hidden="true" />
          <h2 className="font-semibold">بوابات الدفع الإلكتروني</h2>
        </div>
        <p className="text-sm text-[var(--fg-muted)]">
          الدفع بالبطاقة والمحافظ عبر بوابة — محتاج حساب وعقد مع البوابة ومفاتيح API. جاهزين للربط
          أول ما تبعت المفاتيح.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {GATEWAYS.map((g) => (
            <div
              key={g.name}
              className="flex items-center gap-3 rounded-lg border border-[var(--border)] px-3 py-2.5"
            >
              <Wallet className="h-4 w-4 shrink-0 text-[var(--fg-subtle)]" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{g.name}</span>
                <span className="block text-xs text-[var(--fg-subtle)]">{g.desc}</span>
              </div>
              <span className="shrink-0 rounded-md bg-[var(--surface-2)] px-2 py-1 text-xs text-[var(--fg-muted)]">
                محتاج تكامل
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function MethodCard({ def, saved }: { def: MethodDef; saved?: PaymentRow }) {
  const [enabled, setEnabled] = useState(saved?.enabled ?? def.gateway === 'cod')
  const [displayName, setDisplayName] = useState(saved?.displayName ?? def.defaultName)
  const [instructions, setInstructions] = useState(saved?.instructions ?? '')
  const [fee, setFee] = useState(saved?.fixedFee ? String(fromMinorUnits(saved.fixedFee)) : '')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()

  const Icon = def.icon

  function save(nextEnabled?: boolean) {
    const payload: PaymentInput = {
      gateway: def.gateway,
      enabled: nextEnabled ?? enabled,
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
      </div>

      {enabled && (
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
