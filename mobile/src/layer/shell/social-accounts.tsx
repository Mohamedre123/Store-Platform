/**
 * حسابات السوشيال — شاشة أصلية (`/dashboard/studio/accounts`).
 *
 * نفس `AccountsPanel` في اللوحة: الحسابات المربوطة بحالتها («شغّال» / «الربط انتهى»، «مسوّدات بس»)
 * وسبب آخر خطأ، والفصل بتأكيد. والربط: «افتح صفحة الربط» (صفحة خدمة النشر — بتفتح برّه التطبيق)
 * و«حدّث الحسابات» بعد الرجوع، وشروط الربط. ولو خدمة النشر مش مضبوطة: الطريق البديل («انشره من موبايلك»).
 */
import { useState } from 'preact/hooks'
import { haptic, hapticNotify } from '../bridge'
import { toast } from '../dom'
import { icons } from '../icons'
import { formatNumber } from './format'
import { postAppJson, useResource } from './http'
import { navigate } from './navigate'
import { Screen, Sheet } from './screen'
import { socialAccountsData, type LinkedAccount } from './studio-api'
import { Icon } from './ui'

const LINK_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>'

export function SocialAccountsScreen({ visible, onUnavailable }: { visible: boolean; onUnavailable: () => void }) {
  const { data, failed, load } = useResource(socialAccountsData, visible, onUnavailable)
  const [busy, setBusy] = useState<string | null>(null)
  const [removing, setRemoving] = useState<LinkedAccount | null>(null)

  const sync = async () => {
    if (busy) return
    haptic('LIGHT')
    setBusy('sync')
    const res = await postAppJson<{ count?: number }>('/api/app/social-accounts/sync', {})
    await load()
    setBusy(null)
    if (!res.ok) {
      hapticNotify('ERROR')
      toast(res.error, { tone: 'danger', duration: 5000 })
      return
    }
    hapticNotify('SUCCESS')
    toast(`اتربط ${formatNumber(res.data.count ?? 0)} حساب — تقدر تنشر عليهم دلوقتي`, { tone: 'success', duration: 3000 })
  }

  const disconnect = async (a: LinkedAccount) => {
    if (busy) return
    haptic('LIGHT')
    setBusy('disconnect')
    const res = await postAppJson(`/api/app/social-accounts/${encodeURIComponent(a.id)}/disconnect`, {})
    if (!res.ok) {
      setBusy(null)
      hapticNotify('ERROR')
      toast(res.error, { tone: 'danger' })
      return
    }
    await load()
    setBusy(null)
    setRemoving(null)
    hapticNotify('SUCCESS')
    toast('اتفصل', { tone: 'success', duration: 2000 })
  }

  const accounts = data?.accounts ?? []

  return (
    <Screen visible={visible} title="حسابات السوشيال" onRefresh={load}>
      <div class="home-body">
        <header class="page-head rise">
          <div class="page-head-text">
            <h1 class="page-title">حسابات السوشيال</h1>
            <p class="page-sub">اربط صفحاتك مرة، وبعدها البوستات بتنزل عليها لوحدها.</p>
          </div>
        </header>

        {!data ? (
          failed ? (
            <div class="empty">
              <span class="empty-icon">
                <Icon svg={icons.wifiOff()} />
              </span>
              <b>مش قادرين نجيب الحسابات</b>
              <p>اتأكد من النت واسحب لتحت عشان تحاول تاني.</p>
            </div>
          ) : (
            <div class="olist">
              <span class="sk" style="height:160px;border-radius:20px" />
            </div>
          )
        ) : (
          <>
            {!data.studioEnabled && (
              <div class="np-note pst-gap">
                «استوديو المحتوى» مقفول من الإضافات — فعّله عشان تقدر تنشر وتفصل حسابات.
                <button type="button" class="act press pst-note-btn" onClick={() => navigate('/dashboard/plugins')}>
                  افتح الإضافات
                </button>
              </div>
            )}

            {accounts.length > 0 && (
              <div class="card ops-list rise">
                {accounts.map((a) => (
                  <div key={a.id} class="bl-row sa-row">
                    <span class="sa-avatar" style={{ background: `${a.color}22` }}>
                      {a.avatar ? <img src={a.avatar} alt="" loading="lazy" /> : <i style={{ background: a.color }} aria-hidden="true" />}
                    </span>
                    <span class="bl-main">
                      <b>{a.name}</b>
                      <small>
                        {a.platformLabel}
                        {!a.canPublish && ' · مسوّدات بس'}
                      </small>
                      {a.lastError && <small class="pst-err">{a.lastError}</small>}
                    </span>
                    <span class={`pst-pill ${a.status === 'active' ? 'pst-pill--good' : 'pst-pill--bad'}`}>{a.status === 'active' ? 'شغّال' : 'الربط انتهى'}</span>
                    <button type="button" class="ops-icon press pst-del" aria-label={`افصل ${a.name}`} onClick={() => (haptic('LIGHT'), setRemoving(a))}>
                      <Icon svg={icons.trash()} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div class="card pv-card rise sa-connect">
              <h2 class="sec-title">اربط حساب</h2>
              <p class="page-sub">الربط مجاني تمامًا — مفيش أي رسوم على النشر.</p>

              {data.viaProvider ? (
                <>
                  <ol class="sa-steps">
                    <li>دوس «افتح صفحة الربط» — هتفتح برّه التطبيق.</li>
                    <li>اربط فيسبوك وإنستجرام (وأي منصة تانية عايزها) من الصفحة دي.</li>
                    <li>ارجع هنا ودوس «حدّث الحسابات».</li>
                  </ol>
                  <div class="pst-actions">
                    <button
                      type="button"
                      class="btn btn--primary press pst-wide"
                      onClick={() => {
                        haptic('LIGHT')
                        location.assign('/api/social/start?platform=facebook')
                      }}
                    >
                      <Icon svg={LINK_ICON} />
                      افتح صفحة الربط
                    </button>
                    <button type="button" class="act press pst-wide" disabled={Boolean(busy)} onClick={() => void sync()}>
                      {busy === 'sync' ? <span class="spinner" /> : <Icon svg={icons.refresh()} />}
                      حدّث الحسابات
                    </button>
                  </div>
                </>
              ) : (
                <div class="np-note">
                  الربط التلقائي لسه بيتجهّز على المنصة — <b>بس الأداة شغّالة بالكامل من غيره</b>. اعمل البوست من الاستوديو، وافتح «البوستات»،
                  ودوس «انشره من موبايلك» — هتفتحلك شاشة المشاركة بالصورة والكلام مع بعض وتختار إنستجرام أو فيسبوك أو تيك توك.
                  <button type="button" class="act press pst-note-btn" onClick={() => navigate('/dashboard/studio/posts')}>
                    افتح البوستات
                  </button>
                </div>
              )}

              <div class="np-note">
                <b>قبل ما تربط:</b>
                <ul class="sa-steps sa-steps--dots">
                  <li>لازم تكون أدمن على صفحة فيسبوك — الحساب الشخصي ما ينفعش ينشر منه.</li>
                  <li>لإنستجرام: حسابك لازم يكون «أعمال» أو «صانع محتوى» ومربوط بالصفحة.</li>
                  <li>الصور اللي بتتنشر لازم تكون من متجرك — الاستوديو بيرفعها لوحده.</li>
                </ul>
              </div>
            </div>
          </>
        )}
      </div>

      <Sheet open={Boolean(removing)} title="تفصل الحساب؟" onClose={() => setRemoving(null)}>
        {removing && (
          <div class="np-form ops-form">
            <p class="sheet-text">هتفصل «{removing.name}». البوستات المجدولة عليه هتقف لحد ما تربطه تاني.</p>
            <div class="btn-row">
              <button type="button" class="btn btn--ghost press" onClick={() => setRemoving(null)}>
                رجوع
              </button>
              <button type="button" class="btn btn--danger press" disabled={Boolean(busy)} onClick={() => void disconnect(removing)}>
                {busy === 'disconnect' ? <span class="spinner" /> : <Icon svg={icons.trash()} />}
                أيوه، افصله
              </button>
            </div>
          </div>
        )}
      </Sheet>
    </Screen>
  )
}
