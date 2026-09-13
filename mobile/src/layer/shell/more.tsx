/**
 * قايمة «المزيد» — لوحة أصلية بتطلع من تحت فوق أي شاشة.
 *
 * ## ليه مش قايمة المنصة
 * قايمة المنصة بتترسم جوّه الصفحة، والشاشات الأصلية فوق الصفحة —
 * فكانت بتفتح تحتهم ومحدّش يشوفها. هنا نفس الأقسام بنفس الترتيب
 * والصلاحيات، والاختصارات، والحساب، وتسجيل الخروج.
 *
 * بيانات المستخدم محفوظة على الجهاز فالقايمة بتفتح فورًا، ولو مسار
 * `/api/app/me` مش متاح بتظهر كل الأقسام — والصفحة نفسها بتتحقق من
 * الصلاحية لما تتفتح.
 */
import { useEffect, useMemo, useState } from 'preact/hooks'
import { haptic } from '../bridge'
import { toast } from '../dom'
import { icons } from '../icons'
import { assetUrl, clearHomeCache } from './api'
import { clearCustomersCache } from './customers-api'
import { initials } from './format'
import { navigate, openExternal } from './navigate'
import { allowedBy, NAV } from './nav-data'
import { clearOrdersCache } from './orders-api'
import { clearProductsCache } from './products-api'
import { Sheet } from './screen'
import { Icon } from './ui'

type Me = {
  user: { name: string | null; email: string; isPlatformAdmin: boolean }
  store: { name: string; slug: string; logo: string | null; url: string }
  role: string
  permissions: string[]
}

const ME_KEY = 'zw-me:v1'

function readMe(): Me | null {
  try {
    const raw = localStorage.getItem(ME_KEY)
    return raw ? (JSON.parse(raw) as Me) : null
  } catch {
    return null
  }
}

export function clearMeCache(): void {
  try {
    localStorage.removeItem(ME_KEY)
  } catch {
    /* تجاهل */
  }
}

async function fetchMe(): Promise<Me | null> {
  try {
    const res = await fetch('/api/app/me', { credentials: 'same-origin', cache: 'no-store', headers: { accept: 'application/json' } })
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('application/json')) return null
    const me = (await res.json()) as Me
    try {
      localStorage.setItem(ME_KEY, JSON.stringify(me))
    } catch {
      /* تجاهل */
    }
    return me
  } catch {
    return null
  }
}

export function openMore(): void {
  window.dispatchEvent(new Event('zw:more'))
}

const matchesPath = (path: string, href: string) => {
  const base = href.split('?')[0]
  return base === '/dashboard' ? path === '/dashboard' : path === base || path.startsWith(`${base}/`)
}

