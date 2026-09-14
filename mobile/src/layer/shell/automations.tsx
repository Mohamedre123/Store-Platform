/**
 * الأتمتة — شاشة أصلية.
 *
 * - حالة القنوات: واتساب وتيليجرام مربوطين ولا لأ.
 * - «مين يتبلّغ»: مستقبلو إشعارات الطلبات لفريقك — تشغيل/إيقاف بدوسة، ولوحة فيها
 *   «ابعت إشعار تجريبي» والحذف بتأكيد.
 * - القواعد: «لما يحصل كذا ← اعمل كذا» بعدد مرات التشغيل — تشغيل/إيقاف، ولوحة بالتفاصيل
 *   والحذف بتأكيد.
 *
 * إضافة مستقبِل أو بناء قاعدة (شروط وإجراءات) من صفحة المنصة.
 */
import { useState } from 'preact/hooks'
import { haptic, hapticNotify } from '../bridge'
import { toast } from '../dom'
import { icons } from '../icons'
import { formatDateTime, formatNumber } from './format'
import { postAppJson, useResource } from './http'
import { navigate } from './navigate'
import { automationsData, type AutomationRecipient, type AutomationRule } from './ops-api'
import { Screen, Sheet } from './screen'
import { Icon } from './ui'

const ZAP =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>'

const CHANNEL_ICON: Record<string, () => string> = {
  whatsapp: icons.messageCircle,
  email: icons.mail,
  sms: icons.phone,
  telegram: icons.send,
}

