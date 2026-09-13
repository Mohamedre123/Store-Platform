/**
 * المراجعات — شاشة أصلية.
 *
 * «مستنية موافقتك» فوق (المراجعة ما بتظهرش في المتجر غير بعد الموافقة)،
 * وكل مراجعة: النجوم والمنتج والكلام وشارة «اشترى فعلًا» — ووافق أو
 * اخفي، ورد باسم المتجر، وامسح بتأكيد.
 */
import { useMemo, useState } from 'preact/hooks'
import { haptic, hapticNotify } from '../bridge'
import { toast } from '../dom'
import { icons } from '../icons'
import { reviewsData } from './business-api'
import { formatDateTime, formatNumber } from './format'
import { postAppJson, useResource } from './http'
import { Screen, Sheet } from './screen'
import { Icon } from './ui'

type Tab = 'waiting' | 'approved'

export function ReviewsScreen({ visible, onUnavailable }: { visible: boolean; onUnavailable: () => void }) {
  const { data, failed, load } = useResource(reviewsData, visible, onUnavailable)
  const [tab, setTab] = useState<Tab | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [reply, setReply] = useState<{ id: string; author: string; text: string } | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)

  const current: Tab = tab ?? (data && data.waiting > 0 ? 'waiting' : 'approved')
  const list = useMemo(
    () => (data?.reviews ?? []).filter((r) => (current === 'waiting' ? !r.approved : r.approved)),
    [data, current],
  )

  const act = async (id: string, action: 'approve' | 'reply' | 'delete', body: object, done: string) => {
    if (busy) return false
    haptic('LIGHT')
    setBusy(id)
    const res = await postAppJson(`/api/app/reviews/${encodeURIComponent(id)}/${action}`, body)
    setBusy(null)
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
    <Screen visible={visible} title="المراجعات" onRefresh={load}>
      <div class="home-body">
        <header class="page-head rise">
          <div class="page-head-text">
            <h1 class="page-title">المراجعات</h1>
            <p class="page-sub">
              {data && data.waiting > 0
                ? `${formatNumber(data.waiting)} مراجعة مستنية موافقتك عشان تظهر في متجرك`
                : 'آراء عملائك — المراجعة بتظهر في المتجر بعد موافقتك'}
            </p>
          </div>
        </header>

        {!data ? (
          failed ? (
            <div class="empty">
              <span class="empty-icon">
                <Icon svg={icons.wifiOff()} />
              </span>
              <b>مش قادرين نجيب المراجعات</b>
              <p>اتأكد من النت واسحب لتحت عشان تحاول تاني.</p>
            </div>
          ) : (
            <div class="olist">
              {[0, 1, 2].map((i) => (
                <span key={i} class="sk" style="height:140px;border-radius:20px" />
              ))}
            </div>
          )
        ) : data.reviews.length === 0 ? (
          <div class="empty rise">
            <span class="empty-icon">
              <Icon svg={icons.messageCircle()} />
            </span>
            <b>مافيش مراجعات لسه</b>
            <p>العميل بيقدر يكتب رأيه من صفحة المنتج بعد ما يستلم طلبه.</p>
          </div>
        ) : (
          <>
            <div class="frail" role="tablist" aria-label="فلترة المراجعات">
              {(
                [
                  { key: 'waiting', label: 'مستنية موافقتك', n: data.waiting },
                  { key: 'approved', label: 'منشورة', n: data.reviews.length - data.waiting },
                ] as const
              ).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={current === t.key}
                  class={`fchip${current === t.key ? ' fchip--on' : ''}${t.key === 'waiting' && t.n > 0 ? ' fchip--warn' : ''}`}
                  onClick={() => {
                    haptic('LIGHT')
                    setTab(t.key)
                  }}
                >
                  {t.label}
                  {t.n > 0 && <span class="fchip-n">{formatNumber(t.n)}</span>}
                </button>
              ))}
            </div>

            {list.length === 0 ? (
              <div class="empty empty--compact rise">
                <b>{current === 'waiting' ? 'مفيش مراجعات مستنياك' : 'مفيش مراجعات منشورة'}</b>
                <p>{current === 'waiting' ? 'كل المراجعات اتراجعت.' : 'وافق على مراجعة عشان تظهر هنا.'}</p>
              </div>
            ) : (
              <div class="olist">
                {list.map((r, i) => (
                  <article key={r.id} class="card rv rise" style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}>
                    <div class="rv-top">
                      <span class="rv-stars" aria-label={`${r.rating} من ٥`}>
                        {'★'.repeat(r.rating)}
                        <i>{'★'.repeat(Math.max(0, 5 - r.rating))}</i>
                      </span>
                      <span class="rv-date">{formatDateTime(r.createdAt)}</span>
                    </div>
                    <b class="rv-author">
                      {r.authorName}
                      {r.verified && <span class="mk-badge">اشترى فعلًا</span>}
                    </b>
                    {r.productName && <small class="rv-product">على «{r.productName}»</small>}
                    {r.body && <p class="rv-body">{r.body}</p>}
                    {r.reply && (
                      <div class="rv-reply">
                        <small>ردّك</small>
                        {r.reply}
                      </div>
                    )}
                    <div class="ocard-actions">
                      {r.approved ? (
                        <button
                          type="button"
                          class="act press"
                          disabled={busy === r.id}
                          onClick={() => void act(r.id, 'approve', { approve: false }, 'اتخفت من المتجر')}
                        >
                          <Icon svg={icons.eyeOff()} />
                          اخفيها
                        </button>
                      ) : (
                        <button
                          type="button"
                          class="act act--wa press"
                          disabled={busy === r.id}
                          onClick={() => void act(r.id, 'approve', { approve: true }, 'اتنشرت في متجرك')}
                        >
                          <Icon svg={icons.check()} />
                          وافق وانشر
                        </button>
                      )}
                      <button
                        type="button"
                        class="act press"
                        onClick={() => {
                          haptic('LIGHT')
                          setReply({ id: r.id, author: r.authorName, text: r.reply ?? '' })
                        }}
                      >
                        <Icon svg={icons.send()} />
                        {r.reply ? 'عدّل الرد' : 'رد'}
                      </button>
                      <button
                        type="button"
                        class="act press"
                        onClick={() => {
                          haptic('LIGHT')
                          setConfirm(r.id)
                        }}
                      >
                        <Icon svg={icons.trash()} />
                        امسح
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <Sheet open={Boolean(reply)} title={reply ? `الرد على ${reply.author}` : ''} onClose={() => setReply(null)}>
        {reply && (
          <form
            class="verify"
            onSubmit={async (e) => {
              e.preventDefault()
              const ok = await act(reply.id, 'reply', { reply: reply.text }, reply.text.trim() ? 'الرد اتنشر تحت المراجعة' : 'الرد اتمسح')
              if (ok) setReply(null)
            }}
          >
            <textarea
              class="np-input"
              placeholder="شكرًا لرأيك…"
              value={reply.text}
              onInput={(e) => setReply({ ...reply, text: (e.currentTarget as HTMLTextAreaElement).value })}
            />
            <p class="fine">الرد بيظهر تحت المراجعة في صفحة المنتج باسم متجرك.</p>
            <div class="btn-row">
              <button type="button" class="btn btn--ghost press" onClick={() => setReply(null)}>
                رجوع
              </button>
              <button type="submit" class="btn btn--primary press" disabled={Boolean(busy)}>
                {busy ? <span class="spinner" /> : <Icon svg={icons.send()} />}
                احفظ الرد
              </button>
            </div>
          </form>
        )}
      </Sheet>

      <Sheet open={Boolean(confirm)} title="مسح المراجعة" onClose={() => setConfirm(null)}>
        <div class="verify">
          <div class="verify-warn">
            <b>متأكد؟</b>
            <p>المراجعة هتتمسح نهائيًا من متجرك، وتقييم المنتج هيتحسب من غيرها.</p>
          </div>
          <div class="btn-row">
            <button type="button" class="btn btn--ghost press" onClick={() => setConfirm(null)}>
              رجوع
            </button>
            <button
              type="button"
              class="btn btn--danger press"
              disabled={Boolean(busy)}
              onClick={async () => {
                if (!confirm) return
                const ok = await act(confirm, 'delete', {}, 'المراجعة اتمسحت')
                if (ok) setConfirm(null)
              }}
            >
              {busy && <span class="spinner" />}
              امسح
            </button>
          </div>
        </div>
      </Sheet>
    </Screen>
  )
}
