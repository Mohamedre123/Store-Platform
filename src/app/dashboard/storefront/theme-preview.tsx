import type { ThemeDefinition } from '@/lib/themes'

/**
 * معاينة مصغّرة للثيم مرسومة بالـCSS.
 *
 * بترسم تخطيط الثيم الحقيقي: شكل البانر وعدد الأعمدة ونسبة الصورة
 * وشكل البطاقة — مش مجرد نفس الرسمة بلون مختلف. لو الثيمين شكلهم
 * واحد هنا، يبقى واحد منهم مالوش لزوم أصلًا.
 *
 * مرسومة لا مصوّرة: أي تعديل على الثيم بيظهر في المعاينة فورًا
 * من غير ما نرفع لقطة شاشة جديدة.
 */
export function ThemePreview({ theme }: { theme: ThemeDefinition }) {
  const { palette: c, layout: l, radius } = theme
  const r = { none: '0', sm: '3px', md: '6px', lg: '10px', full: '999px' }[radius]

  const line = (w: string, opacity = 0.22, h = 3) => (
    <span style={{ display: 'block', width: w, height: h, borderRadius: 99, background: c.text, opacity }} />
  )

  const imageBox = (extra?: React.CSSProperties) => {
    const aspect = l.imageRatio === 'portrait' ? '3 / 4' : l.imageRatio === 'wide' ? '4 / 3' : '1 / 1'
    return { aspectRatio: aspect, background: c.text, opacity: 0.1, borderRadius: r, ...extra }
  }

  /* ───────── الهيدر ───────── */
  const header = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent:
          l.nav === 'centered' ? 'center' : l.nav === 'split' ? 'space-between' : 'flex-start',
        gap: 6,
        height: 22,
        padding: '0 10px',
        background: c.surface,
        borderBottom: `1px solid ${c.text}12`,
      }}
    >
      <span style={{ display: 'block', width: 22, height: 5, borderRadius: 99, background: c.primary }} />
      {l.nav !== 'centered' && (
        <div style={{ display: 'flex', gap: 5, marginInlineStart: l.nav === 'split' ? 0 : 6 }}>
          {[10, 8, 9].map((w, i) => (
            <span key={i} style={{ display: 'block', width: w, height: 3, borderRadius: 99, background: c.text, opacity: 0.28 }} />
          ))}
        </div>
      )}
      {l.showSearchInHeader && (
        <span
          style={{
            marginInlineStart: l.nav === 'split' ? 0 : 'auto',
            display: 'block',
            width: l.nav === 'split' ? 60 : 46,
            height: 9,
            borderRadius: 99,
            background: c.text,
            opacity: 0.08,
          }}
        />
      )}
    </div>
  )

  /* ───────── البانر ───────── */
  const hero = (() => {
    if (l.hero === 'none') return null

    if (l.hero === 'fullbleed') {
      return (
        <div style={{ height: 54, background: c.primary, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4, padding: '0 12px' }}>
          <span style={{ display: 'block', width: '55%', height: 5, borderRadius: 99, background: '#fff', opacity: 0.9 }} />
          <span style={{ display: 'block', width: '35%', height: 3, borderRadius: 99, background: '#fff', opacity: 0.55 }} />
          <span style={{ display: 'block', width: 34, height: 8, borderRadius: r, background: c.accent, marginTop: 3 }} />
        </div>
      )
    }

    if (l.hero === 'split') {
      return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, margin: '8px 10px 0' }}>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
            {line('80%', 0.55, 5)}
            {line('60%', 0.28)}
            <span style={{ display: 'block', width: 30, height: 8, borderRadius: r, background: c.primary, marginTop: 2 }} />
          </div>
          <div style={{ ...imageBox(), background: c.primary, opacity: 1 }} />
        </div>
      )
    }

    if (l.hero === 'stacked') {
      return (
        <>
          <div style={{ height: 34, margin: '8px 10px 0', borderRadius: r, background: c.primary }} />
          <div style={{ display: 'flex', gap: 6, margin: '8px 10px 0', justifyContent: 'center' }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <span key={i} style={{ display: 'block', width: 20, height: 20, borderRadius: 99, background: c.accent, opacity: 0.55 }} />
            ))}
          </div>
        </>
      )
    }

    // boxed
    return (
      <div style={{ height: 42, margin: '8px 10px 0', borderRadius: r, background: c.primary, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4, padding: '0 10px' }}>
        <span style={{ display: 'block', width: '50%', height: 4, borderRadius: 99, background: '#fff', opacity: 0.85 }} />
        <span style={{ display: 'block', width: '32%', height: 3, borderRadius: 99, background: '#fff', opacity: 0.5 }} />
      </div>
    )
  })()

  /* ───────── شريط الأقسام ───────── */
  const categoryStrip =
    l.showCategoryStrip && l.hero !== 'stacked' ? (
      <div style={{ display: 'flex', gap: 5, margin: '8px 10px 0', overflow: 'hidden' }}>
        {[26, 20, 24, 18, 22].map((w, i) => (
          <span key={i} style={{ display: 'block', width: w, height: 8, borderRadius: 99, background: c.text, opacity: 0.09, flexShrink: 0 }} />
        ))}
      </div>
    ) : null

  /* ───────── المنتجات ───────── */
  const products = (() => {
    if (l.card === 'compact') {
      // صفوف أفقية: صورة صغيرة والتفاصيل جنبها
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, margin: '8px 10px 10px' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', padding: 5, borderRadius: r, background: c.surface, border: `1px solid ${c.text}10` }}>
              <span style={{ width: 22, height: 22, flexShrink: 0, ...imageBox({ aspectRatio: undefined }) }} />
              <span style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
                {line('70%', 0.25)}
                {line('40%', 0.15)}
              </span>
              <span style={{ display: 'block', width: 20, height: 7, borderRadius: 99, background: c.primary, flexShrink: 0 }} />
            </div>
          ))}
        </div>
      )
    }

    const count = l.columns * (l.columns === 2 ? 1 : 1)
    return (
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${l.columns}, 1fr)`, gap: l.card === 'editorial' ? 8 : 6, margin: '8px 10px 10px' }}>
        {Array.from({ length: Math.max(count, l.columns) }).map((_, i) => {
          if (l.card === 'overlay') {
            return (
              <div key={i} style={{ position: 'relative', ...imageBox({ opacity: 0.16 }) }}>
                <span style={{ position: 'absolute', insetInlineStart: 5, insetBlockEnd: 5, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {line('26px', 0.5)}
                  <span style={{ display: 'block', width: 16, height: 3, borderRadius: 99, background: c.accent }} />
                </span>
              </div>
            )
          }

          if (l.card === 'framed') {
            return (
              <div key={i} style={{ border: `1px solid ${c.text}18`, borderRadius: r, padding: 4, background: c.surface, display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={imageBox()} />
                {line('80%', 0.24)}
                {line('55%', 0.14)}
                {l.showPriceBadge && (
                  <span style={{ display: 'block', width: 22, height: 7, borderRadius: 3, background: c.accent }} />
                )}
              </div>
            )
          }

          // clean / editorial
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: l.card === 'editorial' ? 5 : 3 }}>
              <span style={imageBox()} />
              {line(l.card === 'editorial' ? '60%' : '75%', 0.24)}
              <span style={{ display: 'block', width: l.card === 'editorial' ? '30%' : '45%', height: 3, borderRadius: 99, background: c.accent }} />
            </div>
          )
        })}
      </div>
    )
  })()

  return (
    <div
      className="pointer-events-none aspect-[4/3] w-full overflow-hidden border-b border-[var(--border)]"
      style={{ background: c.background }}
      aria-hidden="true"
    >
      {header}
      {hero}
      {categoryStrip}
      {products}
    </div>
  )
}
