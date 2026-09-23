/**
 * حملات البريد — شاشة أصلية (`/dashboard/marketing/campaigns`).
 *
 * نفس `CampaignsManager` في اللوحة: عدد المشتركين (أو «عندك X عميل من غير بريد» بزرار للشيك أوت)، «حملة جديدة»،
 * كارت لكل حملة بالحالة والعنوان والجمهور والتاريخ؛ المسوّدة: عدّل / ابعت (بتأكيد) / احذف (بتأكيد)؛ اللي بدأت:
 * «اتبعت X من Y» بشريط تقدّم. لوحة الفورم: الاسم، العنوان، النص، نص الزر ورابطه، الجمهور بحجم كل واحد، «هتوصل لـX».
 */
import { useState } from 'preact/hooks'
import { haptic, hapticNotify } from '../bridge'
import { toast } from '../dom'
import { icons } from '../icons'
import { formatNumber } from './format'
import { campaignsData, type Campaign, type CampaignAudience, type CampaignStatus } from './growth-api'
import { postAppJson, useResource } from './http'
import { navigate } from './navigate'
import { Screen, Sheet } from './screen'
import { LoadState } from './settings-forms'
import { Icon } from './ui'

const STATUS: Record<CampaignStatus, { label: string; tone: string }> = {
  draft: { label: 'مسوّدة', tone: 'pst-pill--muted' },
  sending: { label: 'بتتبعت دلوقتي', tone: 'pst-pill--info' },
  sent: { label: 'اتبعتت', tone: 'pst-pill--good' },
  failed: { label: 'فشلت', tone: 'pst-pill--bad' },
}

type Form = { id?: string; name: string; subject: string; body: string; ctaLabel: string; ctaUrl: string; audience: CampaignAudience }

const empty = (): Form => ({ name: '', subject: '', body: '', ctaLabel: '', ctaUrl: '', audience: 'all' })
const fromRow = (r: Campaign): Form => ({ id: r.id, name: r.name, subject: r.subject, body: r.body, ctaLabel: r.ctaLabel ?? '', ctaUrl: r.ctaUrl ?? '', audience: r.audience })

