/**
 * الولاء والنقاط — شاشة أصلية.
 *
 * - **النقاط:** تشغيل/إيقاف بمفتاح، والقواعد (نقاط لكل جنيه، قيمة النقطة، أقل
 *   استبدال، نقاط الترحيب والمراجعة والإحالة) في لوحة بمثال حي. المستويات
 *   بتظهر للقراءة — تعديلها من صفحة المنصة.
 * - **متجر المكافآت:** إضافة وتعديل وحذف.
 * - **عجلة الحظ:** تشغيل/إيقاف بمفتاح (الجوايز بتفضل زي ما هي)، وتعديل الجوايز
 *   من صفحة المنصة.
 * - **آخر الحركات.**
 */
import { useState } from 'preact/hooks'
import { haptic, hapticNotify } from '../bridge'
import { toast } from '../dom'
import { icons } from '../icons'
import { formatMoney, formatNumber } from './format'
import { postAppJson, useResource } from './http'
import { navigate } from './navigate'
import { loyaltyData, toLatin, type LoyaltySettings, type Reward } from './ops-api'
import { Screen, Sheet } from './screen'
import { Icon } from './ui'

type SettingsForm = { [K in keyof LoyaltySettings]: string }

type RewardForm = {
  id: string | null
  name: string
  description: string
  type: string
  value: string
  pointsCost: string
  minTier: string
  limited: boolean
  stock: string
  isActive: boolean
}

