/**
 * صفحات المتجر — شاشة أصلية (`/dashboard/settings/pages`).
 *
 * نفس `PagesEditor` في اللوحة: كارت لكل صفحة (منشورة/فاضية، الرابط، أول سطرين)، ودوسة = لوحة كتابة: العنوان،
 * المحتوى، «تحسين» بالذكاء الاصطناعي (٣ اقتراحات تختار منها — نفس زرار اللوحة)، «استخدم نص جاهز» للصفحة
 * الفاضية، «تظهر في فوتر المتجر»، وحفظ. الصفحة الفاضية بتتخفي من المتجر لوحدها.
 */
import { useState } from 'preact/hooks'
import { haptic, hapticNotify } from '../bridge'
import { toast } from '../dom'
import { icons } from '../icons'
import { postAppJson, useResource } from './http'
import { navigate } from './navigate'
import { Screen, Sheet } from './screen'
import { LoadState, Toggle } from './settings-forms'
import { storePagesData, type StorePage } from './store-settings-api'
import { Icon } from './ui'

type Draft = { page: StorePage; title: string; content: string; inFooter: boolean }

export function StorePagesScreen({ visible, onUnavailable }: { visible: boolean; onUnavailable: () => void }) {
  const { data, failed, load } = useResource(storePagesData, visible, onUnavailable)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState<'save' | 'improve' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<string[] | null>(null)
  const [needsSetup, setNeedsSetup] = useState(false)

  const open = (page: StorePage) => {
    haptic('LIGHT')
    setError(null)
    setSuggestions(null)
    setNeedsSetup(false)
    setDraft({ page, title: page.title, content: page.content ?? '', inFooter: page.showInFooter })
  }

  const save = async () => {
    if (!draft || busy) return
    setBusy('save')
    setError(null)
    const res = await postAppJson(`/api/app/store-pages/${encodeURIComponent(draft.page.id)}/save`, {
      title: draft.title,
      content: draft.content,
      showInFooter: draft.inFooter,
    })
    if (!res.ok) {
      setBusy(null)
      hapticNotify('ERROR')
      setError(res.error)
      return
    }
    await load()
    setBusy(null)
    hapticNotify('SUCCESS')
    toast(draft.content.trim() ? 'اتحفظت — الصفحة ظاهرة في متجرك' : 'اتحفظت — فاضية فمش هتظهر للعملاء', { tone: 'success', duration: 2600 })
    setDraft(null)
  }

  const improve = async () => {
    if (!draft || busy) return
    haptic('LIGHT')
    setBusy('improve')
    setError(null)
    setNeedsSetup(false)
    setSuggestions(null)
    const res = await fetch('/api/app/improve', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ task: 'page_content', current: draft.content, fields: { 'نوع الصفحة': draft.page.title } }),
    })
      .then((r) => r.json() as Promise<{ ok?: boolean; suggestions?: string[]; error?: string; needsSetup?: boolean }>)
      .catch(() => ({ ok: false, error: 'مفيش اتصال — جرّب تاني' }) as { ok: false; error: string; needsSetup?: boolean })
    setBusy(null)
    if (res.ok && 'suggestions' in res && res.suggestions?.length) {
      setSuggestions(res.suggestions)
      return
    }
    hapticNotify('ERROR')
    setError(typeof res.error === 'string' && /[؀-ۿ]/.test(res.error) ? res.error : 'ما قدرناش نحسّن النص دلوقتي')
    setNeedsSetup(Boolean(res.needsSetup))
  }

  const starter = draft ? data?.starters[draft.page.type] : undefined

  return (
    <Screen visible={visible} title="صفحات المتجر" onRefresh={load}>
      <div class="home-body">
        <header class="page-head rise">
          <div class="page-head-text">
            <h1 class="page-title">صفحات المتجر</h1>
            <p class="page-sub">سياسة الإرجاع والخصوصية والشروط. العميل بيثق أكتر لما يلاقيها مكتوبة.</p>
          </div>
        </header>

        {!data ? (
          <LoadState failed={failed} what="صفحات المتجر" />
        ) : data.pages.length === 0 ? (
          <div class="empty">
            <span class="empty-icon">
              <Icon svg={icons.stickyNote()} />
            </span>
            <b>مافيش صفحات لسه.</b>
          </div>
        ) : (
          <div class="card ops-list rise">
            {data.pages.map((p) => {
              const live = Boolean(p.content?.trim())
              return (
                <button key={p.id} type="button" class="sp-card press" onClick={() => open(p)}>
                  <span class="sp-card-head">
                    <b>{p.title}</b>
                    <span class={`pst-pill ${live ? 'pst-pill--primary' : 'pst-pill--muted'}`}>{live ? 'منشورة' : 'فاضية'}</span>
                  </span>
                  <span class="sp-slug">/{p.slug}</span>
                  <span class="sp-preview">{live ? p.content : 'الصفحة الفاضية ما بتظهرش للعميل — دوس واكتبها.'}</span>
                  {p.showInFooter && live && <small class="fine">ظاهرة في فوتر المتجر</small>}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <Sheet open={Boolean(draft)} tall title={draft?.page.title ?? ''} onClose={() => setDraft(null)}>
        {draft && (
          <div class="np-form ops-form">
            <label class="np-label">
              عنوان الصفحة
              <input class="np-input" maxLength={120} value={draft.title} onInput={(e) => setDraft({ ...draft, title: (e.currentTarget as HTMLInputElement).value })} />
            </label>

            <div class="np-label">
              <span class="sp-content-head">
                المحتوى
                <button type="button" class="act press" disabled={Boolean(busy)} onClick={() => void improve()}>
                  {busy === 'improve' ? <span class="spinner" /> : <Icon svg={icons.sparkles()} />}
                  تحسين
                </button>
              </span>
              <textarea
                class="np-input np-textarea st-text--long"
                rows={10}
                placeholder="اكتب محتوى الصفحة…"
                value={draft.content}
                onInput={(e) => setDraft({ ...draft, content: (e.currentTarget as HTMLTextAreaElement).value })}
              />
              <small class="pv-hint">الصفحة الفاضية ما بتظهرش للعميل. سطر فاضي بيبدأ فقرة جديدة.</small>
            </div>

            {suggestions && (
              <div class="sp-suggest">
                <small class="fine">اختار اقتراح يتحط مكان المحتوى:</small>
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    class="press"
                    onClick={() => {
                      haptic('LIGHT')
                      setDraft({ ...draft, content: s })
                      setSuggestions(null)
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {starter && !draft.content.trim() && (
              <button type="button" class="btn btn--ghost press" onClick={() => (haptic('LIGHT'), setDraft({ ...draft, content: starter }))}>
                استخدم نص جاهز
              </button>
            )}

            <Toggle label="تظهر في فوتر المتجر" on={draft.inFooter} onChange={(x) => setDraft({ ...draft, inFooter: x })} />

            {error && <p class="np-error">{error}</p>}
            {needsSetup && (
              <button type="button" class="btn btn--ghost press" onClick={() => navigate('/dashboard/plugins')}>
                ظبّط مفتاح الذكاء الاصطناعي من الإضافات
              </button>
            )}

            <div class="btn-row pv-sticky">
              <button type="button" class="btn btn--ghost press" onClick={() => setDraft(null)}>
                رجوع
              </button>
              <button type="button" class="btn btn--primary press" disabled={Boolean(busy)} onClick={() => void save()}>
                {busy === 'save' ? <span class="spinner" /> : <Icon svg={icons.check()} />}
                حفظ
              </button>
            </div>
          </div>
        )}
      </Sheet>
    </Screen>
  )
}
