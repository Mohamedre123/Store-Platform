'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { Check, ImageIcon, Plus, Trash2, X } from 'lucide-react'
import {
  deleteBannerAction,
  saveBannerAction,
  toggleBannerAction,
  type BannerInput,
} from './actions'
import { Alert, Button, Card } from '@/components/ui'
import { ImproveButton } from '@/components/dashboard/improve-button'
import { Choice, Toggle } from '@/components/dashboard/controls'
import { ImageUpload } from '@/components/ui/image-upload'
import { ImageSpecHint } from '../image-spec-hint'

export type BannerRow = {
  id: string
  placement: 'hero' | 'promo' | 'category' | 'popup'
  title: string | null
  subtitle: string | null
  imageDesktop: string | null
  imageMobile: string | null
  ctaLabel: string | null
  ctaUrl: string | null
  startsAt: Date | null
  endsAt: Date | null
  isActive: boolean
}

const PLACEMENTS = [
  { value: 'promo' as const, label: 'شريط ترويجي' },
  { value: 'category' as const, label: 'بانر قسم' },
]

const PLACEMENT_LABEL: Record<string, string> = {
  hero: 'البانر الرئيسي',
  promo: 'شريط ترويجي',
  category: 'بانر قسم',
  popup: 'نافذة منبثقة',
}

const toDateInput = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : '')

const emptyBanner = (): BannerInput => ({
  placement: 'promo',
  title: '',
  subtitle: '',
  imageDesktop: null,
  imageMobile: null,
  ctaLabel: '',
  ctaUrl: '',
  startsAt: '',
  endsAt: '',
  isActive: true,
})

const field =
  'w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm focus:border-[var(--primary)] focus:outline-none'