export function CampaignsScreen({ visible, onUnavailable }: { visible: boolean; onUnavailable: () => void }) {
  const { data, failed, load } = useResource(campaignsData, visible, onUnavailable)
  const [form, setForm] = useState<Form | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<{ id: string; kind: 'start' | 'delete' } | null>(null)

  const act = async (id: string, kind: 'start' | 'delete') => {
    if (busy) return
    haptic('LIGHT')
    setBusy(`${kind}-${id}`)
    const res = await postAppJson(`/api/app/campaigns/${encodeURIComponent(id)}/${kind}`, {})
    if (!res.ok) {
      setBusy(null)
      hapticNotify('ERROR')
      toast(res.error, { tone: 'danger', duration: 4500 })
      return
    }
    await load()
    setBusy(null)
    setConfirm(null)
    hapticNotify('SUCCESS')
    toast(kind === 'start' ? 'بدأ الإرسال — هيكمّل حتى لو قفلت التطبيق' : 'اتحذفت', { tone: 'success', duration: 2600 })
  }

  const save = async () => {
    if (!form || busy) return
    setBusy('save')
    setError(null)
    const res = await postAppJson('/api/app/campaigns/save', { ...form, ctaLabel: form.ctaLabel || null, ctaUrl: form.ctaUrl || null })
    if (!res.ok) {
      setBusy(null)
      hapticNotify('ERROR')
      setError(res.error)
      return
    }
    await load()
    setBusy(null)
    setForm(null)
    hapticNotify('SUCCESS')
    toast('اتحفظت كمسوّدة', { tone: 'success', duration: 2200 })
  }

  const size = form && data ? data.audiences.find((a) => a.key === form.audience)?.size ?? 0 : 0

  return (
    <Screen visible={visible} title="حملات البريد" onRefresh={load}>
      <div class="home-body">
        <header class="page-head rise">
          <div class="page-head-text">
            <h1 class="page-title">حملات البريد</h1>
            <p class="page-sub">العملاء اللي سجّلوا بريدهم عندك أرخص قناة بيع — مش محتاجة إعلان ولا وسيط.</p>
          </div>
        </header>

        {!data ? (
          <LoadState failed={failed} what="الحملات" />
        ) : (
          <>
            <section class="card cm-subs rise">
              <span class="cm-subs-icon">
                <Icon svg={icons.mail()} />
              </span>
              <span>
                <b>{formatNumber(data.subscribers)} مشترك موافق يستقبل رسايلك</b>
                {data.subscribers === 0 && data.withoutEmail > 0 ? (
                  <small>
                    عندك {formatNumber(data.withoutEmail)} عميل من غير بريد — افتح خانة البريد في إعدادات الشيك أوت عشان تقدر توصلهم.{' '}
                    <button type="button" class="st-link" onClick={() => navigate('/dashboard/settings/checkout')}>
                      افتح الشيك أوت
                    </button>
                  </small>
                ) : (
                  <small>اللي ألغى اشتراكه مش محسوب — وما بيستقبلش أي حملة مهما كان الجمهور المختار.</small>
                )}
              </span>
            </section>

            <button
              type="button"
              class="btn btn--primary btn--lg press rise ops-add"
              onClick={() => {
                haptic('LIGHT')
                setError(null)
                setForm(empty())
              }}
            >
              <Icon svg={icons.plus()} />
              حملة جديدة
            </button>

            {data.rows.length === 0 ? (
              <div class="empty empty--compact rise">
                <span class="empty-icon">
                  <Icon svg={icons.mail()} />
                </span>
                <b>مافيش حملات لسه</b>
                <p>العملاء اللي سجّلوا بريدهم في متجرك أرخص قناة عندك. اكتب حملة وابعتلهم.</p>
              </div>
            ) : (
              <div class="card ops-list rise cm-list">
                {data.rows.map((r) => {
                  const meta = STATUS[r.status]
                  const audience = data.audiences.find((a) => a.key === r.audience)?.label ?? r.audience
                  const progress = r.audienceCount > 0 ? Math.min(100, Math.round(((r.sentCount + r.failedCount) / r.audienceCount) * 100)) : 0
                  return (
                    <div key={r.id} class="cm-row">
                      <div class="cm-row-top">
                        <b>{r.name}</b>
                        <span class={`pst-pill ${meta.tone}`}>{meta.label}</span>
                      </div>
                      <small>
                        {r.subject} · {audience} · {new Date(r.createdAt).toLocaleDateString('ar-EG')}
                      </small>

                      {r.status === 'draft' ? (
                        confirm?.id === r.id ? (
                          <div class="ex-confirm">
                            <p class="sheet-text">
                              {confirm.kind === 'start'
                                ? `هتتبعت لـ${formatNumber(data.audiences.find((a) => a.key === r.audience)?.size ?? 0)} عميل، وما ينفعش تتعدّل بعد ما تبدأ.`
                                : `«${r.name}» هتتمسح.`}
                            </p>
                            <div class="btn-row">
                              <button type="button" class="btn btn--ghost press" onClick={() => setConfirm(null)}>
                                رجوع
                              </button>
                              <button
                                type="button"
                                class={`btn ${confirm.kind === 'start' ? 'btn--primary' : 'btn--danger'} press`}
                                disabled={Boolean(busy)}
                                onClick={() => void act(r.id, confirm.kind)}
                              >
                                {busy === `${confirm.kind}-${r.id}` ? <span class="spinner" /> : null}
                                {confirm.kind === 'start' ? 'ابعت دلوقتي' : 'أيوه، احذفها'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div class="cm-actions">
                            <button type="button" class="act press" onClick={() => (haptic('LIGHT'), setError(null), setForm(fromRow(r)))}>
                              <Icon svg={icons.pencil()} />
                              عدّل
                            </button>
                            <button type="button" class="act act--primary press" onClick={() => (haptic('LIGHT'), setConfirm({ id: r.id, kind: 'start' }))}>
                              <Icon svg={icons.send()} />
                              ابعت
                            </button>
                            <button type="button" class="ops-icon press" aria-label={`احذف ${r.name}`} onClick={() => (haptic('LIGHT'), setConfirm({ id: r.id, kind: 'delete' }))}>
                              <Icon svg={icons.trash()} />
                            </button>
                          </div>
                        )
                      ) : (
                        <div class="cm-progress">
                          <small>
                            اتبعت {formatNumber(r.sentCount)} من {formatNumber(r.audienceCount)}
                            {r.failedCount > 0 ? ` · ${formatNumber(r.failedCount)} ما وصلوش` : ''}
                          </small>
                          <div class="an-track">
                            <i style={{ width: `${Math.max(2, progress)}%` }} />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      <Sheet open={Boolean(form)} tall title={form?.id ? 'تعديل الحملة' : 'حملة جديدة'} onClose={() => setForm(null)}>
        {form && data && (
          <div class="np-form ops-form">
            <label class="np-label">
              اسم الحملة
              <input class="np-input" maxLength={80} placeholder="عروض رمضان" value={form.name} onInput={(e) => setForm({ ...form, name: (e.currentTarget as HTMLInputElement).value })} />
              <small class="pv-hint">للتنظيم عندك بس — العميل ما بيشوفهوش.</small>
            </label>
            <label class="np-label">
              عنوان الرسالة
              <input
                class="np-input"
                maxLength={150}
                placeholder="خصم ٢٠٪ على كل التيشيرتات لحد الجمعة"
                value={form.subject}
                onInput={(e) => setForm({ ...form, subject: (e.currentTarget as HTMLInputElement).value })}
              />
              <small class="pv-hint">ده اللي العميل بيقراه في صندوقه قبل ما يفتح — وهو اللي بيقرّر يفتح ولا لأ.</small>
            </label>
            <label class="np-label">
              نص الرسالة
              <textarea class="np-input np-textarea st-text" rows={7} maxLength={5000} value={form.body} onInput={(e) => setForm({ ...form, body: (e.currentTarget as HTMLTextAreaElement).value })} />
              <small class="pv-hint">اكتب عادي — كل سطرين بيبقوا فقرة.</small>
            </label>
            <label class="np-label">
              نص الزر
              <input class="np-input" maxLength={40} placeholder="اتسوّق دلوقتي" value={form.ctaLabel} onInput={(e) => setForm({ ...form, ctaLabel: (e.currentTarget as HTMLInputElement).value })} />
              <small class="pv-hint">سيبه فاضي لو مش عايز زرار.</small>
            </label>
            <label class="np-label">
              رابط الزر
              <input
                class="np-input"
                dir="ltr"
                inputMode="url"
                maxLength={500}
                placeholder="https://…"
                value={form.ctaUrl}
                onInput={(e) => setForm({ ...form, ctaUrl: (e.currentTarget as HTMLInputElement).value })}
              />
            </label>

            <div class="np-label">
              الجمهور
              <div class="sc-options">
                {data.audiences.map((a) => (
                  <button
                    key={a.key}
                    type="button"
                    class={`sc-option${form.audience === a.key ? ' sc-option--on' : ''}`}
                    aria-pressed={form.audience === a.key}
                    onClick={() => (haptic('LIGHT'), setForm({ ...form, audience: a.key }))}
                  >
                    <b>
                      {a.label} <span class="cm-size">· {formatNumber(a.size)}</span>
                    </b>
                    <small>{a.hint}</small>
                  </button>
                ))}
              </div>
            </div>

            <p class="st-preview">{size === 0 ? 'مفيش حد في الجمهور ده دلوقتي.' : <>هتوصل لـ<b>{formatNumber(size)}</b> عميل.</>}</p>

            {error && <p class="np-error">{error}</p>}
            <div class="btn-row pv-sticky">
              <button type="button" class="btn btn--ghost press" onClick={() => setForm(null)}>
                إلغاء
              </button>
              <button type="button" class="btn btn--primary press" disabled={Boolean(busy)} onClick={() => void save()}>
                {busy === 'save' ? <span class="spinner" /> : <Icon svg={icons.check()} />}
                احفظ كمسوّدة
              </button>
            </div>
          </div>
        )}
      </Sheet>
    </Screen>
  )
}
