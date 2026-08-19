'use client'

import { useState, useTransition } from 'react'
import { Check, Plus, Trash2, X, Zap } from 'lucide-react'
import { deleteRuleAction, saveRuleAction, toggleRuleAction, type RuleInput } from './actions'
import { ACTIONS, OPERATORS, TRIGGERS, actionsFor, triggerDef } from '@/lib/automation-defs'
import { Alert, Button, Card } from '@/components/ui'
import { Toggle } from '@/components/dashboard/controls'
import { formatDate } from '@/lib/utils'

export type RuleRow = {
  id: string
  name: string
  trigger: string
  conditions: Array<{ field: string; op: string; value: unknown }>
  actions: Array<{ type: string; config: Record<string, unknown> }>
  cooldownHours: number
  enabled: boolean
  runCount: number
  lastRunAt: Date | null
}

const field =
  'h-10 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-2.5 text-sm focus:border-[var(--primary)] focus:outline-none'

const emptyRule = (): RuleInput => ({
  name: '',
  trigger: 'order.created',
  conditions: [],
  actions: [{ type: 'send_email', config: { subject: '', body: '' } }],
  cooldownHours: '0',
  enabled: true,
})

/** أمثلة جاهزة — أسرع طريقة يفهم بيها التاجر إيه اللي ممكن يعمله */
const PRESETS: Array<{ name: string; hint: string; build: () => RuleInput }> = [
  {
    name: 'رحّب بالعميل الجديد',
    hint: 'كوبون ١٠٪ لأول طلب',
    build: () => ({
      name: 'ترحيب بالعميل الجديد',
      trigger: 'customer.created',
      conditions: [],
      actions: [{ type: 'issue_coupon', config: { percent: '10', days: '14', email: true } }],
      cooldownHours: '0',
      enabled: true,
    }),
  },
  {
    name: 'كافئ الطلبات الكبيرة',
    hint: 'نقاط إضافية فوق ١٠٠٠ جنيه',
    build: () => ({
      name: 'مكافأة الطلبات الكبيرة',
      trigger: 'order.delivered',
      conditions: [{ field: 'orderTotal', op: 'gte', value: '1000' }],
      actions: [{ type: 'add_points', config: { points: '200', reason: 'طلب كبير' } }],
      cooldownHours: '0',
      enabled: true,
    }),
  },
  {
    name: 'استرجع السلة المتروكة',
    hint: 'كوبون ٥٪ للسلات فوق ٥٠٠',
    build: () => ({
      name: 'استرجاع السلة',
      trigger: 'cart.abandoned',
      conditions: [{ field: 'orderTotal', op: 'gte', value: '500' }],
      actions: [{ type: 'issue_coupon', config: { percent: '5', days: '3', email: true } }],
      cooldownHours: '24',
      enabled: true,
    }),
  },
  {
    name: 'اشكر العميل بعد التسليم',
    hint: 'رسالة شكر تلقائية',
    build: () => ({
      name: 'شكر بعد التسليم',
      trigger: 'order.delivered',
      conditions: [],
      actions: [
        {
          type: 'send_email',
          config: {
            subject: 'شكرًا ليك من {{store}}',
            body: 'أهلًا {{name}}،\n\nطلبك {{order}} وصلك بنجاح. نتمنى يعجبك!\n\nلو عندك أي ملاحظة، رد على الرسالة دي.',
          },
        },
      ],
      cooldownHours: '0',
      enabled: true,
    }),
  },
]

