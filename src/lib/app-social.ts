import 'server-only'
import { listAccounts, publishingEnabled } from '@/lib/social'
import { platformOf } from '@/lib/studio-meta'
import { studioEnabled } from '@/lib/app-schedules'

/** شكل شاشة «حسابات السوشيال» اللي تطبيق الموبايل بيستلمه — نفس `/dashboard/studio/accounts` */
export async function socialAccountsPayload(storeId: string) {
  const [accounts, enabled] = await Promise.all([listAccounts(storeId), studioEnabled(storeId)])
  return {
    studioEnabled: enabled,
    /* الربط بيمشي على خدمة النشر: صفحة برّه، ورجوع بإيد التاجر ودوسة «حدّث» */
    viaProvider: publishingEnabled(),
    accounts: accounts.map((a) => ({
      id: a.id,
      name: a.name,
      platform: a.platform,
      platformLabel: platformOf(a.platform).label,
      color: platformOf(a.platform).color,
      avatar: a.avatar,
      canPublish: a.canPublish,
      status: a.status,
      lastError: a.lastError,
    })),
  }
}
