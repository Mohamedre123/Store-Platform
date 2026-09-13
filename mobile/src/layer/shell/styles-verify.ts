/**
 * تنسيق شريط صفحة تأكيد البريد ولوحة خياراتها.
 *
 * الشريط بياخد مكان هيدر الموقع بالظبط (٦٤ بكسل) — والهيدر نفسه
 * بيتخفي من `PAGE_CSS` بـ`zw-verify` ومساحته بتفضل، فالصفحة ما بتتحركش.
 */
export const VERIFY_CSS = `
@keyframes vbar-in{from{opacity:0;transform:translate3d(0,-10px,0)}to{opacity:1;transform:none}}
.vbar{position:fixed;top:0;left:0;right:0;z-index:5;height:64px;display:flex;align-items:center;gap:4px;padding:0 8px;pointer-events:auto;direction:rtl;color:var(--fg,#222540);background:var(--bg,#f6f6f9);border-bottom:1px solid var(--border,#e2e4ec);font-family:var(--font-plex-arabic),'IBM Plex Sans Arabic','Segoe UI',Tahoma,system-ui,sans-serif;-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent;animation:vbar-in .32s cubic-bezier(.16,1,.3,1) both}
.vbar button{font:inherit;color:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}
.vbar-title{flex:1;min-width:0;font-size:16px;font-weight:700}
.vbar-link{min-height:40px;padding:0 14px;border:0;border-radius:12px;background:var(--primary-soft,#ece8f5);color:var(--primary,#634b9a)!important;font-size:13.5px!important;font-weight:700}
.verify{display:flex;flex-direction:column;gap:10px;direction:rtl}
.verify-current{margin:0 4px 4px;padding:12px 14px;border-radius:14px;background:var(--surface-2,#f1f2f6);font-size:13px;color:var(--fg-muted,#5c6890)}
.verify-current bdi{display:block;margin-top:3px;direction:ltr;text-align:right;font-size:15px;font-weight:700;color:var(--fg,#222540);word-break:break-all}
.verify-label{margin:4px 6px 0;font-size:13.5px;font-weight:600;color:var(--fg-muted,#5c6890)}
.verify-field{display:block;width:100%;min-height:54px;padding:0 16px;border:1.5px solid var(--border-strong,#cdd1de);border-radius:14px;background:var(--surface,#fff);color:var(--fg,#222540);font:inherit;font-size:16px;direction:ltr;text-align:left;outline:none;transition:border-color .2s ease}
.verify-field:focus{border-color:var(--primary,#634b9a)}
.verify-error{margin:0 6px;font-size:13.5px;line-height:1.7;color:var(--color-danger,#b91c1c)}
.verify-warn{margin:0 4px;padding:14px;border-radius:16px;background:var(--color-danger-soft,#fee2e2)}
.verify-warn b{display:block;font-size:15px;color:var(--color-danger,#b91c1c)}
.verify-warn p{margin:6px 0 0;font-size:13.5px;line-height:1.8;color:var(--fg,#222540)}
.verify-danger-icon{color:var(--color-danger,#b91c1c)!important;background:var(--color-danger-soft,#fee2e2)!important}
.verify .btn-row{padding:0 4px}
`
