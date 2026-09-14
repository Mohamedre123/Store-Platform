/**
 * سجل النشاط — شاشة أصلية (`/dashboard/settings/activity`).
 *
 * نفس `ActivityList` في اللوحة: فلتر بالشخص (أول حاجة التاجر بيعملها لما يشك)، كل إجراء باسمه (الخطير
 * بلون أحمر) ومين عمله وإمتى، ودوسة بتفتح «قبل» و«بعد».
 */
import { useMemo, useState } from 'preact/hooks'
import { haptic } from '../bridge'
import { icons } from '../icons'
import { formatDateTime } from './format'
import { useResource } from './http'
import { Screen } from './screen'
import { activityData } from './settings-api'
import { Icon } from './ui'

export function ActivityScreen({ visible, onUnavailable }: { visible: boolean; onUnavailable: () => void }) {
  const { data, failed, load } = useResource(activityData, visible, onUnavailable)
  const [who, setWho] = useState('')
  const [open, setOpen] = useState<Record<string, boolean>>({})

  const items = data?.items ?? []
  const people = useMemo(() => {
    const map = new Map<string, string>()
    for (const i of items) if (!map.has(i.whoKey)) map.set(i.whoKey, i.who)
    return [...map.entries()]
  }, [items])
  const shown = who ? items.filter((i) => i.whoKey === who) : items

  return (
    <Screen visible={visible} title="سجل النشاط" onRefresh={load}>
      <div class="home-body">
        <header class="page-head rise">
          <div class="page-head-text">
            <h1 class="page-title">سجل النشاط</h1>
            <p class="page-sub">مين عمل إيه في اللوحة — الإجراءات اللي بتلمس فلوس أو مخزون أو صلاحيات.</p>
          </div>
        </header>

        {!data ? (
          failed ? (
            <div class="empty">
              <span class="empty-icon">
                <Icon svg={icons.wifiOff()} />
              </span>
              <b>مش قادرين نجيب السجل</b>
              <p>اتأكد من النت واسحب لتحت عشان تحاول تاني.</p>
            </div>
          ) : (
            <div class="olist">
              <span class="sk" style="height:220px;border-radius:20px" />
            </div>
          )
        ) : items.length === 0 ? (
          <div class="empty empty--compact rise">
            <span class="empty-icon">
              <Icon svg={icons.clock()} />
            </span>
            <b>مافيش نشاط مسجّل</b>
            <p>أول ما حد يغيّر حالة طلب أو يحذف منتج أو ينشر المتجر، هيتسجّل هنا باسمه ووقته.</p>
          </div>
        ) : (
          <>
            {people.length > 1 && (
              <div class="chips ac-people rise">
                <button type="button" class={`fchip${!who ? ' fchip--on' : ''}`} onClick={() => (haptic('LIGHT'), setWho(''))}>
                  الكل
                </button>
                {people.map(([key, name]) => (
                  <button key={key} type="button" class={`fchip${who === key ? ' fchip--on' : ''}`} onClick={() => (haptic('LIGHT'), setWho(key))}>
                    {name}
                  </button>
                ))}
              </div>
            )}

            <div class="card ops-list rise">
              {shown.map((i) => {
                const detail = Boolean(i.before || i.after)
                return (
                  <div key={i.id} class="ac-row">
                    <button
                      type="button"
                      class="bg-open press"
                      disabled={!detail}
                      onClick={() => {
                        haptic('LIGHT')
                        setOpen((s) => ({ ...s, [i.id]: !s[i.id] }))
                      }}
                    >
                      <span class="bl-main">
                        <b>
                          <span class={`pst-pill ${i.risky ? 'pst-pill--bad' : 'pst-pill--muted'}`}>{i.label}</span>
                          {i.who}
                        </b>
                        <small>
                          {formatDateTime(i.createdAt)}
                          {detail ? (open[i.id] ? ' · اخفي التفاصيل' : ' · التفاصيل') : ''}
                        </small>
                      </span>
                    </button>
                    {open[i.id] && detail && (
                      <div class="ac-detail">
                        {i.before && (
                          <div class="ac-snap">
                            <small>قبل</small>
                            <pre dir="ltr">{i.before}</pre>
                          </div>
                        )}
                        {i.after && (
                          <div class="ac-snap">
                            <small>بعد</small>
                            <pre dir="ltr">{i.after}</pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </Screen>
  )
}