export function AutomationsScreen({ visible, onUnavailable }: { visible: boolean; onUnavailable: () => void }) {
  const { data, failed, load } = useResource(automationsData, visible, onUnavailable)
  const [busy, setBusy] = useState<string | null>(null)
  const [recipient, setRecipient] = useState<AutomationRecipient | null>(null)
  const [rule, setRule] = useState<AutomationRule | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const post = async (key: string, url: string, body: object, done: string) => {
    if (busy) return false
    haptic('LIGHT')
    setBusy(key)
    const res = await postAppJson(url, body)
    if (!res.ok) {
      setBusy(null)
      hapticNotify('ERROR')
      toast(res.error, { tone: 'danger', duration: 4000 })
      return false
    }
    await load()
    setBusy(null)
    hapticNotify('SUCCESS')
    toast(done, { tone: 'success', duration: 2200 })
    return true
  }

  const openWeb = () => {
    haptic('LIGHT')
    navigate('/dashboard/automations?web=1')
  }

  const close = () => {
    setRecipient(null)
    setRule(null)
    setConfirmDelete(false)
  }

  const enabledRules = data?.rules.filter((r) => r.enabled).length ?? 0

  return (
    <Screen visible={visible} title="الأتمتة" onRefresh={load}>
      <div class="home-body">
        <header class="page-head rise">
          <div class="page-head-text">
            <h1 class="page-title">الأتمتة</h1>
            <p class="page-sub">
              {data?.rules.length ? `${formatNumber(enabledRules)} قاعدة شغّالة من ${formatNumber(data.rules.length)}` : 'خلّي المنصة تعمل الشغل المتكرّر عنك'}
            </p>
          </div>
        </header>

        {!data ? (
          failed ? (
            <div class="empty">
              <span class="empty-icon">
                <Icon svg={icons.wifiOff()} />
              </span>
              <b>مش قادرين نجيب الأتمتة</b>
              <p>اتأكد من النت واسحب لتحت عشان تحاول تاني.</p>
            </div>
          ) : (
            <div class="olist">
              <span class="sk" style="height:80px;border-radius:20px" />
              <span class="sk" style="height:160px;border-radius:20px" />
            </div>
          )
        ) : (
          <>
            <div class="au-channels rise">
              <span class={`au-ch${data.whatsappReady ? ' au-ch--on' : ''}`}>
                <Icon svg={icons.messageCircle()} />
                واتساب {data.whatsappReady ? 'مربوط' : 'مش مربوط'}
              </span>
              <span class={`au-ch${data.telegramReady ? ' au-ch--on' : ''}`}>
                <Icon svg={icons.send()} />
                تيليجرام {data.telegramReady ? 'مربوط' : 'مش مربوط'}
              </span>
            </div>
            {!data.whatsappReady && <p class="fine">القواعد اللي بتبعت واتساب مش هتبعت لحد ما تربطه من «الإعدادات ← واتساب».</p>}

            <div class="mk-sec">
              <b>مين يتبلّغ</b>
              <small>إشعارات لفريقك — كل واحد بيوصله اللي يخصّه بس</small>
            </div>
            {data.recipients.length === 0 ? (
              <p class="np-note rise">مفيش حد بيتبلّغ بالطلبات. ضيف رقمك أو تيليجرام فريقك من صفحة الأتمتة الكاملة.</p>
            ) : (
              <div class="card ops-list rise">
                {data.recipients.map((r) => (
                  <div key={r.id} class={`bl-row bg-row${r.isActive ? '' : ' bg-row--draft'}`}>
                    <button
                      type="button"
                      class="bg-open press"
                      onClick={() => {
                        haptic('LIGHT')
                        setConfirmDelete(false)
                        setRecipient(r)
                      }}
                    >
                      <span class="cr-icon cr-icon--sm">
                        <Icon svg={(CHANNEL_ICON[r.channel] ?? icons.bell)()} />
                      </span>
                      <span class="bl-main">
                        <b>{r.name || r.channelLabel}</b>
                        <bdi dir="ltr">{r.target}</bdi>
                        <small>{r.eventsLabel}</small>
                      </span>
                    </button>
                    <button
                      type="button"
                      class="switch-btn"
                      role="switch"
                      aria-checked={r.isActive}
                      aria-label={r.isActive ? 'إيقاف الإشعارات' : 'تشغيل الإشعارات'}
                      onClick={() => void post(`rt-${r.id}`, `/api/app/automations/recipients/${encodeURIComponent(r.id)}/toggle`, { isActive: !r.isActive }, r.isActive ? 'الإشعارات اتوقّفت' : 'الإشعارات اشتغلت')}
                    >
                      <span class={`switch${r.isActive ? ' switch--on' : ''}${busy === `rt-${r.id}` ? ' switch--busy' : ''}`}>
                        <span />
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div class="mk-sec">
              <b>القواعد</b>
              <small>لما يحصل كذا ← اعمل كذا</small>
            </div>
            {data.rules.length === 0 ? (
              <div class="empty empty--compact rise">
                <span class="empty-icon">
                  <Icon svg={ZAP} />
                </span>
                <b>مافيش قواعد</b>
                <p>زي: رحّب بالعميل الجديد بكوبون، أو اشكره بعد التسليم — ابنيها من صفحة الأتمتة الكاملة.</p>
              </div>
            ) : (
              <div class="card ops-list rise">
                {data.rules.map((r) => (
                  <div key={r.id} class={`bl-row bg-row${r.enabled ? '' : ' bg-row--draft'}`}>
                    <button
                      type="button"
                      class="bg-open press"
                      onClick={() => {
                        haptic('LIGHT')
                        setConfirmDelete(false)
                        setRule(r)
                      }}
                    >
                      <span class="cr-icon cr-icon--sm">
                        <Icon svg={ZAP} />
                      </span>
                      <span class="bl-main">
                        <b>{r.name}</b>
                        <small>
                          {r.triggerLabel} ← {r.actions.join('، ') || '—'}
                          {r.runCount ? ` · اشتغلت ${formatNumber(r.runCount)} مرة` : ''}
                        </small>
                      </span>
                    </button>
                    <button
                      type="button"
                      class="switch-btn"
                      role="switch"
                      aria-checked={r.enabled}
                      aria-label={r.enabled ? 'إيقاف القاعدة' : 'تشغيل القاعدة'}
                      onClick={() => void post(`ru-${r.id}`, `/api/app/automations/rules/${encodeURIComponent(r.id)}/toggle`, { enabled: !r.enabled }, r.enabled ? 'القاعدة اتوقّفت' : 'القاعدة اشتغلت')}
                    >
                      <span class={`switch${r.enabled ? ' switch--on' : ''}${busy === `ru-${r.id}` ? ' switch--busy' : ''}`}>
                        <span />
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button type="button" class="an-link press rise au-web" onClick={openWeb}>
              <Icon svg={icons.plus()} />
              <span>
                ضيف مستقبِل أو ابني قاعدة
                <small>الشروط والإجراءات من صفحة الأتمتة الكاملة</small>
              </span>
              <Icon svg={icons.chevronLeft()} className="ic an-chev" />
            </button>
          </>
        )}
      </div>

      <Sheet open={Boolean(recipient)} title={recipient ? recipient.name || recipient.channelLabel : ''} onClose={close}>
        {recipient && (
          <div class="np-form ops-form">
            <p class="sheet-text">
              {recipient.channelLabel} · <bdi dir="ltr">{recipient.target}</bdi>
              <br />
              بيتبلّغ بـ: {recipient.eventsLabel}
            </p>
            <button
              type="button"
              class="btn btn--primary press"
              disabled={Boolean(busy)}
              onClick={() => void post('test', `/api/app/automations/recipients/${encodeURIComponent(recipient.id)}/test`, {}, 'الإشعار التجريبي اتبعت — شوف الموبايل')}
            >
              {busy === 'test' ? <span class="spinner" /> : <Icon svg={icons.send()} />}
              ابعت إشعار تجريبي
            </button>
            <p class="fine center">بيمشي في نفس المسار الحقيقي — لو وصلك، إشعارات الطلبات هتوصل.</p>
            {confirmDelete ? (
              <div class="ex-confirm">
                <p class="sheet-text">هيبطّل يوصله أي إشعار. متأكد؟</p>
                <div class="btn-row">
                  <button type="button" class="btn btn--ghost press" onClick={() => setConfirmDelete(false)}>
                    رجوع
                  </button>
                  <button
                    type="button"
                    class="btn btn--danger press"
                    disabled={Boolean(busy)}
                    onClick={async () => {
                      const ok = await post('delete', `/api/app/automations/recipients/${encodeURIComponent(recipient.id)}/delete`, {}, 'اتشال من الإشعارات')
                      if (ok) close()
                    }}
                  >
                    أيوه، شيله
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" class="btn btn--ghost btn--danger-text press" onClick={() => setConfirmDelete(true)}>
                <Icon svg={icons.trash()} />
                شيله من الإشعارات
              </button>
            )}
          </div>
        )}
      </Sheet>

      <Sheet open={Boolean(rule)} tall title={rule?.name ?? ''} onClose={close}>
        {rule && (
          <div class="np-form ops-form">
            <div class="au-flow">
              <span class="au-step">
                <small>لما</small>
                <b>{rule.triggerLabel}</b>
              </span>
              {rule.conditions.length > 0 && (
                <span class="au-step">
                  <small>وكمان</small>
                  {rule.conditions.map((c) => (
                    <b key={c}>{c}</b>
                  ))}
                </span>
              )}
              <span class="au-step au-step--do">
                <small>اعمل</small>
                {rule.actions.map((a) => (
                  <b key={a}>{a}</b>
                ))}
              </span>
            </div>
            <p class="fine center">
              {rule.runCount ? `اشتغلت ${formatNumber(rule.runCount)} مرة` : 'لسه ما اشتغلتش'}
              {rule.lastRunAt ? ` · آخرها ${formatDateTime(rule.lastRunAt)}` : ''}
              {rule.cooldownHours ? ` · مرة كل ${formatNumber(rule.cooldownHours)} ساعة لنفس العميل بالكتير` : ''}
            </p>
            <button type="button" class="btn btn--ghost press" onClick={openWeb}>
              <Icon svg={icons.pencil()} />
              عدّل الشروط والإجراءات
            </button>
            {confirmDelete ? (
              <div class="ex-confirm">
                <p class="sheet-text">هتحذف القاعدة دي نهائيًا.</p>
                <div class="btn-row">
                  <button type="button" class="btn btn--ghost press" onClick={() => setConfirmDelete(false)}>
                    رجوع
                  </button>
                  <button
                    type="button"
                    class="btn btn--danger press"
                    disabled={Boolean(busy)}
                    onClick={async () => {
                      const ok = await post('delete', `/api/app/automations/rules/${encodeURIComponent(rule.id)}/delete`, {}, 'القاعدة اتحذفت')
                      if (ok) close()
                    }}
                  >
                    أيوه، احذفها
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" class="btn btn--ghost btn--danger-text press" onClick={() => setConfirmDelete(true)}>
                <Icon svg={icons.trash()} />
                احذف القاعدة
              </button>
            )}
          </div>
        )}
      </Sheet>
    </Screen>
  )
}
