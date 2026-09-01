import { SLink as Link } from './store-link'
import { CreditCard } from 'lucide-react'
import type { FooterSettings } from '@/lib/customization'

/* أيقونات السوشيال inline — إصدار lucide الحالي شال أيقونات العلامات التجارية */
type IconProps = { className?: string }
const svg = (path: string) =>
  function Icon({ className }: IconProps) {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
        <path d={path} />
      </svg>
    )
  }

const Facebook = svg('M13 22v-8h2.7l.4-3H13V9.1c0-.9.3-1.5 1.6-1.5H16V5c-.3 0-1.2-.1-2.2-.1-2.2 0-3.8 1.4-3.8 3.9V11H7.5v3H10v8h3Z')
const Instagram = svg('M12 2c2.7 0 3 0 4.1.1 1 0 1.7.2 2.3.4.6.3 1.1.6 1.6 1.1.5.5.8 1 1.1 1.6.2.6.4 1.3.4 2.3.1 1.1.1 1.4.1 4.1s0 3-.1 4.1c0 1-.2 1.7-.4 2.3a4.6 4.6 0 0 1-1.1 1.6 4.6 4.6 0 0 1-1.6 1.1c-.6.2-1.3.4-2.3.4-1.1.1-1.4.1-4.1.1s-3 0-4.1-.1c-1 0-1.7-.2-2.3-.4a4.6 4.6 0 0 1-1.6-1.1 4.6 4.6 0 0 1-1.1-1.6c-.2-.6-.4-1.3-.4-2.3C2 15 2 14.7 2 12s0-3 .1-4.1c0-1 .2-1.7.4-2.3.3-.6.6-1.1 1.1-1.6.5-.5 1-.8 1.6-1.1.6-.2 1.3-.4 2.3-.4C9 2 9.3 2 12 2Zm0 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 8.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4ZM17.4 7.8a1.2 1.2 0 1 1 0-2.4 1.2 1.2 0 0 1 0 2.4Z')
const Youtube = svg('M23 12s0-3.2-.4-4.7a2.5 2.5 0 0 0-1.7-1.7C19.4 5.2 12 5.2 12 5.2s-7.4 0-8.9.4a2.5 2.5 0 0 0-1.7 1.7C1 8.8 1 12 1 12s0 3.2.4 4.7c.2.9.9 1.5 1.7 1.7 1.5.4 8.9.4 8.9.4s7.4 0 8.9-.4c.8-.2 1.5-.8 1.7-1.7.4-1.5.4-4.7.4-4.7ZM9.8 15.3V8.7l6 3.3-6 3.3Z')
const Whatsapp = svg('M17.5 14.4c-.3-.2-1.7-.9-2-1-.3-.1-.5-.2-.6.1-.2.3-.7 1-.9 1.2-.2.2-.3.2-.6.1-1.7-.9-2.9-1.6-4-3.6-.3-.5.3-.5.8-1.6.1-.2 0-.4 0-.5 0-.2-.6-1.5-.9-2-.2-.5-.4-.4-.6-.5H8c-.2 0-.5.1-.7.3-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3.1 5 4.3 1.8.8 2.5.8 3.5.7.5-.1 1.7-.7 2-1.4.2-.7.2-1.2.2-1.4 0-.1-.3-.2-.7-.4ZM12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.3A10 10 0 1 0 12 2Zm0 18.3c-1.5 0-3-.4-4.3-1.2l-.3-.2-2.9.8.8-2.8-.2-.3A8.3 8.3 0 1 1 12 20.3Z')
const XIcon = svg('M18.9 2H22l-6.8 7.8L23.2 22h-6.3l-4.9-6.4L6.3 22H3.2l7.3-8.3L2.8 2h6.4l4.4 5.8L18.9 2Zm-1.1 18.1h1.7L8.3 3.8H6.5l11.3 16.3Z')
const Linkedin = svg('M6.9 21H3.4V9h3.5v12ZM5.2 7.4a2 2 0 1 1 0-4 2 2 0 0 1 0 4ZM21 21h-3.5v-5.8c0-1.4 0-3.2-2-3.2s-2.3 1.5-2.3 3.1V21H9.7V9H13v1.6h.1a3.7 3.7 0 0 1 3.3-1.8c3.5 0 4.2 2.3 4.2 5.3V21Z')
const Snapchat = svg('M12 2c2.6 0 4.5 2 4.6 4.6v2c.5.2 1-.3 1.5-.3.4 0 .9.3.9.8 0 .7-1.3 1-1.8 1.4-.3.2-.4.4-.3.7.6 1.6 2 2.8 3.4 3.1.4.1.6.3.6.6 0 .6-1.2.9-2 1-.2.4-.2 1-.6 1.1-.5.2-1.4-.2-2.3 0-.8.1-1.6 1.4-3.5 1.4s-2.7-1.3-3.5-1.4c-.9-.2-1.8.2-2.3 0-.4-.1-.4-.7-.6-1.1-.8-.1-2-.4-2-1 0-.3.2-.5.6-.6 1.4-.3 2.8-1.5 3.4-3.1.1-.3 0-.5-.3-.7-.5-.4-1.8-.7-1.8-1.4 0-.5.5-.8.9-.8.5 0 1 .5 1.5.3v-2C7.5 4 9.4 2 12 2Z')
const Telegram = svg('M21.9 4.3 18.7 20c-.2 1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.4-5 9.1-8.2c.4-.3-.1-.5-.6-.2L6.3 13.1l-4.8-1.5c-1-.3-1-1 .2-1.5l18.8-7.3c.9-.3 1.6.2 1.4 1.5Z')
const Tiktok = svg('M16 3v3.2a4.8 4.8 0 0 0 3.8 4.7v3A7.7 7.7 0 0 1 16 12.8V16a5.5 5.5 0 1 1-5.5-5.5c.3 0 .6 0 .9.1v3.1a2.5 2.5 0 1 0 1.7 2.3V3H16Z')

