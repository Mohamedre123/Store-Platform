/**
 * النطاق المخصص — شاشة أصلية (`/dashboard/settings/domain`).
 *
 * نفس صفحة اللوحة و`DomainForm`: نطاق متجرك الحالي، تنبيه لو ربط النطاقات مش مفعّل على المنصة، تنبيه الباقة لو
 * الميزة مقفولة (بزرار للاشتراك)، خانة النطاق ← «ربط/تحديث النطاق»، «شيل الربط» بتأكيد، الحالة (شغّال / مستني
 * سجلات)، سجلات الـDNS بنسخ الاسم والقيمة، «تحقّق دلوقتي»، وملحوظة الانتشار.
 */
import { useEffect, useState } from 'preact/hooks'
import { haptic, hapticNotify } from '../bridge'
import { icons } from '../icons'
import { postAppJson, useResource } from './http'
import { navigate } from './navigate'
import { COPY_ICON, copyText } from './ops-api'
import { Screen } from './screen'
import { Group, LoadState } from './settings-forms'
import { domainData } from './store-settings-api'
import { Icon } from './ui'

type State = { error?: string; notice?: string; verified?: boolean }

function CopyValue({ label, value }: { label: string; value: string }) {
  return (
    <div class="st-copy">
      <small>{label}</small>
      <bdi dir="ltr">{value}</bdi>
      <button type="button" class="ops-icon press" aria-label={`انسخ ${label}`} onClick={() => void copyText(value, 'اتنسخ')}>
        <Icon svg={COPY_ICON} />
      </button>
    </div>
  )
}

