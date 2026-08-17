'use client'

import { useActionState, useState, useTransition } from 'react'
import { BadgeCheck, Clock, Copy, Globe, RefreshCw, Trash2 } from 'lucide-react'
import {
  removeDomainAction,
  saveDomainAction,
  verifyDomainAction,
  type DomainState,
} from './actions'
import type { DnsRecord } from '@/lib/custom-domain'
import { Alert, Button, Field, Input } from '@/components/ui'

function CopyValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          setTimeout(() => setCopied(false), 1600)
        } catch {
          // بعض المتصفحات بترفض النسخ من غير تفاعل مباشر — المستخدم يقدر يحدّد ويّنسخ يدويًا
        }
      }}
      title="نسخ"
      className="inline-flex min-h-9 w-full items-center justify-between gap-2 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-2)] px-2.5 text-start transition-colors hover:bg-[var(--surface)]"
    >
      <bdi dir="ltr" className="truncate font-mono text-xs">
        {value}
      </bdi>
      <span className="shrink-0 text-[var(--fg-subtle)]">
        {copied ? (
          <span className="text-xs font-medium text-[var(--color-success)]">اتنسخ</span>
        ) : (
          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
        )}
      </span>
    </button>
  )
}

function RecordsTable({ records }: { records: DnsRecord[] }) {
  return (
    <div className="flex flex-col gap-3">
      {records.map((r, i) => (
        <div key={i} className="surface flex flex-col gap-2.5 p-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-[var(--primary-soft)] px-2 py-0.5 font-mono text-xs font-bold text-[var(--primary)]">
              {r.type}
            </span>
            <span className="text-xs text-[var(--fg-muted)]">{r.note}</span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[var(--fg-muted)]">الاسم / Host</span>
              <CopyValue value={r.host} />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[var(--fg-muted)]">القيمة / Value</span>
              <CopyValue value={r.value} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function DomainForm({
  currentDomain,
  verified,
  initialRecords,
}: {
  currentDomain: string | null
  verified: boolean
  initialRecords: DnsRecord[]
}) {
  const [state, formAction, saving] = useActionState<DomainState, FormData>(saveDomainAction, null)
  const [checkState, setCheckState] = useState<DomainState>(null)
  const [checking, startCheck] = useTransition()
  const [removing, startRemove] = useTransition()

  const domain = state?.domain ?? currentDomain
  const records = state?.records ?? initialRecords
  const isVerified = checkState?.verified ?? verified

  return (
    <div className="flex flex-col gap-6">
      {state?.error && <Alert>{state.error}</Alert>}
      {state?.notice && <Alert tone="info">{state.notice}</Alert>}
      {checkState?.error && <Alert tone="warning">{checkState.error}</Alert>}
      {checkState?.notice && <Alert tone="success">{checkState.notice}</Alert>}

      {/* إدخال النطاق */}
      <form action={formAction} className="flex flex-col gap-4">
        <Field
          label="نطاقك الخاص"
          htmlFor="domain"
          hint="اكتبه من غير https:// ومن غير www. مثال: mystore.com"
        >
          <Input
            id="domain"
            name="domain"
            dir="ltr"
            defaultValue={currentDomain ?? ''}
            placeholder="mystore.com"
            autoComplete="off"
            spellCheck={false}
            className="text-start font-mono"
          />
        </Field>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={saving}>
            <Globe className="h-4 w-4" aria-hidden="true" />
            {currentDomain ? 'تحديث النطاق' : 'ربط النطاق'}
          </Button>

          {currentDomain && (
            <Button
              type="button"
              variant="ghost"
              loading={removing}
              onClick={() => startRemove(async () => setCheckState(await removeDomainAction()))}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              شيل الربط
            </Button>
          )}
        </div>
      </form>

      {domain && records.length > 0 && (
        <>
          {/* الحالة */}
          <div
            className={`flex items-start gap-3 rounded-[var(--radius-card)] border p-4 ${
              isVerified
                ? 'border-[var(--color-success)] bg-[var(--color-success-soft)]'
                : 'border-[var(--color-warning)] bg-[var(--color-warning-soft)]'
            }`}
          >
            <span className="mt-0.5 shrink-0">
              {isVerified ? (
                <BadgeCheck className="h-5 w-5 text-[var(--color-success)]" aria-hidden="true" />
              ) : (
                <Clock className="h-5 w-5 text-[var(--color-warning)]" aria-hidden="true" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={`text-sm font-semibold ${
                  isVerified ? 'text-[var(--color-success)]' : 'text-[var(--color-warning)]'
                }`}
              >
                {isVerified ? 'النطاق شغّال' : 'في انتظار سجلات الـDNS'}
              </p>
              <p className="mt-0.5 text-sm text-[var(--fg-muted)]">
                {isVerified ? (
                  <>
                    متجرك متاح على{' '}
                    <bdi dir="ltr" className="font-medium">
                      {domain}
                    </bdi>
                  </>
                ) : (
                  'ضيف السجلات تحت في لوحة نطاقك، وبعدها اضغط تحقّق.'
                )}
              </p>
            </div>
          </div>

          {/* السجلات */}
          <div className="flex flex-col gap-3">
            <div>
              <h3 className="font-semibold">سجلات الـDNS</h3>
              <p className="mt-1 text-sm text-[var(--fg-muted)]">
                ادخل على لوحة تحكم الشركة اللي اشتريت منها النطاق، وضيف السجلات دي بالظبط.
              </p>
            </div>

            <RecordsTable records={records} />

            <Button
              type="button"
              variant="secondary"
              loading={checking}
              onClick={() => startCheck(async () => setCheckState(await verifyDomainAction()))}
              className="self-start"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              تحقّق دلوقتي
            </Button>

            <p className="text-xs leading-relaxed text-[var(--fg-subtle)]">
              انتشار الـDNS بياخد من ١٠ دقايق لحد ٢٤ ساعة حسب شركة النطاق. لو ضفت السجلات وضغطت
              تحقّق وما اشتغلش، استنى شوية وجرّب تاني — مش لازم تعيد أي حاجة.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
