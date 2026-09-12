/**
 * تنسيق شاشات المنتجات.
 */
export const PRODUCTS_CSS = `
/* ─── البحث ─── */
.search{display:flex;align-items:center;gap:8px;height:48px;padding:0 14px;border-radius:16px;border:1px solid var(--border,#e2e4ec);background:var(--surface,#fff);color:var(--fg-subtle,#8a92ad);transition:border-color .2s ease,box-shadow .2s ease}
.search:focus-within{border-color:var(--primary,#634b9a);box-shadow:0 0 0 4px var(--primary-soft,#ece8f5)}
.search>.ic{width:19px;height:19px}
.search input{flex:1;min-width:0;height:100%;border:0;outline:none;background:none;color:var(--fg,#222540);font:inherit;font-size:15px;-webkit-appearance:none;appearance:none}
.search input::-webkit-search-cancel-button{display:none}
.search-clear{width:30px;height:30px;flex:none;display:flex;align-items:center;justify-content:center;border:0;border-radius:50%;background:var(--surface-2,#f1f2f6)}
.search-clear .ic{width:15px;height:15px}
.fchip--danger{color:var(--color-danger,#b91c1c)!important}
.fchip--danger.fchip--on{background:var(--color-danger,#b91c1c);border-color:var(--color-danger,#b91c1c);color:#fff!important}

/* ─── الشبكة ─── */
.pgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
@media (min-width:600px){.pgrid{grid-template-columns:repeat(3,minmax(0,1fr))}}
.pcard{display:flex;flex-direction:column;padding:0;overflow:hidden;border-radius:20px;border:1px solid var(--border,#e2e4ec);background:var(--surface,#fff);text-align:start;box-shadow:0 1px 2px rgba(34,37,64,.04),0 12px 30px -26px rgba(34,37,64,.45)}
.pcard-img{position:relative;display:flex;align-items:center;justify-content:center;aspect-ratio:1;background:var(--surface-2,#f1f2f6);color:var(--fg-subtle,#8a92ad)}
.pcard-img img{width:100%;height:100%;object-fit:cover}
.pcard-img>.ic{width:30px;height:30px}
.pcard-badge{position:absolute;top:8px;right:8px;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;color:#fff;background:rgba(22,24,43,.72);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.pcard-body{display:flex;flex-direction:column;gap:2px;padding:10px 11px 12px}
.pcard-name{font-size:13.5px;font-weight:600;line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.pcard-cat{font-size:11.5px;color:var(--fg-subtle,#8a92ad);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pcard-price{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px;margin-top:4px;font-size:14.5px;font-weight:700;font-variant-numeric:tabular-nums}
.pcard-price s,.p-price s{font-size:12px;font-weight:400;color:var(--fg-subtle,#8a92ad)}
.stock{align-self:flex-start;margin-top:4px;padding:1px 8px;border-radius:999px;font-size:11px;font-weight:600;white-space:nowrap}
.stock--muted{background:var(--surface-2,#f1f2f6);color:var(--fg-muted,#5c6890)}
.stock--warn{background:var(--color-warning-soft,#fef3c7);color:var(--color-warning,#a16207)}
.stock--danger{background:var(--color-danger-soft,#fee2e2);color:var(--color-danger,#b91c1c)}

/* زرار الإضافة العائم — فوق شريط التبويبات */
.fab{position:absolute;left:16px;bottom:calc(64px + 18px + env(safe-area-inset-bottom,0px));z-index:4;display:inline-flex;align-items:center;gap:8px;height:54px;padding:0 20px;border:0;border-radius:18px;font-size:15px!important;font-weight:700;color:var(--primary-fg,#fff)!important;background:var(--primary,#634b9a);box-shadow:0 16px 32px -14px rgba(99,75,154,.95)}
.fab .ic{width:22px;height:22px}
.home--hidden .fab{opacity:0}
/* مسافة تحت آخر صف عشان الزرار العائم ما يغطّيش سعر آخر منتج */
.home-body--fab{padding-bottom:calc(64px + 96px + env(safe-area-inset-bottom,0px))}

/* ─── تفاصيل المنتج ─── */
.gallery{position:relative;margin:0 -16px;overflow:hidden;background:var(--surface-2,#f1f2f6)}
.gallery-track{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain}
.gallery-track::-webkit-scrollbar{display:none}
.gallery-track img{flex:0 0 100%;width:100%;aspect-ratio:1;object-fit:cover;scroll-snap-align:center}
.gallery-dots{position:absolute;left:0;right:0;bottom:12px;display:flex;justify-content:center;gap:6px}
.gallery-dots span{width:7px;height:7px;border-radius:7px;background:rgba(255,255,255,.6);box-shadow:0 1px 3px rgba(0,0,0,.25);transition:width .3s cubic-bezier(.16,1,.3,1),background .3s}
.gallery-dots span.on{width:22px;background:#fff}
.gallery-empty{aspect-ratio:4/3;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;font-size:13px;color:var(--fg-subtle,#8a92ad)}
.gallery-empty .ic{width:36px;height:36px}
.p-head{padding:6px 4px 0}
.p-cat{display:inline-block;margin-bottom:4px;padding:2px 9px;border-radius:999px;font-size:11.5px;font-weight:600;color:var(--primary,#634b9a);background:var(--primary-soft,#ece8f5)}
.p-name{margin:0;font-size:22px;line-height:1.45;font-weight:700}
.p-price{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px;margin-top:6px}
.p-price strong{font-size:24px;font-weight:700;font-variant-numeric:tabular-nums}
.p-off{padding:1px 8px;border-radius:999px;font-size:11.5px;font-weight:700;color:var(--color-danger,#b91c1c);background:var(--color-danger-soft,#fee2e2)}

.switch-row{display:flex;align-items:center;gap:12px;width:100%;padding:0;border:0;background:none;text-align:start}
.switch-row:disabled{opacity:1}
.switch-text{flex:1;min-width:0}
.switch-text b{display:block;font-size:15px}
.switch-text small{display:block;margin-top:2px;font-size:12.5px;color:var(--fg-muted,#5c6890)}
.switch{position:relative;flex:none;width:54px;height:32px;border-radius:16px;background:var(--border-strong,#cdd1de);transition:background .25s ease}
.switch span{position:absolute;top:3px;right:3px;width:26px;height:26px;border-radius:50%;background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.2);transition:transform .32s cubic-bezier(.34,1.4,.64,1)}
.switch--on{background:var(--color-success,#15803d)}
.switch--on span{transform:translateX(-22px)}
.switch--busy span{animation:h-pulse .8s ease-in-out infinite alternate}
@keyframes h-pulse{to{opacity:.55}}

.facts{display:grid;grid-template-columns:repeat(3,1fr);padding:14px 6px}
.fact{display:flex;flex-direction:column;align-items:center;gap:3px;text-align:center}
.fact+.fact{border-inline-start:1px solid var(--border,#e2e4ec)}
.fact-label{font-size:11.5px;color:var(--fg-muted,#5c6890)}
.fact b{font-size:16px;font-variant-numeric:tabular-nums;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 4px}
.fact-warn{color:var(--color-warning,#a16207)}
.fact-danger{color:var(--color-danger,#b91c1c)}
.fact-good{color:var(--color-success,#15803d)}

.opt-group{margin-bottom:10px}
.opt-name{display:block;margin-bottom:6px;font-size:12.5px;color:var(--fg-muted,#5c6890)}
.opt-values{display:flex;flex-wrap:wrap;gap:6px}
.opt-val{display:inline-flex;align-items:center;gap:6px;padding:4px 11px;border-radius:999px;border:1px solid var(--border-strong,#cdd1de);font-size:13px}
.opt-val i{width:14px;height:14px;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(0,0,0,.15)}
.vlist{margin-top:6px;border-top:1px solid var(--border,#e2e4ec)}
.vrow{display:flex;align-items:center;gap:10px;min-height:46px;border-bottom:1px solid var(--border,#e2e4ec)}
.vrow:last-child{border-bottom:0}
.vrow--off{opacity:.55}
.vrow-title{flex:1;min-width:0;font-size:13.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vrow-price{font-size:13px;font-variant-numeric:tabular-nums;white-space:nowrap}
.vrow .stock{margin:0;align-self:center}
.p-desc{margin:0;font-size:14px;line-height:1.9;color:var(--fg-muted,#5c6890);white-space:pre-line}
.btn--danger-text{color:var(--color-danger,#b91c1c)!important}
.center{text-align:center}
`
