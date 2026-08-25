'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, MessageCircle, Phone, Trash2 } from 'lucide-react'
import { dismissIncompleteAction, logRecoveryMessageAction } from './actions'
import { CHECKOUT_STAGES, readyMessages, stageMeta, type MessageContext } from '@/lib/checkout-stage'
import type { CheckoutStage } from '@/db/schema'
import { Button, Card } from '@/components/ui'
import { cn } from '@/lib/utils'

/**
 * لوحة السلة المتروكة — بديلة أزرار الحالة.
 *
 * الطلب الناقص مالوش حالة يغيّرها التاجر: هو مش «قيد الانتظار»
 * ولا «بيتجهّز»، هو عميل وقف في نُص الطريق. الشبكة اللي كانت هنا
 * كانت بتوريه سبع أزرار مالهاش أي معنى في الحالة دي.
 *
 * اللي محتاجه فعلًا حاجة واحدة: **يكلّمه، ويعرف يقوله إيه.** فالبطاقة
 * بتوريه وقف فين، وتديله الجملة جاهزة على الواتساب بضغطة — والجملة
 * بتتغيّر مع المرحلة، لأن اللي وقف عند الدفع مش زي اللي لسه بيتفرّج.
 */
export function IncompleteActions({
  orderId,
  stage,
  phone,
  context,
}: {
  orderId: string
  stage: CheckoutStage | null
  phone: string | null
  context: MessageContext
}) {
  const [pending, start] = useTransition()
  const router = useRouter()

  const messages = readyMessages(stage, context)
  const [pickedId, setPickedId] = useState(messages[0]?.id ?? '')
  const picked = messages.find((m) => m.id === pickedId) ?? messages[0]

  /* التاجر بيعدّل الجملة قبل ما يبعتها — النص الجاهز بداية مش إلزام */
  const [draft, setDraft] = useState(picked?.text ?? '')
  const [copied, setCopied] = useState(false)

  function choose(id: string) {
    const next = messages.find((m) => m.id === id)
    if (!next) return
    setPickedId(id)
    setDraft(next.text)
    setCopied(false)
  }

  const digits = (phone ?? '').replace(/\D/g, '')
  const waHref = digits
    ? `https://wa.me/${digits}?text=${encodeURIComponent(draft)}`
    : undefined

  const currentRank = stageMeta(stage).rank

  /* الإرسال بيتسجّل على الطلب — عشان التاجر يعرف إنه كلّمه ومتى */
  function markSent() {
    start(async () => {
      await logRecoveryMessageAction(orderId, picked?.label ?? 'رسالة')
      router.refresh()
    })
  }

  return (
    <Card className="flex flex-col gap-5 p-5">
      <div className="flex flex-col gap-1">
        <h2 className="font-semibold">وقف عند إيه</h2>
        <p className="text-sm text-[var(--fg-muted)]">{stageMeta(stage).detail}</p>
      </div>

      {/*
        مقياس المراحل. أفقي على الشاشة الواسعة ورأسي على الفون:
        أربع خطوات بأسمائها جنب بعض على ٣٦٠ بكسل بتتقصّ أو تتلخبط.
      */}
      <ol className="flex flex-col gap-2 sm:flex-row sm:gap-1">
        {CHECKOUT_STAGES.map((s) => {
          const done = s.rank <= currentRank
          const here = s.rank === currentRank
          return (
            <li key={s.key} className="flex flex-1 items-center gap-2 sm:flex-col sm:items-stretch sm:gap-1.5">
              <span
                className={cn(
                  'h-1.5 w-1.5 shrink-0 rounded-full sm:h-1 sm:w-full',
                  done ? 'bg-[var(--color-warning)]' : 'bg-[var(--border-strong)]',
                )}
                aria-hidden="true"
              />
              <span
                className={cn(
                  'text-xs leading-tight',
                  here
                    ? 'font-semibold text-[var(--color-warning)]'
                    : done
                      ? 'text-[var(--fg-muted)]'
                      : 'text-[var(--fg-subtle)]',
                )}
              >
                {s.label}
                {here && <span className="sr-only"> — وقف هنا</span>}
              </span>
            </li>
          )
        })}
      </ol>

      <div className="flex flex-col gap-2 border-t border-[var(--border)] pt-4">
        <h3 className="text-sm font-semibold">رسالة جاهزة تبعتهاله</h3>

        {/* البدايل — الأولى هي المرشّحة، والباقي ليه سبب مكتوب تحته */}
        <div className="flex flex-wrap gap-1.5">
          {messages.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => choose(m.id)}
              className={cn(
                'min-h-9 rounded-lg border px-2.5 text-xs font-medium transition-colors',
                m.id === pickedId
                  ? 'border-transparent bg-[var(--primary)] text-white'
                  : 'border-[var(--border-strong)] text-[var(--fg-muted)] hover:bg-[var(--surface-2)]',
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        {picked && <p className="text-xs leading-relaxed text-[var(--fg-subtle)]">{picked.why}</p>}

        <textarea
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            setCopied(false)
          }}
          rows={7}
          aria-label="نص الرسالة"
          className="w-full resize-y rounded-lg border border-[var(--border-strong)] bg-[var(--surface-2)] p-3 text-sm leading-relaxed outline-none focus:border-[var(--primary)]"
        />

        <div className="flex flex-col gap-2 sm:flex-row">
          {waHref ? (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={markSent}
              className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--color-success)] px-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              ابعتها واتساب
            </a>
          ) : (
            <span className="flex min-h-11 flex-1 items-center justify-center rounded-lg bg-[var(--surface-2)] px-3 text-sm text-[var(--fg-subtle)]">
              مفيش رقم تليفون
            </span>
          )}

          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(draft).then(
                () => setCopied(true),
                () => setCopied(false),
              )
            }}
            className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--border-strong)] px-3 text-sm font-medium text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)] sm:w-28"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" aria-hidden="true" />
                اتنسخت
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" aria-hidden="true" />
                انسخ
              </>
            )}
          </button>
        </div>

        {phone && (
          <a
            href={`tel:${phone}`}
            className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[var(--border-strong)] text-sm font-medium text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)]"
          >
            <Phone className="h-4 w-4" aria-hidden="true" />
            اتصل بيه
          </a>
        )}
      </div>

      <Button
        variant="ghost"
        loading={pending}
        className="text-[var(--color-danger)]"
        onClick={() => {
          if (!confirm('هتمسح السلة المتروكة دي نهائيًا. متأكد؟')) return
          start(async () => {
            await dismissIncompleteAction(orderId)
            router.push('/dashboard/orders?filter=incomplete')
          })
        }}
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        تجاهل السلة دي
      </Button>
    </Card>
  )
}
