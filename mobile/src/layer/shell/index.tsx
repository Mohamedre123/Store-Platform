/**
 * هيكل التطبيق — الشاشات الأصلية وشريط التبويبات.
 *
 * ## إزاي الشاشات بتتحوّل واحدة واحدة
 * كل شاشة أصلية بتتسجّل على مسار. لما المسار يتفتح، الشاشة بتترسم فوق
 * صفحة المنصة وبتاخد مكانها. المسارات اللي لسه ما اتحوّلتش بتفضل صفحة
 * المنصة — بس جوّه نفس الهيكل (نفس شريط التبويبات والحركة) فمفيش نقلة
 * بتبان «موقع».
 *
 * `?web=1` على أي مسار بيعرض نسخة المنصة — مخرج للأفعال اللي لسه
 * مالهاش مكان في الشاشة الأصلية.
 */
import { render } from 'preact'
import { useCallback, useEffect, useState } from 'preact/hooks'
import { layer } from '../dom'
import { onRouteChange } from '../navigation'
import { clearHomeCache } from './api'
import { Home } from './home'
import { SHELL_CSS } from './styles'
import { TabBar } from './tabbar'

function useLocation(): URL {
  const [href, setHref] = useState(location.href)
  useEffect(() => {
    const sync = () => setHref(location.href)
    onRouteChange(sync)
    window.addEventListener('popstate', sync)
    window.addEventListener('pageshow', sync)
  }, [])
  return new URL(href)
}

function Shell() {
  const url = useLocation()
  const path = url.pathname.replace(/\/+$/, '') || '/'
  const web = url.searchParams.get('web') === '1'
  const onDashboard = path === '/dashboard' || path.startsWith('/dashboard/')

  /* لو مسار البيانات مش منشور لسه، الرئيسية بترجع لنسخة المنصة لحد ما يتنشر */
  const [homeAvailable, setHomeAvailable] = useState(true)
  const markUnavailable = useCallback(() => setHomeAvailable(false), [])

  useEffect(() => {
    if (/^\/(login|signup|verify|reset)/.test(path)) clearHomeCache()
  }, [path])

  useEffect(() => {
    document.documentElement.classList.toggle('zw-native-tabs', onDashboard)
  }, [onDashboard])

  return (
    <>
      <Home visible={path === '/dashboard' && homeAvailable && !web} onUnavailable={markUnavailable} />
      <TabBar path={path} active={onDashboard} />
    </>
  )
}

export function installShell(): void {
  const root = layer()
  const style = document.createElement('style')
  style.textContent = SHELL_CSS
  root.appendChild(style)
  const mount = document.createElement('div')
  mount.className = 'shell'
  root.appendChild(mount)
  render(<Shell />, mount)
}
