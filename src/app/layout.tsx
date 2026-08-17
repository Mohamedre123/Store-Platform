import type { Metadata, Viewport } from 'next'
import { IBM_Plex_Sans_Arabic } from 'next/font/google'
import './globals.css'

const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-plex-arabic',
  display: 'swap',
  fallback: ['Segoe UI', 'Tahoma', 'system-ui', 'sans-serif'],
})

export const metadata: Metadata = {
  title: {
    default: 'زاوية — منصة متاجر متكاملة',
    template: '%s | زاوية',
  },
  description:
    'أنشئ متجرك الإلكتروني وابدأ البيع في دقائق. إدارة طلبات ومنتجات وشحن ودفع وتسويق — في مكان واحد.',
  applicationName: 'زاوية',
  authors: [{ name: 'Zawya' }],
  formatDetection: { telephone: false, address: false, email: false },
  openGraph: {
    type: 'website',
    locale: 'ar_EG',
    siteName: 'زاوية',
  },
  icons: {
    icon: '/brand/zawya-logo.png',
    apple: '/brand/zawya-logo.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // نسمح بالتكبير — منعه مشكلة وصولية حقيقية
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f6f9' },
    { media: '(prefers-color-scheme: dark)', color: '#14162a' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={plexArabic.variable} suppressHydrationWarning>
      {/*
        بعض إضافات المتصفح تضيف خصائص على body قبل تحميل React،
        فيظهر تحذير عدم تطابق. التجاهل هنا مقصود ولا يخفي أخطاءنا.
      */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  )
}
