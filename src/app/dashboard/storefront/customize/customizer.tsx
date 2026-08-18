'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, Monitor, RotateCcw, Save, Smartphone, Tablet } from 'lucide-react'
import { saveCustomizationAction, saveDraftAction } from './actions'
import { Panel } from './panels'
import { PANELS, type Customization, type PanelKey } from '@/lib/customization'
import { Button } from '@/components/ui'
import { cn } from '@/lib/utils'

const DEVICES = [
  { key: 'mobile' as const, label: 'موبايل', icon: Smartphone, width: 390 },
  { key: 'tablet' as const, label: 'تابلت', icon: Tablet, width: 820 },
  { key: 'desktop' as const, label: 'كمبيوتر', icon: Monitor, width: 1280 },
]

export function Customizer({
  initial,
  previewUrl,
  themeName,
}: {
  initial: Customization
  previewUrl: string
  themeName: string
}) {
  const [draft, setDraft] = useState<Customization>(initial)
  const [panel, setPanel] = useState<PanelKey>('identity')
  const [device, setDevice] = useState<'mobile' | 'tablet' | 'desktop'>('desktop')
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [pending, startSave] = useTransition()
  const frame = useRef<HTMLIFrameElement>(null)
  const firstRun = useRef(true)
  const reloadPending = useRef(false)
  const reloadTick = useRef(0)

  // خصائص الهوية اللي جسر المعاينة بيطبّقها فورًا من غير إعادة تحميل
  const LIVE_IDENTITY = new Set([
    'primary', 'accent', 'background', 'surface', 'text', 'radius', 'fontHeading', 'fontBody',
  ])

  const patch = useCallback<
    <K extends PanelKey>(key: K, values: Partial<Customization[K]>) => void
  >((key, values) => {
    setDraft((prev) => ({ ...prev, [key]: { ...prev[key], ...values } }))
    setDirty(true)
    setSaved(false)

    // التغييرات اللي الجسر مبيطبّقهاش لحظيًا (شرائح البانر، الأعمدة،
    // الشعار، شاشة التحميل...) محتاجة إعادة تحميل للإطار عشان تبان.
    // الألوان والخطوط ونص الإعلان بيتطبّقوا فورًا فمش محتاجين تحميل.
    const liveOnly =
      key === 'announcement' ||
      (key === 'identity' && Object.keys(values).every((k) => LIVE_IDENTITY.has(k)))
    if (!liveOnly) reloadPending.current = true
  }, [])

  /**
   * المعاينة الفورية للألوان والخطوط ونص الإعلان — رسالة للإطار من غير
   * إعادة تحميل، فالتاجر يشوف الأثر وهو بيسحب منتقي اللون.
   */
  useEffect(() => {
    const id = setTimeout(() => {
      frame.current?.contentWindow?.postMessage({ type: 'zawya:preview', customization: draft }, '*')
    }, 120)
    return () => clearTimeout(id)
  }, [draft])

  /**
   * حفظ المسوّدة تلقائيًا بعد ما التاجر يبطّل تعديل، وإعادة تحميل الإطار
   * لو التغيير هيكلي — فالمعاينة بتعرض المسوّدة الحقيقية المرسومة على
   * الخادم، بما فيها البانر والأعمدة والشعار وشاشة التحميل. من غير كده
   * كان نص المحرّر «بعدّل ومفيش بيتغيّر».
   */
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    setSyncing(true)
    const id = setTimeout(async () => {
      await saveDraftAction(draft)
      if (reloadPending.current) {
        reloadPending.current = false
        const f = frame.current
        if (f) f.src = `${previewUrl}&r=${++reloadTick.current}`
      }
      setSyncing(false)
    }, 600)
    return () => clearTimeout(id)
  }, [draft, previewUrl])

  // تحذير قبل مغادرة الصفحة بتعديلات غير محفوظة
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const current = PANELS.find((p) => p.key === panel)!

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col lg:h-[calc(100dvh-4rem)]">
      {/* الشريط العلوي */}
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-[var(--border)] px-4 py-3 sm:px-6">
        <Link
          href="/dashboard/storefront"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)]"
          aria-label="رجوع"
        >
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>

        <div className="min-w-0 flex-1">
          <h1 className="truncate font-bold">تخصيص المتجر</h1>
          <p className="truncate text-xs text-[var(--fg-subtle)]">ثيم {themeName}</p>
        </div>

        <div className="hidden items-center gap-1 rounded-lg border border-[var(--border-strong)] p-0.5 md:flex">
          {DEVICES.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setDevice(key)}
              aria-label={label}
              aria-pressed={device === key}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-md transition-colors',
                device === key
                  ? 'bg-[var(--primary-soft)] text-[var(--primary)]'
                  : 'text-[var(--fg-muted)] hover:bg-[var(--surface-2)]',
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
            </button>
          ))}
        </div>

        {dirty && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              reloadPending.current = true
              setDraft(initial)
              setDirty(false)
            }}
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            تراجع
          </Button>
        )}

        {syncing && <span className="text-xs text-[var(--fg-subtle)]">بيحدّث المعاينة…</span>}

        <Button
          size="sm"
          disabled={!dirty}
          loading={pending}
          onClick={() =>
            startSave(async () => {
              await saveCustomizationAction(draft)
              setDirty(false)
              setSaved(true)
              setTimeout(() => setSaved(false), 2500)
            })
          }
        >
          {saved ? <Check className="h-4 w-4" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
          {saved ? 'اتحفظ' : 'نشر التعديلات'}
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* اللوحات */}
        <aside className="flex w-full shrink-0 flex-col border-b border-[var(--border)] lg:w-[22rem] lg:border-b-0 lg:border-e">
          <div className="scroll-x flex shrink-0 gap-1 border-b border-[var(--border)] p-2">
            {PANELS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPanel(p.key)}
                className={cn(
                  'shrink-0 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                  panel === p.key
                    ? 'bg-[var(--primary-soft)] text-[var(--primary)]'
                    : 'text-[var(--fg-muted)] hover:bg-[var(--surface-2)]',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="mb-5">
              <h2 className="font-semibold">{current.label}</h2>
              <p className="mt-0.5 text-xs text-[var(--fg-subtle)]">{current.hint}</p>
            </div>
            <div className="flex flex-col gap-6 pb-10">
              <Panel panel={panel} value={draft} patch={patch} />
            </div>
          </div>
        </aside>

        {/* المعاينة */}
        <div className="flex min-h-0 flex-1 items-start justify-center overflow-auto bg-[var(--surface-2)] p-4">
          <div
            className="h-full w-full overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-lg transition-[max-width] duration-300"
            style={{ maxWidth: DEVICES.find((d) => d.key === device)!.width }}
          >
            <iframe
              ref={frame}
              src={previewUrl}
              title="معاينة المتجر"
              className="h-full min-h-[36rem] w-full border-0"
              // المعاينة محتوى متجر التاجر — نمنعها من الملاحة خارج الإطار
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
