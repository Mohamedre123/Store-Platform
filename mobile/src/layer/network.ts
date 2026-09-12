/**
 * حالة الاتصال أثناء الاستخدام.
 *
 * صفحة «مفيش نت» (offline.html) بتغطّي أول تحميل بس. لو النت قطع والتاجر
 * جوّه اللوحة، الصفحة بتفضل ظاهرة لكن أي حفظ هيفشل — فبنقوله قبل ما
 * يكتب وصف منتج كامل ويدوس حفظ.
 */
import { listen, native } from './bridge'
import { el, layer, toast } from './dom'
import { icons } from './icons'

type Status = { connected: boolean }

export function installNetworkWatch(): void {
  let banner: HTMLElement | null = null
  let offline = false

  const apply = (connected: boolean) => {
    if (!connected && !offline) {
      offline = true
      if (!banner) {
        banner = el('div', 'net', `${icons.wifiOff()}<span>مفيش اتصال — هنكمّل أول ما النت يرجع</span>`)
        banner.setAttribute('role', 'alert')
        layer().appendChild(banner)
      }
      const node = banner
      requestAnimationFrame(() => node.classList.add('net--on'))
    } else if (connected && offline) {
      offline = false
      banner?.classList.remove('net--on')
      toast('رجع الاتصال', { tone: 'success', duration: 1800 })
    }
  }

  void native<Status>('Network', 'getStatus').then((status) => {
    if (status) apply(status.connected)
  })
  void listen<Status>('Network', 'networkStatusChange', (status) => apply(status.connected))
}
