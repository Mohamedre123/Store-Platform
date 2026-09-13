/**
 * تنسيق شاشات العملاء.
 */
export const CUSTOMERS_CSS = `
.crow{cursor:pointer;outline:none}
.crow:active{background:var(--surface-2,#f1f2f6)}
.crow .row-title{display:flex;align-items:center;gap:6px}
.crow-end{flex:none;display:flex;flex-direction:column;align-items:flex-end;gap:6px}
.crow-end b{font-size:14px;font-variant-numeric:tabular-nums;white-space:nowrap}
.crow-actions{display:flex;gap:6px}
.mini{width:34px;height:34px;display:flex;align-items:center;justify-content:center;border:0;border-radius:11px;background:var(--surface-2,#f1f2f6);color:var(--fg-muted,#5c6890)!important}
.mini .ic{width:16px;height:16px}
.mini--wa{background:var(--color-success-soft,#dcfce7);color:var(--color-success,#15803d)!important}

.avatar--muted{background:var(--surface-2,#f1f2f6);color:var(--fg-muted,#5c6890)}
.avatar--warn{background:var(--color-warning-soft,#fef3c7);color:var(--color-warning,#a16207)}
.avatar--primary{background:var(--primary-soft,#ece8f5);color:var(--primary,#634b9a)}
.tier{flex:none;padding:1px 8px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap}
.tier--muted{background:var(--surface-2,#f1f2f6);color:var(--fg-muted,#5c6890)}
.tier--warn{background:var(--color-warning-soft,#fef3c7);color:var(--color-warning,#a16207)}
.tier--primary{background:var(--primary-soft,#ece8f5);color:var(--primary,#634b9a)}
.tier--danger{background:var(--color-danger-soft,#fee2e2);color:var(--color-danger,#b91c1c)}

.c-head{display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 0 4px;text-align:center}
.c-avatar{width:84px;height:84px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:700;box-shadow:0 14px 30px -18px rgba(34,37,64,.5)}
.c-name{margin:6px 0 0;font-size:23px;line-height:1.35;font-weight:700}
.c-badges{display:flex;flex-wrap:wrap;justify-content:center;gap:6px}
.c-actions{display:flex;justify-content:center;gap:18px;margin-top:10px}
.c-act{display:flex;flex-direction:column;align-items:center;gap:6px;border:0;background:none;font-size:12.5px!important;font-weight:600}
.c-act>span{width:54px;height:54px;border-radius:18px;display:flex;align-items:center;justify-content:center;color:var(--primary,#634b9a);background:var(--primary-soft,#ece8f5)}
.c-act>span .ic{width:23px;height:23px}
.c-act--wa>span{color:var(--color-success,#15803d);background:var(--color-success-soft,#dcfce7)}
.c-orders{margin:0 -16px -16px;border-top:1px solid var(--border,#e2e4ec)}
.c-orders .row{padding:10px 16px}
.c-orders .row+.row{border-top:1px solid var(--border,#e2e4ec)}
.c-orders .row:active{background:var(--surface-2,#f1f2f6)}
`
