/**
 * الإعدادات — شاشة أصلية بتجمع كل الإعدادات في مكان واحد.
 *
 * صفحة «الإعدادات» في المنصة فورم بيانات المتجر، وباقي الإعدادات متفرّقة
 * (الدفع، الشحن، واتساب، النطاق، الفريق…). هنا قايمة تطبيق مقسّمة
 * بمجموعات، كل بند بيفتح صفحته في المنصة. البنود بتتفلتر بصلاحيات
 * المستخدم (نفس `/api/app/me` اللي «المزيد» بيقرا منه).
 */
import { useEffect, useMemo, useState } from 'preact/hooks'
import { haptic } from '../bridge'
import { icons } from '../icons'
import { assetUrl } from './api'
import { initials } from './format'
import { fetchMe, readMe, type Me } from './more'
import { allowedBy } from './nav-data'
import { navigate, openExternal } from './navigate'
import { Screen } from './screen'
import { Icon } from './ui'

type Item = { label: string; hint: string; href: string; icon: () => string; permission?: string }

const GROUPS: Array<{ title: string; items: Item[] }> = [
  {
    title: 'المتجر',
    items: [
      { label: 'بيانات المتجر', hint: 'الاسم والشعار والتواصل والعملة', href: '/dashboard/settings?web=1', icon: icons.store, permission: 'settings.manage' },
      { label: 'صفحات المتجر', hint: 'الإرجاع والخصوصية والشروط', href: '/dashboard/settings/pages', icon: icons.layout, permission: 'storefront.manage' },
      { label: 'النطاق المخصص', hint: 'اربط اسم متجرك الخاص', href: '/dashboard/settings/domain', icon: icons.globe, permission: 'settings.manage' },
      { label: 'الظهور والسيو', hint: 'إزاي متجرك بيظهر في جوجل والسوشيال', href: '/dashboard/settings/seo', icon: icons.search, permission: 'settings.manage' },
      { label: 'صفحة الطلب والإيصال', hint: 'اللي العميل بيشوفه بعد ما يطلب', href: '/dashboard/settings/receipt', icon: icons.stickyNote, permission: 'settings.manage' },
    ],
  },
  {
    title: 'البيع',
    items: [
      { label: 'الدفع', hint: 'الدفع عند الاستلام والمحافظ والبوابات', href: '/dashboard/payments', icon: icons.creditCard, permission: 'settings.manage' },
      { label: 'الشحن', hint: 'المناطق والأسعار وشركات الشحن', href: '/dashboard/shipping', icon: icons.truck, permission: 'settings.manage' },
      { label: 'الشيك أوت', hint: 'الخانات المطلوبة وخطوات الطلب', href: '/dashboard/settings/checkout', icon: icons.bag, permission: 'settings.manage' },
      { label: 'إعدادات الطلبات', hint: 'ترقيم الطلبات وتأكيدها', href: '/dashboard/settings/orders', icon: icons.package, permission: 'settings.manage' },
    ],
  },
  {
    title: 'التواصل',
    items: [
      { label: 'واتساب المتجر', hint: 'رسايل الطلبات لعملاءك من رقمك', href: '/dashboard/settings/whatsapp', icon: icons.messageCircle, permission: 'settings.manage' },
      { label: 'بريد المتجر', hint: 'البريد اللي رسايل متجرك بتخرج منه', href: '/dashboard/settings/email', icon: icons.mail, permission: 'settings.manage' },
      { label: 'سجل الرسايل', hint: 'كل رسالة اتبعتت ووصلت ولا لأ', href: '/dashboard/messages', icon: icons.bell, permission: 'orders.view' },
    ],
  },
  {
    title: 'الفريق والحساب',
    items: [
      { label: 'الفريق', hint: 'الموظفين وصلاحياتهم', href: '/dashboard/settings/team', icon: icons.users, permission: 'orders.view' },
      { label: 'الاشتراك', hint: 'باقتك وتجديدها', href: '/dashboard/subscription', icon: icons.crown, permission: 'team.manage' },
      { label: 'الإضافات', hint: 'الذكاء الاصطناعي والتكاملات', href: '/dashboard/plugins', icon: icons.plug, permission: 'settings.manage' },
      { label: 'الأجهزة والجلسات', hint: 'الأجهزة اللي داخلة على حسابك', href: '/dashboard/settings/sessions', icon: icons.keyRound },
      { label: 'سجل النشاط', hint: 'مين عمل إيه في المتجر', href: '/dashboard/settings/activity', icon: icons.clock, permission: 'settings.manage' },
    ],
  },
]

export function SettingsScreen({ visible }: { visible: boolean }) {
  const [me, setMe] = useState<Me | null>(readMe)

  useEffect(() => {
    if (!visible) return
    void fetchMe().then((fresh) => fresh && setMe(fresh))
  }, [visible])

  const groups = useMemo(() => {
    const allowed = allowedBy(me?.role ?? null, me?.permissions ?? null)
    return GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => allowed(i.permission)) })).filter((g) => g.items.length)
  }, [me])

  const go = (href: string) => {
    haptic('LIGHT')
    navigate(href)
  }

  const logo = me?.store.logo ? assetUrl(me.store.logo) : null

  return (
    <Screen visible={visible} title="الإعدادات">
      <div class="home-body">
        <header class="page-head rise">
          <div class="page-head-text">
            <h1 class="page-title">الإعدادات</h1>
            <p class="page-sub">كل إعدادات متجرك في مكان واحد</p>
          </div>
        </header>

        {me && (
          <section class="card set-store rise">
            <span class="more-logo">{logo ? <img src={logo} alt="" /> : initials(me.store.name)}</span>
            <span class="more-store">
              <b>{me.store.name}</b>
              <small>{me.user.email}</small>
            </span>
            <button
              type="button"
              class="icon-btn press"
              aria-label="زيارة المتجر"
              onClick={() => {
                haptic('LIGHT')
                openExternal(me.store.url)
              }}
            >
              <Icon svg={icons.externalLink()} />
            </button>
          </section>
        )}

        {groups.map((g, gi) => (
          <div key={g.title} class="set-group rise" style={{ animationDelay: `${gi * 40}ms` }}>
            <small>{g.title}</small>
            <div class="card set-list">
              {g.items.map((item) => (
                <button key={item.href} type="button" class="more-row press" onClick={() => go(item.href)}>
                  <span class="more-icon">
                    <Icon svg={item.icon()} />
                  </span>
                  <span class="more-label">
                    {item.label}
                    <span class="set-hint">{item.hint}</span>
                  </span>
                  <Icon svg={icons.chevronLeft()} className="ic an-chev" />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Screen>
  )
}
