'use client'

import { useState } from 'react'
import { Check, Copy, MessageCircle, Share2, UserPlus, Users } from 'lucide-react'
import { Button, Card } from '@/components/ui'
import { toast } from '@/components/dashboard/toast'
import { cn } from '@/lib/utils'

/**
 * لوحة إحالة التاجر.
 *
 * ## الرابط أول حاجة وأكبر حاجة
 * الصفحة دي ليها هدف واحد: إن التاجر يبعت الرابط. أي حاجة بتتحط
 * قبله بتأخّر الفعل اللي الصفحة اتعملت عشانه.
 *
 * ## وزرار واتساب لا «شارك»
 * التاجر المصري بيبعت على واتساب. زرار مشاركة عام بيفتح قايمة
 * بعشر تطبيقات عشان يوصل لنفس الحاجة، وكل خطوة زيادة بتقلّل اللي
 * بيبعتوا فعلًا.
 */
export function ReferralPanel({
  link,
  code,
  signups,
  subscribed,
  deliveredOrders,
  storeName,
}: {
  link: string
  code: string
  signups: number
  subscribed: number
  deliveredOrders: number
  storeName: string
}) {
  const [copied, setCopied] = useState(false)

  const message = `أنا بستخدم زاوية في إدارة متجري «${storeName}» ومبسوط منها. لو بتفكّر تفتح متجرك، سجّل من هنا:\n${link}`

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        toast(label)
      },
      () => toast('المتصفح رفض النسخ — اختار النص بإيدك', 'error'),
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ────────── الرابط ────────── */}
      <Card className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-1">
          <h2 className="flex items-center gap-2 font-semibold">
            <Share2 className="h-4 w-4 text-[var(--primary)]" aria-hidden="true" />
            رابطك
          </h2>
          <p className="text-sm leading-relaxed text-[var(--fg-muted)]">
            كل واحد يسجّل من الرابط ده بيتسجّل باسمك عندنا — وإحنا بنشوف مين جه منك.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-[var(--surface-2)] p-2.5">
          <code dir="ltr" className="min-w-0 flex-1 truncate text-start text-xs text-[var(--fg-muted)]">
            {link}
          </code>
          <Button size="sm" variant="secondary" onClick={() => copy(link, 'الرابط اتنسخ')}>
            {copied ? (
              <Check className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Copy className="h-4 w-4" aria-hidden="true" />
            )}
            انسخ
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-11 items-center gap-2 rounded-lg bg-[var(--color-success)] px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            ابعت على واتساب
          </a>
          <Button variant="ghost" onClick={() => copy(message, 'الرسالة اتنسخت')}>
            انسخ الرسالة كاملة
          </Button>
        </div>

        <p className="text-xs text-[var(--fg-subtle)]">
          كودك: <code dir="ltr" className="font-mono font-semibold">{code}</code>
        </p>
      </Card>

      {/* ────────── الأرقام ────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat icon={UserPlus} label="سجّلوا برابطك" value={signups} />
        <Stat
          icon={Users}
          label="منهم اشتركوا"
          value={subscribed}
          tone={subscribed > 0 ? 'success' : undefined}
        />
        <Stat icon={Check} label="طلبات وصّلتها" value={deliveredOrders} />
      </div>

      {/*
        شرح صريح إن المكافأة مش تلقائية.

        وعد بمكافأة من غير ما نقول إزاي بتتصرف بيخلّي التاجر يستنّى
        حاجة ما تجيش، وبيخسّرنا ثقته. الجملة دي بتقول الحقيقة:
        العروض بتنزل من عندنا، وهو بيشوفها في لوحته لما تنزل.
      */}
      <p className="rounded-lg bg-[var(--surface-2)] px-3.5 py-3 text-xs leading-relaxed text-[var(--fg-muted)]">
        العروض والمكافآت بتنزل من إدارة المنصة وبتظهرلك في صفحتك الرئيسية أول ما تستحقّها.
        عدّادك فوق بيتحدّث لوحده مع كل واحد بيسجّل برابطك.
      </p>
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Users
  label: string
  value: number
  tone?: 'success'
}) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <span className="flex items-center gap-1.5 text-xs text-[var(--fg-muted)]">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </span>
      <span
        className={cn(
          'tabular text-2xl font-bold',
          tone === 'success' && 'text-[var(--color-success)]',
        )}
      >
        {value}
      </span>
    </Card>
  )
}