/**
 * فوتر المتجر — بيعرض فعلًا كل اللي التاجر يظبطه: نبذة، روابط، سوشيال،
 * أيقونات دفع، وحقوق. أي إعداد يقفله بيختفي، وأي رابط يضيفه بيبان.
 */
export function StoreFooter({
  footer,
  storeName,
  contact,
  policyPages = [],
}: {
  footer: FooterSettings
  storeName: string
  /**
   * بيانات تواصل المتجر — من «إعدادات ← بيانات المتجر».
   *
   * الروابط بقت مكانها هنا لا في تخصيص الفوتر: الرابط بيتغيّر لما
   * التاجر يفتح حسابًا جديدًا مش لما يغيّر شكل متجره.
   *
   * والقيم القديمة اللي في الثيم بتفضل احتياطيًا — التاجر اللي حاطّها
   * من زمان ما يصحاش يلاقي أيقوناته اختفت.
   */
  contact?: {
    phone?: string | null
    whatsapp?: string | null
    social?: Record<string, string> | null
  }
  /** صفحات السياسات المنشورة — بتنضم لروابط الفوتر تلقائيًا */
  policyPages?: Array<{ slug: string; title: string }>
}) {
  const link = (key: string, legacy?: string) =>
    (contact?.social?.[key] || legacy || '').trim()

  const waNumber = (contact?.whatsapp || footer.social.whatsapp || '').replace(/[^\d]/g, '')

  const socials = [
    { key: 'facebook', url: link('facebook', footer.social.facebook), Icon: Facebook, label: 'فيسبوك' },
    { key: 'instagram', url: link('instagram', footer.social.instagram), Icon: Instagram, label: 'إنستجرام' },
    { key: 'youtube', url: link('youtube', footer.social.youtube), Icon: Youtube, label: 'يوتيوب' },
    { key: 'tiktok', url: link('tiktok', footer.social.tiktok), Icon: Tiktok, label: 'تيك توك' },
    { key: 'x', url: link('x'), Icon: XIcon, label: 'إكس' },
    { key: 'linkedin', url: link('linkedin'), Icon: Linkedin, label: 'لينكدإن' },
    { key: 'snapchat', url: link('snapchat'), Icon: Snapchat, label: 'سناب شات' },
    { key: 'telegram', url: link('telegram'), Icon: Telegram, label: 'تيليجرام' },
    { key: 'whatsapp', url: waNumber ? `https://wa.me/${waNumber}` : '', Icon: Whatsapp, label: 'واتساب' },
  ].filter((s) => s.url)

  /*
    التليفون والواتساب في الفوتر.

    التاجر بيحطّهم في بيانات المتجر وبيتوقّع العميل يلاقيهم — وكانوا
    بيتخزّنوا وبس. والعميل اللي عايز يسأل قبل ما يطلب بيدوّر على رقم
    في آخر الصفحة، ولو ما لقاهوش بيسيب المتجر.
  */
  const phone = (contact?.phone || '').trim()

  const hasLinks = footer.links.length > 0 || policyPages.length > 0
  const hasTop =
    footer.about || hasLinks || phone || (footer.showSocial && socials.length > 0)

  return (
    <footer className="mt-8 border-t border-[var(--sf-text)]/10">
      {hasTop && (
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
          {footer.about && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-bold">{storeName}</h3>
              <p className="max-w-xs text-sm leading-relaxed opacity-65">{footer.about}</p>
            </div>
          )}

          {hasLinks && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-bold">روابط</h3>
              <ul className="flex flex-col gap-1.5">
                {policyPages.map((p) => (
                  <li key={p.slug}>
                    <Link
                      href={`/pages/${p.slug}`}
                      className="text-sm opacity-65 transition-opacity hover:opacity-100"
                    >
                      {p.title}
                    </Link>
                  </li>
                ))}
                {footer.links.map((l) => (
                  <li key={l.id}>
                    <a href={l.url} className="text-sm opacity-65 transition-opacity hover:opacity-100">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(phone || waNumber) && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-bold">كلّمنا</h3>
              <ul className="flex flex-col gap-1.5 text-sm opacity-65">
                {phone && (
                  <li>
                    <a href={`tel:${phone.replace(/[^\d+]/g, '')}`} className="transition-opacity hover:opacity-100">
                      <bdi dir="ltr">{phone}</bdi>
                    </a>
                  </li>
                )}
                {waNumber && (
                  <li>
                    <a
                      href={`https://wa.me/${waNumber}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="transition-opacity hover:opacity-100"
                    >
                      واتساب · <bdi dir="ltr">+{waNumber}</bdi>
                    </a>
                  </li>
                )}
              </ul>
            </div>
          )}

          {footer.showSocial && socials.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-bold">تابعنا</h3>
              <div className="flex flex-wrap gap-2">
                {socials.map(({ key, url, Icon, label }) => (
                  <a
                    key={key}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--sf-text)]/15 opacity-70 transition-all hover:bg-[var(--sf-text)]/6 hover:opacity-100"
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="border-t border-[var(--sf-text)]/10 py-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 text-sm opacity-65 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>{footer.copyright || `© ${new Date().getFullYear()} ${storeName}`}</span>

          <div className="flex items-center gap-3">
            {footer.showPaymentIcons && (
              <span className="flex items-center gap-1.5 opacity-80" title="الدفع عند الاستلام والدفع الإلكتروني">
                <CreditCard className="h-4 w-4" aria-hidden="true" />
                <span className="text-xs">دفع عند الاستلام · بطاقات</span>
              </span>
            )}
            {footer.showPoweredBy && <span className="opacity-70">مدعوم بـزاوية</span>}
          </div>
        </div>
      </div>
    </footer>
  )
}
