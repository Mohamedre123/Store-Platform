/**
 * صفحة تأكيد البريد جوّه التطبيق — شريط علوي بزرار رجوع، ولوحة خيارات.
 *
 * ## المشكلة
 * التاجر اللي سجّل ووصل لصفحة الرمز كان محبوس: الشعار بيودّي للوحة،
 * واللوحة بترجّعه للرمز. البريد غلط؟ عايز يدخل بحساب تاني؟ مفيش طريق.
 *
 * ## اللي هنا
 * - **غيّر البريد**: بيكتب بريد تاني والرمز بيروح عليه (`/api/app/account/change-email`).
 * - **سجّل دخول بحساب تاني** / **ابدأ تسجيل جديد**: التسجيل اللي لسه
 *   ما اتأكدش بيتلغي خالص هو ومتجره (`/api/app/account/abandon`) —
 *   فلما يرجع يسجّل بنفس البريد ما يلاقيش «مسجّل قبل كده».
 *
 * زرار الرجوع في أندرويد بيفتح اللوحة دي بدل ما يخرج أو يلفّ في تحويلات.
 * الموقع في المتصفح ما بيتأثرش — ده كله جوّه طبقة التطبيق.
 */
import { useEffect, useRef, useState } from 'preact/hooks'
import { haptic, hapticNotify } from '../bridge'
import { toast } from '../dom'
import { icons } from '../icons'
import { registerBackHandler } from '../navigation'
import { unregisterPush } from '../push'
import { Sheet } from './screen'
import { Icon } from './ui'

type Mode = 'menu' | 'email' | 'confirm'

function pageEmail(): string {
  return document.querySelector('main bdi')?.textContent?.trim() ?? ''
}

async function post(path: string, body: object): Promise<{ status: number; data: Record<string, unknown> | null }> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
    })
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null
    return { status: res.status, data }
  } catch {
    return { status: 0, data: null }
  }
}

