'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getDashboardContext } from '@/lib/store-context'
import { saveConnection } from '@/lib/marketplace'

export type MarketplaceState = { ok?: boolean; error?: string } | null

const schema = z.object({
  platform: z.string().trim().min(1),
  enabled: z.boolean(),
  syncPrices: z.boolean(),
  syncStock: z.boolean(),
})

export async function saveMarketplaceAction(raw: unknown): Promise<MarketplaceState> {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { error: 'بيانات ناقصة' }

  const { store } = await getDashboardContext()
  const { platform, ...rest } = parsed.data

  const res = await saveConnection(store.id, platform, rest)
  if (res.error) return res

  /*
    إعادة التحميل هنا مقصودة على عكس مفاتيح الإضافات: رابط الملف
    ما بيشتغلش غير لما المنصة تبقى مفعّلة، فالتاجر لازم يشوف الرابط
    بيظهر في نفس اللحظة اللي بيفعّل فيها — مش بعد ما يعمل تحديث.
  */
  revalidatePath('/dashboard/marketplace')
  return { ok: true }
}
