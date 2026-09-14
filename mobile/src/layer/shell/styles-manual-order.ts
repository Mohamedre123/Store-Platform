/** شاشة الطلب اليدوي (order-new.tsx) */
export const MANUAL_ORDER_CSS = `
.mo-intro{margin:0 4px 12px}
.mo-warn{margin:0 0 12px;color:var(--color-warning,#a16207);background:var(--color-warning-soft,#fef3c7)}
.mo-card{display:flex;flex-direction:column;gap:12px;margin-bottom:12px}
.mo-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
.mo-link{border:0;background:none;padding:6px 0;font-size:12.5px!important;font-weight:600;color:var(--fg-muted,#5c6890)!important}
.mo-results{display:flex;flex-direction:column;border:1px solid var(--border,#e2e4ec);border-radius:14px;overflow:hidden}
.mo-products{max-height:340px;overflow-y:auto}
.mo-product+.mo-product,.mo-results>.mo-result+.mo-result{border-top:1px solid var(--border,#e2e4ec)}
.mo-result{display:flex;align-items:center;gap:10px;width:100%;min-height:56px;padding:8px 12px;border:0;background:var(--surface,#fff);text-align:start}
.mo-result:disabled{opacity:.45}
.mo-result>.ic,.mo-result>svg{flex:none;width:18px;height:18px;color:var(--primary,#634b9a)}
.mo-result .inv-thumb{width:42px;height:42px}
.mo-count{flex:none;font-size:12px;color:var(--fg-subtle,#8a92ad)}
.mo-variants{display:flex;flex-direction:column;background:var(--surface-2,#f1f2f6)}
.mo-variant{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:46px;padding:6px 16px;border:0;border-top:1px solid var(--border,#e2e4ec);background:none;text-align:start;font-size:14px}
.mo-variant:disabled{opacity:.45}
.mo-variant small{flex:none;font-size:12px;color:var(--fg-subtle,#8a92ad)}
.mo-empty{margin:0;padding:22px 14px;border:1.5px dashed var(--border-strong,#c9cedc);border-radius:14px;text-align:center;font-size:13.5px;color:var(--fg-muted,#5c6890)}
.mo-lines{display:flex;flex-direction:column;gap:10px}
.mo-lines-title{font-size:13px;color:var(--fg-muted,#5c6890)}
.mo-line{display:flex;flex-direction:column;gap:8px;padding:10px 12px;border-radius:14px;background:var(--surface-2,#f1f2f6)}
.mo-line-top{display:flex;align-items:center;gap:10px}
.mo-line-top .inv-thumb{width:42px;height:42px}
.mo-line-bottom{display:flex;align-items:center;gap:8px}
.mo-qty{display:flex;align-items:center;gap:4px;flex:none}
.mo-qty .np-input{width:52px;min-height:40px;padding:0 4px;text-align:center}
.mo-step{width:40px;height:40px;border:1px solid var(--border-strong,#c9cedc);border-radius:12px;background:var(--surface,#fff);font-size:20px!important;line-height:1;color:var(--fg,#222540)!important}
.mo-price{width:88px;min-height:40px;text-align:center}
.mo-price--changed{border-color:var(--primary,#634b9a)!important;color:var(--primary,#634b9a)}
.mo-price-text{font-size:13px;color:var(--fg-muted,#5c6890)}
.mo-line-total{flex:1;text-align:end;font-size:14px;white-space:nowrap}
.mo-sum{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:14px;color:var(--fg-muted,#5c6890)}
.mo-sum b{color:var(--fg,#222540);font-weight:600}
.mo-money{width:120px;min-height:40px;text-align:center}
.mo-sum--total{padding-top:10px;border-top:1px solid var(--border,#e2e4ec);color:var(--fg,#222540);font-weight:700}
.mo-sum--total b{font-size:18px;font-weight:800}
.mo-issue{display:block}
.mo-save{display:flex;align-items:center;gap:12px}
.mo-save .btn{flex:1}
.mo-total{display:flex;flex-direction:column;flex:none;line-height:1.3}
.mo-total small{font-size:11.5px;color:var(--fg-muted,#5c6890)}
.mo-total b{font-size:18px;font-weight:800}
`