export function BannersManager({ banners }: { banners: BannerRow[] }) {
  const [form, setForm] = useState<BannerInput | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function save() {
    if (!form) return
    setError(null)
    start(async () => {
      const res = await saveBannerAction(form)
      if (res?.error) setError(res.error)
      else setForm(null)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {!form && (
        <Button onClick={() => setForm(emptyBanner())} className="self-start">
          <Plus className="h-4 w-4" aria-hidden="true" />
          بانر جديد
        </Button>
      )}

      {form && (
        <Card className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{form.id ? 'تعديل البانر' : 'بانر جديد'}</h2>
            <button
              type="button"
              onClick={() => setForm(null)}
              aria-label="إغلاق"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {error && <Alert tone="danger">{error}</Alert>}

          <Choice
            label="المكان"
            value={form.placement}
            options={PLACEMENTS}
            onChange={(v) => setForm({ ...form, placement: v })}
            columns={2}
          />

          <label className="flex flex-col gap-1.5">
            <span className="flex flex-wrap items-center justify-between gap-2 text-sm font-medium">
              العنوان
              <ImproveButton
                task="banner_text"
                value={form.title}
                onApply={(v) => setForm({ ...form, title: v })}
                compact
              />
            </span>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="خصم العيد يبدأ دلوقتي"
              className={`${field} h-11`}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="flex flex-wrap items-center justify-between gap-2 text-sm font-medium">
              سطر توضيحي
              <ImproveButton
                task="banner_text"
                value={form.subtitle}
                onApply={(v) => setForm({ ...form, subtitle: v })}
                fields={{ 'العنوان': form.title }}
                compact
              />
            </span>
            <input
              value={form.subtitle}
              onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
              className={`${field} h-11`}
            />
          </label>

          <ImageSpecHint specKey="promoBanner" />
          <ImageUpload
            label="صورة الكمبيوتر"
            value={form.imageDesktop ? [form.imageDesktop] : []}
            onChange={(urls) => setForm((f) => (f ? { ...f, imageDesktop: urls[0] ?? null } : f))}
            folder="banners"
          />
          <ImageUpload
            label="صورة الموبايل (اختياري)"
            value={form.imageMobile ? [form.imageMobile] : []}
            onChange={(urls) => setForm((f) => (f ? { ...f, imageMobile: urls[0] ?? null } : f))}
            folder="banners"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">نص الزرار</span>
              <input
                value={form.ctaLabel}
                onChange={(e) => setForm({ ...form, ctaLabel: e.target.value })}
                placeholder="تسوّق دلوقتي"
                className={`${field} h-11`}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">رابط الزرار</span>
              <input
                value={form.ctaUrl}
                onChange={(e) => setForm({ ...form, ctaUrl: e.target.value })}
                dir="ltr"
                placeholder="/products"
                className={`${field} h-11 text-start`}
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">يبدأ (اختياري)</span>
              <input
                type="date"
                value={form.startsAt}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                dir="ltr"
                className={`${field} h-11 text-start`}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">ينتهي (اختياري)</span>
              <input
                type="date"
                value={form.endsAt}
                onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                dir="ltr"
                className={`${field} h-11 text-start`}
              />
            </label>
          </div>

          <Toggle
            label="مفعّل"
            checked={form.isActive}
            onChange={(v) => setForm({ ...form, isActive: v })}
          />

          <div className="flex gap-2">
            <Button onClick={save} loading={pending}>
              <Check className="h-4 w-4" aria-hidden="true" />
              حفظ البانر
            </Button>
            <Button variant="ghost" onClick={() => setForm(null)}>
              إلغاء
            </Button>
          </div>
        </Card>
      )}

      {banners.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <ImageIcon className="h-10 w-10 text-[var(--fg-subtle)]" aria-hidden="true" />
          <p className="max-w-sm text-sm text-[var(--fg-muted)]">
            مافيش بانرات. البانر الترويجي بيعلن عن عروضك في صفحة متجرك الرئيسية.
          </p>
        </Card>
      ) : (
        banners.map((b) => (
          <BannerCard
            key={b.id}
            banner={b}
            onEdit={() =>
              setForm({
                id: b.id,
                placement: b.placement,
                title: b.title ?? '',
                subtitle: b.subtitle ?? '',
                imageDesktop: b.imageDesktop,
                imageMobile: b.imageMobile,
                ctaLabel: b.ctaLabel ?? '',
                ctaUrl: b.ctaUrl ?? '',
                startsAt: toDateInput(b.startsAt),
                endsAt: toDateInput(b.endsAt),
                isActive: b.isActive,
              })
            }
          />
        ))
      )}
    </div>
  )
}

function BannerCard({ banner: b, onEdit }: { banner: BannerRow; onEdit: () => void }) {
  const [pending, start] = useTransition()

  return (
    <Card className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
      <span className="relative h-12 w-20 shrink-0 overflow-hidden rounded-lg bg-[var(--surface-2)]">
        {b.imageDesktop ? (
          <Image src={b.imageDesktop} alt="" fill sizes="80px" className="object-cover" />
        ) : (
          <span className="flex h-full items-center justify-center text-[var(--fg-subtle)]">
            <ImageIcon className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </span>

      <div className="min-w-0 flex-1">
        <span className="font-medium">{b.title || 'بانر بدون عنوان'}</span>
        <span className="mt-0.5 block text-xs text-[var(--fg-subtle)]">
          {PLACEMENT_LABEL[b.placement]}
          {b.endsAt && ` · ينتهي ${new Date(b.endsAt).toLocaleDateString('ar-EG')}`}
        </span>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={b.isActive}
        aria-label={b.isActive ? 'إيقاف البانر' : 'تفعيل البانر'}
        disabled={pending}
        onClick={() => start(() => toggleBannerAction(b.id, !b.isActive).then(() => {}))}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          b.isActive ? 'bg-[var(--primary)]' : 'bg-[var(--border-strong)]'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            b.isActive ? 'start-0.5' : 'start-[1.375rem]'
          }`}
        />
      </button>

      <button
        type="button"
        onClick={onEdit}
        className="rounded-lg border border-[var(--border-strong)] px-3 py-2 text-sm text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)]"
      >
        تعديل
      </button>

      <button
        type="button"
        onClick={() => start(() => deleteBannerAction(b.id).then(() => {}))}
        disabled={pending}
        aria-label="حذف"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--fg-muted)] transition-colors hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>
    </Card>
  )
}
