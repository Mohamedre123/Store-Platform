/**
 * «حِيل صاحبك» — إحالة التجّار — شاشة أصلية.
 *
 * هدف الشاشة واحد: التاجر يبعت رابطه. فالرابط فوق وأكبر حاجة، وزرار
 * واتساب برسالة جاهزة، وتحتهم العدّاد: سجّلوا برابطك، ومنهم اشتركوا.
 */
import { haptic } from '../bridge'
import { icons } from '../icons'
import { formatNumber } from './format'
import { useResource } from './http'
import { openExternal } from './navigate'
import { COPY_ICON, copyText, referralsData } from './ops-api'
import { Screen } from './screen'
import { Icon } from './ui'

export function ReferralsScreen({ visible, onUnavailable }: { visible: boolean; onUnavailable: () => void }) {
  const { data, failed, load } = useResource(referralsData, visible, onUnavailable, 5 * 60_000)

  const message = data
    ? `أنا بستخدم زاوية في إدارة متجري «${data.storeName}» ومبسوط منها. لو بتفكّر تفتح متجرك، سجّل من هنا:\n${data.link}`
    : ''

  const share = async () => {
    if (!data) return
    haptic('LIGHT')
    try {
      await navigator.share({ title: 'زاوية', text: message })
    } catch {
      /* التاجر قفل شاشة المشاركة */
    }
  }

  return (
    <Screen visible={visible} title="حِيل صاحبك" onRefresh={load}>
      <div class="home-body">
        <header class="page-head rise">
          <div class="page-head-text">
            <h1 class="page-title">حِيل صاحبك</h1>
            <p class="page-sub">اللي بيدوّروا على منصة لمتجرهم — ابعتلهم رابطك</p>
          </div>
        </header>

        {!data ? (
          failed ? (
            <div class="empty">
              <span class="empty-icon">
                <Icon svg={icons.wifiOff()} />
              </span>
              <b>مش قادرين نجيب رابطك</b>
              <p>اتأكد من النت واسحب لتحت عشان تحاول تاني.</p>
            </div>
          ) : (
            <div class="olist">
              <span class="sk" style="height:210px;border-radius:20px" />
              <span class="sk" style="height:90px;border-radius:20px" />
            </div>
          )
        ) : (
          <>
            <section class="card sec ref-card rise">
              <div class="sub-hero-top">
                <span class="sub-icon">
                  <Icon svg={icons.gift()} />
                </span>
                <span class="sub-title">
                  <b>رابطك</b>
                  <p>كل واحد يسجّل من الرابط ده بيتسجّل باسمك عندنا.</p>
                </span>
              </div>
              <button type="button" class="ref-link press" onClick={() => void copyText(data.link, 'الرابط اتنسخ')}>
                <bdi dir="ltr">{data.link}</bdi>
                <Icon svg={COPY_ICON} />
              </button>
              <button
                type="button"
                class="btn btn--wa btn--lg press"
                onClick={() => {
                  haptic('LIGHT')
                  openExternal(`https://wa.me/?text=${encodeURIComponent(message)}`)
                }}
              >
                <Icon svg={icons.messageCircle()} />
                ابعت على واتساب
              </button>
              <div class="btn-row">
                <button type="button" class="btn btn--ghost press" onClick={() => void share()}>
                  <Icon svg={icons.share()} />
                  شارك
                </button>
                <button type="button" class="btn btn--ghost press" onClick={() => void copyText(message, 'الرسالة اتنسخت')}>
                  <Icon svg={COPY_ICON} />
                  انسخ الرسالة
                </button>
              </div>
              <p class="fine center">
                كودك: <bdi dir="ltr" class="ref-code">{data.code}</bdi>
              </p>
            </section>

            <div class="an-kpis rise">
              <div class="card an-kpi">
                <span class="an-kpi-label">سجّلوا برابطك</span>
                <span class="an-kpi-value">{formatNumber(data.signups)}</span>
              </div>
              <div class="card an-kpi">
                <span class="an-kpi-label">منهم اشتركوا</span>
                <span class={`an-kpi-value${data.subscribed > 0 ? ' ref-good' : ''}`}>{formatNumber(data.subscribed)}</span>
              </div>
              <div class="card an-kpi">
                <span class="an-kpi-label">طلبات وصّلتها</span>
                <span class="an-kpi-value">{formatNumber(data.deliveredOrders)}</span>
              </div>
            </div>

            <p class="np-note rise ref-note">
              العروض والمكافآت بتنزل من إدارة المنصة وبتظهرلك في الرئيسية أول ما تستحقّها. العدّاد بيتحدّث لوحده مع كل واحد بيسجّل برابطك.
            </p>
          </>
        )}
      </div>
    </Screen>
  )
}
