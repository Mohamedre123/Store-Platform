'use client'

import { useState, useTransition } from 'react'
import { Banknote, Check, Download, Save, Wand2 } from 'lucide-react'
import {
  applyZonePricesAction,
  fetchCarrierRatesAction,
  saveCodAction,
  saveRatesAction,
  saveZoneAction,
} from './actions'
import type { Region } from '@/lib/regions'
import type { ShippingZoneDef } from '@/lib/shipping-zones'
import { Alert, Button, Card, Field, Input } from '@/components/ui'
import { Toggle } from '@/components/dashboard/controls'
import { fromMinorUnits } from '@/lib/utils'

type Zone = {
  enabled: boolean
  defaultPrice: number
  freeShippingEnabled: boolean
  freeOverAmount: number
  minDays: number
  maxDays: number
  codEnabled: boolean
}

const asAmount = (v: number) => (v ? String(fromMinorUnits(v)) : '')

export function ShippingForm({
  country,
  currency,
  regions,
  zone,
  rates,
  zones,
  carrier,
}: {
  country: string
  currency: string
  regions: Region[]
  zone: Zone
  rates: Record<string, { price: number; enabled: boolean }>
  /** مناطق التسعير — التاجر بيكتب سعر المنطقة وإحنا بنفرده */
  zones: ShippingZoneDef[]
  /**
   * شركة الشحن المربوطة، لو فيه.
   *
   * **الجدول ما بيتقفلش لما تبقى موجودة.** كان بيتقفل، والفكرة كانت
   * إن أسعارها هي اللي بتحكم — بس هي ما كانتش بتملا حاجة، فالتاجر
   * كان بيبص على ٢٧ خانة فاضية مقفولة ومش عارف هيتحاسب بكام. دلوقتي
   * بنجيب تعريفتها ونكتبها في نفس الخانات، فهو شايف الأرقام وقادر
   * يعدّلها.
   */
  carrier: { name: string; canFetch: boolean } | null
}) {
  const [enabled, setEnabled] = useState(zone.enabled)
  const [defaultPrice, setDefaultPrice] = useState(asAmount(zone.defaultPrice))
  const [freeEnabled, setFreeEnabled] = useState(zone.freeShippingEnabled)
  const [freeOver, setFreeOver] = useState(asAmount(zone.freeOverAmount))
  const [minDays, setMinDays] = useState(zone.minDays)
  const [maxDays, setMaxDays] = useState(zone.maxDays)
  const [cod, setCod] = useState(zone.codEnabled)

  const [cityRates, setCityRates] = useState<Record<string, string>>(() =>
    Object.fromEntries(regions.map((r) => [r.name, rates[r.name] ? asAmount(rates[r.name].price) : ''])),
  )

  const [pending, start] = useTransition()
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [codMsg, setCodMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [, startCod] = useTransition()

  /**
   * الدفع عند الاستلام بيتحفظ لحظة ما المفتاح يتحرّك.
   *
   * لأنه مش جزء من نموذج التسعير: التاجر اللي بيقفله عايزه يتقفل
   * دلوقتي، مش يفتكر إنه قفله ويكتشف بعد طلبين إنه نسي يدوس «حفظ».
   */
  function saveCod(next: boolean) {
    setCodMsg(null)
    startCod(async () => {
      const res = await saveCodAction(country, next)
      if (res?.error) {
        setCod(!next)
        setCodMsg({ ok: false, text: res.error })
      } else {
        setCodMsg({ ok: true, text: next ? 'مفتوح — هيظهر للعميل في الشيك أوت' : 'مقفول — مش هيظهر للعميل' })
      }
    })
  }

  function saveAll() {
    setMessage(null)
    start(async () => {
      const zoneResult = await saveZoneAction({
        country,
        enabled,
        defaultPrice,
        freeShippingEnabled: freeEnabled,
        freeOverAmount: freeOver,
        minDays,
        maxDays,
        codEnabled: cod,
      })

      if (zoneResult?.error) {
        setMessage({ ok: false, text: zoneResult.error })
        return
      }

      const rateResult = await saveRatesAction(
        country,
        regions.map((r) => ({ city: r.name, price: cityRates[r.name] ?? '', enabled: true })),
      )

      setMessage(
        rateResult?.error
          ? { ok: false, text: rateResult.error }
          : { ok: true, text: 'اتحفظ. الأسعار دي هتظهر للعملاء في الشيك أوت فورًا.' },
      )
    })
  }

  const filledCount = Object.values(cityRates).filter((v) => v.trim() !== '').length

  /* أسعار المناطق — خمس خانات بتتفرد على الـ٢٧ */
  const [zonePrices, setZonePrices] = useState<Record<string, string>>({})
  const [fillMsg, setFillMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [filling, startFill] = useTransition()

  /** بياخد اللي الخادم كتبه ويحطّه في الخانات — من غير إعادة تحميل */
  function applyReturned(applied: Record<string, string> | undefined) {
    if (!applied) return
    setCityRates((prev) => ({ ...prev, ...applied }))
  }

  function fillFromCarrier() {
    setFillMsg(null)
    startFill(async () => {
      const res = await fetchCarrierRatesAction(country)
      if (res?.error) {
        setFillMsg({ ok: false, text: res.error })
        return
      }
      applyReturned(res?.applied)
      setFillMsg({
        ok: true,
        text: `جبنا تعريفة ${res?.carrier ?? 'الشركة'} وملينا ${res?.filled ?? 0} محافظة. راجعها واحفظ.`,
      })
    })
  }

  function fillFromZones() {
    setFillMsg(null)
    startFill(async () => {
      const res = await applyZonePricesAction(country, zonePrices)
      if (res?.error) {
        setFillMsg({ ok: false, text: res.error })
        return
      }
      applyReturned(res?.applied)
      setFillMsg({ ok: true, text: `اتملت ${res?.filled ?? 0} محافظة. راجعها واحفظ.` })
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {message && <Alert tone={message.ok ? 'success' : 'danger'}>{message.text}</Alert>}

      {/*
        الدفع عند الاستلام برّه أي قفل.

        هو مش بند تسعير — هو قرار «أقبل فلوس على الباب ولا لأ»،
        وبيفضل قرار التاجر حتى لو ربط شركة شحن بتحصّل عنه. قفله
        مع التسعير كان بيخلّي التاجر اللي ربط شركة يفقد أهم طريقة
        دفع في السوق المصري من غير ما يقصد.
      */}
      <Card className="flex flex-col gap-4 p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
            <Banknote className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">الدفع عند الاستلام</h2>
            <p className="mt-0.5 text-sm text-[var(--fg-muted)]">
              العميل بيدفع كاش للمندوب. أغلب مبيعات المتاجر المصرية بتيجي منه —
              اقفله بس لو شركة الشحن عندك ما بتحصّلش، أو نسبة الرفض عالية عندك.
            </p>
          </div>
          <Toggle
            label=""
            srLabel="الدفع عند الاستلام"
            checked={cod}
            onChange={(v) => {
              setCod(v)
              saveCod(v)
            }}
          />
        </div>
        {codMsg && (
          <p
            className="rounded-lg px-3 py-2 text-xs"
            style={{
              background: codMsg.ok ? 'var(--color-success-soft)' : 'var(--color-danger-soft)',
              color: codMsg.ok ? 'var(--color-success)' : 'var(--color-danger)',
            }}
          >
            {codMsg.text}
          </p>
        )}
      </Card>

      <div className="flex flex-col gap-6">

      {/* الإعدادات العامة */}
      <Card className="flex flex-col gap-5 p-5">
        <h2 className="font-semibold">إعدادات عامة</h2>

        <Toggle
          label="الشحن مفعّل"
          hint="لو أطفيتها، العملاء مش هيقدروا يطلبوا توصيل للدولة دي."
          checked={enabled}
          onChange={setEnabled}
        />

        <Field
          label={`سعر الشحن الافتراضي (${currency})`}
          htmlFor="defaultPrice"
          hint="بينطبق على أي محافظة ما حدّدتش لها سعر خاص تحت."
        >
          <Input
            id="defaultPrice"
            value={defaultPrice}
            onChange={(e) => setDefaultPrice(e.target.value)}
            inputMode="decimal"
            dir="ltr"
            className="text-start"
            placeholder="50"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="أقل مدة توصيل" htmlFor="minDays">
            <Input
              id="minDays"
              type="number"
              min={0}
              value={minDays}
              onChange={(e) => setMinDays(Number(e.target.value))}
              dir="ltr"
              className="text-start"
            />
          </Field>
          <Field label="أقصى مدة توصيل" htmlFor="maxDays">
            <Input
              id="maxDays"
              type="number"
              min={0}
              value={maxDays}
              onChange={(e) => setMaxDays(Number(e.target.value))}
              dir="ltr"
              className="text-start"
            />
          </Field>
        </div>

        <div className="border-t border-[var(--border)] pt-5">
          <Toggle
            label="شحن مجاني فوق مبلغ"
            hint="من أقوى الحاجات اللي بترفع قيمة الطلب — العميل بيزوّد عشان يوصل للحد."
            checked={freeEnabled}
            onChange={setFreeEnabled}
          />
          {freeEnabled && (
            <div className="mt-4">
              <Field label={`الشحن مجاني فوق (${currency})`} htmlFor="freeOver">
                <Input
                  id="freeOver"
                  value={freeOver}
                  onChange={(e) => setFreeOver(e.target.value)}
                  inputMode="decimal"
                  dir="ltr"
                  className="text-start"
                  placeholder="1000"
                />
              </Field>
            </div>
          )}
        </div>
      </Card>

      {/*
        الملء السريع.

        التاجر مالوش ٢٧ سعر — شركة الشحن بتدّيه كارت بالمناطق:
        القاهرة الكبرى بكذا، الدلتا بكذا، الصعيد بكذا. فكان بيقعد
        يترجم الكارت لـ٢٧ خانة بإيده، وبينسى محافظة فتتسعّر غلط
        والفرق بيطلع من ربحه على كل طلب.
      */}
      <Card className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-1">
          <h2 className="font-semibold">املا الأسعار مرة واحدة</h2>
          <p className="text-sm leading-relaxed text-[var(--fg-muted)]">
            {carrier
              ? `${carrier.name} مربوطة. اسحب تعريفتها، أو اكتب أسعار المناطق بنفسك.`
              : 'اكتب سعر كل منطقة، وإحنا نفرده على محافظاتها.'}
          </p>
        </div>

        {carrier?.canFetch && (
          <Button variant="secondary" className="self-start" loading={filling} onClick={fillFromCarrier}>
            <Download className="h-4 w-4" aria-hidden="true" />
            هات أسعار {carrier.name}
          </Button>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          {zones.map((z) => (
            <label
              key={z.key}
              className="flex items-center gap-3 rounded-lg border border-[var(--border)] px-3 py-2"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{z.label}</span>
                <span className="block truncate text-xs text-[var(--fg-subtle)]">{z.hint}</span>
              </span>
              <input
                value={zonePrices[z.key] ?? ''}
                onChange={(e) => setZonePrices((prev) => ({ ...prev, [z.key]: e.target.value }))}
                inputMode="decimal"
                dir="ltr"
                placeholder="—"
                aria-label={`سعر الشحن لمنطقة ${z.label}`}
                className="h-9 w-20 shrink-0 rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-2 text-start text-sm tabular-nums focus:border-[var(--primary)] focus:outline-none"
              />
            </label>
          ))}
        </div>

        <Button
          variant="secondary"
          className="self-start"
          loading={filling}
          disabled={Object.values(zonePrices).every((v) => !v.trim())}
          onClick={fillFromZones}
        >
          <Wand2 className="h-4 w-4" aria-hidden="true" />
          افرد على المحافظات
        </Button>

        {fillMsg && <Alert tone={fillMsg.ok ? 'success' : 'danger'}>{fillMsg.text}</Alert>}
      </Card>

      {/* أسعار المحافظات */}
      <Card className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">سعر كل محافظة</h2>
            <p className="mt-1 text-sm text-[var(--fg-muted)]">
              سيب الخانة فاضية عشان تاخد السعر الافتراضي.
              {filledCount > 0 && ` (${filledCount} محافظة بسعر خاص)`}
            </p>
          </div>

          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              // نسخ السعر الافتراضي على الكل — أسرع من كتابته ٢٧ مرة
              if (!defaultPrice.trim()) return
              setCityRates(Object.fromEntries(regions.map((r) => [r.name, defaultPrice])))
            }}
          >
            <Wand2 className="h-4 w-4" aria-hidden="true" />
            طبّق الافتراضي على الكل
          </Button>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {regions.map((r) => (
            <label
              key={r.code}
              className="flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2"
            >
              <span className="min-w-0 flex-1 truncate text-sm">{r.name}</span>
              <input
                value={cityRates[r.name] ?? ''}
                onChange={(e) => setCityRates((prev) => ({ ...prev, [r.name]: e.target.value }))}
                inputMode="decimal"
                dir="ltr"
                placeholder={defaultPrice || '—'}
                aria-label={`سعر الشحن لـ${r.name}`}
                className="h-9 w-20 rounded-md border border-[var(--border-strong)] bg-[var(--surface)] px-2 text-start text-sm tabular-nums focus:border-[var(--primary)] focus:outline-none"
              />
            </label>
          ))}
        </div>
      </Card>

      <div className="sticky bottom-0 -mx-4 flex items-center gap-3 border-t border-[var(--border)] bg-[var(--surface)]/95 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6">
        <Button onClick={saveAll} loading={pending}>
          {message?.ok ? <Check className="h-4 w-4" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
          حفظ إعدادات الشحن
        </Button>
      </div>
      </div>
    </div>
  )
}
