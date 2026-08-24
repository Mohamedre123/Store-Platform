import type { NextConfig } from 'next'

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined

const nextConfig: NextConfig = {
  reactStrictMode: true,

  images: {
    // صور المنتجات والشعارات تُخزَّن على Supabase Storage
    remotePatterns: [
      ...(supabaseHost
        ? [{ protocol: 'https' as const, hostname: supabaseHost, pathname: '/storage/v1/object/public/**' }]
        : []),
      { protocol: 'https' as const, hostname: '**.supabase.co', pathname: '/storage/v1/object/public/**' },
    ],
    formats: ['image/avif', 'image/webp'],
  },

  // نطاقات المتاجر تتغيّر ديناميكيًا، فالمضيف يُقرأ من الهيدر في الـmiddleware
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },

          /**
           * HTTPS إجباري لسنتين، بما فيها النطاقات الفرعية.
           *
           * من غيرها، أول زيارة على http بتمشي بالنص المكشوف —
           * وكوكي الجلسة بيروح فيها. المتاجر كلها على نطاقات فرعية
           * عندنا فلازم تشملهم.
           */
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },

          /**
           * منع التأطير.
           *
           * من غيرها حد يحطّ لوحة التاجر في إطار شفاف فوق صفحته
           * ويخلّيه يضغط على «احذف» وهو فاكر إنه بيضغط على حاجة
           * تانية (clickjacking). `frame-ancestors` هي البديل الحديث
           * لـ`X-Frame-Options` وبتدعم استثناءً لنفس الأصل — وده
           * اللي محرّر الثيم محتاجه عشان معاينته تشتغل.
           */
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },

          /**
           * صلاحيات المتصفح.
           *
           * المنصة مش بتستخدم كاميرا ولا ميكروفون ولا موقع، وأي
           * سكربت طرف تالت (بكسل إعلانات مثلًا) ما يصحّش يقدر
           * يطلبهم باسم متجر التاجر.
           */
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
          },
        ],
      },
    ]
  },
}

export default nextConfig
