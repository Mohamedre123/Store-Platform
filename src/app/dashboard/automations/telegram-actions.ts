'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { messagingSettings } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { decrypt, encrypt } from '@/lib/crypto'

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

/* ────────────────────── معرّف المحادثة ────────────────────── */

export type ChatsState =
  | { ok: true; chats: Array<{ id: string; name: string }> }
  | { ok: false; error: string }

/**
 * بيجيب معرّفات المحادثات اللي كلّمت البوت.
 *
 * ## ليه موجودة
 * إضافة مستقبِل تيليجرام محتاجة «Chat ID» — رقم مالوش أي مكان ظاهر
 * في تطبيق تيليجرام. التاجر كان لازم يدوّر على بوت تاني يقوله رقمه،
 * أو يفتح رابط API بإيده. الاتنين خطوة تقنية على حد جاي يفتح متجر.
 *
 * دلوقتي بيبعت أي رسالة لبوته ويدوس زرار — وإحنا بنقرا الرقم ونحطّه.
 *
 * ## `getUpdates` بتنسى
 * تيليجرام بيمسح التحديثات بعد ٢٤ ساعة، وبيرجّع الجديد بس. فلو
 * التاجر ما بعتش رسالة، القايمة بترجع فاضية — والرسالة بتقوله يبعت
 * الأول بدل ما تقول «مفيش نتايج» وهو مش عارف يعمل إيه.
 */
export async function listTelegramChatsAction(): Promise<ChatsState> {
  const { store } = await getDashboardContext()

  const [row] = await db
    .select({ token: messagingSettings.telegramBotToken })
    .from(messagingSettings)
    .where(eq(messagingSettings.storeId, store.id))
    .limit(1)

  if (!row?.token) return { ok: false, error: 'احفظ توكن البوت الأول.' }

  /* التوكن متخزّن مشفّرًا — والقديم ممكن يكون خامًا */
  let token = row.token
  if (token.includes('.')) {
    try {
      token = decrypt(token)
    } catch {
      /* خام — نستخدمه زي ما هو */
    }
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${encodeURIComponent(token)}/getUpdates?limit=50`,
      { cache: 'no-store', signal: AbortSignal.timeout(12_000) },
    )
    const body = (await res.json()) as {
      ok?: boolean
      result?: Array<{
        message?: { chat?: { id?: number; title?: string; first_name?: string; username?: string } }
      }>
    }

    if (!body.ok) return { ok: false, error: 'البوت رفض الطلب — راجع التوكن.' }

    const seen = new Map<string, string>()
    for (const u of body.result ?? []) {
      const chat = u.message?.chat
      if (!chat?.id) continue
      const name = chat.title || chat.first_name || (chat.username ? '@' + chat.username : '') || 'محادثة'
      seen.set(String(chat.id), name)
    }

    return { ok: true, chats: [...seen].map(([id, name]) => ({ id, name })) }
  } catch {
    return { ok: false, error: 'مقدرناش نوصل لتيليجرام دلوقتي. جرّب تاني.' }
  }
}
