/** شاشات الحملات والقنوات والفروع والاستيراد وحسابي (campaigns, channels, branches, product-import, account) */
export const GROWTH_CSS = `
.cm-subs{display:flex;align-items:flex-start;gap:12px;margin-bottom:12px;padding:14px}
.cm-subs-icon{flex:none;width:40px;height:40px;border-radius:13px;display:flex;align-items:center;justify-content:center;color:var(--primary,#634b9a);background:var(--primary-soft,#ece8f5)}
.cm-subs-icon .ic{width:20px;height:20px}
.cm-subs>span:last-child{display:flex;flex-direction:column;gap:3px;min-width:0}
.cm-subs b{font-size:14.5px}
.cm-subs small{font-size:12.5px;line-height:1.7;color:var(--fg-muted,#5c6890)}
.cm-list{margin-top:12px}
.cm-row{display:flex;flex-direction:column;gap:6px;padding:14px}
.cm-row+.cm-row{border-top:1px solid var(--border,#e2e4ec)}
.cm-row-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
.cm-row-top b{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:15px}
.cm-row>small{font-size:12px;line-height:1.6;color:var(--fg-subtle,#8a92ad)}
.cm-actions{display:flex;gap:8px;margin-top:4px}
.act--primary{background:var(--primary,#634b9a)!important;color:var(--primary-fg,#fff)!important}
.cm-progress small{font-size:12px;color:var(--fg-muted,#5c6890)}
.cm-size{font-weight:400;color:var(--fg-subtle,#8a92ad)}
.ch-total{display:block;font-size:15px}
.ch-total+.sg-hint{display:block;margin:4px 0 10px}
.ch-card{display:flex;flex-direction:column;gap:12px;margin-top:12px}
.ch-head{display:flex;align-items:flex-start;gap:10px}
.ch-dot{flex:none;width:12px;height:12px;margin-top:6px;border-radius:50%;box-shadow:0 0 0 3px var(--surface-2,#f1f2f6)}
.ch-head>span{display:flex;flex-direction:column;gap:4px;min-width:0}
.ch-head b{display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:15.5px}
.ch-head small{font-size:12.5px;line-height:1.7;color:var(--fg-muted,#5c6890)}
.ch-steps{display:flex;flex-direction:column;gap:6px}
.ch-step{display:flex;align-items:center;gap:10px;width:100%;padding:10px 12px;border:1px solid var(--border,#e2e4ec);border-radius:14px;background:var(--surface,#fff);text-align:start}
.ch-check{flex:none;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--fg-subtle,#8a92ad);background:var(--surface-2,#f1f2f6)}
.ch-check i{width:10px;height:10px;border:2px solid currentColor;border-radius:50%}
.ch-check .ic,.ch-check svg{width:14px;height:14px}
.ch-step--done .ch-check{color:var(--color-success,#15803d);background:var(--color-success-soft,#dcfce7)}
.ch-step-text{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.ch-step-text b{font-size:13.5px}
.ch-step--done .ch-step-text b{font-weight:500;color:var(--fg-muted,#5c6890)}
.ch-step-text small{font-size:12px;line-height:1.6;color:var(--fg-subtle,#8a92ad)}
.br-row{width:100%;border:0;background:none;text-align:start}
.br-row .bl-main b{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.br-icon{flex:none;width:38px;height:38px;border-radius:12px;display:flex;align-items:center;justify-content:center;color:var(--fg-muted,#5c6890);background:var(--surface-2,#f1f2f6)}
.br-icon .ic{width:18px;height:18px}
.br-transfer-btn{width:100%;margin-bottom:10px}
.br-products{display:flex;flex-direction:column;gap:10px;margin-top:10px}
.br-product{display:flex;flex-direction:column;gap:10px;padding:14px}
.br-product-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
.br-product-head>b{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14.5px}
.br-product-head span{flex:none;font-size:12.5px;color:var(--fg-muted,#5c6890)}
.br-levels{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px}
.br-levels label,.br-rest{display:flex;flex-direction:column;gap:4px;min-width:0}
.br-levels small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11.5px;color:var(--fg-subtle,#8a92ad)}
.br-level{position:relative;display:block}
.br-level .np-input{min-height:44px;padding:0 8px;text-align:center}
.br-saved{position:absolute;top:-6px;inset-inline-end:-4px;font-style:normal;font-size:12px;color:var(--fg-subtle,#8a92ad)}
.br-saved--ok{color:var(--color-success,#15803d)}
.br-rest b{display:flex;align-items:center;justify-content:center;min-height:44px;border-radius:14px;font-variant-numeric:tabular-nums;color:var(--fg-muted,#5c6890);background:var(--surface-2,#f1f2f6)}
.br-rest--bad b{color:var(--color-danger,#b91c1c);background:var(--color-danger-soft,#fee2e2)}
.pi-divider{display:flex;align-items:center;gap:10px;margin:4px 0 12px;font-size:12.5px;color:var(--fg-subtle,#8a92ad)}
.pi-divider::before,.pi-divider::after{content:'';flex:1;height:1px;background:var(--border,#e2e4ec)}
.pi-drop{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;width:100%;min-height:130px;padding:18px;border:1.5px dashed var(--border-strong,#c9cedc);border-radius:16px;background:var(--surface,#fff);text-align:center}
.pi-drop>.ic,.pi-drop svg{width:24px;height:24px;color:var(--fg-subtle,#8a92ad)}
.pi-drop b{font-size:14px}
.pi-drop small{font-size:12px;line-height:1.6;color:var(--fg-subtle,#8a92ad)}
.pi-steps li{display:flex;align-items:flex-start;gap:8px}
.pi-steps i{flex:none;width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-style:normal;font-size:11px;font-weight:700;color:var(--primary,#634b9a);background:var(--primary-soft,#ece8f5)}
.pi-more{display:block;padding:0 14px 12px}
.pi-done{display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center}
.pi-done-icon{width:54px;height:54px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--color-success,#15803d);background:var(--color-success-soft,#dcfce7)}
.pi-done-icon .ic{width:26px;height:26px}
.pi-done>b{font-size:17px}
.pi-done .st-steps{text-align:start}
.pi-done .btn-row{width:100%}
.pi-done .btn-row .btn{flex:1}
`
