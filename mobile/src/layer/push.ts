/**
 * إشعارات الطلبات الجديدة (Firebase).
 *
 * - بنطلب الإذن **بعد** ما التاجر يدخل اللوحة، مش في شاشة الدخول: الإذن
 *   من غير سياق بيترفض، وأندرويد ما بيسألش تاني بعد رفضين.
 * - الجهاز بيتسجّل للمتجر النشط مرة كل تشغيل.
 * - الضغط على الإشعار بيفتح الطلب نفسه. ولو التطبيق مفتوح، الإشعار
 *   بيظهر كرسالة صغيرة فوق بزرار «افتح».
 */
import { hapticNotify, listen, native } from './bridge'
import { PLATFORM, session, storage, wait } from './env'
import { toast } from './dom'
import { navigate } from './shell/navigate'

const TOKEN_KEY = 'zw-push-token'
const REGISTERED_KEY = 'zw-push-registered'

type Permission = { receive: 'prompt' | 'prompt-with-rationale' | 'granted' | 'denied' }
type Notification = { title?: string; body?: string; data?: Record<string, string> }

function openUrl(url: string | undefined): void {
  if (!url || !url.startsWith('/dashboard')) return
  if (location.pathname + location.search === url) return
  navigate(url)
}

async function register(token: string): Promise<void> {
  storage.set(TOKEN_KEY, token)
  if (session.get(REGISTERED_KEY) === token) return
  try {
    const res = await fetch('/api/app/push/register', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, platform: PLATFORM }),
    })
    if (res.ok) session.set(REGISTERED_KEY, token)
  } catch {
    /* المرة الجاية */
  }
}

/** قبل تسجيل الخروج — الجهاز ما يفضلش يستقبل طلبات حساب خرج منه */
export async function unregisterPush(): Promise<void> {
  const token = storage.get(TOKEN_KEY)
  if (!token) return
  session.set(REGISTERED_KEY, '')
  try {
    await Promise.race([
      fetch('/api/app/push/unregister', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token }),
      }),
      wait(2500),
    ])
  } catch {
    /* الخادم بيشيله لوحده أول ما جوجل تقول إنه مش شغّال */
  }
}

async function setup(): Promise<void> {
  /* بعد شاشة الافتتاح والتعريف — مش فوقهم */
  await wait(2600)
  while (document.querySelector('zawya-app-layer')?.shadowRoot?.querySelector('.ob')) await wait(1000)

  if (PLATFORM === 'android') {
    await native('PushNotifications', 'createChannel', {
      id: 'orders',
      name: 'الطلبات الجديدة',
      description: 'إشعار أول ما ييجي طلب جديد في متجرك',
      importance: 5,
      visibility: 1,
      vibration: true,
      lights: true,
      lightColor: '#634B9A',
    })
  }

  let perm = await native<Permission>('PushNotifications', 'checkPermissions')
  if (!perm) return
  if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
    perm = await native<Permission>('PushNotifications', 'requestPermissions')
  }
  if (perm?.receive !== 'granted') return
  await native('PushNotifications', 'register')
}

export function installPush(): void {
  void listen<{ value: string }>('PushNotifications', 'registration', ({ value }) => void register(value))

  void listen<Notification>('PushNotifications', 'pushNotificationReceived', (n) => {
    hapticNotify('SUCCESS')
    const url = n.data?.url
    toast([n.title, n.body].filter(Boolean).join(' — '), {
      tone: 'success',
      duration: 6000,
      action: url ? { label: 'افتح', run: () => openUrl(url) } : undefined,
    })
  })

  void listen<{ notification: Notification }>('PushNotifications', 'pushNotificationActionPerformed', ({ notification }) =>
    openUrl(notification?.data?.url),
  )

  /* التاجر داخل اللوحة = مسجّل دخول */
  if (location.pathname.startsWith('/dashboard')) void setup()
}
