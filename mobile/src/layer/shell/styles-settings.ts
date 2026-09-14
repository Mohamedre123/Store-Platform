/** شاشات الفريق والأجهزة وسجل النشاط (team.tsx, sessions.tsx, activity.tsx) */
export const SETTINGS_CSS = `
.tm-fresh{display:flex;flex-direction:column;gap:10px;margin-bottom:12px;border-color:var(--primary,#634b9a)!important;background:var(--primary-soft,#ece8f5)}
.tm-fresh>b{color:var(--primary,#634b9a);font-size:15px}
.tm-fresh .page-sub{margin:0}
.tm-avatar{flex:none;width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:var(--primary,#634b9a);background:var(--primary-soft,#ece8f5)}
.tm-you{font-size:11.5px;font-weight:400;color:var(--fg-subtle,#8a92ad)}
.bl-main>b .pst-pill,.bl-main>b .tm-you{margin-inline-start:6px;vertical-align:middle}
.tm-invite{flex-wrap:wrap}
.tm-invite-actions{display:flex;gap:6px;flex:none}
.tm-invite-actions .act{flex:none;min-height:38px;padding:0 12px}
.tm-note{margin-top:12px}
.tm-perms{display:flex;flex-direction:column;gap:6px}
.tm-perm{display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border:1.5px solid var(--border,#e2e4ec);border-radius:14px;background:var(--surface,#fff);text-align:start}
.tm-perm--on{border-color:var(--primary,#634b9a);background:var(--primary-soft,#ece8f5)}
.tm-check{flex:none;width:20px;height:20px;margin-top:2px;border:1.5px solid var(--border-strong,#c9cedc);border-radius:6px;display:flex;align-items:center;justify-content:center;color:var(--primary-fg,#fff)}
.tm-perm--on .tm-check{border-color:var(--primary,#634b9a);background:var(--primary,#634b9a)}
.tm-check .ic,.tm-check svg{width:13px;height:13px}
.tm-perm-text{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.tm-perm-text b{display:flex;align-items:center;gap:6px;font-size:14px}
.tm-perm-text small{font-size:12px;font-weight:400;line-height:1.6;color:var(--fg-subtle,#8a92ad)}
.tm-risky{display:inline-flex;color:var(--color-warning,#a16207)}
.tm-risky .ic,.tm-risky svg{width:14px;height:14px}
.ss-all{display:flex;align-items:center;gap:12px;margin-bottom:12px}
.ss-all .act{flex:none;min-height:40px;padding:0 14px}
.ss-icon{background:var(--surface-2,#f1f2f6);color:var(--fg-muted,#5c6890)}
.ss-revoke{flex:none;min-height:38px;padding:0 14px}
.ac-people{margin:0 0 12px}
.ac-row{border-top:1px solid var(--border,#e2e4ec)}
.ac-row:first-child{border-top:0}
.ac-row .bg-open{padding:12px 14px;width:100%}
.ac-row .bl-main>b{display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:14px}
.ac-row .bl-main>b .pst-pill{margin:0}
.ac-detail{display:flex;flex-direction:column;gap:8px;padding:0 14px 14px}
.ac-snap{padding:8px 10px;border-radius:12px;background:var(--surface-2,#f1f2f6)}
.ac-snap small{font-size:11.5px;font-weight:700;color:var(--fg-muted,#5c6890)}
.ac-snap pre{margin:4px 0 0;font-size:11.5px;line-height:1.6;white-space:pre-wrap;word-break:break-word;text-align:left}
`
