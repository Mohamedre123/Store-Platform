/** شاشة البوستات (posts.tsx) */
export const STUDIO_CSS = `
.pst-list{display:flex;flex-direction:column;gap:14px}
.pst-gap{margin:0 0 12px}
.pst-note-btn{display:flex;width:100%;margin-top:10px;min-height:42px}
.pst-card{overflow:hidden;padding:0}
.pst-media{display:block;width:100%;aspect-ratio:1/1;object-fit:cover;background:var(--surface-2,#f1f2f6)}
video.pst-media{background:#000}
.pst-carousel{padding:12px 12px 0}
.pst-strip{display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.pst-strip::-webkit-scrollbar{display:none}
.pst-slide{position:relative;flex:0 0 72%;aspect-ratio:1/1;border-radius:14px;overflow:hidden;scroll-snap-align:start;background:var(--surface-2,#f1f2f6)}
.pst-slide img{width:100%;height:100%;object-fit:cover}
.pst-slide b{position:absolute;top:8px;inset-inline-start:8px;min-width:22px;height:22px;padding:0 6px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff;background:rgba(0,0,0,.6)}
.pst-carousel>small{display:block;margin-top:6px;text-align:center;font-size:11.5px;color:var(--fg-subtle,#8a92ad)}
.pst-body{display:flex;flex-direction:column;gap:10px;padding:14px 16px 16px}
.pst-meta{display:flex;align-items:center;flex-wrap:wrap;gap:8px}
.pst-meta small{font-size:12px;color:var(--fg-subtle,#8a92ad)}
.pst-pill{padding:2px 9px;border-radius:999px;font-size:11.5px;font-weight:700}
.pst-pill--muted{color:var(--fg-muted,#5c6890);background:var(--surface-2,#f1f2f6)}
.pst-pill--primary{color:var(--primary,#634b9a);background:var(--primary-soft,#ece8f5)}
.pst-pill--info{color:var(--color-info,#1d4ed8);background:var(--color-info-soft,#dbeafe)}
.pst-pill--good{color:var(--color-success,#15803d);background:var(--color-success-soft,#dcfce7)}
.pst-pill--bad{color:var(--color-danger,#b91c1c);background:var(--color-danger-soft,#fee2e2)}
.pst-caption{margin:0;font-size:14.5px;line-height:1.85;white-space:pre-line;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
.pst-caption--open{display:block;-webkit-line-clamp:unset}
.pst-tags{margin:0;font-size:12.5px;line-height:1.7;color:var(--primary,#634b9a);word-break:break-word}
.pst-results{display:flex;flex-direction:column;gap:5px;padding:10px 12px;border-radius:12px;background:var(--surface-2,#f1f2f6)}
.pst-result{display:flex;align-items:center;flex-wrap:wrap;gap:6px;font-size:12.5px;color:var(--fg-muted,#5c6890)}
.pst-result i,.pst-account i{flex:none;width:9px;height:9px;border-radius:50%}
.pst-ok{color:var(--color-success,#15803d)}
.pst-err{color:var(--color-danger,#b91c1c);font-weight:600}
.pst-actions{display:flex;flex-wrap:wrap;gap:8px}
.pst-actions .act{flex:1 1 calc(50% - 4px);min-height:42px;padding:0 10px}
.pst-actions .act .ic,.pst-actions .act svg{width:16px;height:16px}
.pst-wide{flex:1 1 100%}
.pst-del{flex:none;width:42px;height:42px;color:var(--color-danger,#b91c1c)!important}
.pst-hint{font-size:12px;line-height:1.7;color:var(--fg-subtle,#8a92ad)}
.pst-account{display:inline-flex;align-items:center;gap:6px}
.pst-account small{font-size:11px;opacity:.65}
`
