/**
 * الاشتراك — شاشة أصلية.
 *
 * حالة الاشتراك الحقيقية وكام يوم فاضل، عدّاد الطلبات للمتجر المجاني،
 * التجربة المجانية (بتبدأها بضغطة من هنا)، الباقات بأسعارها، ومعرّف
 * الحساب اللي الدعم بيسأل عليه — وسجل الطلبات والفترات.
 *
 * الدفع نفسه (تحويل وإيصال) فضل في صفحة المنصة لأنه بيحتاج رفع صورة
 * وتفاصيل التحويل — زرار «اشترك» بيفتحها.
 */
import { useState } from 'preact/hooks'
import { haptic, hapticNotify } from '../bridge'
import { toast } from '../dom'
import { icons } from '../icons'
import { subscriptionData, type SubscriptionPayload } from './business-api'
import { formatNumber } from './format'
import { postAppJson, useResource } from './http'
import { navigate } from './navigate'
import { Screen } from './screen'
import { Icon } from './ui'

const UNLOCKS = [
  'أدوات الذكاء الاصطناعي — الرد على العملاء والمساعد ومصمّم الثيمات',
  'صفحات الهبوط — إنشاء وتعديل بلا حدود',
  'طلبات من غير حد',
  'ربط نطاقك الخاص بدل النطاق الفرعي',
]

export function SubscriptionScreen({ visible, onUnavailable }: { visible: boolean; onUnavailable: () => void }) {
  const { data, failed, load } = useResource(subscriptionData, visible, onUnavailable)

  return (
    <Screen visible={visible} title="الاشتراك" onRefresh={load}>
      <div class="home-body">
        <header class="page-head rise">
          <div class="page-head-text">
            <h1 class="page-title">الاشتراك</h1>
            <p class="page-sub">باقتك الحالية، وإزاي تفتح كل المميزات</p>
          </div>
        </header>

        {data ? (
          <SubscriptionContent data={data} reload={load} />
        ) : failed ? (
          <div class="empty">
            <span class="empty-icon">
              <Icon svg={icons.wifiOff()} />
            </span>
            <b>مش قادرين نجيب الاشتراك</b>
            <p>اتأكد من النت واسحب لتحت عشان تحاول تاني.</p>
          </div>
        ) : (
          <div class="olist">
            <span class="sk" style="height:170px;border-radius:22px" />
            <span class="sk" style="height:220px;border-radius:22px" />
          </div>
        )}
      </div>
    </Screen>
  )
}

