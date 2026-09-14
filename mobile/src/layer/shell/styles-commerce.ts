/** شاشتي الدفع والشحن ولوحة ربط المزوّدين (payments.tsx, shipping.tsx, provider-sheet.tsx) */
export const COMMERCE_CSS = `
.pv-sec{margin:24px 4px 10px}
.pv-sec h2{margin:0;font-size:16.5px;font-weight:700}
.pv-sec p{margin:4px 0 0;font-size:12.5px;line-height:1.75;color:var(--fg-muted,#5c6890)}
.pv-gap{margin:0 0 10px}
.pv-gap-top{margin-top:12px}
.pv-card{padding:14px 16px}
.pv-card .switch-text b{display:block;font-size:15px}
.pv-card .switch-text small{display:block;margin-top:3px;font-size:12.5px;line-height:1.65;color:var(--fg-muted,#5c6890)}
.pv-badge{flex:none;width:44px;height:44px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;letter-spacing:.3px;color:#fff}
.pv-icon{flex:none;width:44px;height:44px;border-radius:14px;display:flex;align-items:center;justify-content:center;color:var(--primary,#634b9a);background:var(--primary-soft,#ece8f5)}
.pv-icon .ic,.pv-icon svg{width:22px;height:22px}
.pv-mode{display:inline-block;margin-inline-start:6px;padding:1px 8px;border-radius:999px;font-size:10.5px;font-weight:700;vertical-align:middle;color:var(--fg-muted,#5c6890);background:var(--surface-2,#f1f2f6)}
.pv-mode--api{color:var(--primary,#634b9a);background:var(--primary-soft,#ece8f5)}
.pv-tone--good{color:var(--color-success,#15803d);background:var(--color-success-soft,#dcfce7)}
.pv-tone--info{color:var(--color-info,#1d4ed8);background:var(--color-info-soft,#dbeafe)}
.pv-tone--muted{color:var(--fg-muted,#5c6890);background:var(--surface-2,#f1f2f6)}
.pv-tone--bad{color:var(--color-danger,#b91c1c);background:var(--color-danger-soft,#fee2e2)}
.pv-ok{color:var(--color-success,#15803d)!important}
.pv-err{color:var(--color-danger,#b91c1c)!important}
.pv-amount{flex:none;font-size:13.5px;font-weight:700;white-space:nowrap}
.pv-hint{display:block;margin-top:2px;font-size:12px;line-height:1.65;font-weight:400;color:var(--fg-subtle,#8a92ad)}
.pv-opt{font-size:12px;font-weight:400;color:var(--fg-subtle,#8a92ad)}
.pv-signup{flex:none;width:100%;min-height:46px;padding:0 12px;color:var(--primary,#634b9a)!important;background:var(--primary-soft,#ece8f5)}
.pv-signup .ic,.pv-signup svg{width:17px;height:17px}
.pv-secret{position:relative;display:flex}
.pv-secret .np-input{flex:1;width:100%;padding-inline-end:70px}
.pv-eye{position:absolute;inset-inline-end:6px;top:50%;transform:translateY(-50%);min-height:34px;padding:0 10px;border:0;border-radius:10px;font-size:12px!important;font-weight:700;color:var(--primary,#634b9a)!important;background:var(--primary-soft,#ece8f5)}
.pv-code{display:flex;align-items:center;gap:8px;margin-top:8px}
.pv-code code{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:9px 10px;border-radius:10px;font-size:12px;direction:ltr;text-align:left;color:var(--fg,#222540);background:var(--surface,#fff)}
.pv-rates{display:flex;flex-direction:column;gap:6px}
.pv-rate{display:flex;align-items:center;gap:10px;padding:6px 12px 6px 6px;border-radius:14px;font-size:14px;font-weight:600;background:var(--surface-2,#f1f2f6)}
.pv-rate>span{flex:1;min-width:0}
.pv-rate small{display:block;font-size:11.5px;font-weight:400;line-height:1.5;color:var(--fg-subtle,#8a92ad)}
.pv-rate .np-input{flex:none;width:96px;min-height:42px;text-align:center}
.pv-sticky{position:sticky;bottom:0;padding-top:10px;background:var(--surface,#fff)}
`
