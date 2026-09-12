/**
 * تنسيق شاشات الطلبات، وإطار الشاشات، واللوحة اللي من تحت.
 */
export const ORDERS_CSS = `
/* ─── إطار شاشة التفاصيل ─── */
.screen--detail.home--hidden{transform:translate3d(-14%,0,0)}
.appbar{position:absolute;top:0;left:0;right:0;z-index:3;height:56px;display:flex;align-items:center;gap:2px;padding:0 6px;background:var(--bg,#f6f6f9);border-bottom:1px solid transparent;transition:border-color .2s ease}
.appbar--scrolled{border-bottom-color:var(--border,#e2e4ec)}
.appbar-btn{width:44px;height:44px;flex:none;display:flex;align-items:center;justify-content:center;border:0;border-radius:14px;background:none;color:var(--fg,#222540)}
.appbar-btn:active{background:var(--surface-2,#f1f2f6)}
.appbar-btn .ic{width:24px;height:24px}
.appbar-title{flex:1;min-width:0;text-align:center;font-size:16px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:0;transform:translate3d(0,6px,0);transition:opacity .2s ease,transform .2s ease}
.appbar-title--on{opacity:1;transform:none}
.appbar-actions{min-width:44px;display:flex;justify-content:flex-end}
.home-scroll--bar{top:56px}
.hptr--below-bar{top:56px}

/* ─── رأس الصفحة ─── */
.page-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;padding:16px 2px 2px}
.page-head-text{min-width:0}
.page-title{margin:0;font-size:28px;line-height:1.25;font-weight:700;letter-spacing:-.01em}
.page-sub{margin:2px 0 0;font-size:13px;color:var(--fg-muted,#5c6890)}
.pill-btn{flex:none;display:inline-flex;align-items:center;gap:6px;min-height:42px;padding:0 15px;border:0;border-radius:999px;font-size:13.5px!important;font-weight:700;color:var(--primary-fg,#fff)!important;background:var(--primary,#634b9a);box-shadow:0 10px 22px -12px rgba(99,75,154,.85)}
.pill-btn .ic{width:18px;height:18px}

/* ─── الفلاتر ─── */
.frail{display:flex;gap:8px;margin-right:-16px;margin-left:-16px;padding:2px 16px 6px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.frail::-webkit-scrollbar{display:none}
.fchip{flex:none;display:inline-flex;align-items:center;gap:6px;min-height:38px;padding:0 14px;border-radius:999px;border:1px solid var(--border-strong,#cdd1de);background:var(--surface,#fff);font-size:13px!important;font-weight:600;color:var(--fg-muted,#5c6890)!important;transition:background .2s ease,color .2s ease,border-color .2s ease}
.fchip-n{min-width:20px;height:20px;padding:0 6px;border-radius:10px;display:inline-flex;align-items:center;justify-content:center;font-size:11px;background:var(--surface-2,#f1f2f6);color:var(--fg-muted,#5c6890)}
.fchip--on{background:var(--fg,#222540);border-color:var(--fg,#222540);color:var(--bg,#f6f6f9)!important}
.fchip--on .fchip-n{background:rgba(128,128,160,.25);color:inherit}
.fchip--warn{color:var(--color-warning,#a16207)!important}
.fchip--warn.fchip--on{background:var(--color-warning,#a16207);border-color:var(--color-warning,#a16207);color:#fff!important}

/* ─── كروت الطلبات ─── */
.olist{display:flex;flex-direction:column;gap:10px}
.ocard{display:block;padding:14px 14px 12px;border-radius:20px;border:1px solid var(--border,#e2e4ec);background:var(--surface,#fff);box-shadow:0 1px 2px rgba(34,37,64,.04),0 12px 30px -26px rgba(34,37,64,.45);cursor:pointer;outline:none}
.ocard-top{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.ocard-no{font-size:15px;font-weight:700}
.ocard-total{margin-inline-start:auto;font-size:16px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}
.ocard-name{margin-top:8px;font-size:14.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ocard-city{font-weight:400;color:var(--fg-muted,#5c6890)}
.ocard-meta{margin-top:2px;font-size:12px;color:var(--fg-subtle,#8a92ad)}
.ocard-actions{display:flex;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid var(--border,#e2e4ec)}
.act{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:40px;border:0;border-radius:12px;background:var(--surface-2,#f1f2f6);font-size:13px!important;font-weight:600;color:var(--fg,#222540)!important}
.act .ic{width:17px;height:17px}
.act--wa{background:var(--color-success-soft,#dcfce7);color:var(--color-success,#15803d)!important}
.tchip{display:inline-flex;align-items:center;gap:3px;padding:1px 7px;border-radius:999px;font-size:11px;font-weight:600}
.tchip .ic{width:12px;height:12px}
.tchip--good{background:var(--color-success-soft,#dcfce7);color:var(--color-success,#15803d)}
.tchip--watch{background:var(--color-warning-soft,#fef3c7);color:var(--color-warning,#a16207)}
.tchip--risky{background:var(--color-danger-soft,#fee2e2);color:var(--color-danger,#b91c1c)}

.empty{min-height:46vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:24px;text-align:center}
.empty--compact{min-height:0;padding:28px 12px}
.empty-icon{width:68px;height:68px;margin-bottom:8px;border-radius:22px;display:flex;align-items:center;justify-content:center;color:var(--primary,#634b9a);background:var(--primary-soft,#ece8f5)}
.empty-icon .ic{width:30px;height:30px}
.empty b{font-size:16.5px}
.empty p{margin:0 0 10px;font-size:14px;color:var(--fg-muted,#5c6890)}
.empty .btn{max-width:260px}

/* ─── تفاصيل الطلب ─── */
.d-head{padding:8px 4px 2px}
.d-head-row{display:flex;align-items:center;gap:8px}
.d-no{font-size:26px;font-weight:700;letter-spacing:-.01em}
.pill--lg{padding:3px 11px;font-size:12.5px}
.d-total{display:block;margin-top:6px;font-size:30px;line-height:1.3;font-weight:700;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.d-date{display:block;margin-top:2px;font-size:13px;color:var(--fg-muted,#5c6890)}
.sec{padding:16px}
.card-title{margin:0 0 12px;display:flex;align-items:center;gap:8px;font-size:16px;font-weight:700}
.count{min-width:22px;height:22px;padding:0 7px;border-radius:11px;display:inline-flex;align-items:center;justify-content:center;font-size:12px;background:var(--surface-2,#f1f2f6);color:var(--fg-muted,#5c6890)}
.sec-row{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px}
.sec-row .card-title{margin:0}
.channel-btn{display:inline-flex;align-items:center;gap:5px;min-height:34px;padding:0 10px;border-radius:999px;border:1px solid var(--border-strong,#cdd1de);background:var(--surface,#fff);font-size:12px!important;color:var(--fg-muted,#5c6890)!important}
.channel-btn .ic{width:14px;height:14px}

.btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:48px;padding:0 16px;border:1px solid transparent;border-radius:14px;font-size:14.5px!important;font-weight:700;transition:transform .16s ease,opacity .2s ease}
.btn .ic{width:19px;height:19px}
.btn:disabled{opacity:.55}
.btn--lg{min-height:56px;border-radius:16px;font-size:16px!important}
.btn--primary{color:var(--primary-fg,#fff)!important;background:var(--primary,#634b9a);box-shadow:0 12px 26px -14px rgba(99,75,154,.9)}
.btn--ghost{color:var(--fg,#222540)!important;background:var(--surface-2,#f1f2f6)}
.btn--wa{color:#fff!important;background:var(--color-success,#15803d)}
.btn--danger{color:#fff!important;background:var(--color-danger,#b91c1c)}
.sec .btn+.btn{margin-top:8px}
.btn-row{display:flex;gap:8px;margin-top:12px}
.btn--block{margin-top:4px}
.fine{margin:10px 2px 0;font-size:11.5px;line-height:1.6;color:var(--fg-subtle,#8a92ad)}
.spinner{width:18px;height:18px;flex:none;border-radius:50%;border:2px solid currentColor;border-top-color:transparent;animation:h-spin .7s linear infinite}

.callout{display:flex;gap:12px;padding:16px;border-color:transparent;background:var(--color-warning-soft,#fef3c7)}
.callout-icon{width:42px;height:42px;flex:none;border-radius:13px;display:flex;align-items:center;justify-content:center;color:var(--color-warning,#a16207);background:var(--surface,#fff)}
.callout-icon .ic{width:21px;height:21px}
.callout-text{flex:1;min-width:0}
.callout-text b{display:block;font-size:15px;color:var(--color-warning,#a16207)}
.callout-text p{margin:4px 0 12px;font-size:13px;line-height:1.7;color:var(--fg-muted,#5c6890)}

.trust{padding:14px 16px;border-color:transparent}
.trust--good{background:var(--color-success-soft,#dcfce7);color:var(--color-success,#15803d)}
.trust--watch{background:var(--color-warning-soft,#fef3c7);color:var(--color-warning,#a16207)}
.trust--risky{background:var(--color-danger-soft,#fee2e2);color:var(--color-danger,#b91c1c)}
.trust--new{background:var(--surface-2,#f1f2f6);color:var(--fg-muted,#5c6890)}
.trust-head{display:flex;align-items:center;gap:8px;font-size:14.5px;font-weight:700}
.trust-head .ic{width:18px;height:18px}
.trust-score{margin-inline-start:auto;font-size:14px}
.trust ul{margin:8px 0 0;padding:0 18px 0 0;font-size:12.5px;line-height:1.75;opacity:.92}
.trust-net{margin:6px 0 0;font-size:11.5px;opacity:.75}

.confirm{display:flex;gap:12px;margin-bottom:12px}
.confirm-icon{width:40px;height:40px;flex:none;border-radius:12px;display:flex;align-items:center;justify-content:center}
.confirm-icon .ic{width:19px;height:19px}
.confirm-icon--success{background:var(--color-success-soft,#dcfce7);color:var(--color-success,#15803d)}
.confirm-icon--danger{background:var(--color-danger-soft,#fee2e2);color:var(--color-danger,#b91c1c)}
.confirm-icon--warning{background:var(--color-warning-soft,#fef3c7);color:var(--color-warning,#a16207)}
.confirm-icon--muted{background:var(--surface-2,#f1f2f6);color:var(--fg-muted,#5c6890)}
.confirm-text{flex:1;min-width:0}
.confirm-text b{display:block;font-size:14.5px}
.confirm-text p{margin:3px 0 0;font-size:12.5px;line-height:1.7;color:var(--fg-muted,#5c6890)}

.items .item{display:flex;align-items:flex-start;gap:12px;padding:10px 0}
.items .item+.item{border-top:1px solid var(--border,#e2e4ec)}
.item-main{flex:1;min-width:0}
.item-main>b{display:block;font-size:14px;font-weight:600;line-height:1.5}
.opts{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}
.opt{padding:1px 7px;border-radius:7px;font-size:11px;color:var(--fg-muted,#5c6890);background:var(--surface-2,#f1f2f6)}
.opt b{font-weight:600;color:var(--fg,#222540)}
.item-sub{display:block;margin-top:3px;font-size:12px;color:var(--fg-subtle,#8a92ad)}
.item-total{flex:none;font-size:14px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}
.totals{display:flex;flex-direction:column;gap:6px;margin:10px 0 0;padding-top:10px;border-top:1px solid var(--border,#e2e4ec);font-size:13.5px}
.totals>div{display:flex;justify-content:space-between;gap:12px}
.totals dt{color:var(--fg-muted,#5c6890)}
.totals dd{margin:0;font-variant-numeric:tabular-nums}
.totals .totals-grand{margin-top:4px;padding-top:8px;border-top:1px solid var(--border,#e2e4ec);font-size:16px;font-weight:700}
.totals .totals-grand dt{color:var(--fg,#222540)}
.profit{display:flex;justify-content:space-between;margin-top:10px;padding:10px 12px;border-radius:12px;font-size:13.5px;background:var(--surface-2,#f1f2f6)}
.profit--up b{color:var(--color-success,#15803d)}
.profit--down b{color:var(--color-danger,#b91c1c)}

.kv{display:flex;align-items:flex-start;gap:10px;padding:6px 0;font-size:14px;line-height:1.6}
.kv>.ic{width:18px;height:18px;margin-top:2px;color:var(--fg-subtle,#8a92ad)}
.muted{color:var(--fg-muted,#5c6890)}
.small{font-size:13px;margin:0 0 10px}
.ellip{max-width:100%;overflow:hidden;text-overflow:ellipsis;word-break:break-all}

.timeline{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:12px}
.tl{display:flex;gap:10px}
.tl-dot{width:10px;height:10px;margin-top:7px;flex:none;border-radius:50%;background:var(--primary,#634b9a);box-shadow:0 0 0 4px var(--primary-soft,#ece8f5)}
.tl--stage .tl-dot{background:var(--color-warning,#a16207);box-shadow:0 0 0 4px var(--color-warning-soft,#fef3c7)}
.tl--message_sent .tl-dot{background:var(--color-success,#15803d);box-shadow:0 0 0 4px var(--color-success-soft,#dcfce7)}
.tl-msg{display:block;font-size:13.5px;line-height:1.6}
.tl-time{display:block;font-size:11.5px;color:var(--fg-subtle,#8a92ad)}
.note-box{display:flex;align-items:flex-end;gap:8px;margin-top:14px}
.note-box textarea{flex:1;min-height:48px;max-height:160px;resize:vertical;padding:12px;border:1px solid var(--border-strong,#cdd1de);border-radius:14px;background:var(--surface-2,#f1f2f6);color:var(--fg,#222540);font:inherit;font-size:14px;line-height:1.5;outline:none}
.note-box textarea:focus{border-color:var(--primary,#634b9a)}
.note-box .btn{width:48px;flex:none;padding:0}

/* ─── اللوحة اللي من تحت ─── */
.sheet{position:fixed;top:0;right:0;bottom:0;left:0;z-index:20;pointer-events:none;direction:rtl;color:var(--fg,#222540);font-family:var(--font-plex-arabic),'IBM Plex Sans Arabic','Segoe UI',Tahoma,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.sheet button{font:inherit;color:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}
.sheet-backdrop{position:absolute;top:0;right:0;bottom:0;left:0;background:rgba(10,10,24,.46);opacity:0;transition:opacity .28s ease}
.sheet-panel{position:absolute;left:0;right:0;bottom:0;max-height:84vh;overflow-y:auto;padding:8px 14px calc(18px + env(safe-area-inset-bottom,0px));border-radius:26px 26px 0 0;background:var(--surface,#fff);box-shadow:0 -24px 48px -24px rgba(0,0,0,.4);transform:translate3d(0,105%,0);transition:transform .4s cubic-bezier(.2,.9,.2,1)}
.sheet--open{pointer-events:auto}
.sheet--open .sheet-backdrop{opacity:1}
.sheet--open .sheet-panel{transform:none}
.sheet-grip{display:block;width:40px;height:5px;margin:4px auto 12px;border-radius:3px;background:var(--border-strong,#cdd1de)}
.sheet-title{margin:0 6px 10px;font-size:17px;font-weight:700}
.sheet-text{margin:0 6px 6px;font-size:14px;line-height:1.75;color:var(--fg-muted,#5c6890)}
.sheet-list{display:flex;flex-direction:column;gap:2px}
.sheet-row{display:flex;align-items:center;gap:12px;width:100%;min-height:54px;padding:8px 10px;border:0;border-radius:14px;background:none;text-align:start;font-size:15px!important}
.sheet-row:active{background:var(--surface-2,#f1f2f6)}
.sheet-row--on{background:var(--primary-soft,#ece8f5)}
.sheet-row:disabled{opacity:1;cursor:default}
.sheet-row .dot{width:12px;height:12px;flex:none;border-radius:50%}
.sheet-row-icon{width:38px;height:38px;flex:none;border-radius:12px;display:flex;align-items:center;justify-content:center;color:var(--primary,#634b9a);background:var(--surface-2,#f1f2f6)}
.sheet-row-icon .ic{width:18px;height:18px}
.sheet-row-label{flex:1;min-width:0;font-weight:600}
.sheet-row-label small{display:block;font-size:12px;font-weight:400;color:var(--fg-muted,#5c6890)}
.sheet-check{width:20px;height:20px;color:var(--primary,#634b9a)}
.sheet .btn-row{padding:0 4px}

@media (prefers-reduced-motion:reduce){
  .sheet-panel,.sheet-backdrop,.appbar-title{transition:none!important}
}
`
