/**
 * الكلام مع الطبقة الأصلية.
 *
 * ## ليه مش `@capacitor/core`
 * الملف ده بيتحقن في أول الصفحة، وعلى أندرويد بيشتغل **قبل** جسر Capacitor
 * نفسه (ترتيب الحقن كده). مكتبة core بتقرا `window.Capacitor` لحظة
 * تحميلها، فكانت هتلاقيه فاضي وتبني نسخة ويب مالهاش علاقة بالجهاز.
 *
 * هنا بنستنى الجسر يظهر، وبعدين بنادي `nativePromise` اللي هو بيوفّره —
 * نفس اللي core بتناديه في الآخر.
 */

type Listener = { remove(): Promise<void> }

interface CapacitorBridge {
  nativePromise(plugin: string, method: string, options?: object): Promise<unknown>
  addListener(plugin: string, event: string, callback: (data: unknown) => void): Listener
}

function current(): CapacitorBridge | null {
  const cap = (window as unknown as { Capacitor?: Partial<CapacitorBridge> }).Capacitor
  return cap && typeof cap.nativePromise === 'function' && typeof cap.addListener === 'function'
    ? (cap as CapacitorBridge)
    : null
}

let ready: Promise<CapacitorBridge> | null = null

export function whenBridge(): Promise<CapacitorBridge> {
  if (!ready) {
    ready = new Promise((resolve, reject) => {
      let tries = 0
      const tick = () => {
        const cap = current()
        if (cap) return resolve(cap)
        /* ٥ ثواني كفاية جدًا — الجسر بيظهر في نفس اللحظة تقريبًا */
        if (++tries > 220) return reject(new Error('Capacitor bridge unavailable'))
        setTimeout(tick, tries < 20 ? 0 : 25)
      }
      tick()
    })
  }
  return ready
}

/**
 * نداء لإضافة أصلية. **ما بيرميش أبدًا** — بيرجّع `undefined` لو فشل.
 *
 * كل ميزة في الطبقة «تحسين» فوق منصة شغّالة لوحدها. فشل الاهتزاز أو لون
 * الشريط ما يصحّش يوقف زرار التاجر داس عليه.
 */
export async function native<T = unknown>(plugin: string, method: string, options: object = {}): Promise<T | undefined> {
  try {
    const cap = await whenBridge()
    return (await cap.nativePromise(plugin, method, options)) as T
  } catch (err) {
    console.debug(`[zawya] ${plugin}.${method}`, err)
    return undefined
  }
}

export async function listen<T>(plugin: string, event: string, callback: (data: T) => void): Promise<Listener | null> {
  try {
    const cap = await whenBridge()
    return cap.addListener(plugin, event, callback as (data: unknown) => void)
  } catch {
    return null
  }
}

/* ─────────────── الاهتزاز ─────────────── */

let lastImpact = 0

export function haptic(style: 'LIGHT' | 'MEDIUM' | 'HEAVY' = 'LIGHT'): void {
  const now = Date.now()
  /* ضغطتين ورا بعض في أقل من ٧٠ms بيحسّوا كأنهم رعشة واحدة مزعجة */
  if (now - lastImpact < 70) return
  lastImpact = now
  void native('Haptics', 'impact', { style })
}

export function hapticNotify(type: 'SUCCESS' | 'WARNING' | 'ERROR'): void {
  void native('Haptics', 'notification', { type })
}
