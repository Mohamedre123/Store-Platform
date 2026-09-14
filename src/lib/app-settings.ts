import 'server-only'
import type { MemberRole } from '@/db/schema'
import type { DashboardContext } from '@/lib/store-context'
import { can, PERMISSIONS, PRESETS, ROLE_LABELS } from '@/lib/permissions'
import { loadTeam } from '@/lib/team-data'
import { loadActivity } from '@/lib/activity-data'

/** شكل شاشة «الفريق» اللي تطبيق الموبايل بيستلمه — نفس `TeamManager` */
export async function teamPayload(ctx: DashboardContext) {
  const canManage = can(ctx.actor, 'team.manage')
  const { members, invites } = await loadTeam(ctx.store.id, canManage)
  return {
    canManage,
    currentUserId: ctx.user.id,
    roleLabels: ROLE_LABELS,
    permissions: PERMISSIONS,
    presets: PRESETS,
    members,
    invites: invites.map((i) => ({ ...i, roleLabel: ROLE_LABELS[i.role as MemberRole] ?? i.role })),
  }
}

/* نفس `RISKY` في `settings/activity/activity-list.tsx` (ملف client) — أي تعديل هناك يتعدّل هنا */
const RISKY = new Set([
  'product.delete',
  'order.cancel',
  'shipment.delete',
  'shipment.cod_settled',
  'supplier.delete',
  'reward.delete',
  'coupon.delete',
  'apikey.revoke',
  'store.unpublish',
  'member.role_change',
])

/** شكل شاشة «سجل النشاط» — «قبل» و«بعد» بيتبعتوا نص JSON مقروء زي ما الصفحة بتعرضهم */
export async function activityPayload(storeId: string) {
  const rows = await loadActivity(storeId)
  return {
    items: rows.map((r) => ({
      id: r.id,
      label: r.label,
      risky: RISKY.has(r.action),
      who: r.userName ?? r.userEmail ?? 'النظام',
      whoKey: r.userEmail ?? 'system',
      createdAt: r.createdAt.toISOString(),
      before: r.before ? JSON.stringify(r.before, null, 1) : null,
      after: r.after ? JSON.stringify(r.after, null, 1) : null,
    })),
  }
}
