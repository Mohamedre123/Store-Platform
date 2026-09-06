'use client'

import { useState, useTransition } from 'react'
import { Globe, Plus, Star, Trash2, X } from 'lucide-react'
import { deleteMarketAction, saveMarketAction } from './actions'
import {
  COMMON_MARKETS,
  RATE_SCALE,
  ROUNDING_MODES,
  convertPrice,
  countryFlag,
  type MarketRow,
  type RoundingMode,
} from '@/lib/markets-meta'
import { Alert, Button, Card, Field, Input } from '@/components/ui'
import { Toggle } from '@/components/dashboard/controls'
import { toast } from '@/components/dashboard/toast'
import { cn, formatMoney } from '@/lib/utils'

type Draft = {
  id?: string
  name: string
  country: string
  currency: string
  rate: string
  rounding: RoundingMode
  isDefault: boolean
  isActive: boolean
}

const empty = (): Draft => ({
  name: '',
  country: '',
  currency: '',
  rate: '1',
  rounding: 'nearest',
  isDefault: false,
  isActive: true,
})

/**
 * الأسواق — بلد وعملة وسعر تحويل.
 *
 * ## ليه سعر التاجر لا سعر البورصة
 * سعر الصرف الحقيقي بيتحرّك كل ساعة. التاجر اللي أسعاره بتتغيّر
 * وراه من غير علمه بيلاقي هامشه اتاكل في يوم — والأسوأ إنه ما
 * يعرفش ليه. الرقم هنا بإيده، وبيغيّره لما يقرّر.
 *
 * ## والمعاينة الحيّة هي الشرح
 * التاجر ما بيقراش عن «نقاط أساس» ولا «تقريب». لكن لما يشوف ٤٩٩
 * جنيه بتبقى ٣٨.٩٩ ريال وهو بيكتب، بيفهم لوحده — وبيعدّل الرقم
 * لحد ما يعجبه.
 */
export function MarketsManager({
  markets,
  baseCurrency,
}: {
  markets: MarketRow[]
  baseCurrency: string
}) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function save() {
    if (!draft) return
    setError(null)
    start(async () => {
      const res = await saveMarketAction(draft)
      if (res?.error) setError(res.error)
      else {
        toast(draft.id ? 'السوق اتحفظ' : 'السوق اتضاف')
        setDraft(null)
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {markets.length === 0 && !draft && (
        <Card className="flex flex-col items-center gap-2 px-6 py-12 text-center">
          <Globe className="h-8 w-8 text-[var(--fg-subtle)]" aria-hidden="true" />
          <h2 className="text-lg font-semibold">متجرك بعملة واحدة دلوقتي</h2>
          <p className="max-w-md text-sm leading-relaxed text-[var(--fg-muted)]">
            كل أسعارك بالـ{baseCurrency}، وده تمام لو بتبيع في مصر بس. لو بتشحن للخليج، ضيف سوقًا
            وهيشوف العميل السعر بعملته — واللي بيقعد يحسب السعر مش بيشتري.
          </p>
        </Card>
      )}

      {markets.map((m) =>
        draft?.id === m.id ? (
          <MarketForm
            key={m.id}
            draft={draft}
            setDraft={setDraft}
            baseCurrency={baseCurrency}
            error={error}
            pending={pending}
            onSave={save}
            onCancel={() => setDraft(null)}
          />
        ) : (
          <Card
            key={m.id}
            className={cn('flex flex-wrap items-center gap-3 p-4', !m.isActive && 'opacity-60')}
          >
            <span className="text-2xl leading-none" aria-hidden="true">
              {countryFlag(m.country)}
            </span>

            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-semibold">{m.name}</span>
                {m.isDefault && (
                  <span className="flex items-center gap-1 rounded bg-[var(--primary-soft)] px-1.5 py-0.5 text-[11px] text-[var(--primary)]">
                    <Star className="h-3 w-3" aria-hidden="true" />
                    الافتراضي
                  </span>
                )}
                {!m.isActive && (
                  <span className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[11px] text-[var(--fg-muted)]">
                    متوقّف
                  </span>
                )}
              </span>
              <span dir="ltr" className="block text-start text-xs text-[var(--fg-subtle)]">
                {m.country} · 1 {baseCurrency} = {(m.rateMicros / RATE_SCALE).toFixed(4)} {m.currency}
              </span>
            </span>

            {/* مثال حيّ — ٤٩٩ بعملة المتجر تبقى كام هنا */}
            <span className="tabular shrink-0 text-xs text-[var(--fg-muted)]">
              {formatMoney(49900, baseCurrency)} ={' '}
              <strong className="text-[var(--fg)]">
                {formatMoney(convertPrice(49900, m.rateMicros, m.rounding), m.currency)}
              </strong>
            </span>

            <div className="flex shrink-0 gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setDraft({
                    id: m.id,
                    name: m.name,
                    country: m.country,
                    currency: m.currency,
                    rate: String(m.rateMicros / RATE_SCALE),
                    rounding: m.rounding,
                    isDefault: m.isDefault,
                    isActive: m.isActive,
                  })
                }
              >
                تعديل
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`احذف ${m.name}`}
                onClick={() => {
                  if (!confirm(`هتشيل سوق ${m.name}؟ الطلبات القديمة منه مش هتتأثر.`)) return
                  start(async () => {
                    await deleteMarketAction(m.id)
                    toast('السوق اتشال')
                  })
                }}
              >
                <Trash2 className="h-4 w-4 text-[var(--color-danger)]" aria-hidden="true" />
              </Button>
            </div>
          </Card>
        ),
      )}

      {draft && !draft.id && (
        <MarketForm
          draft={draft}
          setDraft={setDraft}
          baseCurrency={baseCurrency}
          error={error}
          pending={pending}
          onSave={save}
          onCancel={() => setDraft(null)}
        />
      )}

      {!draft && (
        <Button variant="secondary" className="self-start" onClick={() => setDraft(empty())}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          ضيف سوق
        </Button>
      )}
    </div>
  )
}

