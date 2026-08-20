'use client'

import { useState, useTransition } from 'react'
import { Check, Save } from 'lucide-react'
import { saveRegionalAction, saveStoreInfoAction } from './actions'
import { Alert, Card } from '@/components/ui'
import { ImproveButton } from '@/components/dashboard/improve-button'
import { Choice, Toggle } from '@/components/dashboard/controls'
import { ImageUpload } from '@/components/ui/image-upload'
import { COUNTRIES } from '@/lib/regions'

const CURRENCIES = [
  { value: 'EGP', label: 'جنيه مصري' },
  { value: 'SAR', label: 'ريال سعودي' },
  { value: 'AED', label: 'درهم إماراتي' },
  { value: 'USD', label: 'دولار' },
]

const field =
  'h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm transition-colors focus:border-[var(--primary)] focus:outline-none'

export function SettingsForm({
  store,
}: {
  store: {
    name: string
    tagline: string | null
    email: string | null
    phone: string | null
    whatsapp: string | null
    logoLight: string | null
    favicon: string | null
    country: string
    currency: string
    vatEnabled: boolean
    vatRate: number
    vatIncludedInPrice: boolean
  }
}) {
  /* ── بيانات المتجر ── */
  const [name, setName] = useState(store.name)
  const [tagline, setTagline] = useState(store.tagline ?? '')
  const [email, setEmail] = useState(store.email ?? '')
  const [phone, setPhone] = useState(store.phone ?? '')
  const [whatsapp, setWhatsapp] = useState(store.whatsapp ?? '')
  const [logoLight, setLogoLight] = useState<string | null>(store.logoLight)
  const [favicon, setFavicon] = useState<string | null>(store.favicon)
  const [infoMsg, setInfoMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [savingInfo, startInfo] = useTransition()

  /* ── الإقليمية ── */
  const [country, setCountry] = useState(store.country)
  const [currency, setCurrency] = useState(store.currency)
  const [vatEnabled, setVatEnabled] = useState(store.vatEnabled)
  const [vatRate, setVatRate] = useState(String(store.vatRate / 100))
  const [vatIncluded, setVatIncluded] = useState(store.vatIncludedInPrice)
  const [regionMsg, setRegionMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [savingRegion, startRegion] = useTransition()

  function saveInfo() {
    setInfoMsg(null)
    startInfo(async () => {
      const res = await saveStoreInfoAction({ name, tagline, email, phone, whatsapp, logoLight, favicon })
      setInfoMsg(res?.error ? { ok: false, text: res.error } : { ok: true, text: 'اتحفظ' })
    })
  }

  function saveRegion() {
    setRegionMsg(null)
    startRegion(async () => {
      const res = await saveRegionalAction({
        country,
        currency,
        vatEnabled,
        vatRate,
        vatIncludedInPrice: vatIncluded,
      })
      setRegionMsg(res?.error ? { ok: false, text: res.error } : { ok: true, text: 'اتحفظ' })
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* بيانات المتجر */}
      <Card className="flex flex-col gap-5 p-5">
        <div>
          <h2 className="font-semibold">بيانات المتجر</h2>
          <p className="mt-0.5 text-sm text-[var(--fg-muted)]">
            دي اللي بتظهر للعميل في متجرك وفي رسائل التأكيد.
          </p>
        </div>

        {infoMsg && <Alert tone={infoMsg.ok ? 'success' : 'danger'}>{infoMsg.text}</Alert>}

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">اسم المتجر</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={field} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="flex flex-wrap items-center justify-between gap-2 text-sm font-medium">
            وصف قصير
            <ImproveButton
              task="store_tagline"
              value={tagline}
              onApply={setTagline}
              fields={{ 'اسم المتجر': name }}
              compact
            />
          </span>
          <input
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="أحسن ملابس رجالي في مصر"
            className={field}
          />
          <span className="text-xs text-[var(--fg-subtle)]">بيظهر تحت اسم المتجر وفي نتايج البحث.</span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">تليفون المتجر</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              dir="ltr"
              placeholder="01012345678"
              className={`${field} text-start`}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">واتساب</span>
            <input
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              dir="ltr"
              placeholder="01012345678"
              className={`${field} text-start`}
            />
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">بريد المتجر</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            dir="ltr"
            placeholder="store@example.com"
            className={`${field} text-start`}
          />
        </label>

        <div className="flex flex-col gap-4 border-t border-[var(--border)] pt-5">
          <div>
            <h3 className="text-sm font-medium">شعار متجرك</h3>
            <p className="mt-0.5 text-xs text-[var(--fg-subtle)]">
              بيظهر في هيدر متجرك وشاشة التحميل. PNG بخلفية شفافة، ١:١.
            </p>
          </div>
          <ImageUpload
            label="الشعار"
            value={logoLight ? [logoLight] : []}
            onChange={(urls) => setLogoLight(urls[0] ?? null)}
            folder="logos"
          />
          <ImageUpload
            label="أيقونة المتصفح (Favicon)"
            value={favicon ? [favicon] : []}
            onChange={(urls) => setFavicon(urls[0] ?? null)}
            folder="logos"
          />
        </div>

        <button
          type="button"
          onClick={saveInfo}
          disabled={savingInfo}
          className="flex min-h-11 w-fit items-center gap-2 rounded-lg bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-fg)] transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {infoMsg?.ok ? <Check className="h-4 w-4" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
          حفظ بيانات المتجر
        </button>
      </Card>

      {/* الدولة والعملة والضريبة */}
      <Card className="flex flex-col gap-5 p-5">
        <div>
          <h2 className="font-semibold">الدولة والعملة والضريبة</h2>
          <p className="mt-0.5 text-sm text-[var(--fg-muted)]">
            الدولة بتحدّد المحافظات في الشحن والشيك أوت.
          </p>
        </div>

        {regionMsg && <Alert tone={regionMsg.ok ? 'success' : 'danger'}>{regionMsg.text}</Alert>}

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">الدولة</span>
          <select value={country} onChange={(e) => setCountry(e.target.value)} className={field}>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">العملة</span>
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={field}>
            {CURRENCIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          {currency !== store.currency && (
            <span className="text-xs text-[var(--color-warning)]">
              تنبيه: تغيير العملة بيغيّر رمزها في العرض بس — الأسعار المسجّلة ما بتتحوّلش تلقائيًا.
            </span>
          )}
        </label>

        <div className="flex flex-col gap-4 border-t border-[var(--border)] pt-5">
          <Toggle
            label="تفعيل ضريبة القيمة المضافة"
            hint="لو متجرك مسجّل ضريبيًا."
            checked={vatEnabled}
            onChange={setVatEnabled}
          />
          {vatEnabled && (
            <>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">نسبة الضريبة (%)</span>
                <input
                  value={vatRate}
                  onChange={(e) => setVatRate(e.target.value)}
                  inputMode="decimal"
                  dir="ltr"
                  placeholder="14"
                  className={`${field} w-32 text-start tabular-nums`}
                />
              </label>
              <Choice
                label="الضريبة محسوبة إزاي"
                value={vatIncluded ? 'included' : 'added'}
                options={[
                  { value: 'included', label: 'مضمّنة في السعر' },
                  { value: 'added', label: 'تتضاف على السعر' },
                ]}
                onChange={(v) => setVatIncluded(v === 'included')}
                columns={2}
              />
            </>
          )}
        </div>

        <button
          type="button"
          onClick={saveRegion}
          disabled={savingRegion}
          className="flex min-h-11 w-fit items-center gap-2 rounded-lg bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-fg)] transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {regionMsg?.ok ? <Check className="h-4 w-4" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
          حفظ الإعدادات
        </button>
      </Card>
    </div>
  )
}