export function VerifyBar({ visible }: { visible: boolean }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('menu')
  const [email, setEmail] = useState('')
  const [current, setCurrent] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [target, setTarget] = useState<'/login' | '/signup'>('/login')
  const input = useRef<HTMLInputElement>(null)
  const openRef = useRef(open)
  openRef.current = open

  const show = (next: Mode = 'menu') => {
    haptic('LIGHT')
    setCurrent(pageEmail())
    setMode(next)
    setError(null)
    setOpen(true)
  }

  useEffect(() => {
    document.documentElement.classList.toggle('zw-verify', visible)
    if (!visible) {
      setOpen(false)
      return
    }
    /* رجوع أندرويد: يفتح الخيارات (ولو مفتوحة، اللوحة نفسها بتقفل نفسها) */
    return registerBackHandler(() => {
      if (openRef.current) return false
      show()
      return true
    })
  }, [visible])

  useEffect(() => {
    if (open && mode === 'email') setTimeout(() => input.current?.focus(), 380)
  }, [open, mode])

  if (!visible) return null

  const changeEmail = async (e: Event) => {
    e.preventDefault()
    if (busy) return
    const next = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) {
      setError('اكتب البريد صح — زي name@gmail.com')
      return
    }
    setBusy(true)
    setError(null)
    const { status, data } = await post('/api/app/account/change-email', { email: next })
    setBusy(false)
    if (status === 0) {
      setError('مفيش اتصال بالإنترنت — جرّب تاني.')
      return
    }
    if (!data?.ok) {
      hapticNotify('ERROR')
      setError(typeof data?.message === 'string' ? data.message : 'ما قدرناش نغيّر البريد — جرّب تاني.')
      return
    }
    hapticNotify('SUCCESS')
    if (data.verified) {
      location.replace('/dashboard')
      return
    }
    toast(typeof data.message === 'string' ? data.message : `بعتنا رمز جديد على ${next}`, { tone: 'success', duration: 4000 })
    setOpen(false)
    setTimeout(() => location.replace('/verify'), 350)
  }

  const abandon = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    await unregisterPush()
    const { status, data } = await post('/api/app/account/abandon', {})
    if (status === 0 || !data?.ok) {
      setBusy(false)
      hapticNotify('ERROR')
      setError(status === 0 ? 'مفيش اتصال بالإنترنت — جرّب تاني.' : 'ما قدرناش نلغي التسجيل — جرّب تاني.')
      return
    }
    location.replace(target)
  }

  const title = mode === 'email' ? 'غيّر البريد' : mode === 'confirm' ? 'إلغاء التسجيل' : 'خيارات التسجيل'

  return (
    <>
      <div class="vbar">
        <button type="button" class="appbar-btn press" aria-label="رجوع" onClick={() => show()}>
          <Icon svg={icons.chevronRight()} />
        </button>
        <span class="vbar-title">تأكيد البريد</span>
        <button type="button" class="vbar-link press" onClick={() => show('email')}>
          غيّر البريد
        </button>
      </div>

      <Sheet open={open} title={title} onClose={() => !busy && setOpen(false)}>
        {mode === 'menu' && (
          <div class="verify">
            {current && (
              <p class="verify-current">
                الرمز رايح على
                <bdi>{current}</bdi>
              </p>
            )}
            <div class="sheet-list">
              <button type="button" class="sheet-row" onClick={() => (setMode('email'), setError(null))}>
                <span class="sheet-row-icon">
                  <Icon svg={icons.mail()} />
                </span>
                <span class="sheet-row-label">
                  غيّر البريد
                  <small>كتبته غلط؟ اكتب الصح ونبعتلك عليه رمز جديد</small>
                </span>
              </button>
              <button type="button" class="sheet-row" onClick={() => (setTarget('/login'), setMode('confirm'), setError(null))}>
                <span class="sheet-row-icon">
                  <Icon svg={icons.user()} />
                </span>
                <span class="sheet-row-label">
                  سجّل دخول بحساب تاني
                  <small>عندك حساب متأكّد قبل كده</small>
                </span>
              </button>
              <button type="button" class="sheet-row" onClick={() => (setTarget('/signup'), setMode('confirm'), setError(null))}>
                <span class="sheet-row-icon verify-danger-icon">
                  <Icon svg={icons.logOut()} />
                </span>
                <span class="sheet-row-label">
                  الغِ التسجيل وابدأ من الأول
                  <small>كأنك ما سجّلتش — وتقدر تستخدم نفس البريد تاني</small>
                </span>
              </button>
            </div>
          </div>
        )}

        {mode === 'email' && (
          <form class="verify" onSubmit={changeEmail}>
            {current && (
              <p class="verify-current">
                البريد الحالي
                <bdi>{current}</bdi>
              </p>
            )}
            <label class="verify-label" for="zw-new-email">
              البريد الجديد
            </label>
            <input
              ref={input}
              id="zw-new-email"
              class="verify-field"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="off"
              spellcheck={false}
              dir="ltr"
              placeholder="name@gmail.com"
              enterKeyHint="send"
              value={email}
              onInput={(e) => setEmail((e.currentTarget as HTMLInputElement).value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void changeEmail(e)
              }}
            />
            {error && <p class="verify-error">{error}</p>}
            <div class="btn-row">
              <button type="button" class="btn btn--ghost press" disabled={busy} onClick={() => (setMode('menu'), setError(null))}>
                رجوع
              </button>
              <button type="submit" class="btn btn--primary press" disabled={busy}>
                {busy ? <span class="spinner" /> : <Icon svg={icons.send()} />}
                ابعت الرمز
              </button>
            </div>
          </form>
        )}

        {mode === 'confirm' && (
          <div class="verify">
            <div class="verify-warn">
              <b>متأكد؟</b>
              <p>
                حسابك لسه ما اتأكدش، فهيتمسح هو والمتجر اللي اتعمل معاه — كأنك ما سجّلتش خالص. تقدر تسجّل بنفس البريد تاني في أي
                وقت.
              </p>
            </div>
            {error && <p class="verify-error">{error}</p>}
            <div class="btn-row">
              <button type="button" class="btn btn--ghost press" disabled={busy} onClick={() => (setMode('menu'), setError(null))}>
                رجوع
              </button>
              <button type="button" class="btn btn--danger press" disabled={busy} onClick={abandon}>
                {busy && <span class="spinner" />}
                {target === '/login' ? 'الغِ وسجّل دخول' : 'الغِ التسجيل'}
              </button>
            </div>
          </div>
        )}
      </Sheet>
    </>
  )
}