export function RuleBuilder({ rules }: { rules: RuleRow[] }) {
  const [form, setForm] = useState<RuleInput | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const def = form ? triggerDef(form.trigger) : null

  function save() {
    if (!form) return
    setError(null)
    start(async () => {
      const res = await saveRuleAction(form)
      if (res?.error) setError(res.error)
      else setForm(null)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {!form && (
        <>
          <Button onClick={() => setForm(emptyRule())} className="self-start">
            <Plus className="h-4 w-4" aria-hidden="true" />
            قاعدة جديدة
          </Button>

          <div className="grid gap-2 sm:grid-cols-2">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => setForm(p.build())}
                className="rounded-lg border border-[var(--border)] p-3 text-start transition-colors hover:bg-[var(--surface-2)]"
              >
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <Zap className="h-3.5 w-3.5 text-[var(--primary)]" aria-hidden="true" />
                  {p.name}
                </span>
                <span className="mt-0.5 block text-xs text-[var(--fg-subtle)]">{p.hint}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {form && def && (
        <Card className="flex flex-col gap-5 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{form.id ? 'تعديل القاعدة' : 'قاعدة جديدة'}</h2>
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

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">اسم القاعدة</span>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={`${field} h-11 w-full`}
            />
          </label>

          {/* المحفّز */}
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">١. لما يحصل</span>
            <select
              value={form.trigger}
              onChange={(e) =>
                // تغيير المحفّز بيصفّر الشروط: حقولها بتخص المحفّز القديم
                setForm({ ...form, trigger: e.target.value, conditions: [] })
              }
              className={`${field} h-11 w-full`}
            >
              {TRIGGERS.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
            <span className="text-xs text-[var(--fg-subtle)]">{def.hint}</span>
          </div>

          {/* الشروط */}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">٢. بشرط (اختياري)</span>
            {form.conditions.map((c, i) => {
              const f = def.fields.find((x) => x.key === c.field)
              const ops = OPERATORS.filter((o) => !f || o.types.includes(f.type))
              return (
                <div key={i} className="flex flex-wrap items-center gap-1.5">
                  <select
                    value={c.field}
                    onChange={(e) => {
                      const next = [...form.conditions]
                      next[i] = { ...c, field: e.target.value, value: '' }
                      setForm({ ...form, conditions: next })
                    }}
                    className={`${field} flex-1`}
                  >
                    <option value="">— الحقل —</option>
                    {def.fields.map((x) => (
                      <option key={x.key} value={x.key}>
                        {x.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={c.op}
                    onChange={(e) => {
                      const next = [...form.conditions]
                      next[i] = { ...c, op: e.target.value }
                      setForm({ ...form, conditions: next })
                    }}
                    className={`${field} w-36`}
                  >
                    {ops.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>

                  {f?.type === 'select' ? (
                    <select
                      value={c.value}
                      onChange={(e) => {
                        const next = [...form.conditions]
                        next[i] = { ...c, value: e.target.value }
                        setForm({ ...form, conditions: next })
                      }}
                      className={`${field} w-32`}
                    >
                      <option value="">—</option>
                      {f.options?.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={c.value}
                      onChange={(e) => {
                        const next = [...form.conditions]
                        next[i] = { ...c, value: e.target.value }
                        setForm({ ...form, conditions: next })
                      }}
                      dir={f?.type === 'text' ? undefined : 'ltr'}
                      className={`${field} w-28 ${f?.type !== 'text' ? 'text-start tabular-nums' : ''}`}
                    />
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      setForm({ ...form, conditions: form.conditions.filter((_, j) => j !== i) })
                    }
                    aria-label="حذف الشرط"
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:text-[var(--color-danger)]"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              )
            })}
            <button
              type="button"
              onClick={() =>
                setForm({
                  ...form,
                  conditions: [
                    ...form.conditions,
                    { field: def.fields[0]?.key ?? '', op: 'gte', value: '' },
                  ],
                })
              }
              className="w-fit text-sm font-medium text-[var(--primary)] hover:underline"
            >
              + ضيف شرط
            </button>
            {form.conditions.length === 0 && (
              <span className="text-xs text-[var(--fg-subtle)]">
                من غير شروط، القاعدة بتشتغل في كل مرة يحصل المحفّز.
              </span>
            )}
          </div>

          {/* الإجراءات */}
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">٣. اعمل</span>
            {form.actions.map((a, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-lg border border-[var(--border)] p-3">
                <div className="flex items-center gap-2">
                  <select
                    value={a.type}
                    onChange={(e) => {
                      const next = [...form.actions]
                      next[i] = { type: e.target.value, config: {} }
                      setForm({ ...form, actions: next })
                    }}
                    className={`${field} flex-1`}
                  >
                    {actionsFor(form.trigger).map((x) => (
                      <option key={x.key} value={x.key}>
                        {x.label}
                      </option>
                    ))}
                  </select>
                  {form.actions.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setForm({ ...form, actions: form.actions.filter((_, j) => j !== i) })
                      }
                      aria-label="حذف الإجراء"
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:text-[var(--color-danger)]"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </div>

                <ActionConfig
                  action={a}
                  onChange={(config) => {
                    const next = [...form.actions]
                    next[i] = { ...a, config }
                    setForm({ ...form, actions: next })
                  }}
                />

                <span className="text-xs text-[var(--fg-subtle)]">
                  {ACTIONS.find((x) => x.key === a.type)?.hint}
                </span>
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setForm({ ...form, actions: [...form.actions, { type: 'add_points', config: {} }] })
              }
              className="w-fit text-sm font-medium text-[var(--primary)] hover:underline"
            >
              + ضيف إجراء
            </button>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">فترة تهدئة (ساعة)</span>
            <input
              value={form.cooldownHours}
              onChange={(e) => setForm({ ...form, cooldownHours: e.target.value })}
              inputMode="numeric"
              dir="ltr"
              className={`${field} w-28 text-start tabular-nums`}
            />
            <span className="text-xs text-[var(--fg-subtle)]">
              أقل مدة بين تشغيلتين. صفر = من غير حد. بتمنع القاعدة تبعت رسايل متكررة لنفس العميل.
            </span>
          </label>

          <Toggle
            label="مفعّلة"
            checked={form.enabled}
            onChange={(v) => setForm({ ...form, enabled: v })}
          />

          <div className="flex gap-2">
            <Button onClick={save} loading={pending}>
              <Check className="h-4 w-4" aria-hidden="true" />
              حفظ القاعدة
            </Button>
            <Button variant="ghost" onClick={() => setForm(null)}>
              إلغاء
            </Button>
          </div>
        </Card>
      )}

      {rules.length === 0 && !form ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <Zap className="h-10 w-10 text-[var(--fg-subtle)]" aria-hidden="true" />
          <h2 className="text-lg font-semibold">مافيش قواعد أتمتة</h2>
          <p className="max-w-sm text-sm text-[var(--fg-muted)]">
            الأتمتة بتعمل الشغل المتكرّر عنك: ترحيب بالعملاء الجدد، مكافأة الطلبات الكبيرة، واسترجاع
            السلات المتروكة. ابدأ من مثال جاهز فوق.
          </p>
        </Card>
      ) : (
        rules.map((r) => (
          <RuleCard
            key={r.id}
            rule={r}
            onEdit={() =>
              setForm({
                id: r.id,
                name: r.name,
                trigger: r.trigger,
                conditions: r.conditions.map((c) => {
                  const f = triggerDef(r.trigger)?.fields.find((x) => x.key === c.field)
                  return {
                    field: c.field,
                    op: c.op,
                    // المبالغ مخزّنة بالقرش — بنرجّعها للجنيه في المحرّر
                    value: f?.type === 'money' ? String(Number(c.value) / 100) : String(c.value),
                  }
                }),
                actions: r.actions,
                cooldownHours: String(r.cooldownHours),
                enabled: r.enabled,
              })
            }
          />
        ))
      )}
    </div>
  )
}

function ActionConfig({
  action,
  onChange,
}: {
  action: { type: string; config: Record<string, unknown> }
  onChange: (config: Record<string, unknown>) => void
}) {
  const c = action.config ?? {}
  const set = (patch: Record<string, unknown>) => onChange({ ...c, ...patch })

  switch (action.type) {
    case 'send_email':
      return (
        <>
          <input
            value={String(c.subject ?? '')}
            onChange={(e) => set({ subject: e.target.value })}
            placeholder="عنوان الرسالة"
            className={`${field} w-full`}
          />
          <textarea
            value={String(c.body ?? '')}
            onChange={(e) => set({ body: e.target.value })}
            rows={4}
            placeholder="نص الرسالة"
            className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--primary)] focus:outline-none"
          />
          <span className="text-xs text-[var(--fg-subtle)]">
            متغيّرات: <code dir="ltr">{'{{name}} {{store}} {{order}} {{total}} {{link}}'}</code>
          </span>
        </>
      )

    case 'add_points':
      return (
        <div className="flex gap-2">
          <input
            value={String(c.points ?? '')}
            onChange={(e) => set({ points: e.target.value })}
            inputMode="numeric"
            dir="ltr"
            placeholder="النقاط"
            className={`${field} w-28 text-start tabular-nums`}
          />
          <input
            value={String(c.reason ?? '')}
            onChange={(e) => set({ reason: e.target.value })}
            placeholder="السبب"
            className={`${field} flex-1`}
          />
        </div>
      )

    case 'issue_coupon':
      return (
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={String(c.percent ?? '')}
            onChange={(e) => set({ percent: e.target.value })}
            inputMode="decimal"
            dir="ltr"
            placeholder="٪"
            className={`${field} w-20 text-start tabular-nums`}
          />
          <span className="text-sm text-[var(--fg-muted)]">٪ لمدة</span>
          <input
            value={String(c.days ?? '')}
            onChange={(e) => set({ days: e.target.value })}
            inputMode="numeric"
            dir="ltr"
            placeholder="١٤"
            className={`${field} w-20 text-start tabular-nums`}
          />
          <span className="text-sm text-[var(--fg-muted)]">يوم</span>
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={c.email !== false}
              onChange={(e) => set({ email: e.target.checked })}
              className="h-4 w-4 accent-[var(--primary)]"
            />
            ابعته بالبريد
          </label>
        </div>
      )

    case 'order_note':
      return (
        <input
          value={String(c.text ?? '')}
          onChange={(e) => set({ text: e.target.value })}
          placeholder="نص الملاحظة"
          className={`${field} w-full`}
        />
      )

    case 'set_status':
      return (
        <select
          value={String(c.status ?? 'confirmed')}
          onChange={(e) => set({ status: e.target.value })}
          className={`${field} w-full`}
        >
          <option value="confirmed">مؤكّد</option>
          <option value="processing">بيتجهّز</option>
          <option value="cancelled">ملغي</option>
        </select>
      )

    case 'call_webhook':
      return (
        <input
          value={String(c.url ?? '')}
          onChange={(e) => set({ url: e.target.value })}
          dir="ltr"
          placeholder="https://example.com/hook"
          className={`${field} w-full text-start`}
        />
      )

    default:
      return null
  }
}

function RuleCard({ rule: r, onEdit }: { rule: RuleRow; onEdit: () => void }) {
  const [pending, start] = useTransition()
  const def = triggerDef(r.trigger)

  return (
    <Card className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
        <Zap className="h-5 w-5" aria-hidden="true" />
      </span>

      <div className="min-w-0 flex-1">
        <span className="font-medium">{r.name}</span>
        <span className="mt-0.5 block text-xs text-[var(--fg-subtle)]">
          {def?.label ?? r.trigger}
          {r.conditions.length > 0 && ` · ${r.conditions.length} شرط`} · {r.actions.length} إجراء
          {r.runCount > 0 && ` · اشتغلت ${r.runCount} مرة`}
          {r.lastRunAt && ` · آخر مرة ${formatDate(r.lastRunAt)}`}
        </span>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={r.enabled}
        aria-label={r.enabled ? 'إيقاف القاعدة' : 'تفعيل القاعدة'}
        disabled={pending}
        onClick={() => start(() => toggleRuleAction(r.id, !r.enabled).then(() => {}))}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          r.enabled ? 'bg-[var(--primary)]' : 'bg-[var(--border-strong)]'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            r.enabled ? 'start-0.5' : 'start-[1.375rem]'
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
        onClick={() => start(() => deleteRuleAction(r.id).then(() => {}))}
        disabled={pending}
        aria-label="حذف"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--fg-muted)] transition-colors hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>
    </Card>
  )
}
