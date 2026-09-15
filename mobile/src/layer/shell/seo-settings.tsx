/**
 * الظهور والسيو — شاشة أصلية (`/dashboard/settings/seo`).
 *
 * نفس `SeoForm` في اللوحة: توفّر المتجر (الصيانة ورسالتها، «قريبًا» ورسالتها — والاتنين ما بيشتغلوش مع بعض)،
 * ظهورك في جوجل (العنوان والوصف بعدّاد الحروف، الكلمات المفتاحية، معاينة نتيجة البحث، الفهرسة)، صورة المشاركة
 * (بالكاميرا أو المعرض على `/api/upload` مجلد `banners`) وعنوانها ووصفها، إخفاء المنتجات اللي خلصت، ووسوم التوثيق.
 */
import { useRef, useState } from 'preact/hooks'
import { haptic, hapticNotify } from '../bridge'
import { toast } from '../dom'
import { icons } from '../icons'
import { assetUrl } from './api'
import { postAppJson, useResource } from './http'
import { openExternal } from './navigate'
import { shrink, upload } from './product-new'
import { Screen } from './screen'
import { Group, LoadState, SaveBar, Toggle, useSyncedForm } from './settings-forms'
import { seoData } from './store-settings-api'
import { Icon } from './ui'

export function SeoSettingsScreen({ visible, onUnavailable }: { visible: boolean; onUnavailable: () => void }) {
  const { data, failed, load } = useResource(seoData, visible, onUnavailable)
  const { form: v, patch, saved } = useSyncedForm(data, (d) => ({ ...d.values }))
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const camera = useRef<HTMLInputElement>(null)
  const gallery = useRef<HTMLInputElement>(null)

  const save = async () => {
    if (!v || busy) return
    setBusy(true)
    setError(null)
    const res = await postAppJson('/api/app/seo/save', v)
    if (!res.ok) {
      setBusy(false)
      hapticNotify('ERROR')
      setError(res.error)
      toast(res.error, { tone: 'danger', duration: 4500 })
      return
    }
    saved()
    await load()
    setBusy(false)
    hapticNotify('SUCCESS')
    toast('اتحفظ — شغّال على متجرك دلوقتي', { tone: 'success', duration: 2400 })
  }

  const pick = async (input: HTMLInputElement) => {
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    setUploading(true)
    const url = await upload(await shrink(file), 'banners')
    setUploading(false)
    if (!url) {
      hapticNotify('ERROR')
      toast('ما قدرناش نرفع الصورة — جرّب تاني', { tone: 'danger' })
      return
    }
    haptic('LIGHT')
    patch({ ogImage: url })
  }

  const limits = data?.limits ?? { title: 60, description: 160 }
  const name = data?.storeName ?? ''
  const shownTitle = v ? v.seoTitle.trim() || name : ''
  const shownDescription = v ? v.seoDescription.trim() || `تسوّق من ${name}` : ''
  const cut = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}…` : text)

  return (
    <Screen visible={visible} title="الظهور والسيو" onRefresh={load} overlay={v ? <SaveBar busy={busy || uploading} onSave={() => void save()} /> : null}>
      <div class="home-body np-body">
        <header class="page-head rise">
          <div class="page-head-text">
            <h1 class="page-title">الظهور والسيو</h1>
            <p class="page-sub">شكل متجرك في جوجل وعلى واتساب، وقفله مؤقتًا وإنت بتجهّز.</p>
          </div>
          {data && (
            <button type="button" class="icon-btn press" aria-label="شوف متجرك" onClick={() => openExternal(data.storeUrl)}>
              <Icon svg={icons.externalLink()} />
            </button>
          )}
        </header>

        {!v || !data ? (
          <LoadState failed={failed} what="إعدادات السيو" />
        ) : (
          <>
            <Group title="توفّر المتجر">
              <Toggle
                label="وضع الصيانة"
                hint="المتجر بيقفل مؤقتًا وبيوري رسالتك. صفحات تتبّع الطلب والفواتير بتفضل شغّالة — العميل اللي دفع لازم يفضل شايف طلبه."
                on={v.maintenanceMode}
                onChange={(x) => patch({ maintenanceMode: x })}
              />
              {v.maintenanceMode && (
                <label class="np-label">
                  رسالة الصيانة
                  <textarea
                    class="np-input np-textarea"
                    rows={2}
                    maxLength={300}
                    placeholder="بنعمل صيانة سريعة. ارجع بعد شوية."
                    value={v.maintenanceMessage}
                    onInput={(e) => patch({ maintenanceMessage: (e.currentTarget as HTMLTextAreaElement).value })}
                  />
                </label>
              )}
              <Toggle
                label="وضع «قريبًا»"
                hint={
                  v.maintenanceMode
                    ? 'مقفول دلوقتي لأن الصيانة شغّالة — الوضعين مع بعض بيتضاربوا.'
                    : 'للمتجر اللي لسه ما فتحش. الصفحة بتاخد بريد الزائر، فبتفتح وعندك قايمة مستنيّة بدل ما تفتح على صفر.'
                }
                on={v.comingSoon && !v.maintenanceMode}
                onChange={(x) => {
                  if (!v.maintenanceMode) patch({ comingSoon: x })
                }}
              />
              {v.comingSoon && !v.maintenanceMode && (
                <label class="np-label">
                  رسالة «قريبًا»
                  <textarea
                    class="np-input np-textarea"
                    rows={2}
                    maxLength={300}
                    placeholder="قربنا نفتح. سيب بريدك وهنبعتلك أول ما نبدأ."
                    value={v.comingSoonMessage}
                    onInput={(e) => patch({ comingSoonMessage: (e.currentTarget as HTMLTextAreaElement).value })}
                  />
                </label>
              )}
            </Group>

            <Group title="ظهورك في جوجل">
              <label class="np-label">
                عنوان الصفحة
                <input class="np-input" maxLength={70} placeholder={name} value={v.seoTitle} onInput={(e) => patch({ seoTitle: (e.currentTarget as HTMLInputElement).value })} />
                <small class={`pv-hint${v.seoTitle.length > limits.title ? ' st-bad' : ''}`}>
                  <bdi dir="ltr">
                    {v.seoTitle.length}/{limits.title}
                  </bdi>{' '}
                  حرف — جوجل بيقصّ اللي بعد كده.
                </small>
              </label>
              <label class="np-label">
                وصف الصفحة
                <textarea
                  class="np-input np-textarea"
                  rows={3}
                  maxLength={180}
                  placeholder={`تسوّق من ${name}`}
                  value={v.seoDescription}
                  onInput={(e) => patch({ seoDescription: (e.currentTarget as HTMLTextAreaElement).value })}
                />
                <small class={`pv-hint${v.seoDescription.length > limits.description ? ' st-bad' : ''}`}>
                  <bdi dir="ltr">
                    {v.seoDescription.length}/{limits.description}
                  </bdi>{' '}
                  حرف. ده اللي بيقنع الناس تدوس — اكتب اللي بتبيعه بالظبط.
                </small>
              </label>
              <label class="np-label">
                كلمات مفتاحية
                <input class="np-input" maxLength={300} placeholder="موبايلات، اكسسوارات، شواحن" value={v.seoKeywords} onInput={(e) => patch({ seoKeywords: (e.currentTarget as HTMLInputElement).value })} />
                <small class="pv-hint">جوجل بقى بيتجاهلها من زمان، لكن بينج وبعض أدوات المقارنة لسه بيقروها. مش مطلوبة.</small>
              </label>

              <div class="st-serp">
                <small>شكل نتيجتك في البحث</small>
                <span class="st-serp-url">{data.storeUrl}</span>
                <span class="st-serp-title">{cut(shownTitle, limits.title)}</span>
                <span class="st-serp-desc">{cut(shownDescription, limits.description)}</span>
              </div>

              <Toggle
                label="اسمح لمحركات البحث تفهرس متجرك"
                hint="اقفلها وإنت بتجهّز. الصفحة الفاضية اللي اتفهرست بتفضل في نتايج جوجل شهور بعد ما تمتلي."
                on={v.allowIndexing}
                onChange={(x) => patch({ allowIndexing: x })}
              />
            </Group>

            <Group
              title="صورة المشاركة"
              lead="أول حاجة بتبان لما حد يبعت رابط متجرك على واتساب أو فيسبوك. من غيرها الرابط بيبان سطر نص باهت. المقاس الأنسب ١٢٠٠×٦٣٠."
            >
              <div class="st-og">{v.ogImage ? <img src={assetUrl(v.ogImage) ?? v.ogImage} alt="" /> : <span>{uploading ? 'بنرفع الصورة…' : 'مفيش صورة'}</span>}</div>
              <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void pick(e.currentTarget as HTMLInputElement)} />
              <input ref={gallery} type="file" accept="image/*" hidden onChange={(e) => void pick(e.currentTarget as HTMLInputElement)} />
              <div class="st-row">
                <button type="button" class="btn btn--ghost press" disabled={uploading} onClick={() => camera.current?.click()}>
                  {uploading ? <span class="spinner" /> : <Icon svg={icons.image()} />}
                  صوّر
                </button>
                <button type="button" class="btn btn--ghost press" disabled={uploading} onClick={() => gallery.current?.click()}>
                  من المعرض
                </button>
                {v.ogImage && (
                  <button type="button" class="btn btn--ghost btn--danger-text press" onClick={() => patch({ ogImage: '' })}>
                    شيلها
                  </button>
                )}
              </div>
              <label class="np-label">
                عنوان المشاركة
                <input class="np-input" maxLength={90} placeholder={v.seoTitle.trim() || name} value={v.ogTitle} onInput={(e) => patch({ ogTitle: (e.currentTarget as HTMLInputElement).value })} />
                <small class="pv-hint">سيبه فاضي وهياخد عنوان جوجل. املاه لما تحب تكتب سطرًا بشري أكتر لواتساب وفيسبوك.</small>
              </label>
              <label class="np-label">
                وصف المشاركة
                <textarea
                  class="np-input np-textarea"
                  rows={2}
                  maxLength={200}
                  placeholder={v.seoDescription.trim() || `تسوّق من ${name}`}
                  value={v.ogDescription}
                  onInput={(e) => patch({ ogDescription: (e.currentTarget as HTMLTextAreaElement).value })}
                />
                <small class="pv-hint">السطر اللي تحت العنوان في معاينة الرابط.</small>
              </label>
            </Group>

            <Group title="عرض المنتجات">
              <Toggle
                label="اخفي المنتجات اللي خلصت من القوايم"
                hint="رابط المنتج بيفضل شغّال — يعني إعلانك اللي ماشي عليه ما بيوديش لصفحة ٤٠٤. بس مش هيبان في الأقسام والبحث لحد ما ترجّع الكمية."
                on={v.hideOutOfStock}
                onChange={(x) => patch({ hideOutOfStock: x })}
              />
            </Group>

            <Group
              title="وسوم التوثيق"
              lead="جوجل سيرش كونسول وميتا وبنترست بيدّوك وسم meta عشان تثبت إن الموقع بتاعك — الصقه هنا زي ما جالك. السكربتات مرفوضة هنا عن قصد، والبكسلات ليها مكانها في صفحة الإضافات."
            >
              <label class="np-label">
                وسوم الرأس
                <textarea
                  class="np-input np-textarea st-mono"
                  dir="ltr"
                  rows={4}
                  maxLength={4000}
                  placeholder={'<meta name="google-site-verification" content="..." />'}
                  value={v.headHtml}
                  onInput={(e) => patch({ headHtml: (e.currentTarget as HTMLTextAreaElement).value })}
                />
                <small class="pv-hint">١٠ وسوم كحد أقصى.</small>
              </label>
            </Group>

            {error && <p class="np-error">{error}</p>}
          </>
        )}
      </div>
    </Screen>
  )
}
