'use client'

import { useEffect, useState } from 'react'
import { Loader2, Share2 } from 'lucide-react'
import { toast } from './toast'

/**
 * نشر البوست من موبايل التاجر مباشرةً.
 *
 * ## المشكلة اللي بيحلّها
 * النشر التلقائي على فيسبوك وتيك توك محتاج تطبيق مطوّر متوافَق
 * عليه، والمراجعة محتاجة توثيق نشاط تجاري بورق. لحد ما ده يخلص،
 * البديل كان: نزّل الصورة، افتح إنستجرام، دوّر على الصورة في
 * المعرض، انسخ الكلام من التبويب التاني، الزقه. ستة خطوات، والتاجر
 * بيبطّل يعملها بعد يومين.
 *
 * ## والحل مبني في المتصفح أصلًا
 * `navigator.share` بيفتح شاشة المشاركة بتاعة الموبايل **بالصورة
 * والكلام مع بعض**. التاجر بيدوس إنستجرام من القايمة وخلاص —
 * والصورة والنص بيوصلوا معاه. ضغطتين بدل ستة، ومن غير أي مراجعة
 * ولا ورق.
 *
 * ## وبيختفي على الكمبيوتر
 * الواجهة دي موبايل بالأساس (وسفاري وكروم الأندرويد بيدعموها).
 * إظهار زرار بيقول «مش مدعوم» على الديسكتوب زحمة — والتنزيل
 * والنسخ موجودين جنبه أصلًا.
 */
export function SharePost({
  url,
  text,
  kind,
}: {
  /** رابط الصورة أو الفيديو */
  url: string
  /** الكلام والهاشتاجات مع بعض */
  text: string
  kind: 'image' | 'video'
}) {
  /*
    الفحص بعد التركيب لا قبله.

    `navigator` مش موجود وقت التصيير على الخادم، وقراءته هناك
    بتوقّع الصفحة كلها.
  */
  const [can, setCan] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setCan(typeof navigator !== 'undefined' && typeof navigator.share === 'function')
  }, [])

  if (!can) return null

  async function share() {
    setBusy(true)
    try {
      const res = await fetch(url)
      const blob = await res.blob()

      const name = kind === 'video' ? 'post.mp4' : 'post.png'
      const file = new File([blob], name, { type: blob.type || (kind === 'video' ? 'video/mp4' : 'image/png') })

      /*
        الملف الأول، والنص لوحده احتياطي.

        بعض المتصفحات بتدعم المشاركة من غير ملفات. `canShare`
        بتقول قبل ما نحاول — والمحاولة الفاشلة بترمي استثناء
        بيبان للتاجر كأن الزرار بايظ.
      */
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text })
      } else {
        await navigator.share({ text })
        toast('موبايلك ما بيدعمش مشاركة الملف — الكلام اتشارك، نزّل الصورة وضيفها')
      }
    } catch (e) {
      /*
        الإلغاء مش خطأ.

        التاجر اللي بيقفل شاشة المشاركة بيرمي `AbortError` —
        وعرض رسالة خطأ عليها بتخلّيه يفتكر إن حاجة اتكسرت.
      */
      if (e instanceof Error && e.name !== 'AbortError') {
        toast('مقدرناش نفتح المشاركة. نزّل الملف وانشره بإيدك.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={share}
      className="flex h-10 items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-fg)] transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <Share2 className="h-4 w-4" aria-hidden="true" />
      )}
      انشره من موبايلك
    </button>
  )
}
