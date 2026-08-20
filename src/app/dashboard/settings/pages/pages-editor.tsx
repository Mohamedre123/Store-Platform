'use client'

import { useState, useTransition } from 'react'
import { Check, FileText, Save } from 'lucide-react'
import { savePageAction } from './actions'
import { Alert, Card } from '@/components/ui'
import { ImproveButton } from '@/components/dashboard/improve-button'
import { Toggle } from '@/components/dashboard/controls'

export type PageRow = {
  id: string
  slug: string
  title: string
  content: string | null
  type: string
  showInFooter: boolean
  isPublished: boolean
}

/** نصوص ابتدائية تساعد التاجر يبدأ بدل صفحة بيضا */
const STARTERS: Record<string, string> = {
  refund: `بنقبل الإرجاع خلال ١٤ يوم من استلام الطلب بشرط إن المنتج يكون بحالته وتغليفه الأصلي.

للإرجاع: كلّمنا على رقم المتجر أو رد على رسالة تأكيد الطلب، وهنرتّب استلام المنتج.

مصاريف الإرجاع بتكون على المتجر لو المنتج فيه عيب أو غلط في الشحن، وعلى العميل في باقي الحالات.`,
  privacy: `بنجمع البيانات اللي محتاجينها عشان نوصّلك طلبك بس: الاسم، رقم التليفون، والعنوان.

بياناتك ما بتتباعش ولا بتتشارك مع أي طرف تاني غير شركة الشحن اللي هتوصّلك.

لو عايز تحذف بياناتك، كلّمنا وهنعملها.`,
  terms: `باستخدامك للمتجر ده بتوافق على الشروط دي.

الأسعار المعروضة بالجنيه المصري وشاملة الضريبة إن وُجدت. بنحتفظ بحقنا في تعديل الأسعار في أي وقت.

الطلب بيتأكّد لما نتواصل معاك ونتأكد من بياناتك.`,
}

export function PagesEditor({ pages }: { pages: PageRow[] }) {
  if (pages.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 px-6 py-14 text-center">
        <FileText className="h-10 w-10 text-[var(--fg-subtle)]" aria-hidden="true" />
        <p className="text-sm text-[var(--fg-muted)]">مافيش صفحات لسه.</p>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {pages.map((p) => (
        <PageCard key={p.id} page={p} />
      ))}
    </div>
  )
}

function PageCard({ page }: { page: PageRow }) {
  const [title, setTitle] = useState(page.title)
  const [content, setContent] = useState(page.content ?? '')
  const [inFooter, setInFooter] = useState(page.showInFooter)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()

  const starter = STARTERS[page.type]
  const live = content.trim().length > 0

  function save() {
    setMsg(null)
    start(async () => {
      const res = await savePageAction({ id: page.id, title, content, showInFooter: inFooter })
      setMsg(res?.error ? { ok: false, text: res.error } : { ok: true, text: 'اتحفظ' })
    })
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">{page.title}</h3>
          <span
            className="rounded-md px-2 py-0.5 text-xs font-medium"
            style={{
              background: live ? 'var(--color-success-soft)' : 'var(--surface-2)',
              color: live ? 'var(--color-success)' : 'var(--fg-subtle)',
            }}
          >
            {live ? 'منشورة' : 'فاضية'}
          </span>
        </div>
        <span className="font-mono text-xs text-[var(--fg-subtle)]" dir="ltr">
          /{page.slug}
        </span>
      </div>

      {msg && <Alert tone={msg.ok ? 'success' : 'danger'}>{msg.text}</Alert>}

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">عنوان الصفحة</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-11 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm focus:border-[var(--primary)] focus:outline-none"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="flex flex-wrap items-center justify-between gap-2 text-sm font-medium">
          المحتوى
          <ImproveButton
            task="page_content"
            value={content}
            onApply={setContent}
            fields={{ 'نوع الصفحة': page.title }}
            compact
          />
        </span>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={8}
          placeholder="اكتب محتوى الصفحة…"
          className="rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2.5 text-sm leading-relaxed focus:border-[var(--primary)] focus:outline-none"
        />
        <span className="text-xs text-[var(--fg-subtle)]">
          الصفحة الفاضية ما بتظهرش للعميل. سطر فاضي بيبدأ فقرة جديدة.
        </span>
      </label>

      <Toggle label="تظهر في فوتر المتجر" checked={inFooter} onChange={setInFooter} />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="flex min-h-10 items-center gap-2 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-fg)] transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {msg?.ok ? <Check className="h-4 w-4" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
          حفظ
        </button>

        {starter && !content.trim() && (
          <button
            type="button"
            onClick={() => setContent(starter)}
            className="flex min-h-10 items-center rounded-lg border border-[var(--border-strong)] px-4 text-sm font-medium text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)]"
          >
            استخدم نص جاهز
          </button>
        )}
      </div>
    </Card>
  )
}
