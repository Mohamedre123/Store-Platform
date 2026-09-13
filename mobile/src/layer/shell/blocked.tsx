/**
 * الحظر — شاشة أصلية.
 *
 * فوق: الأرقام اللي رفضت الاستلام أكتر من مرة (من طلبات المتجر نفسه) بزرار
 * «احظره» جنب كل واحد. تحت: قايمة الحظر بسبب كل صف وعدد الطلبات اللي
 * منعها، وشيل بدوسة. «ضيف للحظر» بيفتح لوحة من تحت.
 */
import { useState } from 'preact/hooks'
import { haptic, hapticNotify } from '../bridge'
import { toast } from '../dom'
import { icons } from '../icons'
import { formatDateTime, formatNumber } from './format'
import { postAppJson, useResource } from './http'
import { blockedData } from './ops-api'
import { Screen, Sheet } from './screen'
import { Icon } from './ui'

export const BAN_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg>'

const PLACEHOLDER: Record<string, string> = {
  phone: '01xxxxxxxxx',
  email: 'name@example.com',
  ip: '197.x.x.x',
  name: 'الاسم زي ما بيكتبه',
}

const ACTIONS = [
  { value: 'reject', label: 'ارفض الطلب', hint: 'ما بيتسجّلش أصلًا' },
  { value: 'flag', label: 'اقبله وعلّم عليه', hint: 'بيوصلك وتراجعه بإيدك' },
] as const

