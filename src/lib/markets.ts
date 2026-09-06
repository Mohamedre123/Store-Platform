import 'server-only'
import { cookies, headers } from 'next/headers'
import { and, asc, eq } from 'drizzle-orm'
import { cache } from 'react'
import { db } from '@/db'
import { markets } from '@/db/schema'
import { pickMarket, type MarketRow } from './markets-meta'

export type { MarketRow } from './markets-meta'

/** الكوكي اللي بتفتكر اختيار الزائر — أقوى من بلده */
export const MARKET_COOKIE = 'zw_market'

/** أسواق المتجر — الشغّالة بس، مرتّبة بالافتراضي الأول */
export const listMarkets = cache(async (storeId: string): Promise<MarketRow[]> => {
  const rows = await db
    .select()
    .from(markets)
    .where(eq(markets.storeId, storeId))
    .orderBy(asc(markets.name))

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    country: r.country,
    currency: r.currency,
    rateMicros: r.rateMicros,
    rounding: r.rounding,
    isDefault: r.isDefault,
    isActive: r.isActive,
  }))
})

/**
 * سوق الزائر الحالي.
 *
 * ## الترتيب: اختياره، وبعدين بلده، وبعدين الافتراضي
 * لو الزائر اختار سوقًا بإيده، اختياره بيغلب على بلده — العميل
 * المصري المسافر ممكن يبقى عايز يشتري بالجنيه وهو في السعودية،
 * والعكس. تجاهُل اختياره بيخلّي المبدّل يبان مكسورًا.
 *
 * ## والبلد من ترويسة المستضيف لا من المتصفح
 * `x-vercel-ip-country` بتيجي من الحافة قبل ما الصفحة تترسم —
 * يعني الزائر بيشوف عملته من أول فتحة، من غير وميض السعر القديم.
 *
 * ## وبيرجّع null لو المتجر ما ظبّطش أسواقًا
 * وده الحالة الافتراضية لأغلب التجّار. الاستدعاء بيتعامل مع
 * `null` كـ«اعرض بعملة المتجر» — يعني الميزة مقفولة ما لم تُطلَب،
 * والمتجر اللي مش محتاجها ما بيدفعش تمنها.
 */
export const currentMarket = cache(async (storeId: string): Promise<MarketRow | null> => {
  const list = await listMarkets(storeId)
  if (list.length === 0) return null

  const jar = await cookies()
  const chosen = jar.get(MARKET_COOKIE)?.value

  if (chosen) {
    const match = list.find((m) => m.id === chosen && m.isActive)
    if (match) return match
  }

  const h = await headers()
  return pickMarket(list, h.get('x-vercel-ip-country'))
})

/**
 * حفظ سوق واحد — والافتراضي بيتنقل بدل ما يتكرر.
 *
 * المعاملة إلزامية: لو فكّ القديم نجح وتعليم الجديد فشل، المتجر
 * بيفضل بلا سوق افتراضي — والزائر المجهول ساعتها بيشوف أول سوق
 * أبجديًّا، اللي ممكن يتغيّر مع أي إضافة.
 */
export async function saveMarket(
  storeId: string,
  input: {
    id?: string
    name: string
    country: string
    currency: string
    rateMicros: number
    rounding: 'none' | 'nearest' | 'charm'
    isDefault: boolean
    isActive: boolean
  },
): Promise<{ ok: boolean; error?: string }> {
  const country = input.country.trim().toUpperCase()
  const currency = input.currency.trim().toUpperCase()

  if (!/^[A-Z]{2}$/.test(country)) return { ok: false, error: 'كود البلد حرفين بالإنجليزي — EG أو SA' }
  if (!/^[A-Z]{3}$/.test(currency)) return { ok: false, error: 'كود العملة تلات حروف — EGP أو SAR' }
  if (input.rateMicros <= 0) return { ok: false, error: 'سعر التحويل لازم يكون أكبر من صفر' }

  try {
    await db.transaction(async (tx) => {
      if (input.isDefault) {
        await tx.update(markets).set({ isDefault: false }).where(eq(markets.storeId, storeId))
      }

      const values = {
        name: input.name.trim(),
        country,
        currency,
        rateMicros: input.rateMicros,
        rounding: input.rounding,
        isDefault: input.isDefault,
        isActive: input.isActive,
        updatedAt: new Date(),
      }

      if (input.id) {
        await tx
          .update(markets)
          .set(values)
          .where(and(eq(markets.id, input.id), eq(markets.storeId, storeId)))
      } else {
        await tx.insert(markets).values({ storeId, ...values })
      }
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    /* الفهرس الفريد على (متجر، بلد) — رسالة مفهومة بدل نص بوستجرس */
    if (msg.includes('markets_store_country_unique')) {
      return { ok: false, error: 'عندك سوق للبلد ده بالفعل — عدّله بدل ما تضيف واحدًا تاني' }
    }
    return { ok: false, error: 'ما اتحفظش — جرّب تاني' }
  }

  return { ok: true }
}

export async function deleteMarket(storeId: string, id: string): Promise<{ ok: boolean }> {
  await db.delete(markets).where(and(eq(markets.id, id), eq(markets.storeId, storeId)))
  return { ok: true }
}
