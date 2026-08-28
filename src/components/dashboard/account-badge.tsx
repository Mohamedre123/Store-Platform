'use client'

import { useState } from 'react'
import { Check, Copy, Fingerprint } from 'lucide-react'

/**
 * معرّف الحساب — بيتنسخ بضغطة.
 *
 * التاجر محتاجه في لحظة واحدة بس: لما يبعت تأكيد الدفع. ولأنها لحظة
 * واحدة، لازم يلاقيه من غير ما يدوّر — وينسخه من غير ما يكتبه، لأن
 * حرف غلط في المعرّف بيخلّي البحث عنه يرجع فاضي.
 */
export function AccountBadge({ accountId }: { accountId: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(accountId)
    } catch {
      const el = document.createElement('textarea')
      el.value = accountId
      el.setAttribute('readonly', '')
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.select()
      try {
        document.execCommand('copy')
      } catch {
        /* المعرّف ظاهر قدامه — ينفع ينسخه بإيده */
      }
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? 'اتنسخ' : 'انسخ معرّف الحساب'}
      className="group flex min-h-11 items-center gap-2.5 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-2)] px-3 text-start transition-colors hover:bg-[var(--surface)]"
    >
      <Fingerprint
        className="h-4 w-4 shrink-0 text-[var(--fg-subtle)]"
        aria-hidden="true"
      />
      <span className="min-w-0">
        <span className="block text-[11px] leading-tight text-[var(--fg-subtle)]">
          معرّف حسابك
        </span>
        <bdi
          dir="ltr"
          className="tabular block text-sm font-bold leading-tight tracking-wider"
        >
          {accountId}
        </bdi>
      </span>
      {copied ? (
        <Check
          className="h-4 w-4 shrink-0 text-[var(--color-success)]"
          aria-hidden="true"
        />
      ) : (
        <Copy
          className="h-4 w-4 shrink-0 text-[var(--fg-subtle)] transition-colors group-hover:text-[var(--fg)]"
          aria-hidden="true"
        />
      )}
    </button>
  )
}
