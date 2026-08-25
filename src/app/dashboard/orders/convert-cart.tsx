'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, CreditCard, ShoppingBag } from 'lucide-react'
import { convertCartToOrderAction, paymentLinkAction } from './convert-actions'
import { Button, Card, Field, Input, Textarea } from '@/components/ui'
import type { Region } from '@/lib/regions'

/**
 * «اعملّه الطلب بنفسك».
 *
 * ## ليه موجود
 * نص السلات المتروكة بتترد على الواتساب بـ«تمام ابعتهولي». وبعدها
 * التاجر كان بيقعد يعمل الطلب من الأول: يدوّر على المنتج، يحطّ
 * السعر، يكتب العنوان — أو ما بيعملهوش ويسيب البيعة.
 *
 * البيانات كلها في السلة أصلًا. اللي ناقص خانة أو اتنين.
 *
 * ## الدفع عند الاستلام بس — وده مقصود
 * العميل وافق على الطلب في محادثة، ما دفعش. تسجيله «مدفوعًا» كدب
 * في الحسابات. ولو عايز يدفع بالفيزا، فيه زرار بيطلّع رابط دفع
 * يبعتهوله — والطلب بيتحوّل لمدفوع لما يدفع فعلًا.
 */
export function ConvertCart({
  orderId,
  regions,
  initial,
}: {
  orderId: string
  regions: Region[]
  initial: {
    name: string | null
    phone: string | null
    email: string | null
    city: string | null
    area: string | null
    street: string | null
  }
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [payLink, setPayLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const [name, setName] = useState(initial.name ?? '')
  const [phone, setPhone] = useState(initial.phone ?? '')
  const [email, setEmail] = useState(initial.email ?? '')
  const [city, setCity] = useState(initial.city ?? '')
  const [area, setArea] = useState(initial.area ?? '')
  const [street, setStreet] = useState(initial.street ?? '')
  const [notes, setNotes] = useState('')

  if (!open) {
    return (
      <Button variant="secondary" className="w-full" onClick={() => setOpen(true)}>
        <ShoppingBag className="h-4 w-4" aria-hidden="true" />
        حوّلها لطلب بنفسك
      </Button>
    )
  }

  function submit() {
    setError(null)
    start(async () => {
      const res = await convertCartToOrderAction({
        orderId,
        name: name || undefined,
        phone,
        email: email || undefined,
        city: city || undefined,
        area: area || undefined,
        street: street || undefined,
        notes: notes || undefined,
      })

      if (!res.ok) {
        setError(res.error)
        return
      }

      router.refresh()
    })
  }

  function makeLink() {
    setError(null)
    start(async () => {
      const res = await paymentLinkAction({ orderId })
      if (res.ok) setPayLink(res.url)
      else setError(res.error)
    })
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-col gap-1">
        <h2 className="font-semibold">حوّلها لطلب</h2>
        <p className="text-sm text-[var(--fg-muted)]">
          العميل وافق على الواتساب؟ كمّل بياناته وسجّل الطلب بدالُه. الأسعار بتتحسب من جديد
          بأسعار النهاردة.
        </p>
      </div>

      <Field label="الاسم" htmlFor="cv-name">
        <Input id="cv-name" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>

      <Field label="رقم التليفون" required htmlFor="cv-phone">
        <Input
          id="cv-phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          dir="ltr"
          className="text-start"
        />
      </Field>

      <Field label="البريد (اختياري)" htmlFor="cv-email" hint="عشان الفاتورة توصله">
        <Input
          id="cv-email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          dir="ltr"
          className="text-start"
        />
      </Field>

      <Field label="المحافظة" htmlFor="cv-city">
        <select
          id="cv-city"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm outline-none focus:border-[var(--primary)]"
        >
          <option value="">اختار المحافظة</option>
          {regions.map((r) => (
            <option key={r.code} value={r.name}>
              {r.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="المنطقة" htmlFor="cv-area">
        <Input id="cv-area" value={area} onChange={(e) => setArea(e.target.value)} />
      </Field>

      <Field label="العنوان" htmlFor="cv-street">
        <Input id="cv-street" value={street} onChange={(e) => setStreet(e.target.value)} />
      </Field>

      <Field label="ملاحظة على الطلب" htmlFor="cv-notes">
        <Textarea
          id="cv-notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="مثال: العميل وافق على الواتساب"
        />
      </Field>

      {error && (
        <p className="rounded-lg bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]">
          {error}
        </p>
      )}

      <Button loading={pending} disabled={phone.trim().length < 6} onClick={submit}>
        <Check className="h-4 w-4" aria-hidden="true" />
        سجّل الطلب (دفع عند الاستلام)
      </Button>

      {/*
        رابط الدفع اختياري ومنفصل.

        الطلب بيتسجّل بالدفع عند الاستلام دايمًا — ده اللي العميل
        وافق عليه. الرابط ده للعميل اللي قال «أنا أدفع فيزا»، والطلب
        بيتحوّل لمدفوع لما يدفع فعلًا مش لما التاجر يبعت الرابط.
      */}
      {payLink ? (
        <div className="flex flex-col gap-2 rounded-lg border border-[var(--border)] p-3">
          <span className="text-xs font-medium text-[var(--fg-muted)]">
            رابط الدفع — ابعتهوله وهو يدفع منه
          </span>
          <div className="flex gap-2">
            <input
              readOnly
              value={payLink}
              dir="ltr"
              aria-label="رابط الدفع"
              className="h-10 min-w-0 flex-1 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-2)] px-2 text-xs"
            />
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(payLink).then(
                  () => setCopied(true),
                  () => setCopied(false),
                )
              }}
              className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border-strong)] px-3 text-xs font-medium"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'اتنسخ' : 'انسخ'}
            </button>
          </div>
        </div>
      ) : (
        <Button variant="ghost" loading={pending} onClick={makeLink}>
          <CreditCard className="h-4 w-4" aria-hidden="true" />
          أو اطلع رابط دفع أونلاين
        </Button>
      )}

      <Button variant="ghost" onClick={() => setOpen(false)}>
        إلغاء
      </Button>
    </Card>
  )
}
