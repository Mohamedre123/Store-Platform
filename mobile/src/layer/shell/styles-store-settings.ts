/** شاشات إعدادات الطلبات والشيك أوت وواتساب والبريد (order-settings, checkout-settings, whatsapp-settings, email-settings) */
export const STORE_SETTINGS_CSS = `
.st-group{display:flex;flex-direction:column;gap:14px;margin-bottom:12px}
.st-group>h2{margin:0;font-size:15.5px;font-weight:800;color:var(--fg,#222540)}
.st-lead{margin:-8px 0 0;font-size:13px;line-height:1.7;color:var(--fg-muted,#5c6890)}
.st-save{width:100%}
.st-grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.st-preview{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0;padding:10px 12px;border-radius:12px;font-size:13.5px;color:var(--fg-muted,#5c6890);background:var(--surface-2,#f1f2f6)}
.st-preview b{font-size:15px;font-weight:800;color:var(--fg,#222540)}
.st-bad{color:var(--color-danger,#b91c1c)!important}
.st-warn{color:var(--color-warning,#a16207)!important;background:var(--color-warning-soft,#fef3c7)!important}
.st-danger{color:var(--color-danger,#b91c1c)!important;background:var(--color-danger-soft,#fee2e2)!important}
.st-ok{color:var(--color-success,#15803d)!important;background:var(--color-success-soft,#dcfce7)!important}
.st-link{display:inline;margin:0 4px;padding:0;border:0;background:none;font:inherit;font-weight:700;text-decoration:underline;color:inherit}
.st-picker{display:flex;align-items:center;gap:10px;width:100%;min-height:50px;padding:0 12px;border:1.5px solid var(--border-strong,#c9cedc);border-radius:14px;background:var(--surface,#fff);font-size:14px;font-weight:600;color:var(--fg,#222540);text-align:start}
.st-picker>span:not(.ic){flex:1}
.st-picker>.ic:first-child{color:var(--fg-subtle,#8a92ad)}
.st-pill{margin-inline-start:6px}
.st-box{display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:16px;background:var(--surface-2,#f1f2f6)}
.st-box .btn{width:100%}
.st-steps{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px;font-size:13.5px;line-height:1.7;color:var(--fg-muted,#5c6890)}
.st-copy{display:flex;align-items:center;gap:8px;padding:4px 4px 4px 12px;border:1px solid var(--border,#e2e4ec);border-radius:12px;background:var(--surface,#fff)}
.st-copy small{flex:none;font-size:12px;color:var(--fg-subtle,#8a92ad)}
.st-copy bdi{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:600;text-align:left}
.st-inline{display:flex;gap:8px;align-items:stretch}
.st-inline .np-input{flex:1;min-width:0}
.st-inline .btn{flex:none;width:auto}
.st-mono{font-family:ui-monospace,Menlo,monospace;font-size:12.5px}
.btn--wa{background:#25D366!important;border-color:#25D366!important;color:#fff!important}
.st-linked{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border-radius:14px;background:rgba(37,211,102,.12)}
.st-linked>span{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:700;color:#128C4A}
.st-linked .act{flex:none;min-height:38px;padding:0 12px}
.st-qr{display:flex;flex-direction:column;align-items:center;gap:12px;padding:16px;border-radius:16px;background:var(--surface-2,#f1f2f6)}
.st-qr img{width:240px;height:240px;max-width:100%;padding:8px;border-radius:12px;background:#fff}
.st-qr .btn{width:100%}
.st-wait{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--fg-subtle,#8a92ad)}
.st-risk{display:flex;align-items:flex-start;gap:8px;margin:0;font-size:12px;line-height:1.7;color:var(--fg-subtle,#8a92ad)}
.st-risk .ic,.st-risk svg{flex:none;width:15px;height:15px;margin-top:3px}
.st-risk--warn{margin-top:6px;color:var(--color-warning,#a16207)}
.st-toggle{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;margin:0 0 12px;padding:10px;border:0;background:none;font-size:13.5px;font-weight:600;color:var(--fg-muted,#5c6890)}
.st-chev{width:16px;height:16px;transition:transform .2s}
.st-chev--up{transform:rotate(180deg)}
.st-tabs{display:flex;gap:6px;overflow-x:auto;padding-bottom:2px;scrollbar-width:none}
.st-tabs .fchip{flex:none}
.st-dotmark{margin-inline-start:4px;color:var(--primary,#634b9a)}
.st-text{min-height:170px;line-height:1.8}
.st-vars{display:flex;flex-wrap:wrap;gap:6px}
.st-var{min-height:34px;padding:0 10px;border:1px solid var(--border-strong,#c9cedc);border-radius:10px;background:var(--surface,#fff);font-family:ui-monospace,Menlo,monospace;font-size:12px;color:var(--fg-muted,#5c6890)}
.st-dl{display:flex;flex-direction:column;gap:12px}
.st-dl small{font-size:12px;font-weight:600;color:var(--fg-muted,#5c6890)}
.st-dl code,.st-dns code{display:block;direction:ltr;text-align:left;word-break:break-all}
.st-dl code{margin-top:4px;padding:9px 10px;border-radius:10px;font-size:12.5px;color:var(--fg,#222540);background:var(--surface-2,#f1f2f6)}
.st-sep{display:flex;flex-direction:column;gap:10px;padding-top:12px;border-top:1px solid var(--border,#e2e4ec)}
.st-sep>b{font-size:14px}
.st-dns{display:flex;flex-direction:column;gap:10px;margin:0;padding:0;list-style:none}
.st-dns li{display:flex;align-items:flex-start;gap:10px}
.st-dns li>span:last-child{flex:1;min-width:0}
.st-dns b{display:block;font-size:13.5px}
.st-dns code{font-size:11.5px;color:var(--fg-subtle,#8a92ad)}
.st-dot{flex:none;display:flex;align-items:center;justify-content:center;width:20px;height:20px;margin-top:2px;border-radius:50%}
.st-dot .ic,.st-dot svg{width:12px;height:12px}
.st-dot--ok{color:var(--color-success,#15803d);background:var(--color-success-soft,#dcfce7)}
.st-dot--no{color:var(--color-warning,#a16207);background:var(--color-warning-soft,#fef3c7)}
`
