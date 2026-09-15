/**
 * جودة إشارة التحويل — شاشة أصلية (`/dashboard/analytics/signal`).
 *
 * نفس صفحة اللوحة: تنبيه «مبيعاتك مش بتوصل ميتا» بزرار للإضافات لو التوكن مش مربوط، الدرجة من ١٠ بلونها، طلبات
 * آخر ٧ أيام واللي وصل منها ومتوسط مفاتيح المطابقة، مفاتيح المطابقة بنسبة كل واحد ونصيحته لو أقل من ٨٠٪،
 * والتسليم (وصلت / اتخطّت / فشلت) ورسايل أخطاء المنصة زي ما هي.
 */
import { icons } from '../icons'
import { formatNumber } from './format'
import { useResource } from './http'
import { navigate } from './navigate'
import { signalData } from './reports-api'
import { Screen } from './screen'
import { LoadState } from './settings-forms'
import { Icon } from './ui'

const tone = (pct: number) => (pct >= 80 ? 'var(--color-success,#15803d)' : pct >= 40 ? 'var(--color-warning,#a16207)' : 'var(--color-danger,#b91c1c)')

export function SignalScreen({ visible, onUnavailable }: { visible: boolean; onUnavailable: () => void }) {
  const { data, failed, load } = useResource(signalData, visible, onUnavailable, 60_000)

  const scoreClass = !data || data.score === null ? 'sg-score--none' : data.score >= 7 ? 'sg-score--good' : data.score >= 4 ? 'sg-score--mid' : 'sg-score--bad'

  return (
    <Screen visible={visible} title="جودة الإشارة" onRefresh={load}>
      <div class="home-body">
        <header class="page-head rise">
          <div class="page-head-text">
            <h1 class="page-title">جودة إشارة التحويل</h1>
            <p class="page-sub">قد إيه مبيعاتك بتوصل ميتا وتيك توك كاملة. الرقم ده بيحدّد إعلانك بيتحسّن على مين.</p>
          </div>
        </header>

        {!data ? (
          <LoadState failed={failed} what="جودة الإشارة" />
        ) : (
          <>
            {!data.configured && (
              <section class="card sec rise sg-warn">
                <b>
                  <Icon svg={icons.alertTriangle()} />
                  مبيعاتك مش بتوصل ميتا
                </b>
                <p>
                  البكسل لوحده بيقول لميتا مين <b>فتح</b> متجرك. عشان تقول لها مين <b>اشترى</b>، محتاج توكن واجهة التحويلات كمان — من غيره الخوارزمية بتحسّن على
                  اللي بيتفرّج لا اللي بيدفع، وده بياكل ميزانيتك على أسوأ جمهور ممكن.
                </p>
                <p>والحدث من الخادم بيعدّي حتى لو مانع الإعلانات أو iOS وقّفوا البكسل في متصفح العميل — وده جزء كبير من زوّارك.</p>
                <button type="button" class="btn btn--primary press" onClick={() => navigate('/dashboard/plugins')}>
                  اربط التوكن من صفحة الإضافات
                </button>
              </section>
            )}

            <div class="an-kpis">
              <div class="card an-kpi rise">
                <span class="an-kpi-label">درجة الإشارة</span>
                <b class={`an-kpi-value ${scoreClass}`}>{data.score === null ? '—' : `${formatNumber(data.score)} / ١٠`}</b>
              </div>
              <div class="card an-kpi rise">
                <span class="an-kpi-label">طلبات آخر ٧ أيام</span>
                <b class="an-kpi-value">{formatNumber(data.purchases)}</b>
              </div>
              <div class="card an-kpi rise">
                <span class="an-kpi-label">وصلت للمنصات</span>
                <b class={`an-kpi-value${data.purchases > 0 && data.delivered === 0 ? ' an-kpi-value--neg' : ''}`}>{formatNumber(data.delivered)}</b>
              </div>
              <div class="card an-kpi rise">
                <span class="an-kpi-label">متوسط مفاتيح المطابقة</span>
                <b class="an-kpi-value">{formatNumber(data.avgMatchKeys)} / ٧</b>
              </div>
            </div>

            {data.purchases === 0 ? (
              <div class="empty rise">
                <span class="empty-icon">
                  <Icon svg={icons.trending()} />
                </span>
                <b>مفيش طلبات في آخر ٧ أيام</b>
                <p>الشاشة دي بتتملي مع كل طلب. أول طلب هيوريك كام مفتاح مطابقة خرج معاه، وإذا كان وصل ميتا ولا لأ.</p>
              </div>
            ) : (
              <>
                <section class="card sec rise">
                  <div class="an-head">
                    <b>مفاتيح المطابقة</b>
                  </div>
                  <p class="sg-hint sg-lead">ميتا بتطابق طلبك بحساب العميل عندها بالمفاتيح دي. كل مفتاح ناقص = عملاء أقل بيتطابقوا = جمهور مشابه أضعف.</p>
                  <div class="an-meters">
                    {data.coverage.map((c) => (
                      <div key={c.key}>
                        <div class="an-meter-top">
                          <span>{c.label}</span>
                          <span>{formatNumber(c.pct)}%</span>
                        </div>
                        <div class="an-track">
                          <i style={{ width: `${Math.max(2, c.pct)}%`, background: tone(c.pct) }} />
                        </div>
                        {c.pct < 80 && <p class="sg-hint">{c.hint}</p>}
                      </div>
                    ))}
                  </div>
                </section>

                <section class="card sec rise">
                  <div class="an-head">
                    <b>التسليم</b>
                  </div>
                  <div class="sg-pills">
                    <span class={`sg-pill ${data.delivered > 0 ? 'sg-pill--ok' : 'sg-pill--muted'}`}>{formatNumber(data.delivered)} وصلت</span>
                    {data.skipped > 0 && <span class="sg-pill sg-pill--muted">{formatNumber(data.skipped)} اتخطّت — المتجر مش مربوط</span>}
                    {data.failed > 0 && <span class="sg-pill sg-pill--bad">{formatNumber(data.failed)} فشلت</span>}
                  </div>
                  {data.errors.length > 0 && (
                    <ul class="sg-errors">
                      {data.errors.map((e) => (
                        <li key={e.message}>
                          <b>×{formatNumber(e.count)}</b>
                          <code>{e.message}</code>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            )}
          </>
        )}
      </div>
    </Screen>
  )
}
