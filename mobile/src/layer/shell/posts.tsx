/**
 * البوستات — شاشة أصلية (`/dashboard/studio/posts`).
 *
 * نفس صفحة اللوحة: كل بوست بصورته أو الكاروسيل أو الفيديو، الحالة والتاريخ، الكلام والهاشتاجات،
 * نتيجة كل حساب لوحده، «انشر» (أو «انشر على حساباتك» باختيار الحسابات)، «انشره من موبايلك»
 * (شاشة المشاركة بالصورة والكلام مع بعض)، انسخ الكلام، نزّل، والحذف بتأكيد.
 */
import { useState } from 'preact/hooks'
import { haptic, hapticNotify } from '../bridge'
import { toast } from '../dom'
import { icons } from '../icons'
import { formatDateTime, formatNumber } from './format'
import { postAppJson, useResource } from './http'
import { navigate } from './navigate'
import { COPY_ICON, copyText } from './ops-api'
import { Screen, Sheet } from './screen'
import { postsData, type SocialPost } from './studio-api'
import { Icon } from './ui'

const SEND_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.54 21.69a.5.5 0 0 0 .94-.03l6.5-19a.5.5 0 0 0-.64-.64l-19 6.5a.5.5 0 0 0-.03.94l7.93 3.18a2 2 0 0 1 1.11 1.11z"/><path d="m21.85 2.15-10.94 10.94"/></svg>'
const SHARE_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98"/><path d="m15.41 6.51-6.82 3.98"/></svg>'
const DOWNLOAD_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></svg>'

const TONE: Record<string, string> = {
  draft: 'muted',
  ready: 'primary',
  scheduled: 'info',
  publishing: 'info',
  published: 'good',
  failed: 'bad',
}

const postText = (p: SocialPost) => [p.caption, p.hashtags.join(' ')].filter(Boolean).join('\n\n')
const mediaUrl = (p: SocialPost) => p.videoUrl ?? p.imageUrls[0] ?? null

/**
 * شاشة المشاركة بالصورة (أو الفيديو) والكلام مع بعض.
 * على أندرويد `navigator.share` بالملفات بيروح للمشاركة الأصلية (`files.ts`).
 */
async function shareFromPhone(p: SocialPost): Promise<void> {
  const url = mediaUrl(p)
  if (!url) return
  const text = postText(p)
  try {
    const blob = await (await fetch(url)).blob()
    const video = Boolean(p.videoUrl)
    const file = new File([blob], video ? 'post.mp4' : 'post.jpg', { type: blob.type || (video ? 'video/mp4' : 'image/jpeg') })
    if (navigator.canShare ? navigator.canShare({ files: [file] }) : true) {
      await navigator.share({ files: [file], text })
    } else {
      await navigator.share({ text })
      toast('موبايلك ما بيدعمش مشاركة الملف — الكلام اتشارك، نزّل الصورة وضيفها')
    }
  } catch (e) {
    /* قفل شاشة المشاركة مش خطأ */
    if (!(e instanceof Error && e.name === 'AbortError')) toast('مقدرناش نفتح المشاركة — نزّل الملف وانشره بإيدك', { tone: 'danger' })
  }
}

