/** شاشات العرض المباشر والتقارير المفصّلة وجودة الإشارة (live.tsx, reports.tsx, signal.tsx) — فوق كلاسات `an-` */
export const REPORTS_CSS = `
.lv-dot{display:inline-block;width:8px;height:8px;margin-inline-end:6px;border-radius:50%;vertical-align:middle;background:var(--fg-subtle,#8a92ad)}
.lv-dot--on{background:var(--color-success,#15803d);animation:lv-ping 1.6s ease-out infinite}
@keyframes lv-ping{0%{box-shadow:0 0 0 0 rgba(21,128,61,.45)}100%{box-shadow:0 0 0 9px rgba(21,128,61,0)}}
.lv-pulse{color:var(--color-success,#15803d)!important}
.lv-hint{font-size:11.5px;color:var(--fg-subtle,#8a92ad)}
.lv-quiet{margin:12px 0}
.an-kpis+.card,.an-kpis+.sec{margin-top:12px}
.lv-pages,.lv-feed,.sg-errors{display:flex;flex-direction:column;gap:10px;margin:0;padding:0;list-style:none}
.lv-pages li{display:flex;align-items:center;gap:10px;font-size:13px}
.lv-pages bdi{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left;color:var(--fg-muted,#5c6890)}
.lv-pages b{flex:none;font-variant-numeric:tabular-nums}
.lv-feed{max-height:420px;overflow-y:auto}
.lv-feed li{display:flex;align-items:flex-start;gap:10px;font-size:13px;line-height:1.6}
.lv-feed li>span{flex:1;min-width:0}
.lv-feed time{flex:none;font-size:12px;color:var(--fg-subtle,#8a92ad);font-variant-numeric:tabular-nums}
.lv-ev{flex:none;width:7px;height:7px;margin-top:8px;border-radius:50%;background:var(--fg-subtle,#8a92ad)}
.lv-ev--purchase{background:var(--color-success,#15803d)}
.lv-ev--begin_checkout{background:var(--color-warning,#a16207)}
.lv-ev--add_to_cart{background:var(--primary,#634b9a)}
.lv-muted{color:var(--fg-muted,#5c6890)}
.lv-subtle{color:var(--fg-subtle,#8a92ad)}
.lv-money{font-weight:700;color:var(--color-success,#15803d)}
.an-head .act{flex:none;min-height:34px;padding:0 12px}
.rp-sec{margin-bottom:14px}
.rp-sec-head{display:flex;flex-direction:column;gap:3px;margin:4px 4px 8px}
.rp-sec-head b{display:flex;align-items:center;gap:8px;font-size:15.5px}
.rp-sec-head .ic,.rp-sec-head svg{width:18px;height:18px;color:var(--primary,#634b9a)}
.rp-sec-head small{font-size:12px;line-height:1.7;color:var(--fg-subtle,#8a92ad)}
.rp-empty{padding:18px 14px!important;margin:0!important}
.rp-row{display:flex;flex-direction:column;gap:8px;padding:12px 14px}
.rp-row+.rp-row{border-top:1px solid var(--border,#e2e4ec)}
.rp-row>b{font-size:14px}
.rp-facts{display:flex;flex-wrap:wrap;gap:6px}
.rp-fact{display:flex;flex-direction:column;gap:1px;min-width:74px;padding:6px 10px;border-radius:10px;background:var(--surface-2,#f1f2f6)}
.rp-fact small{font-size:11px;color:var(--fg-subtle,#8a92ad)}
.rp-fact b{font-size:13.5px;font-variant-numeric:tabular-nums}
.rp-fact--bad b{color:var(--color-danger,#b91c1c)}
.sg-warn{display:flex;flex-direction:column;gap:10px;margin-bottom:12px}
.sg-warn>b{display:flex;align-items:center;gap:8px;font-size:15px;color:var(--color-warning,#a16207)}
.sg-warn>b .ic,.sg-warn>b svg{width:18px;height:18px}
.sg-warn p{margin:0;font-size:13.5px;line-height:1.8;color:var(--fg-muted,#5c6890)}
.sg-warn .btn{align-self:flex-start}
.sg-score--good{color:var(--color-success,#15803d)}
.sg-score--mid{color:var(--color-warning,#a16207)}
.sg-score--bad{color:var(--color-danger,#b91c1c)}
.sg-score--none{color:var(--fg-subtle,#8a92ad)}
.sg-hint{margin:4px 0 0;font-size:12px;line-height:1.7;color:var(--fg-subtle,#8a92ad)}
.sg-lead{margin:-4px 0 12px}
.sg-pills{display:flex;flex-wrap:wrap;gap:6px}
.sg-pill{padding:6px 10px;border-radius:10px;font-size:12.5px;font-weight:600}
.sg-pill--ok{color:var(--color-success,#15803d);background:var(--color-success-soft,#dcfce7)}
.sg-pill--bad{color:var(--color-danger,#b91c1c);background:var(--color-danger-soft,#fee2e2)}
.sg-pill--muted{color:var(--fg-muted,#5c6890);background:var(--surface-2,#f1f2f6)}
.sg-errors{margin-top:10px}
.sg-errors li{display:flex;align-items:flex-start;gap:8px;padding:8px 10px;border-radius:10px;font-size:12px;background:var(--color-danger-soft,#fee2e2)}
.sg-errors b{flex:none;color:var(--color-danger,#b91c1c)}
.sg-errors code{flex:1;min-width:0;direction:ltr;text-align:left;word-break:break-all}
@media (prefers-reduced-motion:reduce){.lv-dot--on{animation:none}}
`
