'use client'

import { useState, useTransition } from 'react'
import { Check, ExternalLink, Loader2, Save } from 'lucide-react'
import { saveSeoAction } from './actions'
import { Group, TextField, Toggle } from '@/components/dashboard/controls'
import { Alert, Card } from '@/components/ui'
import { ImageUpload } from '@/components/ui/image-upload'
import { SEO_LIMITS } from '@/lib/seo-template'
import { cn } from '@/lib/utils'

export type SeoValues = {
  seoTitle: string
  seoDescription: string
  seoKeywords: string
  ogImage: string
  allowIndexing: boolean
  maintenanceMode: boolean
  maintenanceMessage: string
  comingSoon: boolean
  comingSoonMessage: string
}

/**
 * سيو المتجر وتوفّره.
 *
 * ## المعاينة هي الشرح
 * التاجر ما بيقراش كلامًا عن «meta description». لكن لما يشوف شكل
 * نتيجته في جوجل وهو بيكتب، بيفهم لوحده إن العنوان الطويل بيتقطع
 * وإن الوصف الفاضي بيخلّي نتيجته باهتة.
 */
export function SeoForm({
  initial,
  storeName,
  storeUrl,
}: {
  initial: SeoValues
  storeName: string
  storeUrl: string
}) {
  const [v, setV] = useState<SeoValues>(initial)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()

  const set = <K extends keyof SeoValues>(k: K, value: SeoValues[K]) =>
    setV((s) => ({ ...s, [k]: value }))

  const shownTitle = v.seoTitle.trim() || storeName
  const shownDescription = v.seoDescription.trim() || `تسوّق من ${storeName}`

  return (
    <div className="flex flex-col gap-6">
      {msg && <Alert tone={msg.ok ? 'success' : 'danger'}>{msg.text}</Alert>}

      {/* حالة المتجر أول حاجة: هي الوحيدة اللي بتقفل البيع */}
      <Card className="flex flex-col gap-6 p-5">
        <Group title="توفّر المتجر">
          <Toggle
            label="وضع الصيانة"
            hint="المتجر بيقفل مؤقتًا وبيوري رسالتك. صفحات تتبّع الطلب والفواتير بتفضل شغّالة — العميل اللي دفع لازم يفضل شايف طلبه."
            checked={v.maintenanceMode}
            onChange={(x) => set('maintenanceMode', x)}
          />

          {v.maintenanceMode && (
            <TextField
              label="رسالة الصيانة"
              value={v.maintenanceMessage}
              onChange={(x) => set('maintenanceMessage', x)}
              placeholder="بنعمل صيانة سريعة. ارجع بعد شوية."
              multiline
            />
          )}

          <Toggle
            label="وضع «قريبًا»"
            hint={
              v.maintenanceMode
                ? 'مقفول دلوقتي لأن الصيانة شغّالة — الوضعين مع بعض بيتضاربوا.'
                : 'للمتجر اللي لسه ما فتحش. الصفحة بتاخد بريد الزائر، فبتفتح وعندك قايمة مستنيّة بدل ما تفتح على صفر.'
            }
            checked={v.comingSoon && !v.maintenanceMode}
            onChange={(x) => !v.maintenanceMode && set('comingSoon', x)}
          />

          {v.comingSoon && !v.maintenanceMode && (
            <TextField
              label="رسالة «قريبًا»"
              value={v.comingSoonMessage}
              onChange={(x) => set('comingSoonMessage', x)}
              placeholder="قربنا نفتح. سيب بريدك وهنبعتلك أول ما نبدأ."
              multiline
            />
          )}
        </Group>
      </Card>

      <Card className="flex flex-col gap-6 p-5">
        <Group title="ظهورك في جوجل">
          <TextField
            label="عنوان الصفحة"
            value={v.seoTitle}
            onChange={(x) => set('seoTitle', x)}
            placeholder={storeName}
            hint={`${v.seoTitle.length}/${SEO_LIMITS.title} حرف — جوجل بيقصّ اللي بعد كده.`}
          />

          <TextField
            label="وصف الصفحة"
            value={v.seoDescription}
            onChange={(x) => set('seoDescription', x)}
            placeholder={`تسوّق من ${storeName}`}
            multiline
            hint={`${v.seoDescription.length}/${SEO_LIMITS.description} حرف. ده اللي بيقنع الناس تدوس — اكتب اللي بتبيعه بالظبط.`}
          />

          <TextField
            label="كلمات مفتاحية"
            value={v.seoKeywords}
            onChange={(x) => set('seoKeywords', x)}
            placeholder="موبايلات، اكسسوارات، شواحن"
            hint="جوجل بقى بيتجاهلها من زمان، لكن بينج وبعض أدوات المقارنة لسه بيقروها. مش مطلوبة."
          />

          {/* المعاينة — شكل نتيجتك زي ما هي في جوجل */}
          <div className="flex flex-col gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-4">
            <span className="text-xs text-[var(--fg-subtle)]">شكل نتيجتك في البحث</span>
            <span dir="ltr" className="truncate text-start text-xs text-[var(--color-success)]">
              {storeUrl}
            </span>
            <span
              className={cn(
                'text-base font-medium text-[#1a0dab]',
                v.seoTitle.length > SEO_LIMITS.title && 'opacity-60',
              )}
            >
              {shownTitle.slice(0, SEO_LIMITS.title)}
              {shownTitle.length > SEO_LIMITS.title && '…'}
            </span>
            <span className="text-sm leading-relaxed text-[var(--fg-muted)]">
              {shownDescription.slice(0, SEO_LIMITS.description)}
              {shownDescription.length > SEO_LIMITS.description && '…'}
            </span>
          </div>

          <Toggle
            label="اسمح لمحركات البحث تفهرس متجرك"
            hint="اقفلها وإنت بتجهّز. الصفحة الفاضية اللي اتفهرست بتفضل في نتايج جوجل شهور بعد ما تمتلي."
            checked={v.allowIndexing}
            onChange={(x) => set('allowIndexing', x)}
          />
        </Group>

        <Group title="صورة المشاركة">
          <p className="text-xs leading-relaxed text-[var(--fg-subtle)]">
            أول حاجة بتبان لما حد يبعت رابط متجرك على واتساب أو فيسبوك. من غيرها الرابط بيبان سطر
            نص باهت — وده الفرق بين إن حد يدوس عليه ولا يعدّيه. المقاس الأنسب ١٢٠٠×٦٣٠.
          </p>
          <ImageUpload
            value={v.ogImage ? [v.ogImage] : []}
            onChange={(urls) => set('ogImage', urls[0] ?? '')}
            folder="banners"
          />
        </Group>
      </Card>

      <div className="safe-bottom sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-3 border-t border-[var(--border)] bg-[var(--surface)]/95 px-4 py-3 backdrop-blur-md sm:mx-0 sm:rounded-xl sm:border sm:px-4">
        <button
          type="button"
          onClick={() => {
            setMsg(null)
            start(async () => {
              const res = await saveSeoAction(v)
              if (res?.error) setMsg({ ok: false, text: res.error })
              else setMsg({ ok: true, text: 'اتحفظ — شغّال على متجرك دلوقتي' })
            })
          }}
          disabled={pending}
          className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-6 text-sm font-semibold text-[var(--primary-fg)] transition-opacity hover:opacity-90 disabled:opacity-60 sm:flex-none"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : msg?.ok ? (
            <Check className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Save className="h-4 w-4" aria-hidden="true" />
          )}
          احفظ التعديلات
        </button>

        <a
          href={storeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border-strong)] px-4 text-sm font-medium text-[var(--fg-muted)]"
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          شوف متجرك
        </a>
      </div>
    </div>
  )
}
