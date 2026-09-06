'use server'

import { cookies } from 'next/headers'
import { MARKET_COOKIE } from '@/lib/markets'

/**
 * اختيار الزائر لسوقه.
 *
 * ## المعرّف بيتحفظ زي ما جه من غير تحقّق
 * الكوكي دي بتتقرا في `currentMarket` وبتتفلتر هناك على أسواق
 * المتجر الشغّالة — يعني معرّف مخترع بيتجاهَل وبيرجع للافتراضي.
 * التحقّق هنا كمان كان هيحتاج قراءة قاعدة بيانات في فعل الغرض منه
 * إنه يبقى فوريًّا.
 *
 * ## وسنة صلاحية
 * الزائر اللي اختار الريال مرة عايز يلاقيه بعد شهر. النافذة القصيرة
 * كانت هترجّعه للجنيه من غير سبب ظاهر — وهو أسوأ من إننا ما
 * فكرناهوش من أصله.
 */
export async function chooseMarketAction(marketId: string): Promise<void> {
  const jar = await cookies()

  jar.set(MARKET_COOKIE, String(marketId).slice(0, 64), {
    path: '/',
    maxAge: 365 * 24 * 60 * 60,
    sameSite: 'lax',
    /* الخادم وحده بيقراها — المتصفح مالوش دعوة بتسعير الصفحة */
    httpOnly: true,
  })
}
