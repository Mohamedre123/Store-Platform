'use client'

import { useState } from 'react'
import { Check, Copy, Share2, Users } from 'lucide-react'

/**
 * بطاقة «هات صاحبك».
 *
 * الرابط جاهز للنسخ مش الكود بس: أغلب المشاركة بتحصل على واتساب،
 * والصاحب بيدوس رابطًا مش بيكتب كودًا. الكود ظاهر برضو للحالة اللي
 * العميل بيمليه فيها بصوته.
 */
export function ReferralCard({
  code,
  link,
  pointsPerReferral,
  stats,
}: {
  code: string
  link: string
  pointsPerReferral: number
  stats: { total: number; rewarded: number; points: number }
}) {
  const [copied, setCopied] = useState<'code' | 'link' | null>(null)

  const copy = (value: string, which: 'code' | 'link') => {
    navigator.clipboard?.writeText(value)
    setCopied(which)
    setTimeout(() => setCopied(null), 2000)
  }

  const share = async () => {
    // مشاركة النظام على الموبايل — بتفتح واتساب مباشرة
    if (navigator.share) {
      try {
        await navigator.share({ text: `اطلب من هنا وهتاخد نقاط: ${link}` })
        return
      } catch {
        // العميل قفل نافذة المشاركة — مش خطأ
      }
    }
    copy(link, 'link')
  }

  return (
    <section className="mb-10 rounded-[var(--sf-radius)] border border-[var(--sf-text)]/12 p-4">
      <h2 className="mb-1 flex items-center gap-2 font-bold">
        <Users className="h-4 w-4 text-[var(--sf-primary)]" aria-hidden="true" />
        هات صاحبك
      </h2>
      <p className="mb-4 text-sm opacity-65">
        صاحبك يطلب لأول مرة من رابطك، وتاخدوا{' '}
        <span className="tabular font-bold text-[var(--sf-primary)]">{pointsPerReferral}</span> نقطة
        الاتنين.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <code className="tabular rounded-lg bg-[var(--sf-text)]/6 px-3 py-2 font-bold tracking-widest">
          {code}
        </code>
        <button
          type="button"
          onClick={() => copy(code, 'code')}
          className="flex min-h-10 items-center gap-1.5 rounded-lg border border-[var(--sf-text)]/20 px-3 text-sm"
        >
          {copied === 'code' ? (
            <Check className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Copy className="h-4 w-4" aria-hidden="true" />
          )}
          {copied === 'code' ? 'اتنسخ' : 'انسخ الكود'}
        </button>
        <button
          type="button"
          onClick={share}
          className="flex min-h-10 items-center gap-1.5 rounded-lg bg-[var(--sf-primary)] px-4 text-sm font-semibold text-white"
        >
          {copied === 'link' ? (
            <Check className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Share2 className="h-4 w-4" aria-hidden="true" />
          )}
          {copied === 'link' ? 'الرابط اتنسخ' : 'شارك الرابط'}
        </button>
      </div>

      {stats.total > 0 && (
        <p className="mt-3 text-sm opacity-70">
          حوّلت <span className="tabular font-bold">{stats.total}</span>
          {stats.rewarded < stats.total && (
            <>
              {' '}
              (<span className="tabular">{stats.rewarded}</span> اتصرفت،{' '}
              <span className="tabular">{stats.total - stats.rewarded}</span> مستنية التسليم)
            </>
          )}
          {stats.points > 0 && (
            <>
              {' '}
              · كسبت <span className="tabular font-bold text-[var(--sf-primary)]">{stats.points}</span>{' '}
              نقطة
            </>
          )}
        </p>
      )}
    </section>
  )
}
