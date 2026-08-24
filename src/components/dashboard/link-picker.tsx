'use client'

import { useEffect, useState } from 'react'
import { Link2, Loader2 } from 'lucide-react'
import { Row } from './controls'
import { listLinkTargets, type LinkTarget } from '@/app/dashboard/storefront/picker-actions'

/**
 * منتقي وجهة الزر.
 *
 * التاجر كان بيكتب المسار بإيده — `/category/رجالي` — وأي حرف غلط
 * بيوصّل العميل لصفحة مش موجودة، وما بيكتشفش غير لما حد يشتكي.
 * وأصلًا مين المفروض يعرف إن مسار القسم بيبدأ بـ`category/`؟
 *
 * دلوقتي بيختار قسمه أو صفحته بالاسم، وإحنا بنبني المسار.
 * و«رابط مخصّص» فاضل لأي حاجة برّه المتجر — واتساب، إعلان، أي رابط.
 */

/*
  القايمة بتتجاب مرة واحدة للصفحة كلها.

  المحرّر فيه عشر خانات رابط (بانر، شرائح، عدّاد، زر «المزيد»...).
  لو كل خانة نادت الخادم لوحدها، فتح لوحة واحدة كان هيولّد عشر
  طلبات لنفس القايمة بالظبط.
*/
let cached: Promise<LinkTarget[]> | null = null

/**
 * وجهات أساسية لو النداء فشل.
 *
 * من غيرها الخانة بتفضل على «بنحمّل…» للأبد، والتاجر ما يقدرش يحطّ
 * ولا رابط. الأقسام والصفحات بتضيع في الحالة دي، بس الأساسيات
 * بتكفّي أغلب الأزرار — والتاجر يقدر يكتب رابطه بنفسه.
 */
const FALLBACK: LinkTarget[] = [
  { value: '/', label: 'الصفحة الرئيسية', group: 'المتجر' },
  { value: '/products', label: 'كل المنتجات', group: 'المتجر' },
  { value: '/cart', label: 'السلة', group: 'المتجر' },
]

function loadTargets(): Promise<LinkTarget[]> {
  /* الفشل ما بيتخزّنش: المحاولة الجاية بتبدأ من جديد */
  cached ??= listLinkTargets().catch(() => {
    cached = null
    return FALLBACK
  })
  return cached
}

const CUSTOM = '__custom__'

export function LinkPicker({
  label = 'وجهة الزر',
  hint,
  value,
  onChange,
}: {
  label?: string
  hint?: string
  value: string
  onChange: (v: string) => void
}) {
  const [targets, setTargets] = useState<LinkTarget[] | null>(null)

  useEffect(() => {
    let alive = true
    loadTargets().then((t) => {
      if (alive) setTargets(t)
    })
    return () => {
      alive = false
    }
  }, [])

  const known = targets?.some((t) => t.value === value) ?? false
  /*
    الخانة الفاضية بتبدأ على القايمة لا على «مخصّص»: أغلب الأزرار
    بتوديّ لمكان في المتجر، والتاجر اللي بيبدأ من خانة نص فاضية
    بيفتكر إنه لازم يكتب رابط.
  */
  const [custom, setCustom] = useState(() => Boolean(value) && !value.startsWith('/'))

  const showCustom = custom || (Boolean(value) && !known && !value.startsWith('/'))

  const groups = targets
    ? [...new Set(targets.map((t) => t.group))].map((g) => ({
        name: g,
        items: targets.filter((t) => t.group === g),
      }))
    : []

  const field =
    'h-10 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm transition-colors focus:border-[var(--primary)] focus:outline-none'

  return (
    <Row label={label} hint={hint}>
      {targets === null ? (
        <span className="flex h-10 items-center gap-2 text-xs text-[var(--fg-subtle)]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          بنحمّل أقسامك وصفحاتك…
        </span>
      ) : (
        <div className="flex flex-col gap-2">
          <select
            value={showCustom ? CUSTOM : known ? value : ''}
            onChange={(e) => {
              const v = e.target.value
              if (v === CUSTOM) {
                setCustom(true)
                onChange('')
                return
              }
              setCustom(false)
              onChange(v)
            }}
            aria-label={label}
            className={field}
          >
            <option value="">من غير رابط</option>
            {groups.map((g) => (
              <optgroup key={g.name} label={g.name}>
                {g.items.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </optgroup>
            ))}
            <option value={CUSTOM}>رابط مخصّص…</option>
          </select>

          {showCustom && (
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 shrink-0 text-[var(--fg-subtle)]" aria-hidden="true" />
              <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                dir="ltr"
                placeholder="https://…"
                aria-label="رابط مخصّص"
                className={`${field} text-start`}
              />
            </div>
          )}

          {/* الوجهة المحفوظة اللي مش في القايمة — قسم اتشال أو اتغيّر اسمه */}
          {!showCustom && Boolean(value) && !known && (
            <p className="text-xs text-[var(--color-warning)]">
              الوجهة المحفوظة{' '}
              <bdi dir="ltr" className="font-mono">
                {value}
              </bdi>{' '}
              مش موجودة في متجرك دلوقتي — اختار وجهة تانية.
            </p>
          )}
        </div>
      )}
    </Row>
  )
}
