'use client'

import Image from 'next/image'
import { useTransition } from 'react'
import { AlertTriangle, Link2, Trash2 } from 'lucide-react'
import { disconnectAccountAction } from '../actions'
import { PLATFORMS, platformOf, type SocialPlatform } from '@/lib/studio-meta'
import { Alert, Card } from '@/components/ui'
import { toast } from '@/components/dashboard/toast'

type Account = {
  id: string
  platform: string
  name: string
  avatar: string | null
  canPublish: boolean
  status: string
  lastError: string | null
}

/**
 * شاشة الربط.
 *
 * ## الرابط `<a>` عادي لا زرار
 * الربط بيخرج من موقعنا لشاشة موافقة فيسبوك. التنقّل الداخلي
 * بتاع Next بيحاول يجيب صفحة من عندنا وبيقع — والخروج لازم يبقى
 * تنقّل متصفح حقيقي.
 */
export function AccountsPanel({
  accounts,
  available,
  connected,
  error,
}: {
  accounts: Account[]
  available: SocialPlatform[]
  connected: string | null
  error: string | null
}) {
  const [pending, start] = useTransition()

  /* فيسبوك وإنستجرام رحلة واحدة — الموافقة بتغطّي الاتنين */
  const entries = PLATFORMS.filter(
    (p) => available.includes(p.key) && p.key !== 'instagram',
  )

  return (
    <div className="flex flex-col gap-4">
      {error && <Alert tone="danger">{error}</Alert>}
      {connected === 'draft' && (
        <Alert tone="warning">
          اتربط. بس تيك توك لسه ما وافقش على النشر المباشر لتطبيقنا — البوستات هتنزل في
          «المسوّدات» عندك في التطبيق وتدوس نشر منها.
        </Alert>
      )}
      {connected && connected !== 'draft' && (
        <Alert tone="success">اتربط. تقدر تنشر عليه دلوقتي.</Alert>
      )}

      {/* ── المربوط ────────────────────────────────────── */}
      {accounts.length > 0 && (
        <Card className="divide-y divide-[var(--border)]">
          {accounts.map((a) => {
            const p = platformOf(a.platform)
            return (
              <div key={a.id} className="flex flex-wrap items-center gap-3 p-4">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full"
                  style={{ background: p.color + '22' }}
                >
                  {a.avatar ? (
                    <Image src={a.avatar} alt="" width={40} height={40} className="h-10 w-10 object-cover" />
                  ) : (
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ background: p.color }}
                      aria-hidden="true"
                    />
                  )}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{a.name}</span>
                  <span className="block text-xs text-[var(--fg-subtle)]">
                    {p.label}
                    {!a.canPublish && ' · مسوّدات بس'}
                  </span>
                </span>

                {a.status !== 'active' ? (
                  <span className="flex shrink-0 items-center gap-1 rounded bg-[var(--color-danger-soft)] px-2 py-1 text-xs text-[var(--color-danger)]">
                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                    الربط انتهى
                  </span>
                ) : (
                  <span className="shrink-0 rounded bg-[var(--color-success-soft)] px-2 py-1 text-xs text-[var(--color-success)]">
                    شغّال
                  </span>
                )}

                <button
                  type="button"
                  disabled={pending}
                  aria-label={`افصل ${a.name}`}
                  onClick={() => {
                    if (!confirm(`هتفصل «${a.name}»؟ البوستات المجدولة عليه هتقف.`)) return
                    start(async () => {
                      await disconnectAccountAction(a.id)
                      toast('اتفصل')
                    })
                  }}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--color-danger)] transition-colors hover:bg-[var(--surface-2)]"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>

                {a.lastError && (
                  <p className="w-full text-xs text-[var(--color-danger)]">{a.lastError}</p>
                )}
              </div>
            )
          })}
        </Card>
      )}

      {/* ── الربط ──────────────────────────────────────── */}
      <Card className="flex flex-col gap-3 p-4">
        <div>
          <h2 className="font-semibold">اربط حساب</h2>
          <p className="mt-0.5 text-sm text-[var(--fg-muted)]">
            الربط مجاني تمامًا — مفيش أي رسوم على النشر.
          </p>
        </div>

        {entries.length === 0 ? (
          <p className="rounded-lg bg-[var(--surface-2)] px-3.5 py-3 text-sm leading-relaxed text-[var(--fg-muted)]">
            الربط بالسوشيال لسه بيتجهّز على المنصة. لحد ما يفتح، البوستات بتتحفظ جاهزة في
            «البوستات» وتنزّلها وتنشرها بإيدك — الصور والكلام شغّالين عادي.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {entries.map((p) => (
              <a
                key={p.key}
                href={`/api/social/start?platform=${p.key}`}
                className="flex min-h-12 items-center gap-3 rounded-lg border border-[var(--border-strong)] px-3.5 transition-colors hover:border-[var(--primary)]"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: p.color }}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    {p.key === 'facebook' ? 'فيسبوك وإنستجرام' : p.label}
                  </span>
                  <span className="block text-xs text-[var(--fg-subtle)]">
                    {p.key === 'facebook'
                      ? 'موافقة واحدة بتربط صفحتك وحساب إنستجرام المربوط بيها'
                      : p.note}
                  </span>
                </span>
                <Link2 className="h-4 w-4 shrink-0 text-[var(--fg-subtle)]" aria-hidden="true" />
              </a>
            ))}
          </div>
        )}

        {/*
          الشروط بتتقال قبل الضغط لا بعد الفشل.

          «لازم تكون أدمن على صفحة» و«الحساب لازم يكون أعمال» هما
          سببا كل فشل ربط تقريبًا — وقراءتهم بعد رسالة خطأ من فيسبوك
          بلغة إنجليزية بتخلّي التاجر يفتكر إن المشكلة عندنا.
        */}
        <div className="rounded-lg bg-[var(--surface-2)] px-3.5 py-3 text-xs leading-relaxed text-[var(--fg-muted)]">
          <p className="font-medium text-[var(--fg)]">قبل ما تربط:</p>
          <ul className="mt-1 flex list-disc flex-col gap-0.5 ps-4">
            <li>لازم تكون أدمن على صفحة فيسبوك — الحساب الشخصي ما ينفعش ينشر منه.</li>
            <li>لإنستجرام: حسابك لازم يكون «أعمال» أو «صانع محتوى» ومربوط بالصفحة.</li>
            <li>الصور اللي بتتنشر لازم تكون من متجرك — الاستوديو بيرفعها لوحده.</li>
          </ul>
        </div>
      </Card>
    </div>
  )
}
