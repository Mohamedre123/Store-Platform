'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { messagingSettings } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { encrypt } from '@/lib/crypto'

export type TelegramState = { ok?: boolean; error?: string; botName?: string } | null

/**
 * توكن بوت تيليجرام.
 *
 * ## ليه الحقل ده اتضاف
 * `notify-team` بيقرا `telegramBotToken` من زمان عشان يبعت إشعارات
 * الفريق — **ومكانش في أي مكان في اللوحة التاجر يحطّه فيه**. يعني
 * القناة كانت معروضة في قايمة المستقبلين، والتاجر يختارها ويحطّ
 * Chat ID، وما يوصلوش ولا إشعار واحد ولا يعرف ليه.
 *
 * ## التحقّق بنداء حقيقي
 * بنسأل تيليجرام `getMe` قبل ما نحفظ. التوكن الغلط بيتقفل عند الحفظ
 * بدل ما يتحفظ ويفضل ساكت — والرد بيدّينا اسم البوت، فالتاجر يشوف
 * إنه ربط البوت الصح مش بوت تاني عنده.
 */
export async function saveTelegramTokenAction(raw: unknown): Promise<TelegramState> {
  const parsed = z.object({ token: z.string().trim().max(200) }).safeParse(raw)
  if (!parsed.success) return { error: 'بيانات ناقصة' }

  const { store } = await getDashboardContext()
  const token = parsed.data.token

  /* الفاضي = امسح الربط */
  if (!token) {
    await db
      .insert(messagingSettings)
      .values({ storeId: store.id, telegramBotToken: null })
      .onConflictDoUpdate({
        target: messagingSettings.storeId,
        set: { telegramBotToken: null },
      })
    revalidatePath('/dashboard/automations')
    return { ok: true }
  }

  let botName = ''
  try {
    const res = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/getMe`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    })
    const body = (await res.json()) as { ok?: boolean; result?: { username?: string } }
    if (!body.ok) return { error: 'التوكن مش مقبول من تيليجرام. راجعه من BotFather.' }
    botName = body.result?.username ?? ''
  } catch {
    return { error: 'مقدرناش نوصل لتيليجرام دلوقتي. جرّب تاني.' }
  }

  /* مشفّر زي كل الأسرار — لو تسرّبت نسخة من القاعدة يفضل غير مقروء */
  await db
    .insert(messagingSettings)
    .values({ storeId: store.id, telegramBotToken: encrypt(token) })
    .onConflictDoUpdate({
      target: messagingSettings.storeId,
      set: { telegramBotToken: encrypt(token) },
    })

  revalidatePath('/dashboard/automations')
  return { ok: true, botName }
}