export function DomainSettingsScreen({ visible, onUnavailable }: { visible: boolean; onUnavailable: () => void }) {
  const { data, failed, load } = useResource(domainData, visible, onUnavailable)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [state, setState] = useState<State | null>(null)
  const [confirmRemove, setConfirmRemove] = useState(false)

  useEffect(() => {
    if (data) setInput(data.domain ?? '')
  }, [data?.domain])

  const run = async (key: 'save' | 'verify' | 'remove', body: object = {}) => {
    if (busy) return
    haptic('LIGHT')
    setBusy(key)
    setState(null)
    const res = await postAppJson<{ state: State }>(`/api/app/domain/${key}`, body)
    if (!res.ok) {
      setBusy(null)
      hapticNotify('ERROR')
      setState({ error: res.error })
      return
    }
    await load()
    setBusy(null)
    setState(res.data.state)
    hapticNotify(res.data.state.error ? 'WARNING' : 'SUCCESS')
    if (key === 'remove') setConfirmRemove(false)
  }

  const verified = state?.verified ?? data?.verified ?? false

  return (
    <Screen visible={visible} title="النطاق المخصص" onRefresh={load}>
      <div class="home-body">
        <header class="page-head rise">
          <div class="page-head-text">
            <h1 class="page-title">النطاق المخصص</h1>
            <p class="page-sub">اربط نطاقك الخاص بمتجرك بدل النطاق الفرعي.</p>
          </div>
        </header>

        {!data ? (
          <LoadState failed={failed} what="إعدادات النطاق" />
        ) : (
          <>
            <section class="card st-group rise">
              <small class="fine">نطاق متجرك الحالي</small>
              <span class="st-host">{data.currentHost}</span>
              <small class="pv-hint">ده بيفضل شغّال دايمًا حتى بعد ما تربط نطاقك الخاص.</small>
            </section>

            {!data.linkReady && (
              <p class="np-note st-warn rise">
                <b>ربط النطاقات مش مفعّل على المنصة.</b> تقدر تضيف نطاقك وتظبّط سجلاته، بس مش هيشتغل قبل ما إدارة المنصة تضبط التكامل مع المستضيف.
              </p>
            )}

            {data.locked && (
              <div class="np-note st-warn rise st-locked">
                اربط نطاقك الخاص بمتجرك — عنوانك إنت بدل النطاق الفرعي. متاح مع أي باقة.
                <button type="button" class="btn btn--primary press" onClick={() => navigate('/dashboard/subscription')}>
                  <Icon svg={icons.crown()} />
                  اشترك
                </button>
              </div>
            )}

            {state?.error && <p class="np-note st-warn rise">{state.error}</p>}
            {state?.notice && <p class={`np-note rise ${state.verified ? 'st-ok' : ''}`}>{state.notice}</p>}

            <Group title="نطاقك الخاص">
              <label class="np-label">
                النطاق
                <input
                  class="np-input st-mono"
                  dir="ltr"
                  inputMode="url"
                  autocomplete="off"
                  spellcheck={false}
                  placeholder="mystore.com"
                  value={input}
                  onInput={(e) => setInput((e.currentTarget as HTMLInputElement).value)}
                />
                <small class="pv-hint">اكتبه من غير https:// ومن غير www. مثال: mystore.com</small>
              </label>
              <button type="button" class="btn btn--primary press" disabled={Boolean(busy) || input.trim().length < 3} onClick={() => void run('save', { domain: input })}>
                {busy === 'save' ? <span class="spinner" /> : <Icon svg={icons.globe()} />}
                {data.domain ? 'تحديث النطاق' : 'ربط النطاق'}
              </button>

              {data.domain &&
                (confirmRemove ? (
                  <div class="st-box">
                    <p class="sheet-text">الربط هيتشال ومتجرك هيرجع يشتغل على نطاقه الفرعي بس. تقدر تربطه تاني بعدين.</p>
                    <div class="btn-row">
                      <button type="button" class="btn btn--ghost press" onClick={() => setConfirmRemove(false)}>
                        رجوع
                      </button>
                      <button type="button" class="btn btn--danger press" disabled={Boolean(busy)} onClick={() => void run('remove')}>
                        {busy === 'remove' ? <span class="spinner" /> : null}
                        أيوه، شيله
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" class="btn btn--ghost btn--danger-text press" onClick={() => (haptic('LIGHT'), setConfirmRemove(true))}>
                    <Icon svg={icons.trash()} />
                    شيل الربط
                  </button>
                ))}
            </Group>

            {data.domain && data.records.length > 0 && (
              <>
                <div class={`st-status rise ${verified ? 'st-status--ok' : 'st-status--wait'}`}>
                  <Icon svg={verified ? icons.shieldCheck() : icons.clock()} />
                  <span>
                    <b>{verified ? 'النطاق شغّال' : 'في انتظار سجلات الـDNS'}</b>
                    <small>
                      {verified ? (
                        <>
                          متجرك متاح على <bdi dir="ltr">{data.domain}</bdi>
                        </>
                      ) : (
                        'ضيف السجلات تحت في لوحة نطاقك، وبعدها اضغط تحقّق.'
                      )}
                    </small>
                  </span>
                </div>

                <Group title="سجلات الـDNS" lead="ادخل على لوحة تحكم الشركة اللي اشتريت منها النطاق، وضيف السجلات دي بالظبط.">
                  {data.records.map((r, i) => (
                    <div key={i} class="st-record">
                      <span class="st-record-head">
                        <span class="st-type">{r.type}</span>
                        {r.note}
                      </span>
                      <CopyValue label="الاسم" value={r.host} />
                      <CopyValue label="القيمة" value={r.value} />
                    </div>
                  ))}
                  <button type="button" class="btn btn--ghost press" disabled={Boolean(busy)} onClick={() => void run('verify')}>
                    {busy === 'verify' ? <span class="spinner" /> : <Icon svg={icons.refresh()} />}
                    تحقّق دلوقتي
                  </button>
                  <small class="pv-hint">
                    انتشار الـDNS بياخد من ١٠ دقايق لحد ٢٤ ساعة حسب شركة النطاق. لو ضفت السجلات وضغطت تحقّق وما اشتغلش، استنى شوية وجرّب تاني — مش لازم تعيد أي حاجة.
                  </small>
                </Group>
              </>
            )}
          </>
        )}
      </div>
    </Screen>
  )
}
