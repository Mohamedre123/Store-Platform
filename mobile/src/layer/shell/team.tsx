/**
 * الفريق — شاشة أصلية (`/dashboard/settings/team`).
 *
 * نفس `TeamManager` في اللوحة: الأعضاء بدورهم وصلاحياتهم (سطر ملخّص)، «إنت»، «موقوف»؛ للي يدير الفريق:
 * «ضيف عضو» (البريد، الدور، القوالب الجاهزة، الصلاحيات) ← رابط الدعوة (انسخ / واتساب) وبيتبعت على البريد،
 * دوسة على عضو = لوحة الدور والصلاحيات والإيقاف/الرجوع، والدعوات المستنية بـ«ابعت تاني» و«ألغِ».
 */
import { useState } from 'preact/hooks'
import { haptic, hapticNotify } from '../bridge'
import { toast } from '../dom'
import { icons } from '../icons'
import { postAppJson, useResource } from './http'
import { COPY_ICON, copyText } from './ops-api'
import { Screen, Sheet } from './screen'
import { teamData, type Perm, type TeamMember } from './settings-api'
import { Icon } from './ui'

type Fresh = { url: string; emailed: boolean }

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('ar-EG')
type InviteForm = { email: string; role: 'admin' | 'staff'; permissions: string[] }

const SHIELD_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>'

/** وصف مختصر للصلاحيات المفتوحة — نفس `summarize` في اللوحة */
function summarize(perms: Perm[], permissions: string[]): string {
  if (permissions.length === 0) return 'صلاحيات الدور الافتراضية'
  const labels = perms.filter((p) => permissions.includes(p.key)).map((p) => p.label)
  if (labels.length === 0) return 'مفيش صلاحيات مفتوحة'
  if (labels.length <= 3) return labels.join(' · ')
  return `${labels.slice(0, 3).join(' · ')} و${labels.length - 3} غيرها`
}

