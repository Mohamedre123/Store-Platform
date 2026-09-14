/**
 * الأجهزة والجلسات — شاشة أصلية (`/dashboard/settings/sessions`).
 *
 * نفس `SessionsList` في اللوحة: كل جهاز داخل على الحساب («كروم على أندرويد»، إمتى دخل، الـIP)،
 * «الجهاز ده» على الجهاز الحالي، «اقفلها» لأي جهاز تاني، و«اقفل الباقي» بتأكيد (الجهاز ده بيفضل مفتوح).
 */
import { useState } from 'preact/hooks'
import { haptic, hapticNotify } from '../bridge'
import { toast } from '../dom'
import { icons } from '../icons'
import { formatDateTime, formatNumber } from './format'
import { postAppJson, useResource } from './http'
import { Screen, Sheet } from './screen'
import { sessionsData, type DeviceSession } from './settings-api'
import { Icon } from './ui'

const DEVICE_ICONS: Record<DeviceSession['device'], string> = {
  mobile:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>',
  tablet:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>',
  desktop:
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16"/></svg>',
}

export function SessionsScreen({ visible, onUnavailable }: { visible: boolean; onUnavailable: () => void }) {
  const { data, failed, load } = useResource(sessionsData, visible, onUnavailable)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmAll, setConfirmAll] = useState(false)

  const revoke = async (key: string, url: string) => {
    if (busy) return null
    haptic('LIGHT')
    setBusy(key)
    const res = await postAppJson<{ closed?: number }>(url, {})
    if (!res.ok) {
      setBusy(null)
      hapticNotify('ERROR')
      toast(res.error, { tone: 'danger' })
      return null
    }
    await load()
    setBusy(null)
    hapticNotify('SUCCESS')
    return res.data
  }

  const rows = data?.sessions ?? []
  const others = rows.filter((r) => !r.isCurrent).length

  return (
    <Screen visible={visible} title="الأجهزة والجلسات" onRefresh={load}>
      <div class="home-body">
        <header class="page-head rise">
          <div class="page-head-text">
            <h1 class="page-title">الأجهزة والجلسات</h1>
            <p class="page-sub">مين داخل على حسابك دلوقتي. لو فيه جهاز مش بتاعك، اقفله من هنا.</p>
          </div>
        </header>

        {!data ? (
          failed ? (
            <div class="empty">
              <span class="empty-icon">
                <Icon svg={icons.wifiOff()} />
              </span>
              <b>مش قادرين نجيب الأجهزة</b>
              <p>اتأكد من النت واسحب لتحت عشان تحاول تاني.</p>
            </div>
          ) : (
            <div class="olist">
              <span class="sk" style="height:160px;border-radius:20px" />
            </div>
          )
        ) : (
          <>
            {others > 0 && (
              <div class="card pv-card ss-all rise">
                <span class="bl-main">
                  <b>فيه {formatNumber(others)} جهاز تاني داخل على حسابك</b>
                  <small>لو فيهم واحد مش بتاعك، اقفلهم كلهم. جهازك ده هيفضل مفتوح.</small>
                </span>
                <button type="button" class="act press" onClick={() => (haptic('LIGHT'), setConfirmAll(true))}>
                  اقفل الباقي
                </button>
              </div>
            )}

            <div class="card ops-list rise">
              {rows.map((r) => (
                <div key={r.id} class="bl-row">
                  <span class="pv-icon ss-icon">
                    <Icon svg={DEVICE_ICONS[r.device]} />
                  </span>
                  <span class="bl-main">
                    <b>
                      {r.label}
                      {r.isCurrent && <span class="pst-pill pst-pill--good">الجهاز ده</span>}
                    </b>
                    <small>
                      دخل {formatDateTime(r.createdAt)}
                      {r.ip && (
                        <>
                          {' · '}
                          <bdi dir="ltr">{r.ip}</bdi>
                        </>
                      )}
                    </small>
                  </span>
                  {!r.isCurrent && (
                    <button
                      type="button"
                      class="act press ss-revoke"
                      disabled={Boolean(busy)}
                      aria-label={`اقفل جلسة ${r.label}`}
                      onClick={async () => {
                        const res = await revoke(`one-${r.id}`, `/api/app/sessions/${encodeURIComponent(r.id)}/revoke`)
                        if (res) toast('اتقفلت', { tone: 'success', duration: 2000 })
                      }}
                    >
                      {busy === `one-${r.id}` ? <span class="spinner" /> : 'اقفلها'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <Sheet open={confirmAll} title="تقفل الأجهزة التانية؟" onClose={() => setConfirmAll(false)}>
        <div class="np-form ops-form">
          <p class="sheet-text">هتخرّج كل الأجهزة التانية من حسابك ({formatNumber(others)}). الموبايل ده هيفضل داخل.</p>
          <div class="btn-row">
            <button type="button" class="btn btn--ghost press" onClick={() => setConfirmAll(false)}>
              رجوع
            </button>
            <button
              type="button"
              class="btn btn--danger press"
              disabled={Boolean(busy)}
              onClick={async () => {
                const res = await revoke('all', '/api/app/sessions/others/revoke')
                if (!res) return
                setConfirmAll(false)
                toast(`اتقفل ${formatNumber(res.closed ?? 0)} جهاز`, { tone: 'success' })
              }}
            >
              {busy === 'all' ? <span class="spinner" /> : null}
              أيوه، اقفلهم
            </button>
          </div>
        </div>
      </Sheet>
    </Screen>
  )
}
