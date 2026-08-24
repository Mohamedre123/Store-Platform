'use client'

import { useRef, useState, useTransition } from 'react'
import { Loader2, RotateCcw, Save } from 'lucide-react'
import { saveTemplatesAction, type WaState } from './actions'
import { Alert, Card } from '@/components/ui'
import {
  DEFAULT_TEMPLATES,
  TEMPLATE_LABELS,
  TEMPLATE_VARS,
  type TemplateKey,
  type Templates,
} from '@/lib/whatsapp-templates'
import { cn } from '@/lib/utils'

const ORDER: TemplateKey[] = [
  'otp',
  'order_placed',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'returned',
]

/**
 * نصوص رسايل واتساب.
 *
 * النص الجاهز بتاعنا بيوصّل المعلومة، بس صوته مش صوت التاجر. اللي
 * بيبيع عطور بيكلّم عملاءه غير اللي بيبيع قطع غيار.
 *
 * والمتغيّرات أزرار مش كلام مكتوب: التاجر مش لازم يفتكر إن الأقواس
 * دبل، ولا يكتب اسم المتغيّر صح — بيدوس فيتلزق مكان المؤشّر.
 */
export function TemplatesEditor({ initial }: { initial: Templates }) {
  const [tab, setTab] = useState<TemplateKey>('otp')
  const [values, setValues] = useState<Templates>(initial)
  const [msg, setMsg] = useState<WaState>(null)
  const [saving, start] = useTransition()
  const boxRef = useRef<HTMLTextAreaElement>(null)

  const current = values[tab] ?? DEFAULT_TEMPLATES[tab]
  const isCustom = Boolean(values[tab]?.trim())

  const setCurrent = (text: string) => setValues((v) => ({ ...v, [tab]: text }))

  /* اللصق مكان المؤشّر — مش في آخر النص */
  const insertVar = (name: string) => {
    const box = boxRef.current
    const token = `{{${name}}}`
    if (!box) {
      setCurrent(current + token)
      return
    }

    const start = box.selectionStart ?? current.length
    const end = box.selectionEnd ?? start
    setCurrent(current.slice(0, start) + token + current.slice(end))

    requestAnimationFrame(() => {
      box.focus()
      box.setSelectionRange(start + token.length, start + token.length)
    })
  }

  const save = () =>
    start(async () => {
      setMsg(await saveTemplatesAction(values))
    })

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div>
        <h2 className="font-semibold">نصوص الرسايل</h2>
        <p className="mt-0.5 text-sm text-[var(--fg-muted)]">
          اكتبها بصوتك إنت. سيب أي واحدة فاضية وهتتبعت بالنص الافتراضي.
        </p>
      </div>

      {msg?.ok && <Alert tone="success">{msg.note ?? 'اتحفظ'}</Alert>}
      {msg?.error && <Alert tone="danger">{msg.error}</Alert>}

      <div className="scroll-x flex gap-1.5 pb-1">
        {ORDER.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              'min-h-9 shrink-0 rounded-lg border px-3 text-xs font-medium transition-colors',
              tab === key
                ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]'
                : 'border-[var(--border-strong)] text-[var(--fg-muted)] hover:bg-[var(--surface-2)]',
            )}
          >
            {TEMPLATE_LABELS[key]}
            {values[key]?.trim() && <span className="ms-1 text-[var(--primary)]">•</span>}
          </button>
        ))}
      </div>

      <textarea
        ref={boxRef}
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        rows={7}
        className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] p-3 text-sm leading-relaxed focus:border-[var(--primary)] focus:outline-none"
      />

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-[var(--fg-subtle)]">
          دوس عشان تلزق المتغيّر مكان المؤشّر:
        </span>
        <div className="flex flex-wrap gap-1.5">
          {TEMPLATE_VARS[tab].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => insertVar(v)}
              className="min-h-8 rounded-md border border-[var(--border-strong)] px-2 font-mono text-xs text-[var(--fg-muted)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
            >
              {`{{${v}}}`}
            </button>
          ))}
        </div>
      </div>

      {tab === 'otp' && (
        <p className="text-xs leading-relaxed text-[var(--color-warning)]">
          قالب رمز الدخول لازم يكون فيه <span className="font-mono">{'{{كود}}'}</span> — من غيره
          العميل هياخد رسالة مالهاش لازمة ومش هيقدر يدخل.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex min-h-11 items-center gap-2 rounded-lg bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-fg)] transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="h-4 w-4" aria-hidden="true" />
          )}
          حفظ النصوص
        </button>

        {isCustom && (
          <button
            type="button"
            onClick={() => setValues((v) => ({ ...v, [tab]: '' }))}
            className="flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border-strong)] px-4 text-sm font-medium text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)]"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            رجّع الافتراضي
          </button>
        )}
      </div>
    </Card>
  )
}
