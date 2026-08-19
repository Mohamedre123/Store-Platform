'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  ExternalLink,
  Monitor,
  Plus,
  Save,
  Smartphone,
  Trash2,
} from 'lucide-react'
import { saveLandingAction } from '../actions'
import {
  BLOCK_LIBRARY,
  DEFAULT_TOKENS,
  blockDef,
  type Block,
  type LandingTokens,
} from '@/lib/landing'
import { FONT_LABELS } from '@/lib/customization'
import { Alert } from '@/components/ui'
import { BlockSettings } from './block-settings'
import { cn } from '@/lib/utils'

const RADIUS = [
  { value: 'none' as const, label: 'حادة' },
  { value: 'sm' as const, label: 'خفيفة' },
  { value: 'md' as const, label: 'متوسطة' },
  { value: 'lg' as const, label: 'دائرية' },
]

const WIDTHS = [
  { value: 'narrow' as const, label: 'ضيّقة' },
  { value: 'normal' as const, label: 'عادية' },
  { value: 'wide' as const, label: 'واسعة' },
]

const SWATCHES = ['#634b9a', '#0f4c81', '#15803d', '#b3341f', '#c9a227', '#0d9488', '#1b1b1f']

export function LandingEditor({
  funnel,
  previewUrl,
  publicUrl,
  products,
}: {
  funnel: {
    id: string
    name: string
    slug: string
    productId: string | null
    blocks: Block[]
    tokens: Record<string, unknown>
    seoTitle: string | null
    seoDescription: string | null
    status: string
  }
  previewUrl: string
  publicUrl: string
  products: Array<{ id: string; name: string }>
}) {
  const [name, setName] = useState(funnel.name)
  const [slug, setSlug] = useState(funnel.slug)
  const [productId, setProductId] = useState(funnel.productId)
  const [blocks, setBlocks] = useState<Block[]>(funnel.blocks)
  const [tokens, setTokens] = useState<LandingTokens>({ ...DEFAULT_TOKENS, ...(funnel.tokens as object) })
  const [seoTitle, setSeoTitle] = useState(funnel.seoTitle ?? '')
  const [seoDesc, setSeoDesc] = useState(funnel.seoDescription ?? '')
  const [published, setPublished] = useState(funnel.status === 'published')

  const [selected, setSelected] = useState<string | null>(blocks[0]?.id ?? null)
  const [tab, setTab] = useState<'blocks' | 'style' | 'seo'>('blocks')
  const [device, setDevice] = useState<'mobile' | 'desktop'>('desktop')
  const [adding, setAdding] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()

  const frame = useRef<HTMLIFrameElement>(null)
  const firstRun = useRef(true)
  const tick = useRef(0)

  /**
   * المعاينة بتتحدّث بإعادة تحميل الإطار بعد الحفظ التلقائي.
   *
   * على عكس محرّر الثيم (اللي بيبعت رسالة للإطار للألوان)، هنا البلوكات
   * نفسها بتتغيّر — فمفيش معنى نحاول نطبّقها في المتصفح، الخادم بيرسمها.
   */
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    const id = setTimeout(async () => {
      await saveLandingAction({
        id: funnel.id,
        name,
        slug,
        productId,
        blocks,
        tokens,
        seoTitle,
        seoDescription: seoDesc,
        status: published ? 'published' : 'draft',
      })
      const f = frame.current
      if (f) f.src = `${previewUrl}&r=${++tick.current}`
    }, 700)
    return () => clearTimeout(id)
  }, [blocks, tokens, name, slug, productId, seoTitle, seoDesc, published, funnel.id, previewUrl])

  const patchBlock = useCallback((id: string, settings: Record<string, unknown>) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, settings } : b)))
  }, [])

  function addBlock(type: string) {
    const def = blockDef(type)
    if (!def) return
    const block: Block = {
      id: `b${Date.now()}`,
      type: def.type,
      settings: { ...def.defaults },
    }
    setBlocks((prev) => [...prev, block])
    setSelected(block.id)
    setAdding(false)
  }

  function move(id: string, dir: -1 | 1) {
    setBlocks((prev) => {
      const i = prev.findIndex((b) => b.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  const current = blocks.find((b) => b.id === selected) ?? null
  const field =
    'h-10 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm focus:border-[var(--primary)] focus:outline-none'

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col">
      {/* الشريط العلوي */}
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-[var(--border)] px-4 py-3">
        <Link
          href="/dashboard/landing"
          aria-label="رجوع"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
        >
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="اسم الصفحة"
          className="min-w-0 flex-1 rounded-lg bg-transparent px-2 py-1 font-bold outline-none focus:bg-[var(--surface-2)]"
        />

        <div className="hidden items-center gap-1 rounded-lg border border-[var(--border-strong)] p-0.5 md:flex">
          {[
            { key: 'mobile' as const, Icon: Smartphone },
            { key: 'desktop' as const, Icon: Monitor },
          ].map(({ key, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setDevice(key)}
              aria-label={key === 'mobile' ? 'موبايل' : 'كمبيوتر'}
              aria-pressed={device === key}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-md',
                device === key ? 'bg-[var(--primary-soft)] text-[var(--primary)]' : 'text-[var(--fg-muted)]',
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
            </button>
          ))}
        </div>

        {published && (
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-10 items-center gap-1.5 rounded-lg border border-[var(--border-strong)] px-3 text-sm text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            افتح
          </a>
        )}

        <button
          type="button"
          onClick={() => setPublished((v) => !v)}
          className={cn(
            'flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold',
            published
              ? 'border border-[var(--border-strong)] text-[var(--fg-muted)]'
              : 'bg-[var(--primary)] text-[var(--primary-fg)]',
          )}
        >
          {published ? 'إيقاف النشر' : 'نشر الصفحة'}
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* اللوحة */}
        <aside className="flex w-full shrink-0 flex-col border-b border-[var(--border)] lg:w-[24rem] lg:border-b-0 lg:border-e">
          <div className="flex shrink-0 gap-1 border-b border-[var(--border)] p-2">
            {[
              { key: 'blocks' as const, label: 'البلوكات' },
              { key: 'style' as const, label: 'الهوية' },
              { key: 'seo' as const, label: 'السيو' },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  'flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  tab === t.key
                    ? 'bg-[var(--primary-soft)] text-[var(--primary)]'
                    : 'text-[var(--fg-muted)] hover:bg-[var(--surface-2)]',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {msg && <Alert tone={msg.ok ? 'success' : 'danger'}>{msg.text}</Alert>}

            {tab === 'blocks' && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  {blocks.map((b, i) => {
                    const def = blockDef(b.type)
                    const active = b.id === selected
                    return (
                      <div
                        key={b.id}
                        className={cn(
                          'flex items-center gap-1 rounded-lg border px-2 py-1.5',
                          active
                            ? 'border-[var(--primary)] bg-[var(--primary-soft)]'
                            : 'border-[var(--border)]',
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => setSelected(b.id)}
                          className="min-w-0 flex-1 truncate text-start text-sm font-medium"
                        >
                          {def?.label ?? b.type}
                        </button>
                        <button
                          type="button"
                          onClick={() => move(b.id, -1)}
                          disabled={i === 0}
                          aria-label="فوق"
                          className="flex h-7 w-7 items-center justify-center rounded text-[var(--fg-muted)] disabled:opacity-25"
                        >
                          <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => move(b.id, 1)}
                          disabled={i === blocks.length - 1}
                          aria-label="تحت"
                          className="flex h-7 w-7 items-center justify-center rounded text-[var(--fg-muted)] disabled:opacity-25"
                        >
                          <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setBlocks((prev) => prev.filter((x) => x.id !== b.id))
                            if (selected === b.id) setSelected(null)
                          }}
                          aria-label="حذف"
                          className="flex h-7 w-7 items-center justify-center rounded text-[var(--fg-muted)] hover:text-[var(--color-danger)]"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    )
                  })}
                </div>

                {adding ? (
                  <div className="flex flex-col gap-1.5 rounded-lg border border-[var(--border)] p-2">
                    {BLOCK_LIBRARY.map((def) => (
                      <button
                        key={def.type}
                        type="button"
                        onClick={() => addBlock(def.type)}
                        className="rounded-lg px-2 py-2 text-start transition-colors hover:bg-[var(--surface-2)]"
                      >
                        <span className="block text-sm font-medium">{def.label}</span>
                        <span className="block text-xs text-[var(--fg-subtle)]">{def.hint}</span>
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setAdding(false)}
                      className="mt-1 text-sm text-[var(--fg-muted)]"
                    >
                      إلغاء
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAdding(true)}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border-strong)] py-2.5 text-sm font-medium text-[var(--primary)]"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    ضيف بلوك
                  </button>
                )}

                {current && (
                  <div className="flex flex-col gap-4 border-t border-[var(--border)] pt-4">
                    <h3 className="font-semibold">{blockDef(current.type)?.label}</h3>
                    <BlockSettings
                      block={current}
                      onChange={(s) => patchBlock(current.id, s)}
                    />
                  </div>
                )}
              </div>
            )}

            {tab === 'style' && (
              <div className="flex flex-col gap-5">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">المنتج المرتبط</span>
                  <select
                    value={productId ?? ''}
                    onChange={(e) => setProductId(e.target.value || null)}
                    className={field}
                  >
                    <option value="">— مفيش —</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-[var(--fg-subtle)]">
                    بلوك المنتج وأزرار الشراء بتشتغل على المنتج ده.
                  </span>
                </label>

                {(
                  [
                    ['primary', 'اللون الأساسي'],
                    ['background', 'خلفية الصفحة'],
                    ['surface', 'خلفية البطاقات'],
                    ['text', 'لون النص'],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium">{label}</span>
                    <div className="flex items-center gap-2">
                      <input
                        value={tokens[key]}
                        onChange={(e) => setTokens({ ...tokens, [key]: e.target.value })}
                        dir="ltr"
                        className={`${field} w-28 text-start font-mono text-xs`}
                      />
                      <div className="flex gap-1">
                        {SWATCHES.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setTokens({ ...tokens, [key]: c })}
                            aria-label={`لون ${c}`}
                            className={cn(
                              'h-7 w-7 rounded-full border-2',
                              tokens[key] === c ? 'border-[var(--fg)]' : 'border-transparent',
                            )}
                            style={{ background: c }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                ))}

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">الخط</span>
                  <select
                    value={tokens.font}
                    onChange={(e) => setTokens({ ...tokens, font: e.target.value as LandingTokens['font'] })}
                    className={field}
                  >
                    {(Object.keys(FONT_LABELS) as Array<keyof typeof FONT_LABELS>).map((k) => (
                      <option key={k} value={k}>
                        {FONT_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">حواف العناصر</span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {RADIUS.map((r) => (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setTokens({ ...tokens, radius: r.value })}
                        className={cn(
                          'min-h-9 rounded-lg border text-xs font-medium',
                          tokens.radius === r.value
                            ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]'
                            : 'border-[var(--border-strong)] text-[var(--fg-muted)]',
                        )}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">عرض الصفحة</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {WIDTHS.map((w) => (
                      <button
                        key={w.value}
                        type="button"
                        onClick={() => setTokens({ ...tokens, width: w.value })}
                        className={cn(
                          'min-h-9 rounded-lg border text-xs font-medium',
                          tokens.width === w.value
                            ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]'
                            : 'border-[var(--border-strong)] text-[var(--fg-muted)]',
                        )}
                      >
                        {w.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {tab === 'seo' && (
              <div className="flex flex-col gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">رابط الصفحة</span>
                  <input
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    dir="ltr"
                    className={`${field} text-start font-mono`}
                  />
                  <span className="text-xs text-[var(--fg-subtle)]" dir="ltr">
                    …/lp/{slug}
                  </span>
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">عنوان السيو</span>
                  <input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} className={field} />
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium">وصف السيو</span>
                  <textarea
                    value={seoDesc}
                    onChange={(e) => setSeoDesc(e.target.value)}
                    rows={3}
                    className="rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--primary)] focus:outline-none"
                  />
                </label>
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-[var(--border)] p-3">
            <button
              type="button"
              onClick={() =>
                start(async () => {
                  const res = await saveLandingAction({
                    id: funnel.id,
                    name,
                    slug,
                    productId,
                    blocks,
                    tokens,
                    seoTitle,
                    seoDescription: seoDesc,
                    status: published ? 'published' : 'draft',
                  })
                  setMsg(
                    res?.error ? { ok: false, text: res.error } : { ok: true, text: 'اتحفظ' },
                  )
                  if (res?.slug) setSlug(res.slug)
                })
              }
              disabled={pending}
              className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] text-sm font-semibold text-[var(--primary-fg)] disabled:opacity-60"
            >
              {msg?.ok ? <Check className="h-4 w-4" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
              حفظ
            </button>
          </div>
        </aside>

        {/* المعاينة */}
        <div className="flex min-h-0 flex-1 items-start justify-center overflow-auto bg-[var(--surface-2)] p-4">
          <div
            className="h-full w-full overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-lg transition-[max-width] duration-300"
            style={{ maxWidth: device === 'mobile' ? 390 : 1100 }}
          >
            <iframe
              ref={frame}
              src={previewUrl}
              title="معاينة صفحة الهبوط"
              className="h-full min-h-[40rem] w-full border-0"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
