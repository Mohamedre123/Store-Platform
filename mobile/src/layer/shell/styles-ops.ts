/**
 * تنسيق شاشات الحظر والمندوبين والحجوزات، وزرار «الغلاف» في فورم المنتج.
 */
export const OPS_CSS = `
.ops-add{width:100%;margin-top:4px}
.ops-list{padding:2px 0}
.ops-form{padding:0 4px}
.ops-icon{flex:none;width:40px;height:40px;padding:0;border:1px solid var(--border-strong,#cdd1de);border-radius:12px;display:flex;align-items:center;justify-content:center;background:var(--surface,#fff);color:var(--fg-muted,#5c6890)!important}
.ops-icon .ic{width:17px;height:17px}
.ops-icon:disabled{opacity:.5}
.act--danger{background:var(--color-danger-soft,#fee2e2);color:var(--color-danger,#b91c1c)!important}
.chips{display:flex;flex-wrap:wrap;gap:8px;font-weight:400}
.chips .fchip{min-height:38px}
.chips--scroll{max-height:168px;overflow-y:auto;padding:2px;overscroll-behavior:contain}
.ops-choice{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.ops-opt{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:2px;min-height:64px;padding:10px 12px;border:1.5px solid var(--border-strong,#cdd1de);border-radius:14px;background:var(--surface,#fff);text-align:start;transition:border-color .2s ease,background .2s ease}
.ops-opt b{font-size:14px;color:var(--fg,#222540)}
.ops-opt small{font-size:11.5px;font-weight:400;color:var(--fg-subtle,#8a92ad)}
.ops-opt--on{border-color:var(--primary,#634b9a);background:var(--primary-soft,#ece8f5)}
.ops-opt--on b{color:var(--primary,#634b9a)}

/* ─── الحظر ─── */
.bl-row{display:flex;align-items:center;gap:10px;padding:12px 14px}
.bl-row+.bl-row{border-top:1px solid var(--border,#e2e4ec)}
.bl-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.bl-main b{font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bl-main bdi{display:block;font-size:13px;color:var(--fg-muted,#5c6890);text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bl-main .bl-value{font-size:15px;font-weight:700;color:var(--fg,#222540)}
.bl-main small{font-size:12px;line-height:1.6;color:var(--fg-subtle,#8a92ad)}
.bl-tag{flex:none;padding:3px 8px;border-radius:8px;font-size:11px;font-weight:700}
.bl-tag--reject{color:var(--color-danger,#b91c1c);background:var(--color-danger-soft,#fee2e2)}
.bl-tag--flag{color:var(--color-warning,#a16207);background:var(--color-warning-soft,#fef3c7)}
.bl-act{flex:none;padding:0 14px}

/* ─── المندوبون ─── */
.cr-warn{color:var(--color-warning,#a16207)}
.cr-head{flex-direction:row;align-items:flex-end;justify-content:space-between;gap:10px}
.cr-head>span{display:flex;flex-direction:column;gap:2px;min-width:0}
.cr-add{flex:none;padding:0 14px}
.cr{display:flex;flex-direction:column;gap:12px;padding:14px;margin-bottom:10px;transition:opacity .25s ease}
.cr--off{opacity:.62}
.cr-top{display:flex;align-items:flex-start;gap:12px}
.cr-icon{width:44px;height:44px;flex:none;border-radius:14px;display:flex;align-items:center;justify-content:center;color:var(--primary,#634b9a);background:var(--primary-soft,#ece8f5)}
.cr-icon .ic{width:22px;height:22px}
.cr-icon--sm{width:36px;height:36px;border-radius:12px}
.cr-icon--sm .ic{width:18px;height:18px}
.cr-icon--off{color:var(--fg-subtle,#8a92ad);background:var(--surface-2,#f1f2f6)}
.cr-main{flex:1;min-width:0}
.cr-main b{display:flex;align-items:center;flex-wrap:wrap;gap:6px;font-size:15.5px}
.cr-sub{display:block;margin-top:2px;font-size:12.5px;color:var(--fg-muted,#5c6890)}
.cr-main small{display:block;margin-top:3px;font-size:12px;line-height:1.6;color:var(--fg-subtle,#8a92ad)}
.cr-off{padding:1px 7px;border-radius:999px;font-size:10.5px;font-weight:700;color:var(--fg-muted,#5c6890);background:var(--surface-2,#f1f2f6)}
.cr-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.cr-stat{display:flex;flex-direction:column;align-items:center;gap:2px;min-width:0;padding:8px 4px;border-radius:12px;background:var(--surface-2,#f1f2f6);text-align:center}
.cr-stat span{font-size:11px;color:var(--fg-subtle,#8a92ad)}
.cr-stat b{max-width:100%;font-size:14px;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cr-stat--warn b{color:var(--color-warning,#a16207)}
.cr-stat--danger b{color:var(--color-danger,#b91c1c)}
.cr-settle{display:flex;flex-direction:column;gap:10px;padding:12px;border:1px dashed var(--border-strong,#cdd1de);border-radius:14px;font-size:13px;line-height:1.8;color:var(--fg-muted,#5c6890)}
.cr-settle strong{color:var(--fg,#222540);font-variant-numeric:tabular-nums}
.cr-actions{display:flex;gap:8px}
.cr-actions .act:disabled{opacity:.5}
.cr-note{margin:0;font-size:12.5px;line-height:1.7;color:var(--fg-subtle,#8a92ad)}

/* ─── الحجوزات ─── */
.bk-hours{display:flex;align-items:center;gap:12px;width:100%;margin-bottom:12px;padding:14px;text-align:start;color:var(--fg,#222540)!important}
.bk-state{padding:1px 8px;border-radius:999px;font-size:10.5px;font-weight:700;color:var(--fg-muted,#5c6890);background:var(--surface-2,#f1f2f6)}
.bk-state--on{color:var(--color-success,#15803d);background:var(--color-success-soft,#dcfce7)}
.bk-item{display:flex;flex-direction:column}
.bk-day{margin:10px 6px 8px;font-size:13px;font-weight:700;color:var(--fg-subtle,#8a92ad)}
.bk-item:first-child .bk-day{margin-top:2px}
.bk-time{font-size:16px;font-weight:800;font-variant-numeric:tabular-nums}
.bk-past{opacity:.78}
.bk-notes{padding:8px 10px;border-radius:12px;font-size:13px;background:var(--surface-2,#f1f2f6)}

/* ─── فورم المنتج: خلّيها الغلاف ─── */
.np-makecover{position:absolute;right:6px;bottom:6px;padding:2px 8px;border:0;border-radius:999px;font-size:10.5px!important;font-weight:700;color:#fff!important;background:rgba(22,24,43,.62)}
.np-note{margin:0;padding:10px 12px;border-radius:12px;font-size:13px;line-height:1.7;color:var(--fg-muted,#5c6890);background:var(--surface-2,#f1f2f6)}
`
