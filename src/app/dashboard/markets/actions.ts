'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getDashboardContext } from '@/lib/store-context'
import { assertCan } from '@/lib/permissions'
import { deleteMarket, saveMarket } from '@/lib/markets'
import { RATE_SCALE } from '@/lib/markets-meta'

export type MarketState = { ok?: boolean; error?: string } | null

const schema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, 'اكتب اسم السوق').max(60),
  country: z.string().trim().length(2, 'كود البلد حرفين'),
  currency: z.string().trim().length(3, 'كود العملة تلات حروف'),
  /**
   * السعر زي ما التاجر بيكتبه — «١ جنيه = كام بعملة السوق».
   *
   * الرقم بيوصل نصًّا وبيتحوّل لمليون هنا. الاتجاه ده مقصود:
   * التاجر بيفكّر «الجنيه بكام ريال» لا «الريال بكام جنيه»، والعكس
   * كان هيخلّيه يحطّ ١٣ مكان ٠.٠٧٧ ويلاقي أسعاره اتضاعفت ١٧٠ مرة.
   */
  rate: z.string().trim().min(1, 'اكتب سعر التحويل'),
  rounding: z.enum(['none', 'nearest', 'charm']),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
})

export async function saveMarketAction(raw: unknown): Promise<MarketState> {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'بيانات ناقصة' }

  const { store, actor } = await getDashboardContext()
  assertCan(actor, 'settings.manage')

  const rate = Number(parsed.data.rate)
  if (!Number.isFinite(rate) || rate <= 0) return { error: 'سعر التحويل لازم يكون رقمًا أكبر من صفر' }

  const res = await saveMarket(store.id, {
    ...parsed.data,
    rateMicros: Math.round(rate * RATE_SCALE),
  })

  if (!res.ok) return { error: res.error }
  revalidatePath('/dashboard/markets')
  return { ok: true }
}

export async function deleteMarketAction(id: string): Promise<MarketState> {
  const { store, actor } = await getDashboardContext()
  assertCan(actor, 'settings.manage')

  await deleteMarket(store.id, id)
  revalidatePath('/dashboard/markets')
  return { ok: true }
}
