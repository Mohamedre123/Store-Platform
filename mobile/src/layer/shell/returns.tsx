/**
 * المرتجعات — شاشة أصلية.
 *
 * كل طلب إرجاع أو استبدال: رقمه وطلبه وعميله، السبب وكلام العميل، ومبلغ
 * الاسترداد. الحالة بتتغيّر من لوحة تحت بخطوات الإرجاع (نفس خطوات
 * اللوحة)، وملاحظة داخلية، واتصال بالعميل بدوسة.
 */
import { useMemo, useState } from 'preact/hooks'
import { haptic, hapticNotify } from '../bridge'
import { toast } from '../dom'
import { icons } from '../icons'
import { returnsData, type ReturnsPayload } from './business-api'
import { formatDateTime, formatNumber } from './format'
import { postAppJson, useResource } from './http'
import { Screen, Sheet } from './screen'
import { Icon } from './ui'

type Item = ReturnsPayload['returns'][number]

export function ReturnsScreen({ visible, onUnavailable }: { visible: boolean; onUnavailable: () => void }) {
  const { data, failed, load } = useResource(returnsData, visible, onUnavailable)
  const [onlyOpen, setOnlyOpen] = useState(true)
  const [busy, setBusy] = useState(false)
  const [statusFor, setStatusFor] = useState<Item | null>(null)
  const [noteFor, setNoteFor] = useState<{ item: Item; text: string } | null>(null)

  const list = useMemo(() => {
    const all = data?.returns ?? []
    return onlyOpen ? all.filter((r) => r.status !== 'completed' && r.status !== 'rejected') : all
  }, [data, onlyOpen])

  const post = async (id: string, action: 'status' | 'note', body: object, done: string) => {
    if (busy) return false
    setBusy(true)
    const res = await postAppJson(`/api/app/returns/${encodeURIComponent(id)}/${action}`, body)
    setBusy(false)
    if (!res.ok) {
      hapticNotify('ERROR')
      toast(res.error, { tone: 'danger' })
      return false
    }
    hapticNotify('SUCCESS')
    toast(done, { tone: 'success', duration: 1800 })
    await load()
    return true
  }

  return (
    <Screen visible={visible} title="المرتجعات" onRefresh={load}>
      <div class="home-body">
        <header class="page-head rise">
          <div class="page-head-text">
            <h1 class="page-title">المرتجعات</h1>
            <p class="page-sub">
              {data && data.open > 0 ? `${formatNumber(data.open)} طلب إرجاع محتاج إجراء منك` : 'طلبات الإرجاع والاستبدال من عملائك'}
            </p>
          </div>
        </header>

        {!data ? (
          failed ? (
            <div class="empty">
              <span class="empty-icon">
                <Icon svg={icons.wifiOff()} />
              </span>
              <b>مش قادرين نجيب المرتجعات</b>
              <p>اتأكد من النت واسحب لتحت عشان تحاول تاني.</p>
            </div>
          ) : (
            <div class="olist">
              {[0, 1, 2].map((i) => (
                <span key={i} class="sk" style="height:150px;border-radius:20px" />
              ))}
            </div>
          )
        ) : data.returns.length === 0 ? (
          <div class="empty rise">
            <span class="empty-icon">
              <Icon svg={icons.refresh()} />
            </span>
            <b>مافيش مرتجعات</b>
            <p>العميل بيقدر يطلب إرجاع من صفحة طلبه بعد ما يتسلّم.</p>
          </div>
        ) : (
          <>
            <div class="frail" role="tablist" aria-label="فلترة المرتجعات">
              <button
                type="button"
                role="tab"
                aria-selected={onlyOpen}
                class={`fchip${onlyOpen ? ' fchip--on' : ''}${data.open > 0 ? ' fchip--warn' : ''}`}
                onClick={() => {
                  haptic('LIGHT')
                  setOnlyOpen(true)
                }}
              >
                محتاجة إجراء
                {data.open > 0 && <span class="fchip-n">{formatNumber(data.open)}</span>}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={!onlyOpen}
                class={`fchip${!onlyOpen ? ' fchip--on' : ''}`}
                onClick={() => {
                  haptic('LIGHT')
                  setOnlyOpen(false)
                }}
              >
                الكل
                <span class="fchip-n">{formatNumber(data.returns.length)}</span>
              </button>
            </div>

            {list.length === 0 ? (
              <div class="empty empty--compact rise">
                <b>مفيش مرتجعات محتاجة إجراء</b>
                <p>كله اتقفل — شوف «الكل» للمرتجعات القديمة.</p>
              </div>
            ) : (
              <div class="olist">
                {list.map((r, i) => (
                  <article key={r.id} class="ocard rise" style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}>
                    <div class="ocard-top">
                      <span class="ocard-no num">مرتجع #{r.number}</span>
                      <span class="pill" style={{ background: r.bg, color: r.fg }}>
                        {r.statusLabel}
                      </span>
                      <span class="ocard-total">{r.refundLabel ?? r.typeLabel}</span>
                    </div>
                    <div class="ocard-name">
                      {r.customerName || 'بدون اسم'}
                      <span class="ocard-city"> · طلب {r.orderLabel}</span>
                    </div>
                    <div class="ocard-meta">
                      {r.typeLabel} · {formatDateTime(r.createdAt)}
                    </div>
                    {r.reason && <p class="rt-reason">السبب: {r.reason}</p>}
                    {r.customerNote && <p class="rv-body">«{r.customerNote}»</p>}
                    {r.merchantNote && (
                      <div class="rv-reply">
                        <small>ملاحظتك</small>
                        {r.merchantNote}
                      </div>
                    )}
                    <div class="ocard-actions">
                      <button
                        type="button"
                        class="act act--wa press"
                        onClick={() => {
                          haptic('LIGHT')
                          setStatusFor(r)
                        }}
                      >
                        <Icon svg={icons.refresh()} />
                        غيّر الحالة
                      </button>
                      <button
                        type="button"
                        class="act press"
                        onClick={() => {
                          haptic('LIGHT')
                          setNoteFor({ item: r, text: r.merchantNote ?? '' })
                        }}
                      >
                        <Icon svg={icons.stickyNote()} />
                        ملاحظة
                      </button>
                      {r.customerPhone && (
                        <button
                          type="button"
                          class="act press"
                          onClick={() => {
                            haptic('LIGHT')
                            location.assign(`tel:${r.customerPhone}`)
                          }}
                        >
                          <Icon svg={icons.phone()} />
                          اتصال
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <Sheet open={Boolean(statusFor)} title={statusFor ? `حالة المرتجع #${statusFor.number}` : ''} onClose={() => setStatusFor(null)}>
        {statusFor && data && (
          <div class="sheet-list">
            {data.statuses.map((s) => (
              <button
                key={s.key}
                type="button"
                class={`sheet-row${s.key === statusFor.status ? ' sheet-row--on' : ''}`}
                disabled={busy || s.key === statusFor.status}
                onClick={async () => {
                  const ok = await post(statusFor.id, 'status', { status: s.key }, `المرتجع بقى «${s.label}»`)
                  if (ok) setStatusFor(null)
                }}
              >
                <span class="dot" style={{ background: s.fg }} />
                <span class="sheet-row-label">{s.label}</span>
                {s.key === statusFor.status && <Icon svg={icons.check()} className="ic sheet-check" />}
              </button>
            ))}
          </div>
        )}
      </Sheet>

      <Sheet open={Boolean(noteFor)} title="ملاحظة داخلية" onClose={() => setNoteFor(null)}>
        {noteFor && (
          <form
            class="verify"
            onSubmit={async (e) => {
              e.preventDefault()
              const ok = await post(noteFor.item.id, 'note', { note: noteFor.text }, 'الملاحظة اتحفظت')
              if (ok) setNoteFor(null)
            }}
          >
            <textarea
              class="np-input"
              placeholder="مثلًا: المندوب هيستلم يوم الخميس"
              value={noteFor.text}
              onInput={(e) => setNoteFor({ ...noteFor, text: (e.currentTarget as HTMLTextAreaElement).value })}
            />
            <p class="fine">الملاحظة ليك ولفريقك بس — العميل مش بيشوفها.</p>
            <div class="btn-row">
              <button type="button" class="btn btn--ghost press" onClick={() => setNoteFor(null)}>
                رجوع
              </button>
              <button type="submit" class="btn btn--primary press" disabled={busy}>
                {busy ? <span class="spinner" /> : <Icon svg={icons.check()} />}
                احفظ
              </button>
            </div>
          </form>
        )}
      </Sheet>
    </Screen>
  )
}