export function MoreSheet({ path, search }: { path: string; search: string }) {
  const [open, setOpen] = useState(false)
  const [me, setMe] = useState<Me | null>(readMe)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    const onOpen = () => {
      haptic('LIGHT')
      /* القسم اللي التاجر جوّاه بيبقى مفتوح — يشوف إخوات صفحته على طول */
      setExpanded(NAV.find((s) => s.children && s.children.some((c) => matchesPath(path, c.href)))?.href ?? null)
      setConfirmLogout(false)
      setOpen(true)
      void fetchMe().then((fresh) => {
        if (fresh) setMe(fresh)
      })
    }
    window.addEventListener('zw:more', onOpen)
    return () => window.removeEventListener('zw:more', onOpen)
  }, [path])

  useEffect(() => {
    if (!me) void fetchMe().then((fresh) => fresh && setMe(fresh))
  }, [])

  const sections = useMemo(() => {
    const allowed = allowedBy(me?.role ?? null, me?.permissions ?? null)
    return NAV.filter((s) => allowed(s.permission)).map((s) => ({
      ...s,
      children: s.children?.filter((c) => allowed(c.permission)),
    }))
  }, [me])

  const go = (href: string) => {
    haptic('LIGHT')
    setOpen(false)
    /* نستنى اللوحة تبدأ تنزل عشان الانتقال يبان ناعم */
    setTimeout(() => navigate(href), 140)
  }

  const logout = async () => {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      const res = await fetch('/api/app/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      })
      if (!res.ok) throw new Error(String(res.status))
    } catch {
      setLoggingOut(false)
      toast('ما قدرناش نسجّل خروجك — جرّب تاني', { tone: 'danger' })
      return
    }
    clearHomeCache()
    clearOrdersCache()
    clearProductsCache()
    clearCustomersCache()
    clearMeCache()
    location.replace('/login')
  }

  const quick = [
    { label: 'عرض المتجر', icon: icons.externalLink(), run: () => me && (setOpen(false), openExternal(me.store.url)), show: Boolean(me) },
    { label: 'الاشتراك', icon: icons.crown(), run: () => go('/dashboard/subscription'), show: true },
    { label: 'سجل الرسايل', icon: icons.bell(), run: () => go('/dashboard/messages'), show: true },
    { label: 'الأجهزة', icon: icons.keyRound(), run: () => go('/dashboard/settings/sessions'), show: true },
  ].filter((q) => q.show)

  const currentFull = path + (search ? `?${search}` : '')

  return (
    <Sheet open={open} tall onClose={() => setOpen(false)}>
      <div class="more">
        <div class="more-head">
          <span class="more-logo">
            {me?.store.logo ? <img src={assetUrl(me.store.logo) ?? ''} alt="" /> : initials(me?.store.name ?? 'زاوية')}
          </span>
          <span class="more-store">
            <b>{me?.store.name ?? 'متجرك'}</b>
            {me && <small class="num">{me.store.slug}</small>}
          </span>
          <button type="button" class="appbar-btn press" aria-label="إغلاق" onClick={() => setOpen(false)}>
            <Icon svg={icons.x()} />
          </button>
        </div>

        <div class="more-quick">
          {quick.map((q) => (
            <button key={q.label} type="button" class="press" onClick={q.run}>
              <span class="qi">
                <Icon svg={q.icon} />
              </span>
              {q.label}
            </button>
          ))}
        </div>

        <div class="more-list">
          {sections.map((s) => {
            const active = matchesPath(path, s.href) || Boolean(s.children?.some((c) => matchesPath(path, c.href)))
            const isOpen = expanded === s.href
            return (
              <div key={s.href} class={`more-sec${isOpen ? ' more-sec--open' : ''}`}>
                <button
                  type="button"
                  class={`more-row press${active ? ' more-row--active' : ''}`}
                  aria-expanded={s.children ? isOpen : undefined}
                  onClick={() => {
                    if (!s.children) return go(s.href)
                    haptic('LIGHT')
                    setExpanded(isOpen ? null : s.href)
                  }}
                >
                  <span class="more-icon">
                    <Icon svg={s.icon()} />
                  </span>
                  <span class="more-label">{s.label}</span>
                  <Icon svg={(s.children ? icons.chevronDown : icons.chevronLeft)()} className="chev more-chev" />
                </button>
                {s.children && isOpen && (
                  <div class="more-children">
                    {s.children.map((c) => (
                      <button
                        key={c.href}
                        type="button"
                        class={`more-child press${currentFull === c.href ? ' more-child--active' : ''}`}
                        onClick={() => go(c.href)}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div class="more-foot">
          {me?.user.isPlatformAdmin && (
            <button type="button" class="more-row press more-row--brand" onClick={() => go('/dashboard/admin')}>
              <span class="more-icon">
                <Icon svg={icons.shieldCheck()} />
              </span>
              <span class="more-label">إدارة المنصة</span>
              <Icon svg={icons.chevronLeft()} className="chev more-chev" />
            </button>
          )}
          <button type="button" class="more-user press" onClick={() => go('/dashboard/account')}>
            <span class="avatar">{initials(me?.user.name)}</span>
            <span class="row-main">
              <span class="row-title">{me?.user.name ?? 'حسابي'}</span>
              {me && <span class="row-sub num">{me.user.email}</span>}
            </span>
            <Icon svg={icons.chevronLeft()} className="chev" />
          </button>
          {confirmLogout ? (
            <div class="more-confirm">
              <span>تسجّل خروج من الجهاز ده؟</span>
              <div class="btn-row">
                <button type="button" class="btn btn--ghost press" onClick={() => setConfirmLogout(false)}>
                  رجوع
                </button>
                <button type="button" class="btn btn--danger press" disabled={loggingOut} onClick={logout}>
                  {loggingOut ? <span class="spinner" /> : <Icon svg={icons.logOut()} />}
                  خروج
                </button>
              </div>
            </div>
          ) : (
            <button type="button" class="more-row more-row--danger press" onClick={() => setConfirmLogout(true)}>
              <span class="more-icon">
                <Icon svg={icons.logOut()} />
              </span>
              <span class="more-label">تسجيل الخروج</span>
            </button>
          )}
        </div>
      </div>
    </Sheet>
  )
}