export function LoyaltyScreen({ visible, onUnavailable }: { visible: boolean; onUnavailable: () => void }) {
  const { data, failed, load } = useResource(loyaltyData, visible, onUnavailable)
  const [busy, setBusy] = useState<string | null>(null)
  const [settingsForm, setSettingsForm] = useState<SettingsForm | null>(null)
  const [rewardForm, setRewardForm] = useState<RewardForm | null>(null)
  const [deleteReward, setDeleteReward] = useState<Reward | null>(null)
  const [error, setError] = useState<string | null>(null)

  const currency = data?.currency ?? 'EGP'
  const unitLabel = currency === 'EGP' ? 'ج.م' : currency

  /* بيرجّع true لو نجح — واللوحة المفتوحة بتتقفل من برّه */
  const post = async (key: string, url: string, body: object, done: string, inline = false) => {
    if (busy) return false
    haptic('LIGHT')
    setBusy(key)
    const res = await postAppJson(url, body)
    if (!res.ok) {
      setBusy(null)
      hapticNotify('ERROR')
      if (inline) setError(res.error)
      else toast(res.error, { tone: 'danger' })
      return false
    }
    await load()
    setBusy(null)
    hapticNotify('SUCCESS')
    toast(done, { tone: 'success', duration: 2000 })
    return true
  }

  const settingsBody = (enabled: boolean, s: SettingsForm | LoyaltySettings) => ({
    enabled,
    pointsPerPound: toLatin(String(s.pointsPerPound)),
    pointValue: toLatin(String(s.pointValue)),
    minPointsToRedeem: toLatin(String(s.minPointsToRedeem)),
    welcomePoints: toLatin(String(s.welcomePoints)),
    reviewPoints: toLatin(String(s.reviewPoints)),
    referralPoints: toLatin(String(s.referralPoints)),
  })

  const openSettings = () => {
    if (!data) return
    haptic('LIGHT')
    setError(null)
    const s = data.settings
    setSettingsForm({
      pointsPerPound: String(s.pointsPerPound),
      pointValue: String(s.pointValue),
      minPointsToRedeem: String(s.minPointsToRedeem),
      welcomePoints: String(s.welcomePoints),
      reviewPoints: String(s.reviewPoints),
      referralPoints: String(s.referralPoints),
    })
  }

  const openReward = (r?: Reward) => {
    haptic('LIGHT')
    setError(null)
    setRewardForm(
      r
        ? {
            id: r.id,
            name: r.name,
            description: r.description ?? '',
            type: r.type,
            value: String(r.value / 100),
            pointsCost: String(r.pointsCost),
            minTier: r.minTier ?? '',
            limited: r.stock !== null,
            stock: String(r.stock ?? 50),
            isActive: r.isActive,
          }
        : { id: null, name: '', description: '', type: 'coupon_percent', value: '10', pointsCost: '100', minTier: '', limited: false, stock: '50', isActive: true },
    )
  }

  const rewardWorth = (r: Reward) =>
    r.type === 'coupon_percent' ? `خصم ${formatNumber(r.value / 100)}٪` : r.type === 'coupon_fixed' ? `خصم ${formatMoney(r.value, currency)}` : r.typeLabel

  /* مثال حي: طلب بـ١٠٠٠ جنيه */
  const example = (s: SettingsForm | null) => {
    if (!s) return null
    const perPound = Number(toLatin(s.pointsPerPound)) || 0
    const value = Number(toLatin(s.pointValue)) || 0
    if (perPound <= 0 || value <= 0) return null
    const points = 1000 * perPound
    return `عميل طلب بـ١٠٠٠ ${unitLabel} هياخد ${formatNumber(points)} نقطة، قيمتها ${formatNumber(Math.round((points * value) / 100))} ${unitLabel} خصم في طلبه الجاي.`
  }

  const rewardUnit = data?.rewardTypes.find((t) => t.key === rewardForm?.type)?.unit ?? null

  return (
    <Screen visible={visible} title="الولاء والنقاط" onRefresh={load}>
      <div class="home-body">
        <header class="page-head rise">
          <div class="page-head-text">
            <h1 class="page-title">الولاء والنقاط</h1>
            <p class="page-sub">خلّي العميل يرجع تاني — نقاط مع كل طلب، وخصم لما يجمعها</p>
          </div>
        </header>

        {!data ? (
          failed ? (
            <div class="empty">
              <span class="empty-icon">
                <Icon svg={icons.wifiOff()} />
              </span>
              <b>مش قادرين نجيب إعدادات الولاء</b>
              <p>اتأكد من النت واسحب لتحت عشان تحاول تاني.</p>
            </div>
          ) : (
            <div class="olist">
              <span class="sk" style="height:180px;border-radius:20px" />
              <span class="sk" style="height:160px;border-radius:20px" />
            </div>
          )
        ) : (
          <>
            {data.enabled && (
              <div class="an-kpis rise">
                <div class="card an-kpi">
                  <span class="an-kpi-label">عملاء عندهم نقاط</span>
                  <span class="an-kpi-value">{formatNumber(data.stats.members)}</span>
                </div>
                <div class="card an-kpi">
                  <span class="an-kpi-label">نقاط لسه ما اتصرفتش</span>
                  <span class="an-kpi-value">{formatNumber(data.stats.outstanding)}</span>
                </div>
              </div>
            )}

            {/* ─── النقاط ─── */}
            <section class="card sec np-form rise ly-sec">
              <button
                type="button"
                class="switch-row"
                disabled={Boolean(busy)}
                onClick={() =>
                  void post(
                    'enable',
                    '/api/app/loyalty/settings',
                    settingsBody(!data.enabled, data.settings),
                    data.enabled ? 'نظام النقاط اتوقّف' : 'نظام النقاط اشتغل 🎉',
                  )
                }
              >
                <span class="switch-text">
                  <b>نظام النقاط</b>
                  <small>{data.enabled ? 'العميل بيجمع نقاط مع كل طلب يتسلّمه' : 'متوقّف — شغّله عشان العملاء يجمعوا نقاط'}</small>
                </span>
                <span class={`switch${data.enabled ? ' switch--on' : ''}${busy === 'enable' ? ' switch--busy' : ''}`}>
                  <span />
                </span>
              </button>

              {data.enabled && (
                <>
                  <div class="ly-rules">
                    <span>
                      <b>{formatNumber(data.settings.pointsPerPound)}</b>
                      <small>نقطة لكل جنيه</small>
                    </span>
                    <span>
                      <b>{formatNumber(data.settings.pointValue)}</b>
                      <small>قرش قيمة النقطة</small>
                    </span>
                    <span>
                      <b>{formatNumber(data.settings.minPointsToRedeem)}</b>
                      <small>أقل استبدال</small>
                    </span>
                  </div>
                  <p class="fine">
                    ترحيب {formatNumber(data.settings.welcomePoints)} · مراجعة {formatNumber(data.settings.reviewPoints)} · إحالة{' '}
                    {formatNumber(data.settings.referralPoints)} نقطة
                  </p>
                  <button type="button" class="btn btn--ghost press" onClick={openSettings}>
                    <Icon svg={icons.pencil()} />
                    عدّل القواعد
                  </button>

                  <div class="ly-tiers">
                    {data.tiers.map((t) => (
                      <span key={t.key} class="ly-tier">
                        <i style={{ background: t.color }} />
                        <b>{t.name}</b>
                        <small>
                          من {formatNumber(t.minPoints)} نقطة{t.discountBps ? ` · خصم ${formatNumber(t.discountBps / 100)}٪` : ''}
                        </small>
                      </span>
                    ))}
                  </div>
                  <button type="button" class="an-link press" onClick={() => navigate('/dashboard/loyalty?web=1')}>
                    <Icon svg={icons.crown()} />
                    <span>
                      مستويات العملاء
                      <small>تعديل المستويات من صفحة الولاء الكاملة</small>
                    </span>
                    <Icon svg={icons.chevronLeft()} className="ic an-chev" />
                  </button>
                </>
              )}
            </section>

            {/* ─── المكافآت ─── */}
            <div class="mk-sec cr-head">
              <span>
                <b>متجر المكافآت</b>
                <small>العميل ياخد إيه مقابل نقاطه</small>
              </span>
              <button type="button" class="act press cr-add" onClick={() => openReward()}>
                <Icon svg={icons.plus()} />
                ضيف
              </button>
            </div>
            {data.rewards.length === 0 ? (
              <div class="empty empty--compact rise">
                <span class="empty-icon">
                  <Icon svg={icons.gift()} />
                </span>
                <b>مافيش مكافآت</b>
                <p>من غيرها العميل بيجمع نقاط ما بيقدرش يستخدمها.</p>
              </div>
            ) : (
              <div class="card ops-list rise">
                {data.rewards.map((r) => (
                  <button key={r.id} type="button" class={`bl-row ct-row press${r.isActive ? '' : ' cr--off'}`} onClick={() => openReward(r)}>
                    <span class="cr-icon cr-icon--sm">
                      <Icon svg={icons.gift()} />
                    </span>
                    <span class="bl-main">
                      <b>
                        {r.name}
                        {!r.isActive && <span class="cr-off">موقوفة</span>}
                      </b>
                      <small>
                        {rewardWorth(r)}
                        {r.minTierLabel ? ` · ${r.minTierLabel} فأعلى` : ''}
                        {r.stock !== null ? ` · باقي ${formatNumber(r.stock)}` : ''}
                        {r.redeemedCount ? ` · اتسحبت ${formatNumber(r.redeemedCount)} مرة` : ''}
                      </small>
                    </span>
                    <b class="ly-cost num">{formatNumber(r.pointsCost)} نقطة</b>
                  </button>
                ))}
              </div>
            )}

            {/* ─── العجلة ─── */}
            <div class="mk-sec">
              <b>عجلة الحظ</b>
              <small>الزائر بياخد كود خصم مقابل رقمه</small>
            </div>
            <section class="card sec np-form rise ly-sec">
              <button
                type="button"
                class="switch-row"
                disabled={Boolean(busy)}
                onClick={() =>
                  void post('wheel', '/api/app/loyalty/wheel', { enabled: !data.wheel.enabled }, data.wheel.enabled ? 'العجلة اتوقّفت' : 'العجلة اشتغلت في متجرك')
                }
              >
                <span class="switch-text">
                  <b>{data.wheel.title}</b>
                  <small>
                    {data.wheel.enabled ? 'ظاهرة لزوّار متجرك' : 'متوقّفة'} · {formatNumber(data.wheel.prizes.length)} جايزة
                  </small>
                </span>
                <span class={`switch${data.wheel.enabled ? ' switch--on' : ''}${busy === 'wheel' ? ' switch--busy' : ''}`}>
                  <span />
                </span>
              </button>
              {data.wheel.prizes.length > 0 && (
                <div class="ly-prizes">
                  {data.wheel.prizes.map((p, i) => (
                    <span key={i} class="ly-prize">
                      <i style={{ background: p.color }} />
                      {p.label}
                      <small>{formatNumber(p.chance)}٪</small>
                    </span>
                  ))}
                </div>
              )}
              <button type="button" class="an-link press" onClick={() => navigate('/dashboard/loyalty?web=1')}>
                <Icon svg={icons.sparkles()} />
                <span>
                  عدّل العجلة
                  <small>الجوايز وفرص ظهورها والعنوان</small>
                </span>
                <Icon svg={icons.chevronLeft()} className="ic an-chev" />
              </button>
            </section>

            {/* ─── آخر الحركات ─── */}
            {data.recent.length > 0 && (
              <>
                <div class="mk-sec">
                  <b>آخر الحركات</b>
                </div>
                <div class="card ops-list rise">
                  {data.recent.map((t) => (
                    <div key={t.id} class="bl-row">
                      <span class={`mv-delta num ${t.points > 0 ? 'mv-delta--in' : 'mv-delta--out'}`}>
                        {t.points > 0 ? `+${formatNumber(t.points)}` : `−${formatNumber(Math.abs(t.points))}`}
                      </span>
                      <span class="bl-main">
                        <b>{t.customerName ?? 'عميل'}</b>
                        <small>
                          {t.reason ? `${t.reason} · ` : ''}
                          {new Date(t.createdAt).toLocaleDateString('ar-EG')}
                        </small>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* قواعد النقاط */}
      <Sheet open={Boolean(settingsForm)} tall title="قواعد النقاط" onClose={() => setSettingsForm(null)}>
        {settingsForm && data && (
          <form
            class="np-form ops-form"
            onSubmit={async (e) => {
              e.preventDefault()
              setError(null)
              const ok = await post('settings', '/api/app/loyalty/settings', settingsBody(true, settingsForm), 'قواعد النقاط اتحفظت', true)
              if (ok) setSettingsForm(null)
            }}
          >
            <div class="np-two">
              {(
                [
                  ['pointsPerPound', 'نقاط لكل جنيه'],
                  ['pointValue', 'قيمة النقطة (قرش)'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} class="np-label">
                  {label}
                  <input
                    class="np-input num"
                    type="text"
                    inputMode="numeric"
                    value={settingsForm[key]}
                    onInput={(e) => setSettingsForm({ ...settingsForm, [key]: (e.currentTarget as HTMLInputElement).value })}
                  />
                </label>
              ))}
            </div>
            {example(settingsForm) && <p class="np-note">يعني: {example(settingsForm)}</p>}
            <div class="np-two">
              {(
                [
                  ['minPointsToRedeem', 'أقل نقاط للاستبدال'],
                  ['welcomePoints', 'نقاط الترحيب'],
                  ['reviewPoints', 'نقاط المراجعة'],
                  ['referralPoints', 'نقاط الإحالة'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} class="np-label">
                  {label}
                  <input
                    class="np-input num"
                    type="text"
                    inputMode="numeric"
                    value={settingsForm[key]}
                    onInput={(e) => setSettingsForm({ ...settingsForm, [key]: (e.currentTarget as HTMLInputElement).value })}
                  />
                </label>
              ))}
            </div>
            <p class="fine">نقاط الإحالة بتتصرف للاتنين — اللي حوّل واللي اتحوّل. صفر يقفل «هات صاحبك».</p>
            {error && <p class="np-error">{error}</p>}
            <div class="btn-row">
              <button type="button" class="btn btn--ghost press" onClick={() => setSettingsForm(null)}>
                رجوع
              </button>
              <button type="submit" class="btn btn--primary press" disabled={busy === 'settings'}>
                {busy === 'settings' ? <span class="spinner" /> : <Icon svg={icons.check()} />}
                احفظ
              </button>
            </div>
          </form>
        )}
      </Sheet>

      {/* مكافأة */}
      <Sheet open={Boolean(rewardForm)} tall title={rewardForm?.id ? 'تعديل المكافأة' : 'مكافأة جديدة'} onClose={() => setRewardForm(null)}>
        {rewardForm && data && (
          <form
            class="np-form ops-form"
            onSubmit={async (e) => {
              e.preventDefault()
              if (rewardForm.name.trim().length < 2) return setError('اكتب اسم المكافأة')
              setError(null)
              const ok = await post(
                'reward',
                '/api/app/loyalty/rewards/save',
                { ...rewardForm, value: toLatin(rewardForm.value), pointsCost: toLatin(rewardForm.pointsCost), stock: toLatin(rewardForm.stock) },
                rewardForm.id ? 'المكافأة اتحفظت' : 'المكافأة اتضافت',
                true,
              )
              if (ok) setRewardForm(null)
            }}
          >
            <label class="np-label">
              اسم المكافأة
              <input
                class="np-input"
                placeholder="خصم ١٠٪ على أي طلب"
                value={rewardForm.name}
                maxLength={60}
                onInput={(e) => setRewardForm({ ...rewardForm, name: (e.currentTarget as HTMLInputElement).value })}
              />
            </label>
            <div class="np-label">
              النوع
              <div class="chips">
                {data.rewardTypes.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    class={`fchip${rewardForm.type === t.key ? ' fchip--on' : ''}`}
                    onClick={() => {
                      haptic('LIGHT')
                      setRewardForm({ ...rewardForm, type: t.key })
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div class="np-two">
              {rewardUnit && (
                <label class="np-label">
                  القيمة ({rewardUnit === 'ج' ? unitLabel : rewardUnit})
                  <input
                    class="np-input num"
                    type="text"
                    inputMode="decimal"
                    value={rewardForm.value}
                    onInput={(e) => setRewardForm({ ...rewardForm, value: (e.currentTarget as HTMLInputElement).value })}
                  />
                </label>
              )}
              <label class="np-label">
                سعرها بالنقاط
                <input
                  class="np-input num"
                  type="text"
                  inputMode="numeric"
                  value={rewardForm.pointsCost}
                  onInput={(e) => setRewardForm({ ...rewardForm, pointsCost: (e.currentTarget as HTMLInputElement).value })}
                />
              </label>
            </div>
            <div class="np-label">
              أقل مستوى
              <div class="chips">
                {[{ key: '', label: 'أي مستوى' }, ...data.tierOptions.map((t) => ({ key: t.key, label: `${t.label} فأعلى` }))].map((t) => (
                  <button
                    key={t.key || 'any'}
                    type="button"
                    class={`fchip${rewardForm.minTier === t.key ? ' fchip--on' : ''}`}
                    onClick={() => {
                      haptic('LIGHT')
                      setRewardForm({ ...rewardForm, minTier: t.key })
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <label class="np-label">
              وصف قصير (اختياري)
              <input
                class="np-input"
                placeholder="بيتطبّق على أي منتج، صالح ٩٠ يوم"
                value={rewardForm.description}
                maxLength={200}
                onInput={(e) => setRewardForm({ ...rewardForm, description: (e.currentTarget as HTMLInputElement).value })}
              />
            </label>
            <button
              type="button"
              class="switch-row"
              onClick={() => {
                haptic('LIGHT')
                setRewardForm({ ...rewardForm, limited: !rewardForm.limited })
              }}
            >
              <span class="switch-text">
                <b>كمية محدودة</b>
                <small>{rewardForm.limited ? 'بتقفل لما الكمية تخلص' : 'مفتوحة لأي عدد'}</small>
              </span>
              <span class={`switch${rewardForm.limited ? ' switch--on' : ''}`}>
                <span />
              </span>
            </button>
            {rewardForm.limited && (
              <label class="np-label">
                الكمية المتاحة
                <input
                  class="np-input num"
                  type="text"
                  inputMode="numeric"
                  value={rewardForm.stock}
                  onInput={(e) => setRewardForm({ ...rewardForm, stock: (e.currentTarget as HTMLInputElement).value })}
                />
              </label>
            )}
            <button
              type="button"
              class="switch-row"
              onClick={() => {
                haptic('LIGHT')
                setRewardForm({ ...rewardForm, isActive: !rewardForm.isActive })
              }}
            >
              <span class="switch-text">
                <b>معروضة للعملاء</b>
                <small>{rewardForm.isActive ? 'العميل يقدر يستبدل نقاطه بيها' : 'موقوفة'}</small>
              </span>
              <span class={`switch${rewardForm.isActive ? ' switch--on' : ''}`}>
                <span />
              </span>
            </button>
            {error && <p class="np-error">{error}</p>}
            <div class="btn-row">
              <button type="button" class="btn btn--ghost press" onClick={() => setRewardForm(null)}>
                رجوع
              </button>
              <button type="submit" class="btn btn--primary press" disabled={busy === 'reward'}>
                {busy === 'reward' ? <span class="spinner" /> : <Icon svg={icons.check()} />}
                {rewardForm.id ? 'احفظ' : 'ضيف المكافأة'}
              </button>
            </div>
            {rewardForm.id && (
              <button
                type="button"
                class="btn btn--ghost btn--danger-text press"
                onClick={() => {
                  const r = data.rewards.find((x) => x.id === rewardForm.id) ?? null
                  setRewardForm(null)
                  setDeleteReward(r)
                }}
              >
                <Icon svg={icons.trash()} />
                احذف المكافأة
              </button>
            )}
          </form>
        )}
      </Sheet>

      <Sheet open={Boolean(deleteReward)} title={deleteReward ? `تحذف «${deleteReward.name}»؟` : ''} onClose={() => setDeleteReward(null)}>
        {deleteReward && (
          <>
            <p class="sheet-text">العملاء مش هيقدروا يستبدلوا نقاطهم بيها تاني. الأكواد اللي اتسحبت قبل كده بتفضل شغّالة.</p>
            <div class="btn-row">
              <button type="button" class="btn btn--ghost press" onClick={() => setDeleteReward(null)}>
                رجوع
              </button>
              <button
                type="button"
                class="btn btn--danger press"
                onClick={async () => {
                  const r = deleteReward
                  setDeleteReward(null)
                  await post(`del-${r.id}`, `/api/app/loyalty/rewards/${encodeURIComponent(r.id)}/delete`, {}, 'المكافأة اتحذفت')
                }}
              >
                أيوه، احذفها
              </button>
            </div>
          </>
        )}
      </Sheet>
    </Screen>
  )
}
