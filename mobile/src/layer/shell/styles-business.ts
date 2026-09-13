/**
 * تنسيق شاشات الكوبونات والمخزون والرسايل والاشتراك والإعدادات.
 */
export const BUSINESS_CSS = `
/* ─── عناوين الأقسام ─── */
.mk-sec{display:flex;flex-direction:column;gap:2px;margin:22px 4px 10px}
.mk-sec b{font-size:16.5px}
.mk-sec small{font-size:12.5px;color:var(--fg-muted,#5c6890)}

/* ─── الكوبونات والعروض ─── */
.mk-coupons{display:flex;flex-direction:column;gap:10px}
.mk-coupon{display:flex;flex-direction:column;gap:10px;padding:14px;transition:opacity .25s ease}
.mk-coupon--off{opacity:.6}
.mk-top{display:flex;align-items:center;gap:10px}
.mk-code{flex:none;max-width:58%;padding:7px 12px;border:1.5px dashed var(--primary,#634b9a);border-radius:12px;background:var(--primary-soft,#ece8f5);color:var(--primary,#634b9a)!important;font-family:'SFMono-Regular',Consolas,'Liberation Mono',monospace;font-size:15px!important;font-weight:700;letter-spacing:.6px;direction:ltr;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mk-value{flex:1;min-width:0;text-align:left;font-size:18px;font-weight:800;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mk-desc{margin:0;font-size:13.5px;line-height:1.7}
.mk-conds{display:flex;flex-wrap:wrap;gap:6px}
.mk-conds span{padding:3px 9px;border-radius:999px;font-size:11.5px;color:var(--fg-muted,#5c6890);background:var(--surface-2,#f1f2f6)}
.mk-conds .mk-expired{color:var(--color-danger,#b91c1c);background:var(--color-danger-soft,#fee2e2);font-weight:700}
.mk-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;padding-top:10px;border-top:1px solid var(--border,#e2e4ec)}
.mk-foot small{font-size:12.5px;color:var(--fg-muted,#5c6890)}
.mk-row{display:flex;align-items:center;gap:12px;padding:12px 14px;transition:opacity .25s ease}
.mk-row+.mk-row{border-top:1px solid var(--border,#e2e4ec)}
.mk-row-main{flex:1;min-width:0}
.mk-row-main b{display:flex;align-items:center;gap:6px;font-size:14.5px}
.mk-row-main small{display:block;margin-top:3px;font-size:12px;line-height:1.6;color:var(--fg-muted,#5c6890)}
.mk-badge{padding:1px 7px;border-radius:999px;font-size:10.5px;font-weight:700;color:var(--primary,#634b9a);background:var(--primary-soft,#ece8f5)}
/* فليكس عشان الـswitch (span) ياخد مقاسه — جوّه زرار عادي بيبقى inline وبيختفي والدايرة تطير برّه */
.switch-btn{flex:none;display:inline-flex;align-items:center;padding:4px;border:0;background:none;cursor:pointer;-webkit-tap-highlight-color:transparent}

/* ─── المخزون ─── */
.inv-item{padding:12px 14px}
.inv-item+.inv-item{border-top:1px solid var(--border,#e2e4ec)}
.inv-top{display:flex;align-items:center;gap:12px}
.inv-thumb{width:46px;height:46px;flex:none;padding:0;border:0;border-radius:13px;overflow:hidden;display:flex;align-items:center;justify-content:center;color:var(--fg-subtle,#8a92ad);background:var(--surface-2,#f1f2f6)}
.inv-thumb img{width:100%;height:100%;object-fit:cover}
.inv-thumb .ic{width:20px;height:20px}
.inv-name{flex:1;min-width:0}
.inv-name b{display:block;font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.inv-name small{display:block;margin-top:2px;font-size:11.5px;color:var(--fg-subtle,#8a92ad);direction:ltr;text-align:right}
.inv-chip{flex:none;padding:3px 9px;border-radius:999px;font-size:11.5px;font-weight:700;white-space:nowrap}
.inv-chip--out{color:var(--color-danger,#b91c1c);background:var(--color-danger-soft,#fee2e2)}
.inv-chip--low{color:var(--color-warning,#a16207);background:var(--color-warning-soft,#fef3c7)}
.inv-chip--ok{color:var(--color-success,#15803d);background:var(--color-success-soft,#dcfce7)}
.inv-controls{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px}
.inv-variant .inv-controls{margin-top:0}
.inv-state{font-size:12px;color:var(--fg-subtle,#8a92ad)}
.inv-state--saved{color:var(--color-success,#15803d)}
.stepper{display:flex;align-items:center;gap:6px;direction:ltr}
.stepper button{width:42px;height:42px;padding:0;border:0;border-radius:13px;display:flex;align-items:center;justify-content:center;background:var(--surface-2,#f1f2f6);color:var(--fg,#222540);transition:transform .14s ease}
.stepper button:active{transform:scale(.9)}
.stepper button:disabled{opacity:.4}
.stepper .ic{width:18px;height:18px}
.stepper .stepper-val{width:auto;min-width:58px;padding:0 10px;border:1.5px solid var(--border-strong,#cdd1de);background:var(--surface,#fff);font-size:16px!important;font-weight:800;font-variant-numeric:tabular-nums}
.inv-toggle{margin-top:8px;padding:6px 0;border:0;background:none;color:var(--primary,#634b9a)!important;font-size:13px!important;font-weight:700}
.inv-variants{margin-top:6px;padding-top:4px;border-top:1px dashed var(--border,#e2e4ec)}
.inv-variant{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 0}
.inv-variant>span{flex:1;min-width:0;font-size:13.5px;color:var(--fg-muted,#5c6890);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mv-delta{width:52px;flex:none;font-size:15px;font-weight:800;font-variant-numeric:tabular-nums}
.mv-delta--in{color:var(--color-success,#15803d)}
.mv-delta--out{color:var(--color-danger,#b91c1c)}

/* ─── الرسايل ─── */
.msg{padding:12px 14px}
.msg+.msg{border-top:1px solid var(--border,#e2e4ec)}
.msg-head{display:flex;align-items:center;gap:10px;width:100%;padding:0;border:0;background:none;text-align:start}
.msg-ch{width:36px;height:36px;flex:none;border-radius:12px;display:flex;align-items:center;justify-content:center;color:var(--fg-muted,#5c6890);background:var(--surface-2,#f1f2f6)}
.msg-ch--wa{color:#16a34a;background:rgba(37,211,102,.14)}
.msg-ch .ic{width:17px;height:17px}
.msg-main{flex:1;min-width:0}
.msg-main b{display:flex;align-items:center;flex-wrap:wrap;gap:6px;font-size:14px}
.msg-main bdi{display:block;margin-top:2px;font-size:12px;color:var(--fg-muted,#5c6890);direction:ltr;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.msg-time{flex:none;max-width:34%;font-size:11px;line-height:1.5;text-align:left;color:var(--fg-subtle,#8a92ad)}
.msg-body{margin:8px 0 0;font-size:12.5px;line-height:1.7;color:var(--fg-muted,#5c6890);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.msg-body--open{display:block}
.msg-hint{display:block;margin-top:6px;font-size:11.5px;color:var(--color-danger,#b91c1c)}
.msg-error{margin-top:8px;padding:10px 12px;border-radius:12px;font-size:12.5px;line-height:1.7;color:var(--color-danger,#b91c1c);background:var(--color-danger-soft,#fee2e2);white-space:pre-wrap;word-break:break-word;direction:ltr;text-align:left}
.msg-actions{display:flex;gap:8px;margin-top:10px}

/* ─── الاشتراك ─── */
.sub-hero{display:flex;flex-direction:column;gap:14px;padding:18px}
.sub-trial{display:flex;flex-direction:column;gap:14px}
.sub-hero-top{display:flex;align-items:flex-start;gap:12px}
.sub-icon{width:50px;height:50px;flex:none;border-radius:16px;display:flex;align-items:center;justify-content:center;color:var(--primary,#634b9a);background:var(--primary-soft,#ece8f5)}
.sub-icon .ic{width:24px;height:24px}
.sub-icon--gift{color:var(--color-warning,#a16207);background:var(--color-warning-soft,#fef3c7)}
.sub-tone--success .sub-icon{color:var(--color-success,#15803d);background:var(--color-success-soft,#dcfce7)}
.sub-tone--warning .sub-icon{color:var(--color-warning,#a16207);background:var(--color-warning-soft,#fef3c7)}
.sub-tone--danger .sub-icon{color:var(--color-danger,#b91c1c);background:var(--color-danger-soft,#fee2e2)}
.sub-title{flex:1;min-width:0}
.sub-title b{display:block;font-size:17px}
.sub-title p{margin:4px 0 0;font-size:13.5px;line-height:1.75;color:var(--fg-muted,#5c6890)}
.sub-days{display:flex;align-items:baseline;gap:8px;padding:12px 16px;border-radius:16px;background:var(--surface-2,#f1f2f6)}
.sub-days b{font-size:30px;line-height:1;font-variant-numeric:tabular-nums}
.sub-days span{font-size:13.5px;color:var(--fg-muted,#5c6890)}
.sub-list{display:flex;flex-direction:column;gap:8px;margin:0;padding:0;list-style:none}
.sub-list li{display:flex;gap:9px;font-size:13.5px;line-height:1.7;color:var(--fg-muted,#5c6890)}
.sub-list li::before{content:"";width:6px;height:6px;flex:none;margin-top:9px;border-radius:50%;background:var(--primary,#634b9a)}
.plan{display:flex;flex-direction:column;gap:8px;padding:16px;margin-bottom:10px}
.plan--hl{border-color:var(--primary,#634b9a);box-shadow:0 18px 40px -26px rgba(99,75,154,.9)}
.plan-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
.plan-head b{font-size:16px}
.plan-price{font-size:24px;font-weight:800;font-variant-numeric:tabular-nums}
.plan-tag{margin:0 0 4px;font-size:13px;color:var(--fg-muted,#5c6890)}
.plan .btn{margin-top:6px}
.acc{display:flex;align-items:center;gap:10px;width:100%;margin-top:14px;padding:14px;text-align:start}
.acc>.ic{width:20px;height:20px;color:var(--primary,#634b9a)}
.acc span{flex:1;min-width:0;font-size:12.5px;color:var(--fg-muted,#5c6890)}
.acc bdi{font-size:14px;font-weight:800;letter-spacing:1px}

/* ─── الإعدادات ─── */
.set-store{display:flex;align-items:center;gap:12px;padding:14px}
.set-group{margin-top:18px}
.set-group>small{display:block;margin:0 8px 8px;font-size:12.5px;font-weight:700;color:var(--fg-subtle,#8a92ad)}
.set-list{padding:6px}
.set-hint{display:block;margin-top:2px;font-size:12px;font-weight:400;color:var(--fg-muted,#5c6890)}
`
