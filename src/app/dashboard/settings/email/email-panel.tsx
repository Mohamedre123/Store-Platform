'use client'

import { useState, useTransition } from 'react'
import { Check, Send, TriangleAlert, X } from 'lucide-react'
import {
  sendDeliveryTestAction,
  sendDomainComparisonAction,
  sendFullSuiteAction,
  type EmailDiagnostics,
} from './actions'
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
  const [suite, setSuite] = useState<Array<{ label: string; ok: boolean; note: string }>>([])

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
                setSuite([])
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
          كل الرسايل مرة واحدة.

          «الميل بيروح السبام» مش حالة واحدة: الفاتورة كانت بتوصل
          الوارد ورمز الدخول بيروح السبام في نفس الوقت. اختبار رسالة
          واحدة بيدّي إجابة عن رسالة واحدة بس، والباقي تخمين.
        */}
        <Button
          variant="ghost"
          loading={pending}
          disabled={!testTo.includes('@')}
          className="self-start"
          onClick={() =>
            start(async () => {
              setTestMsg(null)
              setSuite([])
              const res = await sendFullSuiteAction(testTo)
              setSuite(res.results)
              setTestMsg({
                ok: res.ok,
                text: res.ok
                  ? `اتبعتت ${res.results.length} رسالة من ${res.from}. افتح الوارد والسبام وشوف كل واحدة راحت فين.`
                  : 'فيه رسايل المزوّد رفضها — التفاصيل تحت.',
              })
            })
          }
        >
          <Send className="h-4 w-4" aria-hidden="true" />
          ابعت كل الرسايل (رمز الدخول، الفاتورة، كل حالات الطلب، السلة المتروكة)
        </Button>

        {/*
          الاختبار اللي بيقطع الشك.

          «القالب ولا النطاق؟» الاتنين بيدّوا نفس العَرَض وعلاجهم
          مختلف تمامًا — القالب بيتصلّح في ساعة، والسمعة بتاخد
          أسابيع. من غير الإجابة دي كل تغيير بنعمله تخمين.
        */}
        <Button
          variant="ghost"
          loading={pending}
          disabled={!testTo.includes('@')}
          className="self-start"
          onClick={() =>
            start(async () => {
              setTestMsg(null)
              setSuite([])
              const res = await sendDomainComparisonAction(testTo)
              setSuite(res.results.map((r) => ({ label: `${r.label} — ${r.from}`, ok: r.ok, note: r.note })))
              setTestMsg({
                ok: res.results.every((r) => r.ok),
                text: 'تلات رسايل بنفس المحتوى بالحرف، والفرق بينهم اسم المرسِل بس. شوف [1] و[2] و[3] راحوا فين — اللي يوصل الوارد هو الصيغة اللي هنمشي بيها.',
              })
            })
          }
        >
          <Send className="h-4 w-4" aria-hidden="true" />
          اختبار المقارنة: نفس الرسالة بتلات صيغ مرسِل
        </Button>

        {suite.length > 0 && (
          <ul className="flex flex-col gap-1.5 border-t border-[var(--border)] pt-3">
            {suite.map((r) => (
              <li key={r.label} className="flex items-start gap-2 text-xs">
                <span
                  className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: r.ok ? 'var(--color-success-soft)' : 'var(--color-danger-soft)',
                    color: r.ok ? 'var(--color-success)' : 'var(--color-danger)',
                  }}
                >
                  {r.ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{r.label}</span>
                  <span className="block break-words text-[var(--fg-subtle)]">{r.note}</span>
                </span>
              </li>
            ))}
          </ul>
        )}

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