function PermissionGrid({ perms, value, onChange }: { perms: Perm[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div class="np-label">
      يقدر يعمل إيه
      <div class="tm-perms">
        {perms.map((p) => {
          const on = value.includes(p.key)
          const risky = p.key === 'finance.view' || p.key === 'team.manage'
          return (
            <button
              key={p.key}
              type="button"
              class={`tm-perm${on ? ' tm-perm--on' : ''}`}
              aria-pressed={on}
              onClick={() => {
                haptic('LIGHT')
                onChange(on ? value.filter((k) => k !== p.key) : [...value, p.key])
              }}
            >
              <span class="tm-check">{on && <Icon svg={icons.check()} />}</span>
              <span class="tm-perm-text">
                <b>
                  {p.label}
                  {risky && (
                    <span class="tm-risky" aria-label="صلاحية حسّاسة">
                      <Icon svg={SHIELD_ICON} />
                    </span>
                  )}
                </b>
                <small>{p.hint}</small>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function TeamScreen({ visible, onUnavailable }: { visible: boolean; onUnavailable: () => void }) {
  const { data, failed, load } = useResource(teamData, visible, onUnavailable)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fresh, setFresh] = useState<Fresh | null>(null)
  const [invite, setInvite] = useState<InviteForm | null>(null)
  const [member, setMember] = useState<{ m: TeamMember; role: 'admin' | 'staff'; permissions: string[] } | null>(null)
  const [confirmBlock, setConfirmBlock] = useState(false)

  const call = async <T,>(key: string, url: string, body: object, sheet: boolean): Promise<T | null> => {
    if (busy) return null
    haptic('LIGHT')
    setBusy(key)
    setError(null)
    const res = await postAppJson<T>(url, body)
    if (!res.ok) {
      setBusy(null)
      hapticNotify('ERROR')
      if (sheet) setError(res.error)
      else toast(res.error, { tone: 'danger', duration: 4000 })
      return null
    }
    await load()
    setBusy(null)
    hapticNotify('SUCCESS')
    return res.data
  }

  const perms = data?.permissions ?? []

  const waUrl = (url: string) =>
    `https://wa.me/?text=${encodeURIComponent(`اتدعيت تنضم لفريق المتجر 👋\nافتح الرابط ده — لو معندكش حساب هتعمل واحد في دقيقة، ولو عندك سجّل دخول:\n${url}`)}`

  return (
    <Screen visible={visible} title="الفريق" onRefresh={load}>
      <div class="home-body">
        <header class="page-head rise">
          <div class="page-head-text">
            <h1 class="page-title">الفريق</h1>
            <p class="page-sub">مين بيدخل لوحتك ويقدر يعمل إيه. كل تغيير بيتسجّل في سجل النشاط باسم صاحبه.</p>
          </div>
        </header>

        {!data ? (
          failed ? (
            <div class="empty">
              <span class="empty-icon">
                <Icon svg={icons.wifiOff()} />
              </span>
              <b>مش قادرين نجيب الفريق</b>
              <p>اتأكد من النت واسحب لتحت عشان تحاول تاني.</p>
            </div>
          ) : (
            <div class="olist">
              <span class="sk" style="height:180px;border-radius:20px" />
            </div>
          )
        ) : (
          <>
            {fresh && (
              <div class="card pv-card tm-fresh rise">
                <b>الرابط جاهز — ابعتهوله</b>
                <p class="page-sub">
                  {fresh.emailed ? 'وبعتناله الدعوة على بريده كمان. ' : 'ما قدرناش نبعت الدعوة على بريده دلوقتي — ابعتله الرابط بنفسك. '}
                  الرابط شغّال أسبوع ومربوط ببريده: لو معندوش حساب هيعمل واحد في دقيقة، ولو عنده هيسجّل دخول وينضم.
                </p>
                <div class="pv-code">
                  <code>{fresh.url}</code>
                </div>
                <div class="pst-actions">
                  <button type="button" class="btn btn--primary press" onClick={() => void copyText(fresh.url, 'الرابط اتنسخ')}>
                    <Icon svg={COPY_ICON} />
                    انسخ
                  </button>
                  <button type="button" class="act act--wa press" onClick={() => location.assign(waUrl(fresh.url))}>
                    واتساب
                  </button>
                  <button type="button" class="ops-icon press" aria-label="إخفاء" onClick={() => setFresh(null)}>
                    <Icon svg={icons.x()} />
                  </button>
                </div>
              </div>
            )}

            {data.canManage && (
              <button
                type="button"
                class="btn btn--primary btn--lg press rise ops-add"
                onClick={() => {
                  haptic('LIGHT')
                  setError(null)
                  setInvite({ email: '', role: 'staff', permissions: ['orders.view', 'orders.manage', 'products.view'] })
                }}
              >
                <Icon svg={icons.plus()} />
                ضيف عضو للفريق
              </button>
            )}

            <div class="card ops-list rise">
              {data.members.map((m) => {
                const editable = data.canManage && m.role !== 'owner'
                return (
                  <div key={m.id} class="bl-row">
                    <button
                      type="button"
                      class="bg-open press"
                      disabled={!editable}
                      onClick={() => {
                        haptic('LIGHT')
                        setError(null)
                        setConfirmBlock(false)
                        setMember({ m, role: m.role === 'admin' ? 'admin' : 'staff', permissions: m.permissions })
                      }}
                    >
                      <span class="tm-avatar">{m.name.trim().slice(0, 2) || '؟'}</span>
                      <span class="bl-main">
                        <b>
                          {m.name}
                          <span class={`pst-pill ${m.role === 'owner' ? 'pst-pill--primary' : 'pst-pill--muted'}`}>{data.roleLabels[m.role] ?? m.role}</span>
                          {m.userId === data.currentUserId && <span class="tm-you">(إنت)</span>}
                          {m.isBlocked && <span class="pst-pill pst-pill--bad">موقوف</span>}
                        </b>
                        <small>
                          <bdi dir="ltr">{m.email}</bdi>
                        </small>
                        <small>
                          {m.role === 'owner' ? 'المالك عنده كل حاجة، وصلاحياته ما بتتغيّرش.' : summarize(perms, m.permissions)}
                        </small>
                      </span>
                    </button>
                  </div>
                )
              })}
            </div>

            {data.invites.length > 0 && (
              <>
                <div class="pv-sec rise">
                  <h2>دعوات مستنية</h2>
                </div>
                <div class="card ops-list rise">
                  {data.invites.map((i) => (
                    <div key={i.id} class="bl-row tm-invite">
                      <span class="bl-main">
                        <b>
                          <bdi dir="ltr">{i.email}</bdi>
                        </b>
                        <small>
                          {i.roleLabel} · بتنتهي {formatDate(i.expiresAt)}
                        </small>
                      </span>
                      {data.canManage && (
                        <span class="tm-invite-actions">
                          <button
                            type="button"
                            class="act press"
                            disabled={Boolean(busy)}
                            onClick={async () => {
                              const res = await call<Fresh & { inviteUrl: string }>(`resend-${i.id}`, `/api/app/team/invites/${encodeURIComponent(i.id)}/resend`, {}, false)
                              if (!res?.inviteUrl) return
                              setFresh({ url: res.inviteUrl, emailed: res.emailed })
                              toast(res.emailed ? 'اتبعتت تاني على بريده' : 'رابط جديد جاهز — ابعته بنفسك', { tone: 'success' })
                            }}
                          >
                            {busy === `resend-${i.id}` ? <span class="spinner" /> : null}
                            ابعت تاني
                          </button>
                          <button
                            type="button"
                            class="act act--danger press"
                            disabled={Boolean(busy)}
                            onClick={async () => {
                              const res = await call(`cancel-${i.id}`, `/api/app/team/invites/${encodeURIComponent(i.id)}/cancel`, {}, false)
                              if (res) toast('الدعوة اتلغت', { tone: 'success', duration: 2000 })
                            }}
                          >
                            ألغِ
                          </button>
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {!data.canManage && <p class="np-note pst-gap tm-note">إدارة الفريق للمالك بس. لو محتاج تغيير، كلّم صاحب المتجر.</p>}
          </>
        )}
      </div>

      <Sheet open={Boolean(invite)} tall title="عضو جديد" onClose={() => setInvite(null)}>
        {invite && data && (
          <form
            class="np-form ops-form"
            onSubmit={async (e) => {
              e.preventDefault()
              const res = await call<{ inviteUrl: string; emailed: boolean }>('invite', '/api/app/team/invite', invite, true)
              if (!res?.inviteUrl) return
              setInvite(null)
              setFresh({ url: res.inviteUrl, emailed: res.emailed })
              toast(res.emailed ? 'الدعوة اتبعتت على بريده' : 'رابط الدعوة جاهز', { tone: 'success' })
            }}
          >
            <label class="np-label">
              بريده
              <input
                class="np-input"
                type="email"
                inputMode="email"
                dir="ltr"
                placeholder="staff@example.com"
                value={invite.email}
                onInput={(e) => setInvite({ ...invite, email: (e.currentTarget as HTMLInputElement).value })}
              />
              <small class="pv-hint">هنبعتله الدعوة على البريد ده، وتقدر كمان تبعتله الرابط على واتساب. أي حد يفتح الرابط ببريد تاني بيترفض.</small>
            </label>

            <div class="np-label">
              الدور
              <div class="sc-options sc-options--row">
                {(
                  [
                    { value: 'staff', label: 'موظف', hint: 'بتحدّد له كل صلاحية بإيدك' },
                    { value: 'admin', label: 'مدير', hint: 'كل حاجة عدا الفريق والاشتراك' },
                  ] as const
                ).map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    class={`sc-option${invite.role === o.value ? ' sc-option--on' : ''}`}
                    onClick={() => {
                      haptic('LIGHT')
                      setInvite({
                        ...invite,
                        role: o.value,
                        permissions: o.value === 'admin' ? perms.filter((p) => p.key !== 'team.manage').map((p) => p.key) : invite.permissions,
                      })
                    }}
                  >
                    <b>{o.label}</b>
                    <small>{o.hint}</small>
                  </button>
                ))}
              </div>
            </div>

            <div class="np-label">
              قوالب جاهزة
              <div class="chips">
                {data.presets.map((p) => (
                  <button key={p.key} type="button" class="fchip" onClick={() => (haptic('LIGHT'), setInvite({ ...invite, role: p.role, permissions: [...p.permissions] }))}>
                    {p.label}
                  </button>
                ))}
              </div>
              <small class="pv-hint">اختار الأقرب وبعدين عدّل اللي تحته لو محتاج.</small>
            </div>

            <PermissionGrid perms={perms} value={invite.permissions} onChange={(permissions) => setInvite({ ...invite, permissions })} />

            {error && <p class="np-error">{error}</p>}
            <div class="btn-row pv-sticky">
              <button type="button" class="btn btn--ghost press" onClick={() => setInvite(null)}>
                رجوع
              </button>
              <button type="submit" class="btn btn--primary press" disabled={Boolean(busy)}>
                {busy === 'invite' ? <span class="spinner" /> : <Icon svg={icons.check()} />}
                اعمل رابط الدعوة
              </button>
            </div>
          </form>
        )}
      </Sheet>

      <Sheet open={Boolean(member)} tall title={member?.m.name ?? ''} onClose={() => setMember(null)}>
        {member && data && (
          <div class="np-form ops-form">
            <div class="np-label">
              الدور
              <div class="chips">
                {(['staff', 'admin'] as const).map((r) => (
                  <button key={r} type="button" class={`fchip${member.role === r ? ' fchip--on' : ''}`} onClick={() => (haptic('LIGHT'), setMember({ ...member, role: r }))}>
                    {data.roleLabels[r]}
                  </button>
                ))}
              </div>
            </div>

            <PermissionGrid perms={perms} value={member.permissions} onChange={(permissions) => setMember({ ...member, permissions })} />

            {error && <p class="np-error">{error}</p>}
            <div class="btn-row">
              <button type="button" class="btn btn--ghost press" onClick={() => setMember(null)}>
                رجوع
              </button>
              <button
                type="button"
                class="btn btn--primary press"
                disabled={Boolean(busy)}
                onClick={async () => {
                  const res = await call(`update`, `/api/app/team/members/${encodeURIComponent(member.m.id)}/update`, { role: member.role, permissions: member.permissions }, true)
                  if (!res) return
                  setMember(null)
                  toast('اتحفظ', { tone: 'success', duration: 2000 })
                }}
              >
                {busy === 'update' ? <span class="spinner" /> : <Icon svg={icons.check()} />}
                احفظ
              </button>
            </div>

            {confirmBlock ? (
              <div class="ex-confirm">
                <p class="sheet-text">
                  {member.m.isBlocked
                    ? `«${member.m.name}» هيرجع يدخل اللوحة بصلاحياته.`
                    : `«${member.m.name}» مش هيقدر يدخل اللوحة. بيفضل في القايمة، وكل اللي عمله قبل كده بيفضل متسجّل باسمه.`}
                </p>
                <div class="btn-row">
                  <button type="button" class="btn btn--ghost press" onClick={() => setConfirmBlock(false)}>
                    رجوع
                  </button>
                  <button
                    type="button"
                    class={`btn ${member.m.isBlocked ? 'btn--primary' : 'btn--danger'} press`}
                    disabled={Boolean(busy)}
                    onClick={async () => {
                      const res = await call('block', `/api/app/team/members/${encodeURIComponent(member.m.id)}/block`, { blocked: !member.m.isBlocked }, true)
                      if (!res) return
                      toast(member.m.isBlocked ? 'رجع يشتغل' : 'اتوقف', { tone: 'success', duration: 2000 })
                      setMember(null)
                    }}
                  >
                    {busy === 'block' ? <span class="spinner" /> : null}
                    {member.m.isBlocked ? 'أيوه، رجّعه' : 'أيوه، وقّفه'}
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" class={`btn btn--ghost press${member.m.isBlocked ? '' : ' btn--danger-text'}`} onClick={() => setConfirmBlock(true)}>
                {member.m.isBlocked ? 'رجّعه' : 'وقّفه'}
              </button>
            )}
          </div>
        )}
      </Sheet>
    </Screen>
  )
}