export function BlockedScreen({ visible, onUnavailable }: { visible: boolean; onUnavailable: () => void }) {
  const { data, failed, load } = useResource(blockedData, visible, onUnavailable)
  const [busy, setBusy] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [match, setMatch] = useState('phone')
  const [value, setValue] = useState('')
  const [action, setAction] = useState<'reject' | 'flag'>('reject')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const run = async (key: string, url: string, done: string) => {
    if (busy) return
    haptic('LIGHT')
    setBusy(key)
    const res = await postAppJson(url)
    if (!res.ok) {
      setBusy(null)
      hapticNotify('ERROR')
      toast(res.error, { tone: 'danger' })
      return
    }
    await load()
    setBusy(null)
    hapticNotify('SUCCESS')
    toast(done, { tone: 'success', duration: 1800 })
  }

  const openAdd = () => {
    haptic('LIGHT')
    setMatch('phone')
    setValue('')
    setAction('reject')
    setReason('')
    setError(null)
    setAdding(true)
  }

  const add = async (e: Event) => {
    e.preventDefault()
    if (busy) return
    if (value.trim().length < 2) return setError('اكتب القيمة اللي عايز تحظرها')
    setError(null)
    setBusy('add')
    const res = await postAppJson('/api/app/blocked/add', { match, value, action, reason })
    if (!res.ok) {
      setBusy(null)
      hapticNotify('ERROR')
      setError(res.error)
      return
    }
    await load()
    setBusy(null)
    hapticNotify('SUCCESS')
    toast('اتضاف للحظر', { tone: 'success', duration: 1800 })
    setAdding(false)
  }

  const blockedCount = data?.rows.length ?? 0

  return (
    <Screen visible={visible} title="الحظر" onRefresh={load}>
      <div class="home-body">
        <header class="page-head rise">
          <div class="page-head-text">
            <h1 class="page-title">الحظر</h1>
            <p class="page-sub">
              {blockedCount > 0 ? `${formatNumber(blockedCount)} محظور — الطلب منهم بيتوقف قبل ما يتشحن` : 'امنع الطلبات الوهمية قبل ما تكلّفك شحن'}
            </p>
          </div>
        </header>

        {!data ? (
          failed ? (
            <div class="empty">
              <span class="empty-icon">
                <Icon svg={icons.wifiOff()} />
              </span>
              <b>مش قادرين نجيب قايمة الحظر</b>
              <p>اتأكد من النت واسحب لتحت عشان تحاول تاني.</p>
            </div>
          ) : (
            <div class="olist">
              {[0, 1, 2].map((i) => (
                <span key={i} class="sk" style="height:80px;border-radius:20px" />
              ))}
            </div>
          )
        ) : (
          <>
            <button type="button" class="btn btn--primary btn--lg press rise ops-add" onClick={openAdd}>
              <Icon svg={BAN_ICON} />
              ضيف للحظر
            </button>

            {data.risky.length > 0 && (
              <>
                <div class="mk-sec">
                  <b>رفضوا الاستلام أكتر من مرة</b>
                  <small>كل رفض كلّفك شحن رايح وجاي. مش لازم تحظرهم كلهم — بس كلهم يستاهلوا مكالمة تأكيد.</small>
                </div>
                <div class="card ops-list rise">
                  {data.risky.map((c) => (
                    <div key={c.id} class="bl-row">
                      <span class="bl-main">
                        <b>{c.name || 'بلا اسم'}</b>
                        {c.phone && <bdi dir="ltr">{c.phone}</bdi>}
                        <small>
                          {formatNumber(c.refused)} رفض · {formatNumber(c.delivered)} استلام
                        </small>
                      </span>
                      <button
                        type="button"
                        class={`act bl-act press${c.isBlocked ? '' : ' act--danger'}`}
                        disabled={Boolean(busy)}
                        onClick={() =>
                          void run(
                            c.id,
                            `/api/app/blocked/${encodeURIComponent(c.id)}/${c.isBlocked ? 'unblock' : 'block'}`,
                            c.isBlocked ? 'اتفكّ الحظر' : 'اتحظر',
                          )
                        }
                      >
                        {busy === c.id && <span class="spinner" />}
                        {c.isBlocked ? 'فُكّ الحظر' : 'احظره'}
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div class="mk-sec">
              <b>قايمة الحظر</b>
              <small>الصف اللي عدّاده صفر بعد شهور غالبًا اتحطّ بالغلط.</small>
            </div>

            {data.rows.length === 0 ? (
              <div class="empty empty--compact rise">
                <span class="empty-icon">
                  <Icon svg={BAN_ICON} />
                </span>
                <b>مفيش حاجة محظورة</b>
                <p>لما رقم يطلب ويرفض الاستلام، حطّه هنا — طلبه الجاي هيتوقف قبل ما يتحوّل لشحنة على حسابك.</p>
              </div>
            ) : (
              <div class="card ops-list rise">
                {data.rows.map((r) => (
                  <div key={r.id} class="bl-row">
                    <span class={`bl-tag bl-tag--${r.action}`}>{r.action === 'reject' ? 'يترفض' : 'يعدّي معلَّم'}</span>
                    <span class="bl-main">
                      <bdi class="bl-value" dir={r.match === 'name' ? 'rtl' : 'ltr'}>
                        {r.value}
                      </bdi>
                      <small>
                        {r.matchLabel}
                        {r.reason ? ` · ${r.reason}` : ''}
                        {r.hits > 0
                          ? ` · منع ${formatNumber(r.hits)} طلب${r.lastHitAt ? `، آخرها ${formatDateTime(r.lastHitAt)}` : ''}`
                          : ' · لسه ما منعش أي طلب'}
                      </small>
                    </span>
                    <button
                      type="button"
                      class="ops-icon press"
                      aria-label={`شيل ${r.value} من الحظر`}
                      disabled={Boolean(busy)}
                      onClick={() => void run(r.id, `/api/app/blocked/${encodeURIComponent(r.id)}/remove`, 'اتشال من الحظر')}
                    >
                      {busy === r.id ? <span class="spinner" /> : <Icon svg={icons.trash()} />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <Sheet open={adding} title="حظر جديد" onClose={() => setAdding(false)}>
        <form class="np-form ops-form" onSubmit={add}>
          <div class="np-label">
            بتحظر إيه
            <div class="chips">
              {(data?.matches ?? []).map((m) => (
                <button
                  key={m.key}
                  type="button"
                  class={`fchip${match === m.key ? ' fchip--on' : ''}`}
                  onClick={() => {
                    haptic('LIGHT')
                    setMatch(m.key)
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <label class="np-label">
            القيمة
            <input
              class="np-input"
              dir={match === 'name' ? 'rtl' : 'ltr'}
              type={match === 'phone' ? 'tel' : match === 'email' ? 'email' : 'text'}
              placeholder={PLACEHOLDER[match] ?? ''}
              value={value}
              onInput={(e) => setValue((e.currentTarget as HTMLInputElement).value)}
            />
          </label>
          <div class="np-label">
            يحصل إيه لما يطلب
            <div class="ops-choice">
              {ACTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  class={`ops-opt${action === o.value ? ' ops-opt--on' : ''}`}
                  onClick={() => {
                    haptic('LIGHT')
                    setAction(o.value)
                  }}
                >
                  <b>{o.label}</b>
                  <small>{o.hint}</small>
                </button>
              ))}
            </div>
          </div>
          <label class="np-label">
            السبب (اكتبه عشان تفتكر بعدين)
            <input
              class="np-input"
              placeholder="رفض الاستلام ٣ مرات"
              value={reason}
              onInput={(e) => setReason((e.currentTarget as HTMLInputElement).value)}
            />
          </label>
          {error && <p class="np-error">{error}</p>}
          <div class="btn-row">
            <button type="button" class="btn btn--ghost press" onClick={() => setAdding(false)}>
              رجوع
            </button>
            <button type="submit" class="btn btn--danger press" disabled={busy === 'add'}>
              {busy === 'add' ? <span class="spinner" /> : <Icon svg={BAN_ICON} />}
              احظر
            </button>
          </div>
        </form>
      </Sheet>
    </Screen>
  )
}
