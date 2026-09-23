/**
 * حسابي — شاشة أصلية (`/dashboard/account`).
 *
 * نفس صفحة اللوحة و`AccountForms`: بياناتك (الاسم، الموبايل، البريد للعرض بس، معرّف الحساب بنسخ) + حفظ،
 * كلمة السر (الحالية، الجديدة، تأكيدها — ٨ حروف على الأقل)، متاجرك، وروابط الاشتراك والأجهزة وسجل النشاط.
 */
import { useState } from 'preact/hooks'
import { haptic, hapticNotify } from '../bridge'
import { toast } from '../dom'
import { icons } from '../icons'
import { formatNumber } from './format'
import { accountData } from './growth-api'
import { postAppJson, useResource } from './http'
import { navigate } from './navigate'
import { COPY_ICON, copyText } from './ops-api'
import { Screen } from './screen'
import { Group, LoadState, useSyncedForm } from './settings-forms'
import { Icon } from './ui'

const LINKS = [
  { href: '/dashboard/subscription', label: 'الاشتراك والباقة', hint: 'باقتك الحالية وتاريخ تجديدها', icon: icons.crown },
  { href: '/dashboard/settings/sessions', label: 'الأجهزة والجلسات', hint: 'مين داخل على حسابك دلوقتي — واقفل أي جهاز', icon: icons.keyRound },
  { href: '/dashboard/settings/activity', label: 'سجل النشاط', hint: 'كل إجراء حسّاس اتعمل على متجرك', icon: icons.clock },
]

