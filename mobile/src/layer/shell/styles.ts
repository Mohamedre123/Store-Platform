/**
 * تنسيق الشاشات الأصلية.
 *
 * كل الألوان من توكنات المنصة (`--bg` و`--surface` و`--primary`...)
 * فالوضع الداكن والفاتح بيتبعوا اختيار التاجر في المنصة لوحدهم. القيم
 * بعد الفاصلة احتياطي لو الصفحة لسه ما حمّلتش تنسيقها.
 */
export const SHELL_CSS = `
.home,.tabbar{font-family:var(--font-plex-arabic),'IBM Plex Sans Arabic','Segoe UI',Tahoma,system-ui,sans-serif;direction:rtl;-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent;color:var(--fg,#222540)}
.home button,.tabbar button{font:inherit;color:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}
.ic{display:inline-flex;align-items:center;justify-content:center;flex:none}
.ic svg{width:100%;height:100%}
.num{direction:ltr;unicode-bidi:isolate;display:inline-block}
.press{transition:transform .16s ease}
.press:active{transform:scale(.97)}
@keyframes h-rise{from{opacity:0;transform:translate3d(0,14px,0)}to{opacity:1;transform:none}}
.rise{animation:h-rise .55s cubic-bezier(.16,1,.3,1) both}

/* ─── الشاشة ─── */
.home{position:fixed;top:0;right:0;bottom:0;left:0;pointer-events:auto;background:var(--bg,#f6f6f9);transition:opacity .28s ease,transform .34s cubic-bezier(.2,.8,.2,1);will-change:transform,opacity}
.home--hidden{opacity:0;transform:translate3d(10%,0,0);pointer-events:none;visibility:hidden;transition:opacity .22s ease,transform .3s cubic-bezier(.4,0,.2,1),visibility 0s linear .3s}
.home-scroll{position:absolute;top:0;right:0;bottom:0;left:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior-y:contain;-webkit-overflow-scrolling:touch}
.home-body{padding:6px 16px calc(64px + 32px + env(safe-area-inset-bottom,0px));max-width:720px;margin:0 auto}
.home-body>*+*{margin-top:14px}
.home-bar{position:absolute;top:0;left:0;right:0;z-index:3;height:50px;display:flex;align-items:center;justify-content:center;padding:0 60px;font-size:16px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:var(--surface,#fff);border-bottom:1px solid var(--border,#e2e4ec);opacity:0;transform:translate3d(0,-8px,0);transition:opacity .22s ease,transform .22s ease;pointer-events:none}
@supports ((-webkit-backdrop-filter:blur(1px)) or (backdrop-filter:blur(1px))) and (background:color-mix(in srgb,red 50%,blue)){.home-bar{background:color-mix(in srgb,var(--bg,#f6f6f9) 80%,transparent);-webkit-backdrop-filter:blur(18px) saturate(1.7);backdrop-filter:blur(18px) saturate(1.7)}}
.home-bar--on{opacity:1;transform:none}

.hptr{position:absolute;top:0;left:50%;z-index:4;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--primary,#634b9a);background:var(--surface,#fff);box-shadow:0 8px 22px -8px rgba(34,37,64,.45);opacity:0;transform:translate3d(-50%,-48px,0);pointer-events:none}
.hptr .ic{width:20px;height:20px}
.hptr--settle{transition:transform .3s cubic-bezier(.16,1,.3,1),opacity .3s ease}
.hptr--spin .ic{animation:h-spin .75s linear infinite}
@keyframes h-spin{to{transform:rotate(360deg)}}

/* ─── الهيدر ─── */
.h-top{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 2px 4px}
.h-ident{display:flex;align-items:center;gap:12px;min-width:0}
.h-logo{width:50px;height:50px;border-radius:16px;flex:none;display:flex;align-items:center;justify-content:center;overflow:hidden;font-size:18px;font-weight:700;color:#fff;background:linear-gradient(145deg,#8a72c4,#634b9a 60%,#47366a);box-shadow:0 10px 24px -12px rgba(99,75,154,.8)}
.h-logo img{width:100%;height:100%;object-fit:contain;background:#fff;padding:4px}
.h-names{min-width:0}
.h-hello{margin:0;font-size:13.5px;color:var(--fg-muted,#5c6890)}
.h-title{margin:1px 0 0;font-size:24px;line-height:1.3;font-weight:700;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.icon-btn{width:46px;height:46px;flex:none;display:flex;align-items:center;justify-content:center;border-radius:15px;border:1px solid var(--border,#e2e4ec);background:var(--surface,#fff)}
.icon-btn .ic{width:20px;height:20px}

/* ─── العناصر العامة ─── */
.card{background:var(--surface,#fff);border:1px solid var(--border,#e2e4ec);border-radius:22px;box-shadow:0 1px 2px rgba(34,37,64,.04),0 12px 32px -24px rgba(34,37,64,.4)}
.sec-head{display:flex;align-items:center;justify-content:space-between;margin:10px 4px 10px}
.sec-title{margin:0;font-size:17px;font-weight:700}
.sec-link{border:0;background:none;padding:6px 4px;font-size:14px;font-weight:600;color:var(--primary,#634b9a)!important}
.stack>*+*{margin-top:10px}
.chev{width:18px;height:18px;color:var(--fg-subtle,#8a92ad)}
.badge{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:999px;font-size:11px;font-weight:700;color:var(--primary-fg,#fff);background:var(--primary,#634b9a)}
.badge .ic{width:12px;height:12px}

.delta{display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:999px;font-size:11.5px;font-weight:700;white-space:nowrap}
.delta--up{background:var(--color-success-soft,#dcfce7);color:var(--color-success,#15803d)}
.delta--down{background:var(--color-danger-soft,#fee2e2);color:var(--color-danger,#b91c1c)}
.delta--none{background:var(--surface-2,#f1f2f6);color:var(--fg-subtle,#8a92ad)}
.spark{width:56px;height:24px;flex:none;overflow:visible}

.ring{position:relative;flex:none;display:inline-flex}
.ring>svg{width:100%;height:100%;transform:rotate(-90deg)}
.ring-value{transition:stroke-dashoffset 1s cubic-bezier(.16,1,.3,1)}
.ring b{position:absolute;top:0;right:0;bottom:0;left:0;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;direction:ltr}
.ring b .ic{width:20px;height:20px;color:var(--fg-muted,#5c6890)}

/* ─── التنبيهات ─── */
.alert{display:flex;align-items:center;gap:12px;width:100%;padding:14px;border-radius:20px;border:1px solid var(--border,#e2e4ec);background:var(--surface,#fff);text-align:start}
.alert-icon{width:44px;height:44px;flex:none;border-radius:14px;display:flex;align-items:center;justify-content:center;background:var(--primary-soft,#ece8f5);color:var(--primary,#634b9a)}
.alert-icon .ic{width:22px;height:22px}
.alert-text{flex:1;min-width:0}
.alert-title{display:block;font-size:14.5px;font-weight:700;line-height:1.5}
.alert-hint{display:block;margin-top:2px;font-size:12.5px;line-height:1.6;color:var(--fg-muted,#5c6890)}
.alert--warning{border-color:transparent;background:var(--color-warning-soft,#fef3c7)}
.alert--warning .alert-icon{background:var(--surface,#fff);color:var(--color-warning,#a16207)}
.alert--danger{border-color:transparent;background:var(--color-danger-soft,#fee2e2)}
.alert--danger .alert-icon{background:var(--surface,#fff);color:var(--color-danger,#b91c1c)}
.alert--danger .alert-title{color:var(--color-danger,#b91c1c)}

.notice{display:flex;gap:12px;padding:16px}
.notice-icon{width:44px;height:44px;flex:none;border-radius:14px;display:flex;align-items:center;justify-content:center;color:#fff;background:linear-gradient(145deg,#8a72c4,#634b9a)}
.notice--praise .notice-icon{background:linear-gradient(145deg,#34d399,#15803d)}
.notice--info .notice-icon{background:linear-gradient(145deg,#60a5fa,#1d4ed8)}
.notice-icon .ic{width:22px;height:22px}
.notice-text{flex:1;min-width:0}
.notice-text b{display:block;font-size:15px}
.notice-text p{margin:4px 0 0;font-size:13px;line-height:1.7;color:var(--fg-muted,#5c6890)}
.notice-cta{margin-top:10px;min-height:38px;padding:0 16px;border:0;border-radius:12px;font-size:13.5px;font-weight:700;color:var(--primary-fg,#fff)!important;background:var(--primary,#634b9a)}
.notice-cta:disabled{opacity:.7}

/* ─── دليل الإعداد ─── */
.setup{padding:16px;background:linear-gradient(165deg,var(--primary-soft,#ece8f5) 0%,var(--surface,#fff) 72%)}
.setup-top{display:flex;align-items:center;gap:14px}
.setup-copy{min-width:0}
.setup-copy h3{margin:6px 0 0;font-size:17px;line-height:1.4}
.setup-copy p{margin:2px 0 0;font-size:12.5px;color:var(--fg-muted,#5c6890)}
.setup-next{margin-top:14px;display:flex;align-items:center;gap:12px;width:100%;min-height:56px;padding:10px 12px;border:0;border-radius:16px;text-align:start;color:var(--primary-fg,#fff)!important;background:var(--primary,#634b9a);box-shadow:0 12px 26px -14px rgba(99,75,154,.9)}
.setup-next-icon{width:38px;height:38px;flex:none;border-radius:12px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.18)}
.setup-next-icon .ic{width:20px;height:20px}
.setup-next-text{flex:1;min-width:0}
.setup-next-text b{display:block;font-size:14.5px}
.setup-next-text small{display:block;font-size:12px;opacity:.85}
.setup-next .chev{color:inherit;opacity:.8}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
.chip{display:inline-flex;align-items:center;gap:5px;min-height:34px;padding:0 11px;border-radius:999px;border:1px solid var(--border,#e2e4ec);background:var(--surface,#fff);font-size:12px!important;color:var(--fg-muted,#5c6890)!important}
.chip .ic{width:14px;height:14px}
.chip--done{color:var(--color-success,#15803d)!important;background:var(--color-success-soft,#dcfce7);border-color:transparent;text-decoration:line-through;text-decoration-color:rgba(21,128,61,.4)}

/* ─── الرسم ─── */
.hero{padding:14px 14px 10px;overflow:hidden}
.seg{position:relative;display:grid;grid-template-columns:repeat(4,1fr);padding:3px;border-radius:13px;background:var(--surface-2,#f1f2f6)}
.seg-thumb{position:absolute;top:3px;bottom:3px;right:3px;width:calc((100% - 6px)/4);border-radius:10px;background:var(--surface,#fff);box-shadow:0 1px 3px rgba(34,37,64,.14),0 4px 10px -6px rgba(34,37,64,.2);transition:transform .38s cubic-bezier(.34,1.25,.64,1)}
.seg button{position:relative;z-index:1;border:0;background:none;padding:8px 0;border-radius:10px;font-size:12.5px!important;font-weight:600;color:var(--fg-muted,#5c6890)!important;transition:color .2s}
.seg button[aria-selected="true"]{color:var(--fg,#222540)!important}
.hero-head{padding:16px 4px 0}
.hero-caption{display:block;font-size:12.5px;color:var(--fg-muted,#5c6890)}
.hero-value{display:block;margin:2px 0 6px;font-size:31px;line-height:1.25;font-weight:700;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.hero-sub{display:flex;align-items:center;gap:8px;min-height:22px;font-size:12px;color:var(--fg-subtle,#8a92ad)}
.chart{position:relative;height:150px;margin:10px -4px 0;touch-action:pan-y;user-select:none;-webkit-user-select:none}
.chart-svg{width:100%;height:100%;display:block;overflow:visible;animation:h-reveal .9s cubic-bezier(.16,1,.3,1) both}
@keyframes h-reveal{from{clip-path:inset(0 100% 0 0)}to{clip-path:inset(0 0 0 0)}}
.chart-line{fill:none;stroke:var(--primary,#634b9a);stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}
.chart-guide{position:absolute;top:0;bottom:0;width:1px;margin-left:-.5px;background:var(--border-strong,#cdd1de)}
.chart-dot{position:absolute;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;background:var(--surface,#fff);border:3px solid var(--primary,#634b9a);box-shadow:0 0 0 6px var(--primary-soft,#ece8f5)}
.chart-empty{height:100%;display:flex;align-items:center;justify-content:center;font-size:13px;color:var(--fg-subtle,#8a92ad)}
.chart-x{display:flex;justify-content:space-between;padding:6px 4px 0;direction:ltr;font-size:11px;color:var(--fg-subtle,#8a92ad)}

/* ─── الكروت بالسحب ─── */
.rail{display:flex;gap:10px;margin-right:-16px;margin-left:-16px;padding:2px 16px 8px;overflow-x:auto;scroll-snap-type:x mandatory;scroll-padding:0 16px;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.rail::-webkit-scrollbar{display:none}
.tile{flex:0 0 44%;min-width:150px;scroll-snap-align:start;display:flex;flex-direction:column;padding:14px;border-radius:20px;border:1px solid var(--border,#e2e4ec);background:var(--surface,#fff);text-align:start}
.tile-label{font-size:12px;color:var(--fg-muted,#5c6890)}
.tile-value{margin:6px 0 12px;font-size:19px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tile-foot{margin-top:auto;display:flex;align-items:center;justify-content:space-between;gap:6px}

/* ─── الاختصارات ─── */
.quick{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.quick button{display:flex;flex-direction:column;align-items:center;gap:8px;border:0;background:none;padding:4px 0;font-size:12px!important;font-weight:500}
.qi{width:58px;height:58px;border-radius:20px;display:flex;align-items:center;justify-content:center;color:var(--primary,#634b9a);background:var(--primary-soft,#ece8f5)}
.qi .ic{width:25px;height:25px}

/* ─── الخطة ─── */
.plan{display:flex;align-items:center;gap:14px;width:100%;padding:14px 16px;text-align:start}
.plan-text{flex:1;min-width:0}
.plan-label{display:block;font-size:11.5px;color:var(--fg-muted,#5c6890)}
.plan-text b{display:block;font-size:17px;line-height:1.4}
.plan-text small{display:block;font-size:12.5px;color:var(--fg-muted,#5c6890)}

/* ─── القوايم ─── */
.list{overflow:hidden;padding:0}
.row{display:flex;align-items:center;gap:12px;width:100%;min-height:64px;padding:10px 14px;border:0;background:none;text-align:start}
.row+.row{border-top:1px solid var(--border,#e2e4ec)}
button.row:active{background:var(--surface-2,#f1f2f6)}
.avatar{width:42px;height:42px;flex:none;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:var(--primary,#634b9a);background:var(--primary-soft,#ece8f5)}
.row-main{flex:1;min-width:0}
.row-title{display:block;font-size:14.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.row-sub{display:flex;align-items:center;gap:6px;margin-top:3px;font-size:12px;color:var(--fg-muted,#5c6890)}
.pill{padding:1px 8px;border-radius:999px;font-size:11px;font-weight:600}
.row-end{flex:none;font-size:14px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}
.thumb{position:relative;width:46px;height:46px;flex:none;border-radius:14px;display:flex;align-items:center;justify-content:center;color:var(--fg-subtle,#8a92ad);background:var(--surface-2,#f1f2f6)}
.thumb img{width:100%;height:100%;object-fit:cover;border-radius:14px}
.thumb .ic{width:22px;height:22px}
.rank{position:absolute;top:-6px;right:-6px;min-width:20px;height:20px;padding:0 5px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--primary-fg,#fff);background:var(--primary,#634b9a);border:2px solid var(--surface,#fff)}

.home-foot{margin:22px 4px 0;text-align:center;font-size:12.5px;line-height:1.9;color:var(--fg-subtle,#8a92ad)}
.updated{display:block}
.updated--stale{color:var(--color-warning,#a16207)}

.sk{display:block;background:linear-gradient(90deg,var(--surface-2,#f1f2f6) 25%,var(--surface,#fff) 50%,var(--surface-2,#f1f2f6) 75%);background-size:200% 100%;animation:h-sk 1.25s ease-in-out infinite;border-radius:14px}
@keyframes h-sk{from{background-position:200% 0}to{background-position:-200% 0}}

.home-empty{min-height:70vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:24px 32px;text-align:center}
.home-empty-icon{width:72px;height:72px;margin-bottom:10px;border-radius:24px;display:flex;align-items:center;justify-content:center;color:var(--primary,#634b9a);background:var(--primary-soft,#ece8f5)}
.home-empty-icon .ic{width:32px;height:32px}
.home-empty b{font-size:17px}
.home-empty p{margin:0 0 14px;color:var(--fg-muted,#5c6890);font-size:14px}

/* ─── شريط التبويبات ─── */
.tabbar{position:fixed;left:0;right:0;bottom:0;z-index:6;pointer-events:auto;isolation:isolate;display:flex;height:calc(64px + env(safe-area-inset-bottom,0px));padding-bottom:env(safe-area-inset-bottom,0px);background:var(--surface,#fff);border-top:1px solid var(--border,#e2e4ec);transition:transform .32s cubic-bezier(.2,.8,.2,1)}
@supports ((-webkit-backdrop-filter:blur(1px)) or (backdrop-filter:blur(1px))) and (background:color-mix(in srgb,red 50%,blue)){.tabbar{background:color-mix(in srgb,var(--surface,#fff) 84%,transparent);-webkit-backdrop-filter:blur(22px) saturate(1.8);backdrop-filter:blur(22px) saturate(1.8)}}
.tabbar--hidden{transform:translate3d(0,110%,0);pointer-events:none}
.tab{position:relative;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;border:0;background:none;font-size:11.5px!important;font-weight:600;color:var(--fg-muted,#5c6890)!important;transition:color .2s}
.tab .ic{width:24px;height:24px;transition:transform .32s cubic-bezier(.34,1.56,.64,1)}
.tab[aria-current="page"]{color:var(--primary,#634b9a)!important}
.tab[aria-current="page"] .ic{transform:translate3d(0,-1px,0) scale(1.06)}
.tab:active .ic{transform:scale(.84)}
.tab-slot{position:absolute;z-index:-1;top:0;right:0;width:calc(100% / var(--n));height:64px;display:flex;justify-content:center;transform:translate3d(calc(var(--i) * -100%),0,0);transition:transform .46s cubic-bezier(.34,1.2,.64,1);pointer-events:none}
.tab-slot span{margin-top:7px;width:60px;height:32px;border-radius:16px;background:var(--primary-soft,#ece8f5)}
.tab-slot--off{opacity:0}

@media (prefers-reduced-motion:reduce){
  .rise,.chart-svg{animation:none!important}
  .home,.home--hidden,.tab-slot,.seg-thumb,.ring-value{transition:none!important}
}
`
