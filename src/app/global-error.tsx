'use client'

import { useEffect } from 'react'

/**
 * آخر خط دفاع: الخطأ وقع في التخطيط الجذري نفسه.
 *
 * ## ليه الأنماط مكتوبة في السطر
 * الملف ده بيحلّ محلّ التخطيط الجذري كله — يعني `<html>` و`<body>`
 * والخطوط وملف الأنماط كلهم مش موجودين. أي `className` من تيلويند
 * هنا ما بيتطبّقش، والنتيجة نص أسود على أبيض بخط المتصفح الافتراضي
 * وبمحاذاة شمال في صفحة عربية. الأنماط في السطر هي الوحيدة المضمونة.
 *
 * ## بيتنادى نادرًا جدًا
 * أخطاء الصفحات بيمسكها `error.tsx` قبل ما توصل هنا. ده بس لما
 * التخطيط الجذري نفسه يقع.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('خطأ في التخطيط الجذري:', error.digest ?? '', error)
  }, [error])

  return (
    <html lang="ar" dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1.25rem',
          padding: '1.5rem',
          textAlign: 'center',
          background: '#f6f6f9',
          color: '#222540',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Tahoma, Arial, sans-serif',
        }}
      >
        <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700 }}>حصلت مشكلة مؤقتة</h1>

        <p style={{ margin: 0, maxWidth: '26rem', lineHeight: 1.7, color: '#5c6890' }}>
          الصفحة ما قدرتش تحمّل دلوقتي. جرّب تاني — ده بيحصل ساعات وقت التحديثات وبيعدّي في ثواني.
        </p>

        <button
          type="button"
          onClick={reset}
          style={{
            minHeight: '2.75rem',
            padding: '0 1.5rem',
            borderRadius: '0.75rem',
            border: 'none',
            background: '#634b9a',
            color: '#ffffff',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          جرّب تاني
        </button>

        {error.digest && (
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#8a92ad' }}>
            رقم الخطأ: <bdi dir="ltr">{error.digest}</bdi>
          </p>
        )}
      </body>
    </html>
  )
}
