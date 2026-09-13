/**
 * تنسيق قايمة «المزيد».
 */
export const MORE_CSS = `
.sheet-panel--tall{max-height:92vh;padding-top:6px}
.more{display:flex;flex-direction:column;gap:12px;direction:rtl}
.more-head{display:flex;align-items:center;gap:12px;padding:2px 4px 4px}
.more-logo{width:46px;height:46px;flex:none;border-radius:15px;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:#fff;background:linear-gradient(145deg,#8a72c4,#634b9a 60%,#47366a)}
.more-logo img{width:100%;height:100%;object-fit:contain;background:#fff;padding:3px}
.more-store{flex:1;min-width:0}
.more-store b{display:block;font-size:16.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.more-store small{display:block;font-size:12px;color:var(--fg-subtle,#8a92ad)}
.more-quick{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:10px 4px;border-radius:20px;background:var(--surface-2,#f1f2f6)}
.more-quick button{display:flex;flex-direction:column;align-items:center;gap:6px;border:0;background:none;font-size:11.5px!important;font-weight:600}
.more-quick .qi{width:48px;height:48px;border-radius:16px;background:var(--surface,#fff)}
.more-quick .qi .ic{width:21px;height:21px}
.more-list,.more-foot{display:flex;flex-direction:column;gap:2px}
.more-foot{padding-top:10px;border-top:1px solid var(--border,#e2e4ec)}
.more-row{display:flex;align-items:center;gap:12px;width:100%;min-height:54px;padding:6px 8px;border:0;border-radius:15px;background:none;text-align:start}
.more-row:active{background:var(--surface-2,#f1f2f6)}
.more-row--active{background:var(--primary-soft,#ece8f5)}
.more-row--active .more-label,.more-row--active .more-icon{color:var(--primary,#634b9a)}
.more-icon{width:40px;height:40px;flex:none;border-radius:13px;display:flex;align-items:center;justify-content:center;color:var(--fg-muted,#5c6890);background:var(--surface-2,#f1f2f6)}
.more-row--active .more-icon{background:var(--surface,#fff)}
.more-icon .ic{width:20px;height:20px}
.more-label{flex:1;min-width:0;font-size:15.5px;font-weight:600}
.more-chev{transition:transform .25s ease}
.more-sec--open .more-chev{transform:rotate(180deg)}
.more-children{display:flex;flex-direction:column;margin:2px 28px 6px 0;padding-right:14px;border-right:2px solid var(--border,#e2e4ec);animation:h-rise .3s cubic-bezier(.16,1,.3,1) both}
.more-child{min-height:44px;padding:0 10px;border:0;border-radius:12px;background:none;text-align:start;font-size:14.5px!important;color:var(--fg-muted,#5c6890)!important}
.more-child:active{background:var(--surface-2,#f1f2f6)}
.more-child--active{color:var(--primary,#634b9a)!important;font-weight:700}
.more-row--brand .more-icon{color:var(--primary,#634b9a);background:var(--primary-soft,#ece8f5)}
.more-row--brand .more-label{color:var(--primary,#634b9a)}
.more-row--danger .more-icon{color:var(--color-danger,#b91c1c);background:var(--color-danger-soft,#fee2e2)}
.more-row--danger .more-label{color:var(--color-danger,#b91c1c)}
.more-user{display:flex;align-items:center;gap:12px;width:100%;min-height:60px;padding:8px;border:0;border-radius:15px;background:none;text-align:start}
.more-user:active{background:var(--surface-2,#f1f2f6)}
.more-confirm{padding:12px;border-radius:16px;background:var(--color-danger-soft,#fee2e2)}
.more-confirm>span{display:block;font-size:14.5px;font-weight:700;color:var(--color-danger,#b91c1c)}
.more-confirm .btn-row{margin-top:10px}
`