function SubscriptionContent({ data, reload }: { data: SubscriptionPayload; reload: () => Promise<void> }) {
  const [starting, setStarting] = useState(false)

  const pay = () => {
    haptic('LIGHT')
    navigate('/dashboard/subscription?web=1')
  }

  const startTrial = async () => {
    if (starting) return
    haptic('MEDIUM')
    setStarting(true)
    const res = await postAppJson('/api/app/subscription/trial')
    setStarting(false)
    if (!res.ok) {
      hapticNotify('ERROR')
      toast(res.error, { tone: 'danger' })
      return
    }
    hapticNotify('SUCCESS')
    toast('التجربة المجانية بدأت — كل المميزات مفتوحة 🎁', { tone: 'success', duration: 3200 })
    await reload()
  }

  const copyAccount = async () => {
    if (!data.accountId) return
    haptic('LIGHT')
    try {
      await navigator.clipboard.writeText(data.accountId)
      toast('اتنسخ معرّف الحساب', { tone: 'success', duration: 1800 })
    } catch {
      toast(data.accountId)
    }
  }

  const quotaRatio = data.quota.limit ? Math.min(1, data.quota.used / data.quota.limit) : 0

  return (
    <>
      <section class={`card sub-hero sub-tone--${data.tone} rise`}>
        <div class="sub-hero-top">
          <span class="sub-icon">
            <Icon svg={data.isAdmin ? icons.shieldCheck() : icons.crown()} />
          </span>
          <span class="sub-title">
            <b>{data.title}</b>
            <p>{data.text}</p>
          </span>
        </div>
        {data.daysLeft !== null && (
          <div class="sub-days">
            <b class="num">{formatNumber(data.daysLeft)}</b>
            <span>{data.daysLeft === 1 ? 'يوم فاضل' : 'يوم فاضلين'}</span>
          </div>
        )}
        {!data.active && data.quota.limit !== null && (
          <div>
            <div class="an-meter-top">
              <span>{data.quota.blocked ? 'متجرك وقف عن استقبال الطلبات' : 'الطلبات من غير اشتراك'}</span>
              <span>
                {formatNumber(data.quota.used)} / {formatNumber(data.quota.limit)}
              </span>
            </div>
            <div class="an-track">
              <i
                style={{
                  width: `${Math.max(4, quotaRatio * 100)}%`,
                  background: data.quota.blocked ? 'var(--color-danger,#b91c1c)' : undefined,
                }}
              />
            </div>
          </div>
        )}
      </section>

      {data.pendingPlan && (
        <div class="alert rise">
          <span class="alert-icon">
            <Icon svg={icons.clock()} />
          </span>
          <span class="alert-text">
            <span class="alert-title">طلب {data.pendingPlan} تحت المراجعة</span>
            <span class="alert-hint">هنفعّله أول ما نتأكد من التحويل، وهيوصلك إيميل بالتفعيل.</span>
          </span>
        </div>
      )}

      {!data.active && (
        <section class="card sec rise">
          <div class="an-head">
            <b>اللي بيتفتح بالاشتراك</b>
          </div>
          <ul class="sub-list">
            {UNLOCKS.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
        </section>
      )}

      {!data.isAdmin && data.trial.state !== 'hidden' && (
        <section class="card sec sub-trial rise">
          <div class="sub-hero-top">
            <span class="sub-icon sub-icon--gift">
              <Icon svg={icons.gift()} />
            </span>
            <span class="sub-title">
              <b>{data.trial.name}</b>
              <p>
                {data.trial.state === 'running'
                  ? 'شغّالة دلوقتي — استغلّها وجرّب كل حاجة.'
                  : data.trial.state === 'used'
                    ? 'استخدمت التجربة المجانية قبل كده.'
                    : data.trial.tagline}
              </p>
            </span>
          </div>
          {data.trial.state === 'available' && (
            <button type="button" class="btn btn--primary btn--lg press" disabled={starting} onClick={() => void startTrial()}>
              {starting ? <span class="spinner" /> : <Icon svg={icons.sparkles()} />}
              ابدأ التجربة المجانية
            </button>
          )}
        </section>
      )}

      {!data.isAdmin && (
        <>
          <div class="mk-sec rise">
            <b>{data.active && !data.onTrial ? 'جدّد اشتراكك' : 'اختار باقتك'}</b>
            <small>الدفع بتحويل (محفظة أو إنستا باي)، والتفعيل بعد التأكيد</small>
          </div>
          {data.plans.map((p) => (
            <section key={p.key} class={`card plan rise${p.highlight ? ' plan--hl' : ''}`}>
              <div class="plan-head">
                <b>{p.name}</b>
                {p.highlight && <span class="badge">الأكثر اختيارًا</span>}
              </div>
              <span class="plan-price">{p.priceLabel}</span>
              <p class="plan-tag">{p.tagline}</p>
              <ul class="sub-list">
                {p.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <button type="button" class={`btn ${p.highlight ? 'btn--primary' : 'btn--ghost'} press`} onClick={pay}>
                {data.active && !data.onTrial ? 'جدّد' : 'اشترك'} في {p.name}
              </button>
            </section>
          ))}
        </>
      )}

      {data.accountId && (
        <button type="button" class="card acc press rise" onClick={() => void copyAccount()}>
          <Icon svg={icons.keyRound()} />
          <span>معرّف حسابك — ابعته للدعم لما تسأل</span>
          <bdi class="num">{data.accountId}</bdi>
        </button>
      )}

      {data.requests.length > 0 && (
        <>
          <div class="mk-sec rise">
            <b>طلباتك</b>
            <small>كل مرة بعتّ فيها تأكيد دفع</small>
          </div>
          <div class="card list rise">
            {data.requests.map((r) => (
              <div key={r.id} class="row">
                <span class="row-main">
                  <span class="row-title">
                    {r.planName} · {r.amountLabel}
                  </span>
                  <span class="row-sub">
                    {r.dateLabel}
                    {r.note ? ` · ${r.note}` : ''}
                  </span>
                </span>
                <span class="pill" style={{ background: r.bg, color: r.fg }}>
                  {r.statusLabel}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {data.history.length > 0 && (
        <>
          <div class="mk-sec rise">
            <b>سجل الاشتراكات</b>
            <small>كل فترة اشتراك مرّت على متجرك</small>
          </div>
          <div class="card list rise">
            {data.history.map((h) => (
              <div key={h.id} class="row">
                <span class="row-main">
                  <span class="row-title">
                    {h.planName} · {h.amountLabel}
                  </span>
                  <span class="row-sub">
                    {h.fromLabel} ← {h.toLabel}
                    {h.daysLeft !== null ? ` · فاضل ${formatNumber(h.daysLeft)} يوم` : ''}
                  </span>
                </span>
                <span class="pill" style={{ background: h.bg, color: h.fg }}>
                  {h.statusLabel}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
}