export function AccountScreen({ visible, onUnavailable }: { visible: boolean; onUnavailable: () => void }) {
  const { data, failed, load } = useResource(accountData, visible, onUnavailable)
  const profile = useSyncedForm(data, (d) => ({ name: d.name, phone: d.phone }))
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const [busy, setBusy] = useState<'profile' | 'password' | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [pwError, setPwError] = useState<string | null>(null)
  const [pwDone, setPwDone] = useState(false)

  const saveProfile = async () => {
    const p = profile.form
    if (!p || busy) return
    haptic('LIGHT')
    setBusy('profile')
    setProfileError(null)
    const res = await postAppJson('/api/app/account/profile', p)
    if (!res.ok) {
      setBusy(null)
      hapticNotify('ERROR')
      setProfileError(res.error)
      return
    }
    profile.saved()
    await load()
    setBusy(null)
    hapticNotify('SUCCESS')
    toast('بياناتك اتحفظت', { tone: 'success', duration: 2200 })
  }

  const changePassword = async () => {
    if (busy) return
    setPwError(null)
    setPwDone(false)
    if (pw.next !== pw.confirm) {
      setPwError('الكلمتين الجديدتين مش زي بعض')
      return
    }
    if (pw.next.length < 8) {
      setPwError('كلمة السر الجديدة ٨ حروف على الأقل')
      return
    }
    haptic('LIGHT')
    setBusy('password')
    const res = await postAppJson('/api/app/account/password', { current: pw.current, next: pw.next })
    setBusy(null)
    if (!res.ok) {
      hapticNotify('ERROR')
      setPwError(res.error)
      return
    }
    hapticNotify('SUCCESS')
    setPw({ current: '', next: '', confirm: '' })
    setPwDone(true)
    toast('كلمة السر اتغيّرت', { tone: 'success', duration: 2200 })
  }

  const p = profile.form

  return (
    <Screen visible={visible} title="حسابي" onRefresh={load}>
      <div class="home-body">
        <header class="page-head rise">
          <div class="page-head-text">
            <h1 class="page-title">حسابي</h1>
            <p class="page-sub">بياناتك أنت — مش بيانات المتجر. التغيير هنا بيمشي على كل متاجرك.</p>
          </div>
        </header>

        {!data || !p ? (
          <LoadState failed={failed} what="حسابك" />
        ) : (
          <>
            <Group title="بياناتك">
              <label class="np-label">
                اسمك
                <input class="np-input" maxLength={80} value={p.name} onInput={(e) => profile.patch({ name: (e.currentTarget as HTMLInputElement).value })} />
              </label>
              <label class="np-label">
                موبايلك
                <input
                  class="np-input"
                  type="tel"
                  inputMode="tel"
                  dir="ltr"
                  maxLength={24}
                  value={p.phone}
                  onInput={(e) => profile.patch({ phone: (e.currentTarget as HTMLInputElement).value })}
                />
                <small class="pv-hint">بنستعمله لو احتجنا نوصلك</small>
              </label>
              <label class="np-label">
                البريد
                <input class="np-input" dir="ltr" value={data.email} disabled readOnly />
                <small class="pv-hint">مربوط بحسابك — كلّم الدعم لو محتاج تغيّره</small>
              </label>
              {data.publicId && (
                <div class="np-label">
                  معرّف حسابك
                  <div class="st-copy">
                    <bdi dir="ltr">{data.publicId}</bdi>
                    <button type="button" class="ops-icon press" aria-label="انسخ معرّف الحساب" onClick={() => void copyText(data.publicId!, 'اتنسخ')}>
                      <Icon svg={COPY_ICON} />
                    </button>
                  </div>
                  <small class="pv-hint">ابعته للدعم بدل ما تشرح — بيه بنلاقي حسابك على طول</small>
                </div>
              )}
              {profileError && <p class="np-error">{profileError}</p>}
              <button type="button" class="btn btn--primary press" disabled={Boolean(busy)} onClick={() => void saveProfile()}>
                {busy === 'profile' ? <span class="spinner" /> : <Icon svg={icons.check()} />}
                احفظ
              </button>
            </Group>

            <Group title="كلمة السر">
              <label class="np-label">
                كلمة السر الحالية
                <input class="np-input" type="password" autocomplete="current-password" value={pw.current} onInput={(e) => setPw({ ...pw, current: (e.currentTarget as HTMLInputElement).value })} />
              </label>
              <label class="np-label">
                كلمة السر الجديدة
                <input class="np-input" type="password" autocomplete="new-password" value={pw.next} onInput={(e) => setPw({ ...pw, next: (e.currentTarget as HTMLInputElement).value })} />
                <small class="pv-hint">٨ حروف على الأقل</small>
              </label>
              <label class="np-label">
                اكتبها تاني
                <input class="np-input" type="password" autocomplete="new-password" value={pw.confirm} onInput={(e) => setPw({ ...pw, confirm: (e.currentTarget as HTMLInputElement).value })} />
              </label>
              {pwError && <p class="np-error">{pwError}</p>}
              {pwDone && <p class="np-note st-ok">اتغيّرت. أجهزتك التانية لسه مفتوحة — اقفلها من صفحة الأجهزة لو محتاج.</p>}
              <button
                type="button"
                class="btn btn--primary press"
                disabled={Boolean(busy) || !pw.current || !pw.next || !pw.confirm}
                onClick={() => void changePassword()}
              >
                {busy === 'password' ? <span class="spinner" /> : <Icon svg={icons.keyRound()} />}
                غيّر كلمة السر
              </button>
            </Group>

            {data.stores.length > 0 && (
              <Group title={`متاجرك (${formatNumber(data.stores.length)})`}>
                <div class="card ops-list">
                  {data.stores.map((s) => (
                    <div key={s.id} class="bl-row">
                      <span class="bl-main">
                        <b>{s.name}</b>
                        <bdi dir="ltr">{s.slug}</bdi>
                      </span>
                    </div>
                  ))}
                </div>
              </Group>
            )}

            <div class="an-links rise">
              {LINKS.map((l) => (
                <button key={l.href} type="button" class="an-link press" onClick={() => (haptic('LIGHT'), navigate(l.href))}>
                  <Icon svg={l.icon()} />
                  <span>
                    {l.label}
                    <small>{l.hint}</small>
                  </span>
                  <Icon svg={icons.chevronLeft()} className="ic an-chev" />
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </Screen>
  )
}
