import { AlertCircle, Mail } from 'lucide-react'
import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { isEmailConfigured } from '@/lib/email'
import { loadMessages } from '@/lib/messages-data'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { Card } from '@/components/ui'
import { MessagesList } from './messages-list'

export const metadata = { title: 'سجل الرسايل' }
export const dynamic = 'force-dynamic'

export default async function MessagesPage() {
  const { store, actor } = await getDashboardContext()
  guard(actor, 'orders.view')

  /* الاستعلامات في `src/lib/messages-data.ts` — تطبيق الموبايل بيقرا نفس البيانات */
  const { rows, total, failed, last7 } = await loadMessages(store)

  const configured = isEmailConfigured()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="سجل الرسايل"
        description="كل رسالة اتبعتت من متجرك — وصلت ولا فشلت وليه."
      />

      {!configured && (
        <Reveal>
          <Card className="flex items-start gap-3 border-[var(--color-warning)]/40 p-4">
            <AlertCircle
              className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-warning)]"
              aria-hidden="true"
            />
            <div>
              <p className="font-medium">البريد مش مضبوط</p>
              <p className="mt-1 text-sm text-[var(--fg-muted)]">
                محتاج <code className="tabular">RESEND_API_KEY</code> و
                <code className="tabular">EMAIL_FROM</code> في إعدادات النشر. من غيرهم كل
                محاولة إرسال بتتسجّل هنا كفاشلة والعميل ما بيوصلهوش حاجة.
              </p>
            </div>
          </Card>
        </Reveal>
      )}

      {rows.length > 0 && (
        <Reveal>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="كل الرسايل" value={String(total)} />
            <Stat label="آخر ٧ أيام" value={String(last7)} />
            <Stat label="فشلت" value={String(failed)} danger={failed > 0} />
          </div>
        </Reveal>
      )}

      {rows.length === 0 ? (
        <Reveal>
          <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <Mail className="h-10 w-10 text-[var(--fg-subtle)]" aria-hidden="true" />
            <h2 className="text-lg font-semibold">مافيش رسايل لسه</h2>
            <p className="max-w-sm text-sm text-[var(--fg-muted)]">
              أول ما يجيلك طلب، رسالة التأكيد هتتسجّل هنا بحالتها — عشان تعرف
              وصلت ولا لأ من غير ما تسأل العميل.
            </p>
          </Card>
        </Reveal>
      ) : (
        <Reveal>
          <MessagesList messages={rows} />
        </Reveal>
      )}
    </div>
  )
}

function Stat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <span className="text-xs text-[var(--fg-muted)]">{label}</span>
      <span
        className="tabular text-xl font-bold"
        style={danger ? { color: 'var(--color-danger)' } : undefined}
      >
        {value}
      </span>
    </Card>
  )
}
