'use client'

import { useState, useTransition } from 'react'
import { Check, Copy, ExternalLink, Info, TriangleAlert } from 'lucide-react'
import { Alert, Card } from '@/components/ui'
import { MARKETPLACES, feedPath, type Connection } from '@/lib/marketplace-meta'
import { saveMarketplaceAction } from './actions'

/**
 * ربط الكتالوج بمنصات الإعلانات.
 *
 * الشاشة بتقول للتاجر حاجة واحدة بوضوح: **فعّل، انسخ الرابط،
 * الزقه عندهم.** مفيش تعاقد ولا انتظار موافقة — ودي كانت العقبة
 * اللي بتأخّر الحتة دي شهور.
 */
export function MarketplaceManager({
  connections,
  origin,
  storeId,
  counts,
}: {
  connections: Record<string, Connection>
  origin: string
  storeId: string
  /** كام منتج نشط وكام منهم مؤهّل (له صورة) */
  counts: { total: number; eligible: number }
}) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const missing = counts.total - counts.eligible

  return (
    <div className="flex flex-col gap-5">
      {msg && <Alert tone={msg.ok ? 'success' : 'danger'}>{msg.text}</Alert>}

      <p className="flex items-start gap-2 rounded-[var(--radius-card)] bg-[var(--color-info-soft)] px-4 py-3 text-sm leading-relaxed text-[var(--color-info)]">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          إحنا بنجهّزلك <strong>ملف كتالوج</strong> على رابط ثابت، وإنت بتلزقه في حسابك
          عندهم. هما بيجيبوه لوحدهم كل يوم، فأي تغيير في سعر أو مخزون بيوصلهم من غير
          ما تعمل حاجة. <strong>مش محتاج أي تعاقد ولا موافقة.</strong>
        </span>
      </p>

      {missing > 0 && (
        <p className="flex items-start gap-2 rounded-[var(--radius-card)] bg-[var(--color-warning-soft)] px-4 py-3 text-sm leading-relaxed text-[var(--color-warning)]">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <strong>{missing} منتج من غير صورة</strong> مش هيتبعتوا. المنصات بترفض المنتج
            اللي مالوش صورة، والمرفوض بيتعدّ في نسبة أخطاء حسابك — ونسبة عالية بتوقف
            الكتالوج كله. حطّ صورهم وهيدخلوا لوحدهم.
          </span>
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {MARKETPLACES.map((def) => (
          <PlatformCard
            key={def.platform}
            def={def}
            state={connections[def.platform]}
            feedUrl={origin + feedPath(storeId, def.platform)}
            eligible={counts.eligible}
            onMessage={setMsg}
          />
        ))}
      </div>
    </div>
  )
}

function PlatformCard({
  def,
  state,
  feedUrl,
  eligible,
  onMessage,
}: {
  def: (typeof MARKETPLACES)[number]
  state?: Connection
  feedUrl: string
  eligible: number
  onMessage: (m: { ok: boolean; text: string }) => void
}) {
  const [enabled, setEnabled] = useState(state?.enabled ?? false)
  const [syncPrices, setSyncPrices] = useState(state?.syncPrices ?? true)
  const [syncStock, setSyncStock] = useState(state?.syncStock ?? true)
  const [copied, setCopied] = useState(false)
  const [pending, start] = useTransition()

  const save = (next: Partial<{ enabled: boolean; syncPrices: boolean; syncStock: boolean }>) =>
    start(async () => {
      const payload = { platform: def.platform, enabled, syncPrices, syncStock, ...next }
      const res = await saveMarketplaceAction(payload)
      if (res?.error) {
        onMessage({ ok: false, text: res.error })
        setEnabled(state?.enabled ?? false)
        return
      }
      onMessage({ ok: true, text: next.enabled === false ? 'اتوقفت' : 'اتحفظ' })
    })

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-start gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white"
          style={{ background: def.color }}
          aria-hidden="true"
        >
          {def.brand.slice(0, 2).toUpperCase()}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="font-semibold">{def.name}</h3>
            <span className="text-xs text-[var(--fg-subtle)]" dir="ltr">
              {def.brand}
            </span>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-[var(--fg-muted)]">{def.desc}</p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-busy={pending}
          aria-label={enabled ? `إيقاف ${def.name}` : `تفعيل ${def.name}`}
          onClick={() => {
            if (pending) return
            const next = !enabled
            setEnabled(next)
            save({ enabled: next })
          }}
          className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${
            enabled ? 'bg-[var(--primary)]' : 'bg-[var(--border-strong)]'
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
              enabled ? 'start-0.5' : 'start-[1.375rem]'
            }`}
          />
        </button>
      </div>

      {enabled ? (
        <div className="flex flex-col gap-4 border-t border-[var(--border)] pt-4">
          <div>
            <span className="text-sm font-medium">رابط الملف</span>
            <p className="mt-1 text-xs leading-relaxed text-[var(--fg-muted)]">{def.where}</p>
            <div className="mt-2 flex gap-1.5">
              <code
                dir="ltr"
                className="min-w-0 flex-1 truncate rounded-lg bg-[var(--surface-2)] px-2.5 py-2 text-start font-mono text-xs"
              >
                {feedUrl}
              </code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(feedUrl)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                }}
                aria-label="انسخ الرابط"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--border-strong)] transition-colors hover:bg-[var(--surface-2)]"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-[var(--color-success)]" aria-hidden="true" />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
            <a
              href={feedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[var(--primary)] hover:underline"
            >
              افتح الملف وشوفه بنفسك ({eligible} منتج)
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          </div>

          <div className="flex flex-col gap-2 border-t border-[var(--border)] pt-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={syncPrices}
                onChange={(e) => {
                  setSyncPrices(e.target.checked)
                  save({ syncPrices: e.target.checked })
                }}
                className="h-4 w-4 accent-[var(--primary)]"
              />
              حدّث الأسعار معاهم
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={syncStock}
                onChange={(e) => {
                  setSyncStock(e.target.checked)
                  save({ syncStock: e.target.checked })
                }}
                className="h-4 w-4 accent-[var(--primary)]"
              />
              حدّث المخزون معاهم
            </label>
          </div>

          {state?.lastSyncAt && (
            <p className="text-xs text-[var(--fg-subtle)]">
              آخر مرة جابوا الملف: {new Date(state.lastSyncAt).toLocaleString('ar-EG')}
              {state.syncedCount > 0 && ` · ${state.syncedCount} منتج`}
            </p>
          )}
        </div>
      ) : (
        <a
          href={def.signupUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border-strong)] px-3 py-2.5 text-sm transition-colors hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]"
        >
          <span>
            لسه مالكش حساب عندهم؟
            <span className="block text-xs text-[var(--fg-subtle)]">
              افتح حساب، وبعدين فعّل من هنا وانسخ الرابط.
            </span>
          </span>
          <ExternalLink className="h-4 w-4 shrink-0 text-[var(--primary)]" aria-hidden="true" />
        </a>
      )}
    </Card>
  )
}
