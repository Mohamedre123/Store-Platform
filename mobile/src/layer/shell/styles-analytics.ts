/**
 * تنسيق شاشتي التحليلات والشحنات.
 *
 * الحركة كلها transform/opacity — الأعمدة بتطلع بـscale مش بتغيير الارتفاع.
 */
export const ANALYTICS_CSS = `
.an-kpis{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.an-kpi{display:flex;flex-direction:column;align-items:flex-start;gap:6px;min-width:0;padding:14px}
.an-kpi-label{font-size:12px;color:var(--fg-muted,#5c6890)}
.an-kpi-value{max-width:100%;font-size:19px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.an-kpi-value--neg{color:var(--color-danger,#b91c1c)}
.an-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px}
.an-head b{font-size:15.5px}
.an-head span{font-size:12.5px;color:var(--fg-muted,#5c6890)}
.an-none{margin:6px 0;padding:14px 0;text-align:center;font-size:13.5px;line-height:1.8;color:var(--fg-muted,#5c6890)}
.an-pick{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:12px}
.an-pick b{font-size:21px;font-variant-numeric:tabular-nums}
.an-pick span{font-size:12.5px;color:var(--fg-muted,#5c6890)}
.an-bars{display:flex;align-items:flex-end;gap:4px;height:150px;direction:ltr;touch-action:pan-y}
.an-bar{flex:1;min-width:0;height:100%;display:flex;align-items:flex-end}
.an-bar i{display:block;width:100%;border-radius:7px 7px 3px 3px;background:var(--primary-soft,#ece8f5);transform-origin:50% 100%;animation:an-grow .6s cubic-bezier(.16,1,.3,1) both;transition:background-color .2s ease}
.an-bar--on i{background:var(--primary,#634b9a)}
@keyframes an-grow{from{transform:scaleY(0)}to{transform:none}}
.an-x{display:flex;justify-content:space-between;direction:ltr;margin-top:8px;font-size:11px;color:var(--fg-subtle,#8a92ad)}
.an-foot{margin:12px 0 0;font-size:12.5px;color:var(--fg-muted,#5c6890)}
.an-foot b{color:var(--fg,#222540)}
.an-meters{display:flex;flex-direction:column;gap:13px}
.an-meter-top{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:13.5px}
.an-meter-top span:first-child{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.an-meter-top span:last-child{flex:none;font-size:12.5px;color:var(--fg-muted,#5c6890);font-variant-numeric:tabular-nums}
.an-track{height:8px;margin-top:6px;border-radius:99px;overflow:hidden;background:var(--surface-2,#f1f2f6)}
.an-track i{display:block;height:100%;border-radius:99px;background:var(--primary,#634b9a);transform-origin:100% 50%;animation:an-fill .7s cubic-bezier(.16,1,.3,1) both}
@keyframes an-fill{from{transform:scaleX(0)}to{transform:none}}
.an-drop{display:block;margin-top:4px;font-size:11.5px;color:var(--color-danger,#b91c1c)}
.an-links{display:flex;flex-direction:column;gap:8px}
.an-link{display:flex;align-items:center;gap:12px;width:100%;min-height:62px;padding:10px 14px;border:1px solid var(--border,#e2e4ec);border-radius:18px;background:var(--surface,#fff);text-align:start;font-size:14.5px!important;font-weight:600}
.an-link>.ic:first-child{width:22px;height:22px;color:var(--primary,#634b9a)}
.an-link span{flex:1;min-width:0}
.an-link small{display:block;margin-top:2px;font-size:12px;font-weight:400;color:var(--fg-muted,#5c6890)}
.an-chev{width:18px!important;height:18px!important;color:var(--fg-subtle,#8a92ad)}

/* ─── الشحنات ─── */
.sh-list-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:14px 14px 6px}
.sh-list-head b{font-size:15px}
.sh-icon{width:40px;height:40px;flex:none;border-radius:13px;display:flex;align-items:center;justify-content:center;color:var(--primary,#634b9a);background:var(--primary-soft,#ece8f5)}
.sh-icon .ic{width:20px;height:20px}
.sh-cod{margin-top:8px;padding:7px 10px;border-radius:12px;font-size:12.5px;font-weight:600;color:var(--color-warning,#a16207);background:var(--color-warning-soft,#fef3c7)}
.fact b.warn{color:var(--color-warning,#a16207)}
.fact b.bad{color:var(--color-danger,#b91c1c)}

@media (prefers-reduced-motion:reduce){.an-bar i,.an-track i{animation:none!important}}
`
