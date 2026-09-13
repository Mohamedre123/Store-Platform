/**
 * قفل التطبيق بالبصمة (أندرويد).
 *
 * التاجر بيسيب موبايله على المكتب وفيه طلبات عملاء وأرقامهم وفلوس متجره.
 * لو فعّل القفل من «الإعدادات»:
 * - أول ما التطبيق يتفتح (من أول وجديد) بيطلب البصمة أو قفل الشاشة.
 * - لما يطلع من التطبيق، المحتوى بيتغطّى فورًا (فالصورة في قايمة التطبيقات
 *   المفتوحة ما بتكشفش حاجة)، ولو رجع بعد أكتر من ٣٠ ثانية بيطلب البصمة تاني.
 *
 * البصمة نفسها من النظام (`ZawyaShell.biometricAuthenticate` ← BiometricPrompt)
 * — التطبيق عمره ما بيشوف البصمة ولا الرقم السري.
 */
import { haptic, hapticNotify, listen, native } from './bridge'
import { ASSETS, IS_ANDROID, session, storage, wait } from './env'
import { el, layer } from './dom'

const KEY = 'zw-lock'
const UNLOCKED = 'zw-unlocked'
const GRACE = 30_000

const CSS = `
.lock{position:fixed;top:0;right:0;bottom:0;left:0;z-index:45;pointer-events:auto;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:32px;direction:rtl;text-align:center;color:#eceef6;background:radial-gradient(120% 75% at 50% 42%,#2d2656 0%,#1a1838 52%,#0f0e24 100%);font-family:var(--font-plex-arabic),'IBM Plex Sans Arabic','Segoe UI',Tahoma,system-ui,sans-serif;-webkit-font-smoothing:antialiased;transition:opacity .3s ease}
.lock--out{opacity:0;pointer-events:none}
.lock-mark{width:78px;height:auto;margin-bottom:10px;animation:lock-breathe 2.4s ease-in-out infinite}
@keyframes lock-breathe{0%,100%{transform:none}50%{transform:scale(1.06)}}
.lock-title{font-size:21px;font-weight:700}
.lock-msg{margin:0 0 18px;font-size:14px;line-height:1.8;color:rgba(236,238,246,.72)}
.lock-btn{display:inline-flex;align-items:center;gap:10px;min-height:54px;padding:0 26px;border:0;border-radius:18px;font:inherit;font-size:16px;font-weight:700;color:#fff;background:#634b9a;box-shadow:0 16px 34px -14px rgba(99,75,154,.95);cursor:pointer;-webkit-tap-highlight-color:transparent}
.lock-btn:active{transform:scale(.97)}
.lock-btn svg{width:22px;height:22px}
`

const FINGERPRINT =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"/><path d="M14 13.12c0 2.38 0 6.38-1 8.88"/><path d="M17.29 21.02c.12-.6.43-2.3.5-3.02"/><path d="M2 12a10 10 0 0 1 18-6"/><path d="M2 16h.01"/><path d="M21.8 16c.2-2 .131-5.354 0-6"/><path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2"/><path d="M8.65 22c.21-.66.45-1.32.57-2"/><path d="M9 6.8a6 6 0 0 1 9 5.2v2"/></svg>'

let overlay: HTMLElement | null = null
let styled = false
let authenticating = false
/** القفل محتاج بصمة (مش مجرد غطا وقت ما التطبيق في الخلفية) */
let required = false
let hiddenAt = 0

export const lockEnabled = (): boolean => IS_ANDROID && storage.get(KEY) === '1'

export function setLockEnabled(on: boolean): void {
  storage.set(KEY, on ? '1' : '0')
  if (on) session.set(UNLOCKED, '1')
}

export async function biometricAvailable(): Promise<boolean> {
  if (!IS_ANDROID) return false
  const res = await native<{ available?: boolean }>('ZawyaShell', 'biometricStatus')
  return Boolean(res?.available)
}

export async function authenticate(title = 'افتح زاوية'): Promise<{ ok: boolean; error?: string }> {
  const res = await native<{ ok?: boolean; error?: string }>('ZawyaShell', 'biometricAuthenticate', {
    title,
    subtitle: 'بالبصمة أو قفل الشاشة',
  })
  return { ok: Boolean(res?.ok), error: res?.error }
}

function mount(): void {
  if (overlay) return
  if (!styled) {
    const style = document.createElement('style')
    style.textContent = CSS
    layer().appendChild(style)
    styled = true
  }
  const node = el(
    'div',
    'lock',
    `<img class="lock-mark" src="${ASSETS.markWhite}" alt="">
     <b class="lock-title">زاوية مقفول</b>
     <p class="lock-msg">افتحه ببصمتك أو بقفل الشاشة</p>
     <button type="button" class="lock-btn">${FINGERPRINT}افتح</button>`,
  )
  node.setAttribute('role', 'dialog')
  node.setAttribute('aria-label', 'التطبيق مقفول')
  node.querySelector('.lock-btn')?.addEventListener('click', () => {
    haptic('LIGHT')
    void unlock()
  })
  layer().appendChild(node)
  overlay = node
}

function unmount(): void {
  const node = overlay
  overlay = null
  if (!node) return
  node.classList.add('lock--out')
  window.setTimeout(() => node.remove(), 320)
}

async function unlock(): Promise<void> {
  if (authenticating) return
  authenticating = true
  const res = await authenticate()
  authenticating = false
  if (res.ok) {
    required = false
    session.set(UNLOCKED, '1')
    hapticNotify('SUCCESS')
    unmount()
    return
  }
  const msg = overlay?.querySelector('.lock-msg')
  if (msg) msg.textContent = res.error || 'ما اتفتحش — دوس «افتح» وجرّب تاني'
}

export function installLock(): void {
  if (!IS_ANDROID) return
  const onDashboard = () => location.pathname.startsWith('/dashboard')

  /* فتح جديد للتطبيق (مش مجرد تحميل صفحة جوّه نفس الجلسة) */
  if (lockEnabled() && onDashboard() && session.get(UNLOCKED) !== '1') {
    required = true
    mount()
    /* بعد ما شاشة الافتتاح تختفي — النافذة دي فوق الـWebView مش تحته */
    void wait(1400).then(() => void unlock())
  }

  void listen<{ isActive: boolean }>('App', 'appStateChange', ({ isActive }) => {
    if (!lockEnabled() || !onDashboard()) return
    if (!isActive) {
      /* نافذة البصمة نفسها بتوقّف التطبيق لحظة — ده مش خروج */
      if (authenticating) return
      hiddenAt = Date.now()
      mount()
      return
    }
    if (authenticating) return
    if (!required && hiddenAt && Date.now() - hiddenAt < GRACE) {
      unmount()
      return
    }
    required = true
    mount()
    void unlock()
  })
}