/** رابط `download` بيتداس — طبقة التطبيق بتحفظه على الموبايل (`files.ts`) */
function download(p: SocialPost): void {
  const url = mediaUrl(p)
  if (!url) return
  const a = document.createElement('a')
  a.href = url
  a.download = p.videoUrl ? 'post.mp4' : 'post.jpg'
  a.target = '_blank'
  a.rel = 'noreferrer'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

function Media({ p }: { p: SocialPost }) {
  if (p.videoUrl) return <video class="pst-media" src={p.videoUrl} controls playsInline preload="metadata" />
  if (p.imageUrls.length > 1) {
    return (
      <div class="pst-carousel">
        <div class="pst-strip">
          {p.imageUrls.map((url, i) => (
            <span key={url} class="pst-slide">
              <img src={url} alt="" loading="lazy" />
              <b>{formatNumber(i + 1)}</b>
            </span>
          ))}
        </div>
        <small>كاروسيل · {formatNumber(p.imageUrls.length)} شرايح</small>
      </div>
    )
  }
  if (p.imageUrls[0]) return <img class="pst-media" src={p.imageUrls[0]} alt="" loading="lazy" />
  return null
}

export function PostsScreen({ visible, onUnavailable }: { visible: boolean; onUnavailable: () => void }) {
  const { data, failed, load } = useResource(postsData, visible, onUnavailable)
  const [busy, setBusy] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [pick, setPick] = useState<SocialPost | null>(null)
  const [chosen, setChosen] = useState<string[]>([])
  const [removing, setRemoving] = useState<SocialPost | null>(null)
  const [error, setError] = useState<string | null>(null)

  const accounts = data?.accounts ?? []
  const live = accounts.filter((a) => a.status === 'active')
  const posts = data?.posts ?? []

  const publish = async (p: SocialPost, targets?: string[]) => {
    if (busy) return false
    haptic('LIGHT')
    setBusy(`pub-${p.id}`)
    setError(null)
    const res = await postAppJson(`/api/app/posts/${encodeURIComponent(p.id)}/publish`, targets ? { targets } : {})
    /* النتيجة لكل حساب بتتسجّل على البوست حتى لو فشل — بنحدّث عشان تبان */
    await load()
    setBusy(null)
    if (!res.ok) {
      hapticNotify('ERROR')
      if (targets) setError(res.error)
      else toast(res.error, { tone: 'danger', duration: 4200 })
      return false
    }
    hapticNotify('SUCCESS')
    toast('اتنشر', { tone: 'success', duration: 2200 })
    return true
  }

  const remove = async (p: SocialPost) => {
    if (busy) return
    haptic('LIGHT')
    setBusy(`del-${p.id}`)
    const res = await postAppJson(`/api/app/posts/${encodeURIComponent(p.id)}/delete`, {})
    if (!res.ok) {
      setBusy(null)
      hapticNotify('ERROR')
      toast(res.error, { tone: 'danger' })
      return
    }
    await load()
    setBusy(null)
    setRemoving(null)
    hapticNotify('SUCCESS')
    toast('البوست اتحذف', { tone: 'success', duration: 2000 })
  }

  const chosenNames = live.filter((a) => chosen.includes(a.id)).map((a) => a.name).join('، ')

  return (
    <Screen visible={visible} title="البوستات" onRefresh={load}>
      <div class="home-body">
        <header class="page-head rise">
          <div class="page-head-text">
            <h1 class="page-title">البوستات</h1>
            <p class="page-sub">اللي اتعمل — جاهز للنشر أو اتنشر خلاص.</p>
          </div>
        </header>

        {!data ? (
          failed ? (
            <div class="empty">
              <span class="empty-icon">
                <Icon svg={icons.wifiOff()} />
              </span>
              <b>مش قادرين نجيب البوستات</b>
              <p>اتأكد من النت واسحب لتحت عشان تحاول تاني.</p>
            </div>
          ) : (
            <div class="olist">
              {[0, 1].map((i) => (
                <span key={i} class="sk" style="height:260px;border-radius:20px" />
              ))}
            </div>
          )
        ) : (
          <>
            {!data.studioEnabled && (
              <div class="np-note pst-gap">
                «استوديو المحتوى» مقفول من الإضافات — فعّله عشان تقدر تنشر وتحذف من هنا.
                <button type="button" class="act press pst-note-btn" onClick={() => navigate('/dashboard/plugins')}>
                  افتح الإضافات
                </button>
              </div>
            )}

            {posts.length === 0 ? (
              <div class="empty empty--compact rise">
                <span class="empty-icon">
                  <Icon svg={icons.sparkles()} />
                </span>
                <b>مفيش بوستات لسه</b>
                <p>اعمل أول واحد من الاستوديو، أو ظبّط جدول نشر وهو هيعملهم لوحده كل يوم.</p>
                <div class="btn-row">
                  <button type="button" class="btn btn--primary press" onClick={() => navigate('/dashboard/studio')}>
                    افتح الاستوديو
                  </button>
                  <button type="button" class="btn btn--ghost press" onClick={() => navigate('/dashboard/studio/schedules')}>
                    ظبّط جدول
                  </button>
                </div>
              </div>
            ) : (
              <div class="pst-list">
                {posts.map((p) => {
                  const done = p.status === 'published'
                  const media = mediaUrl(p)
                  return (
                    <article key={p.id} class="card pst-card rise">
                      <Media p={p} />
                      <div class="pst-body">
                        <div class="pst-meta">
                          <span class={`pst-pill pst-pill--${TONE[p.status] ?? 'muted'}`}>{p.statusLabel}</span>
                          <small>{formatDateTime(p.publishedAt ?? p.createdAt)}</small>
                        </div>

                        <p
                          class={`pst-caption${expanded[p.id] ? ' pst-caption--open' : ''}`}
                          onClick={() => setExpanded((s) => ({ ...s, [p.id]: !s[p.id] }))}
                        >
                          {p.caption}
                        </p>
                        {p.hashtags.length > 0 && <p class="pst-tags">{p.hashtags.join(' ')}</p>}

                        {p.results.length > 0 && (
                          <div class="pst-results">
                            {p.results.map((r) => (
                              <span key={r.accountId} class="pst-result">
                                <i style={{ background: r.color }} aria-hidden="true" />
                                <span>{r.accountName}</span>
                                <b class={r.ok ? 'pst-ok' : 'pst-err'}>{r.ok ? 'اتنشر' : r.error || 'فشل'}</b>
                              </span>
                            ))}
                          </div>
                        )}

                        <div class="pst-actions">
                          {!done && p.targets.length > 0 && (
                            <button type="button" class="btn btn--primary press pst-wide" disabled={Boolean(busy)} onClick={() => void publish(p)}>
                              {busy === `pub-${p.id}` ? <span class="spinner" /> : <Icon svg={SEND_ICON} />}
                              انشر
                            </button>
                          )}
                          {!done && p.targets.length === 0 && live.length > 0 && (
                            <button
                              type="button"
                              class="btn btn--primary press pst-wide"
                              onClick={() => {
                                haptic('LIGHT')
                                setError(null)
                                setChosen(live.length === 1 ? [live[0].id] : [])
                                setPick(p)
                              }}
                            >
                              <Icon svg={SEND_ICON} />
                              انشر على حساباتك
                            </button>
                          )}
                          {!done && media && (
                            <button type="button" class="act press" onClick={() => void shareFromPhone(p)}>
                              <Icon svg={SHARE_ICON} />
                              انشره من موبايلك
                            </button>
                          )}
                          <button type="button" class="act press" onClick={() => void copyText(postText(p), 'الكلام اتنسخ')}>
                            <Icon svg={COPY_ICON} />
                            انسخ الكلام
                          </button>
                          {media && (
                            <button type="button" class="act press" onClick={() => download(p)}>
                              <Icon svg={DOWNLOAD_ICON} />
                              {p.videoUrl ? 'نزّل الفيديو' : p.imageUrls.length > 1 ? 'نزّل أول شريحة' : 'نزّل الصورة'}
                            </button>
                          )}
                          <button type="button" class="ops-icon press pst-del" aria-label="احذف البوست" onClick={() => (haptic('LIGHT'), setRemoving(p))}>
                            <Icon svg={icons.trash()} />
                          </button>
                        </div>

                        {!done && p.targets.length === 0 && (
                          <small class="pst-hint">
                            جاهز — دوس «انشره من موبايلك» واختار المنصة، أو نزّل {p.videoUrl ? 'الفيديو' : 'الصورة'} وانسخ الكلام.
                          </small>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      <Sheet open={Boolean(pick)} title="هتنشره على أنهي حساب؟" onClose={() => setPick(null)}>
        {pick && (
          <div class="np-form ops-form">
            <div class="chips">
              {live.map((a) => {
                const on = chosen.includes(a.id)
                return (
                  <button
                    key={a.id}
                    type="button"
                    class={`fchip pst-account${on ? ' fchip--on' : ''}`}
                    aria-pressed={on}
                    onClick={() => {
                      haptic('LIGHT')
                      setChosen((c) => (on ? c.filter((x) => x !== a.id) : [...c, a.id]))
                    }}
                  >
                    <i style={{ background: a.color }} aria-hidden="true" />
                    {a.name}
                    <small>{a.platformLabel}</small>
                  </button>
                )
              })}
            </div>
            <p class="np-note">{chosen.length ? `هتنشر البوست دلوقتي على: ${chosenNames}` : 'اختار حساب واحد على الأقل.'}</p>
            {error && <p class="np-error">{error}</p>}
            <div class="btn-row">
              <button type="button" class="btn btn--ghost press" onClick={() => setPick(null)}>
                رجوع
              </button>
              <button
                type="button"
                class="btn btn--primary press"
                disabled={chosen.length === 0 || Boolean(busy)}
                onClick={async () => {
                  const ok = await publish(pick, chosen)
                  if (ok) setPick(null)
                }}
              >
                {busy === `pub-${pick.id}` ? <span class="spinner" /> : <Icon svg={SEND_ICON} />}
                انشر دلوقتي
              </button>
            </div>
          </div>
        )}
      </Sheet>

      <Sheet open={Boolean(removing)} title="تحذف البوست؟" onClose={() => setRemoving(null)}>
        {removing && (
          <div class="np-form ops-form">
            <p class="sheet-text">هيتشال من القايمة هنا. لو كان اتنشر على صفحاتك، هيفضل هناك زي ما هو.</p>
            <div class="btn-row">
              <button type="button" class="btn btn--ghost press" onClick={() => setRemoving(null)}>
                رجوع
              </button>
              <button type="button" class="btn btn--danger press" disabled={Boolean(busy)} onClick={() => void remove(removing)}>
                {busy === `del-${removing.id}` ? <span class="spinner" /> : <Icon svg={icons.trash()} />}
                أيوه، احذفه
              </button>
            </div>
          </div>
        )}
      </Sheet>
    </Screen>
  )
}
