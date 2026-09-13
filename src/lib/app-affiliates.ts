import 'server-only'
import type { ActiveStore } from '@/lib/store-context'
import { loadAffiliates } from '@/lib/affiliates-data'
import { publicStoreUrl } from '@/lib/domain'
import { formatMoney } from '@/lib/utils'

/** شكل شاشة المسوّقين بالعمولة اللي تطبيق الموبايل بيستلمه — المبالغ بالوحدة الصغرى */
export async function affiliatesPayload(store: ActiveStore) {
  const rows = await loadAffiliates(store.id)
  const storeUrl = publicStoreUrl(store)

  return {
    currency: store.currency,
    stats: {
      balance: rows.reduce((s, a) => s + a.balance, 0),
      earned: rows.reduce((s, a) => s + a.totalEarned, 0),
      conversions: rows.reduce((s, a) => s + a.conversions, 0),
    },
    affiliates: rows.map((a) => ({
      id: a.id,
      name: a.name,
      phone: a.phone,
      email: a.email,
      code: a.code,
      commissionType: a.commissionType,
      /* بخانة الفورم: نسبة مئوية أو مبلغ بالجنيه */
      commissionInput: String(a.commissionValue / 100),
      commissionLabel:
        a.commissionType === 'percent' ? `${a.commissionValue / 100}٪` : formatMoney(a.commissionValue, store.currency),
      balance: a.balance,
      totalEarned: a.totalEarned,
      totalPaid: a.totalPaid,
      clicks: a.clicks,
      conversions: a.conversions,
      isActive: a.isActive,
      link: `${storeUrl}?ref=${a.code}`,
    })),
  }
}