function MarketForm({
  draft,
  setDraft,
  baseCurrency,
  error,
  pending,
  onSave,
  onCancel,
}: {
  draft: Draft
  setDraft: (d: Draft) => void
  baseCurrency: string
  error: string | null
  pending: boolean
  onSave: () => void
  onCancel: () => void
}) {
  const rate = Number(draft.rate)
  const rateMicros = Number.isFinite(rate) && rate > 0 ? Math.round(rate * RATE_SCALE) : 0

  return (
    <Card className="flex flex-col gap-4 p-4">
      {/* اختصارات البلاد الشائعة — التاجر ما يكتبش كود ولا عملة */}
      {!draft.id && (
        <div className="flex flex-wrap gap-1.5">
          {COMMON_MARKETS.map((c) => (
            <button
              key={c.country}
              type="button"
              onClick={() =>
                setDraft({ ...draft, name: c.name, country: c.country, currency: c.currency })
              }
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs transition-colors',
                draft.country === c.country
                  ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]'
                  : 'border-[var(--border-strong)] text-[var(--fg-muted)]',
              )}
            >
              <span aria-hidden="true">{countryFlag(c.country)}</span>
              {c.name}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="اسم السوق" required htmlFor="m-name">
          <Input
            id="m-name"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="السعودية"
            maxLength={60}
          />
        </Field>

        <Field label="كود البلد" required htmlFor="m-country" hint="حرفين — SA">
          <Input
            id="m-country"
            dir="ltr"
            className="text-start uppercase"
            value={draft.country}
            onChange={(e) => setDraft({ ...draft, country: e.target.value.toUpperCase() })}
            maxLength={2}
          />
        </Field>

        <Field label="العملة" required htmlFor="m-currency" hint="تلات حروف — SAR">
          <Input
            id="m-currency"
            dir="ltr"
            className="text-start uppercase"
            value={draft.currency}
            onChange={(e) => setDraft({ ...draft, currency: e.target.value.toUpperCase() })}
            maxLength={3}
          />
        </Field>
      </div>

      <Field
        label={`1 ${baseCurrency} = كام ${draft.currency || '؟'}`}
        required
        htmlFor="m-rate"
        hint="سعرك إنت — مش بنجيبه من بورصة. غيّره لما تقرّر، وأسعارك ما بتتحركش وراك."
      >
        <Input
          id="m-rate"
          type="number"
          step="0.000001"
          min={0}
          inputMode="decimal"
          dir="ltr"
          className="text-start"
          value={draft.rate}
          onChange={(e) => setDraft({ ...draft, rate: e.target.value })}
          placeholder="0.077"
        />
      </Field>

      <Field label="تقريب السعر">
        <div className="flex flex-wrap gap-2">
          {ROUNDING_MODES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setDraft({ ...draft, rounding: r.key })}
              className={cn(
                'flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-start transition-colors',
                draft.rounding === r.key
                  ? 'border-[var(--primary)] bg-[var(--primary-soft)]'
                  : 'border-[var(--border-strong)]',
              )}
            >
              <span
                className={cn(
                  'text-sm font-medium',
                  draft.rounding === r.key && 'text-[var(--primary)]',
                )}
              >
                {r.label}
              </span>
              <span className="text-[11px] text-[var(--fg-subtle)]">{r.hint}</span>
            </button>
          ))}
        </div>
      </Field>

      {/*
        المعاينة الحيّة — هي اللي بتشرح الإعداد.

        التاجر مش هيقرا عن التقريب ولا عن المليون. لكن لما يشوف
        تلات أسعار حقيقية من كتالوجه بتتحوّل وهو بيكتب، بيفهم
        الفرق ويعدّل الرقم لحد ما يعجبه.
      */}
      {rateMicros > 0 && draft.currency && (
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 rounded-lg bg-[var(--surface-2)] px-3.5 py-2.5 text-xs">
          {[9900, 49900, 199900].map((amount) => (
            <span key={amount} className="tabular">
              {formatMoney(amount, baseCurrency)} →{' '}
              <strong>
                {formatMoney(convertPrice(amount, rateMicros, draft.rounding), draft.currency)}
              </strong>
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Toggle
          label="السوق الافتراضي"
          hint="اللي بيشوفه الزائر اللي مش من بلد عندك سوق ليه."
          checked={draft.isDefault}
          onChange={(x) => setDraft({ ...draft, isDefault: x })}
        />
        <Toggle
          label="شغّال"
          checked={draft.isActive}
          onChange={(x) => setDraft({ ...draft, isActive: x })}
        />
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="flex flex-wrap gap-2">
        <Button onClick={onSave} loading={pending}>
          احفظ السوق
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          <X className="h-4 w-4" aria-hidden="true" />
          إلغاء
        </Button>
      </div>
    </Card>
  )
}
