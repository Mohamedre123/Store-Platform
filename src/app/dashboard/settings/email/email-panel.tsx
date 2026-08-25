'use client'

import { useState, useTransition } from 'react'
import { Check, Copy, Globe, Mail, RefreshCw, Send, TriangleAlert, X } from 'lucide-react'
import {
  removeEmailDomainAction,
  sendTestEmailAction,
  startEmailDomainAction,
  verifyEmailDomainAction,
  type EmailDiagnostics,
} from './actions'
import { Button, Card, Input } from '@/components/ui'
import type { DnsRecord } from '@/lib/store-email-domain'

/**
 * لوحة بريد المتجر.
 *
 * تلات أقسام بترتيب ما التاجر بيحتاجه:
 * ١. **الرسالة بتخرج إزاي** — الترويسة الحقيقية قدامه.
 * ٢. **جرّب بنفسك** — يبعت لأي عنوان ويشوف وصل فين.
 * ٣. **نطاقك** — التوثيق اللي بيخلّي سمعته بتاعته هو.
 */
export function EmailPanel({ initial }: { initial: EmailDiagnostics }) {
  const [diag, setDiag] = useState(initial)
  const [pending, start] = useTransition()

  const [testTo, setTestTo] = useState('')
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const [domainMsg, setDomainMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [records, setRecords] = useState<DnsRecord[]>(initial.ownDomain.records)
  const [status, setStatus] = useState(initial.ownDomain.status)

  const verified = status === 'verified'

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
          <h3 className="text-sm font-semibold">سجلات النطاق اللي بيتبعت منه</h3>
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
                const res = await sendTestEmailAction(testTo)
                setTestMsg({ ok: res.ok, text: res.message })
              })
            }
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            ابعت
          </Button>
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

      {/* ٣ — نطاق المتجر */}
      <Card className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-1">
          <h2 className="flex items-center gap-2 font-semibold">
            <Globe className="h-4 w-4" aria-hidden="true" />
            ابعت من نطاقك إنت
          </h2>
          <p className="text-sm leading-relaxed text-[var(--fg-muted)]">
            دلوقتي رسايلك بتخرج من نطاق المنصة، وسمعة النطاق ده مشتركة بين كل التجّار — تاجر
            عملاؤه بيبلّغوا سبام بيأثّر عليك. لما توثّق نطاقك، رسايلك بتخرج باسمك ونطاقك، وسمعتك
            بتبقى بتاعتك لوحدك.
          </p>
        </div>

        {verified ? (
          <>
            <p className="flex items-center gap-2 rounded-lg bg-[var(--color-success-soft)] px-3 py-2 text-sm font-medium text-[var(--color-success)]">
              <Check className="h-4 w-4" aria-hidden="true" />
              نطاقك موثّق — رسايلك بتخرج من {diag.ownDomain.domain}
            </p>
            <Button
              variant="ghost"
              className="self-start text-[var(--color-danger)]"
              loading={pending}
              onClick={() =>
                start(async () => {
                  if (!confirm('هترجع تبعت من نطاق المنصة. متأكد؟')) return
                  await removeEmailDomainAction()
                  setStatus('none')
                  setRecords([])
                })
              }
            >
              افصل النطاق
            </Button>
          </>
        ) : records.length > 0 ? (
          <>
            <p className="text-sm leading-relaxed">
              ضيف السجلات دي في إعدادات DNS بتاعة نطاقك، وبعدين دوس «تحقّق». الانتشار بياخد من
              دقايق لساعات.
            </p>

            {/*
              الجدول بيتمرّر جوّه نفسه: قيم DKIM طويلة جدًا، ولو سبناها
              تمدّ الصفحة، الجدول بيخرج بره الشاشة على الفون.
            */}
            <div className="-mx-5 overflow-x-auto px-5">
              <table className="w-full min-w-[40rem] text-xs">
                <thead>
                  <tr className="text-[var(--fg-subtle)]">
                    <th className="pb-2 text-start font-medium">النوع</th>
                    <th className="pb-2 text-start font-medium">الاسم</th>
                    <th className="pb-2 text-start font-medium">القيمة</th>
                    <th className="pb-2 text-start font-medium">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, i) => (
                    <tr key={i} className="border-t border-[var(--border)] align-top">
                      <td className="py-2 pe-3 font-medium" dir="ltr">
                        {r.type}
                        {r.priority !== undefined ? ` (${r.priority})` : ''}
                      </td>
                      <td className="py-2 pe-3 break-all" dir="ltr">
                        {r.name}
                      </td>
                      <td className="py-2 pe-3">
                        <div className="flex items-start gap-1.5">
                          <span className="min-w-0 break-all" dir="ltr">
                            {r.value}
                          </span>
                          <button
                            type="button"
                            onClick={() => navigator.clipboard?.writeText(r.value)}
                            aria-label="انسخ القيمة"
                            className="shrink-0 rounded p-1 text-[var(--fg-subtle)] hover:bg-[var(--surface-2)]"
                          >
                            <Copy className="h-3 w-3" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                      <td className="py-2" dir="ltr">
                        {r.status ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Button
              loading={pending}
              className="self-start"
              onClick={() =>
                start(async () => {
                  setDomainMsg(null)
                  const res = await verifyEmailDomainAction()
                  if (!res.ok) {
                    setDomainMsg({ ok: false, text: res.error })
                    return
                  }
                  setStatus(res.status as typeof status)
                  setRecords(res.records)
                  setDomainMsg({
                    ok: res.status === 'verified',
                    text:
                      res.status === 'verified'
                        ? 'تمام — نطاقك اتوثّق ورسايلك هتخرج منه من دلوقتي.'
                        : 'لسه ما اتحقّقش. السجلات ممكن تكون لسه بتنتشر — استنّى شوية وجرّب تاني.',
                  })
                })
              }
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              تحقّق دلوقتي
            </Button>
          </>
        ) : (
          <Button
            loading={pending}
            className="self-start"
            onClick={() =>
              start(async () => {
                setDomainMsg(null)
                const res = await startEmailDomainAction()
                if (!res.ok) {
                  setDomainMsg({ ok: false, text: res.error })
                  return
                }
                setRecords(res.records)
                setStatus('pending')
              })
            }
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            فعّل البريد على نطاقي
          </Button>
        )}

        {domainMsg && (
          <p
            className="rounded-lg px-3 py-2 text-sm leading-relaxed"
            style={{
              background: domainMsg.ok ? 'var(--color-success-soft)' : 'var(--color-danger-soft)',
              color: domainMsg.ok ? 'var(--color-success)' : 'var(--color-danger)',
            }}
          >
            {domainMsg.text}
          </p>
        )}
      </Card>
    </div>
  )
}
