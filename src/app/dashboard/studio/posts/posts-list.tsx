'use client'

import Image from 'next/image'
import { useState, useTransition } from 'react'
import { Check, Copy, Download, Loader2, Send, Trash2 } from 'lucide-react'
import { deletePostAction, publishPostAction } from '../actions'
import { platformOf } from '@/lib/studio-meta'
import { Card } from '@/components/ui'
import { toast } from '@/components/dashboard/toast'
import { cn, formatDateTime } from '@/lib/utils'

type Post = {
  id: string
  caption: string
  hashtags: string[]
  imageUrls: string[]
  videoUrl: string | null
  status: string
  targets: string[]
  publishedAt: string | null
  createdAt: string
  results: Array<{ accountId: string; ok: boolean; error?: string }>
}

const STATUS: Record<string, { label: string; tone: string }> = {
  draft: { label: 'مسوّدة', tone: 'bg-[var(--surface-2)] text-[var(--fg-muted)]' },
  ready: { label: 'جاهز للنشر', tone: 'bg-[var(--primary-soft)] text-[var(--primary)]' },
  scheduled: { label: 'مجدوَل', tone: 'bg-[var(--color-info-soft)] text-[var(--color-info)]' },
  publishing: { label: 'بينشر…', tone: 'bg-[var(--color-info-soft)] text-[var(--color-info)]' },
  published: { label: 'اتنشر', tone: 'bg-[var(--color-success-soft)] text-[var(--color-success)]' },
  failed: { label: 'فشل', tone: 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]' },
}

/**
 * قايمة البوستات.
 *
 * ## نتيجة كل حساب على حدة
 * البوست اللي نزل على فيسبوك وفشل على إنستجرام بيوري الاتنين.
 * الحالة الواحدة كانت بتخلّي التاجر يعيد النشر فينزل على فيسبوك
 * مرتين — أو يفتكر إن اللي ما نزلش نزل.
 */
export function PostsList({
  posts,
  accounts,
}: {
  posts: Post[]
  accounts: Array<{ id: string; name: string; platform: string }>
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [, start] = useTransition()
  const byId = new Map(accounts.map((a) => [a.id, a]))

  return (
    <div className="flex flex-col gap-3">
      {posts.map((p) => {
        const s = STATUS[p.status] ?? STATUS.draft
        const text = [p.caption, p.hashtags.join(' ')].filter(Boolean).join('\n\n')

        return (
          <Card key={p.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
            {/*
              الفيديو بعنصره لا في `<img>`.

              `<img>` على mp4 بيرسم أيقونة مكسورة من غير ما يقول
              ليه — والتاجر بيفتكر إن الفيديو نفسه بايظ.
            */}
            {p.videoUrl ? (
              <video
                src={p.videoUrl}
                controls
                playsInline
                className="aspect-square w-full shrink-0 rounded-xl border border-[var(--border)] bg-black object-cover sm:w-32"
              />
            ) : p.imageUrls[0] ? (
              <span className="relative block aspect-square w-full shrink-0 overflow-hidden rounded-xl border border-[var(--border)] sm:w-32">
                <Image src={p.imageUrls[0]} alt="" fill sizes="128px" className="object-cover" />
              </span>
            ) : null}

            <div className="flex min-w-0 flex-1 flex-col gap-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn('rounded px-2 py-0.5 text-[11px] font-medium', s.tone)}>
                  {s.label}
                </span>
                <span className="text-xs text-[var(--fg-subtle)]">
                  {formatDateTime(p.publishedAt ?? p.createdAt)}
                </span>
              </div>

              <p className="whitespace-pre-line text-sm leading-relaxed">{p.caption}</p>

              {p.hashtags.length > 0 && (
                <p className="text-xs text-[var(--primary)]">{p.hashtags.join(' ')}</p>
              )}

              {/* نتيجة كل وجهة */}
              {p.results.length > 0 && (
                <div className="flex flex-col gap-1">
                  {p.results.map((r) => {
                    const acc = byId.get(r.accountId)
                    return (
                      <span key={r.accountId} className="flex flex-wrap items-center gap-1.5 text-xs">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: platformOf(acc?.platform ?? '').color }}
                          aria-hidden="true"
                        />
                        <span className="text-[var(--fg-muted)]">{acc?.name ?? 'حساب متشال'}</span>
                        {r.ok ? (
                          <span className="text-[var(--color-success)]">اتنشر</span>
                        ) : (
                          <span className="text-[var(--color-danger)]">{r.error ?? 'فشل'}</span>
                        )}
                      </span>
                    )
                  })}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {p.targets.length > 0 && p.status !== 'published' && (
                  <button
                    type="button"
                    disabled={busy === p.id}
                    onClick={() => {
                      setBusy(p.id)
                      start(async () => {
                        const res = await publishPostAction(p.id)
                        setBusy(null)
                        toast(res.error ?? 'اتنشر')
                      })
                    }}
                    className="flex h-10 items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-fg)] disabled:opacity-50"
                  >
                    {busy === p.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Send className="h-4 w-4" aria-hidden="true" />
                    )}
                    انشر
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard
                      ?.writeText(text)
                      .then(() => toast('اتنسخ'))
                      .catch(() => toast('مقدرناش ننسخ'))
                  }}
                  className="flex h-10 items-center gap-1.5 rounded-lg border border-[var(--border-strong)] px-3 text-sm text-[var(--fg-muted)]"
                >
                  <Copy className="h-4 w-4" aria-hidden="true" />
                  انسخ الكلام
                </button>

                {(p.videoUrl || p.imageUrls[0]) && (
                  <a
                    href={p.videoUrl ?? p.imageUrls[0]}
                    download
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-10 items-center gap-1.5 rounded-lg border border-[var(--border-strong)] px-3 text-sm text-[var(--fg-muted)]"
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    {p.videoUrl ? 'نزّل الفيديو' : 'نزّل الصورة'}
                  </a>
                )}

                <button
                  type="button"
                  aria-label="احذف البوست"
                  onClick={() => {
                    if (!confirm('هتحذف البوست ده؟')) return
                    start(async () => {
                      await deletePostAction(p.id)
                      toast('اتحذف')
                    })
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--color-danger)] transition-colors hover:bg-[var(--surface-2)]"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              {p.targets.length === 0 && p.status !== 'published' && (
                <p className="flex items-center gap-1.5 text-xs text-[var(--fg-subtle)]">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  جاهز — نزّل {p.videoUrl ? 'الفيديو' : 'الصورة'} وانسخ الكلام وانشره بإيدك، أو
                  اربط صفحتك عشان ينزل لوحده.
                </p>
              )}
            </div>
          </Card>
        )
      })}
    </div>
  )
}
