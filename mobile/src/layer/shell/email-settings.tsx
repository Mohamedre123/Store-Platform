/**
 * بريد المتجر — شاشة أصلية (`/dashboard/settings/email`).
 *
 * نفس `EmailPanel` في اللوحة: المرسِل والرد بالظبط (وليه البريد المجاني اتشال من الرد)، تنبيه لو خدمة البريد مش
 * مضبوطة، سجلات نطاق الإرسال بحالتها، ورسالة تجريبية لأي عنوان بنفس قالب رسايل العملاء + تحذير «جرّب بحساب».
 */
import { useState } from 'preact/hooks'
import { haptic, hapticNotify } from '../bridge'
import { icons } from '../icons'
import { postAppJson, useResource } from './http'
import { Screen } from './screen'
import { Group, LoadState } from './settings-forms'
import { emailData } from './store-settings-api'
import { Icon } from './ui'

export function EmailSettingsScreen({ visible, onUnavailable }: { visible: boolean; onUnavailable: () => void }) {
  const { data, failed, load } = useResource(emailData, visible, onUnavailable)
  const [to, setTo] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  const send = async () => {
    if (busy || !to.includes('@')) return
    haptic('LIGHT')
    setBusy(true)
    setResult(null)
    const res = await postAppJson<{ message: string }>('/api/app/email/test', { to })
    setBusy(false)
    if (res.ok) {
      hapticNotify('SUCCESS')
      setResult({ ok: true, text: res.data.message })
    } else {
      hapticNotify('ERROR')
      setResult({ ok: false, text: res.error })
    }
  }

  return (
    <Screen visible={visible} title="بريد المتجر" onRefresh={load}>
      <div class="home-body">
        <header class="page-head rise">
          <div class="page-head-text">
            <h1 class="page-title">بريد المتجر</h1>
            <p class="page-sub">من فين بتخرج رسايلك، وإزاي تخلّيها توصل الوارد مش السبام.</p>
          </div>
        </header>

        {!data ? (
          <LoadState failed={failed} what="إعدادات البريد" />
        ) : (
          <>
            <Group title="رسايلك بتخرج إزاي دلوقتي" lead="ده اللي العميل بيشوفه في بريده بالظبط.">
              <div class="st-dl">
                <div>
                  <small>المرسِل</small>
                  <code>{data.from}</code>
                </div>
                <div>
                  <small>الرد يروح لـ</small>
                  <code>{data.replyTo ?? '—'}</code>
                  {data.replyToDropped && (
                    <p class="st-risk st-risk--warn">
                      <Icon svg={icons.alertTriangle()} />
                      <span>
                        بريد متجرك على خدمة مجانية (جيميل مثلًا)، فشيلناه من ترويسة الرد: «مرسِل على نطاق ورد على نطاق تاني» بصمة تصيّد بتودّي الرسالة السبام.
                        بريدك مكتوب في تذييل كل رسالة فالعميل لسه يقدر يكلّمك.
                      </span>
                    </p>
                  )}
                </div>
              </div>

              {!data.configured && <p class="np-note st-danger">خدمة البريد مش مضبوطة على المنصة — مفيش أي رسالة بتخرج.</p>}

              <div class="st-sep">
                <b>سجلات نطاق الإرسال</b>
                <ul class="st-dns">
                  {data.dns.map((r) => (
                    <li key={r.name + r.label}>
                      <span class={`st-dot ${r.found ? 'st-dot--ok' : 'st-dot--no'}`}>
                        <Icon svg={r.found ? icons.check() : icons.x()} />
                      </span>
                      <span>
                        <b>{r.label}</b>
                        <code>{r.found ?? 'مش موجود'}</code>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </Group>

            <Group
              title="ابعت رسالة تجريبية"
              lead="بنفس القالب وبنفس الترويسات اللي بتروح لعملائك. جرّب على عنوان مش بتاعك عشان النتيجة تبقى حقيقية — بريدك إنت جيميل بيثق فيه أصلًا."
            >
              <div class="st-inline">
                <input
                  class="np-input"
                  type="email"
                  inputMode="email"
                  dir="ltr"
                  placeholder="test@example.com"
                  aria-label="عنوان التجربة"
                  value={to}
                  onInput={(e) => setTo((e.currentTarget as HTMLInputElement).value)}
                />
                <button type="button" class="btn btn--primary press" disabled={busy || !to.includes('@')} onClick={() => void send()}>
                  {busy ? <span class="spinner" /> : <Icon svg={icons.send()} />}
                  ابعت
                </button>
              </div>

              <p class="np-note st-warn">
                <b>جرّب بحساب، مش كل شوية.</b> كل رسالة تجريبية بتقع في السبام وتتساب هناك بتقلّل ثقة جيميل في مرسِلك. لو رسالة راحت السبام، ادوس عليها{' '}
                <b>«ليست غير مرغوب فيها»</b> قبل ما تجرّب تاني — وإلا كل تجربة بتخلّي الوضع أسوأ.
              </p>

              {result && <p class={`np-note ${result.ok ? 'st-ok' : 'st-danger'}`}>{result.text}</p>}
            </Group>
          </>
        )}
      </div>
    </Screen>
  )
}
