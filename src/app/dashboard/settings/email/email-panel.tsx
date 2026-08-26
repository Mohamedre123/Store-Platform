'use client'

import { useState, useTransition } from 'react'
import { Check, Send, TriangleAlert, X } from 'lucide-react'
import { sendDeliveryTestAction, type EmailDiagnostics } from './actions'
import { Button, Card, Input } from '@/components/ui'

/**
 * لوحة بريد المتجر.
 *
 * قسمين بترتيب ما التاجر بيحتاجه:
 * ١. **الرسالة بتخرج إزاي** — الترويسة الحقيقية قدامه.
 * ٢. **جرّب بنفسك** — يبعت لأي عنوان ويشوف وصل فين.
 */
export function EmailPanel({ initial }: { initial: EmailDiagnostics }) {
  const diag = initial
  const [pending, start] = useTransition()

  const [testTo, setTestTo] = useState('')
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null)

  return (
    <div className="flex flex-col gap-6">
      {/* ١ — الترويسة الحقيقية */}
      <Card className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-1">
          <h2 className="font-semibold">رسايلك بتخرج إزاي دلوقتي</h2>
          <p className="text-sm text-[var(--fg-muted)]">
            ده اللي العميل بيشوفه في بريده بالظبط.
          </p>
        </div>

        <dl className="flex flex-col gap-3 text-sm">
          <div className="flex flex-col gap-1">
            <dt className="text-xs font-medium text-[var(--fg-muted)]">المرسِل</dt>
            <dd className="tabular break-all rounded-lg bg-[var(--surface-2)] px-3 py-2" dir="ltr">
              {diag.from}
            </dd>
          </div>

          <div className="flex flex-col gap-1">
            <dt className="text-xs font-medium text-[var(--fg-muted)]">الرد يروح لـ</dt>
            <dd className="break-all rounded-lg bg-[var(--surface-2)] px-3 py-2" dir="ltr">
              {diag.replyTo ?? '—'}
            </dd>
            {diag.replyToDropped && (
              /*
                التاجر لازم يعرف ليه بريده مش في الترويسة — من غير
                الشرح ده هيفتكر إن فيه عطل ويقعد يعيد الحفظ.
              */
              <p className="flex items-start gap-1.5 text-xs leading-relaxed text-[var(--color-warning)]">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                بريد متجرك على خدمة مجانية (جيميل مثلًا)، فشيلناه من ترويسة الرد: «مرسِل على نطاق
                ورد على نطاق تاني» بصمة تصيّد بتودّي الرسالة السبام. بريدك مكتوب في تذييل كل رسالة
                فالعميل لسه يقدر يكلّمك.
              </p>
            )}
          </div>
        </dl>

        {!diag.configured && (
          <p className="rounded-lg bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]">
            خدمة البريد مش مضبوطة على المنصة — مفيش أي رسالة بتخرج.
          </p>
        )}

        <div className="flex flex-col gap-2 border-t border-[var(--border)] pt-4">
          <h3 className="text-sm font-semibold">سجلات نطاق الإرسال</h3>
          <ul className="flex flex-col gap-2">
            {diag.dns.map((r) => (
              <li key={r.name + r.label} className="flex items-start gap-2 text-xs">
                <span
                  className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: r.found ? 'var(--color-success-soft)' : 'var(--color-warning-soft)',
                    color: r.found ? 'var(--color-success)' : 'var(--color-warning)',
                  }}
                >
                  {r.found ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{r.label}</span>
                  <span className="block break-all text-[var(--fg-subtle)]" dir="ltr">
                    {r.found ?? 'مش موجود'}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Card>

      {/* ٢ — جرّب بنفسك */}
      <Card className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-1">
          <h2 className="font-semibold">ابعت رسالة تجريبية</h2>
          <p className="text-sm text-[var(--fg-muted)]">
            بنفس القالب وبنفس الترويسات اللي بتروح لعملائك. جرّب على عنوان مش بتاعك عشان النتيجة
            تبقى حقيقية — بريدك إنت جيميل بيثق فيه أصلًا.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="test@example.com"
            dir="ltr"
            aria-label="عنوان التجربة"
            className="flex-1 text-start"
          />
          <Button
            loading={pending}
            disabled={!testTo.includes('@')}
            onClick={() =>
              start(async () => {
                setTestMsg(null)
                const res = await sendDeliveryTestAction(testTo)
                setTestMsg({ ok: res.ok, text: res.message })
              })
            }
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            ابعت
          </Button>
        </div>

        {/*
          أزرار الإرسال بالجملة اتشالت.

          كانت بتبعت ٦ لـ١١ رسالة شبه متطابقة لنفس الصندوق في دقيقة.
          الشكل ده **هو** حملة سبام عند جيميل، وكل دفعة بتقع في السبام
          وتتساب هناك بتتحسب إشارة سلبية على المرسِل كله. الاختبار كان
          بيخرّب الحاجة اللي بيقيسها، والنتيجة كانت بتسوء كل جولة لحد
          ما المرسِل نفسه اتصنّف — مش الرسالة.

          فضل زرار واحد بيبعت رسالة واحدة. وحتى هو بمهلة.
        */}
        <div className="flex items-start gap-2 rounded-lg bg-[var(--color-warning-soft)] px-3 py-2.5 text-xs leading-relaxed text-[var(--color-warning)]">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            <strong>جرّب بحساب، مش كل شوية.</strong> كل رسالة تجريبية بتقع في السبام وتتساب
            هناك بتقلّل ثقة جيميل في مرسِلك. لو رسالة راحت السبام، ادوس عليها{' '}
            <strong>«ليست غير مرغوب فيها»</strong> قبل ما تجرّب تاني — وإلا كل تجربة بتخلّي
            الوضع أسوأ.
          </span>
        </div>

        {testMsg && (
          <p
            className="rounded-lg px-3 py-2 text-sm leading-relaxed"
            style={{
              background: testMsg.ok ? 'var(--color-success-soft)' : 'var(--color-danger-soft)',
              color: testMsg.ok ? 'var(--color-success)' : 'var(--color-danger)',
            }}
          >
            {testMsg.text}
          </p>
        )}

      </Card>

    </div>
  )
}
