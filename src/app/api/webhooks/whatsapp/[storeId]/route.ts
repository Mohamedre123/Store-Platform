import { NextResponse, type NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { stores } from '@/db/schema'
import { normalizePhone } from '@/lib/utils'
import { sendWhatsapp } from '@/lib/whatsapp'
import { applyReply, findPendingOrder, readReply } from '@/lib/order-confirm'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * الرسايل الواردة على واتساب المتجر.
 *
 * ## بيعمل حاجة واحدة بس
 * بيقرا رد العميل على طلب التأكيد («١» أو «٢»)، بيسجّله على الطلب،
 * وبيرد عليه. **مش بوت محادثة** — أي رسالة تانية بيتجاهلها بصمت.
 *
 * التحديد ده مقصود: البوت اللي بيرد على كل حاجة بيرد غلط على حاجات
 * كتير، وبيخلّي العميل يفتكر إنه بيكلّم حد وهو لأ. اللي عايز يسأل
 * بيلاقي التاجر نفسه بيرد — الرسالة بتوصله زي ما هي.
 *
 * ## ليه بيرد 200 دايمًا
 * البوابة بتعيد المحاولة على أي رد مش ناجح. ورسالة مالهاش علاقة
 * بالتأكيد مش «فشل» — فلو رجّعنا خطأ، البوابة تفضل تبعتها ونفضل
 * نتجاهلها في حلقة مالهاش لازمة.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await ctx.params

  /* المتجر لازم يكون موجود — المسار مفتوح، والمعرّف uuid مش مخمّن */
  const [store] = await db
    .select({ id: stores.id })
    .from(stores)
    .where(eq(stores.id, storeId))
    .limit(1)
  if (!store) return NextResponse.json({ ok: true })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: true })
  }

  const msg = extract(body)
  if (!msg) return NextResponse.json({ ok: true })

  /*
    رسايلنا إحنا بترجع في الويب هوك كمان.

    من غير الفحص ده، الرد اللي بنبعته («طلبك اتأكّد») بيرجعلنا،
    بنقراه كأنه رد عميل، ونرد عليه — حلقة لا نهائية على رقم العميل.
  */
  if (msg.fromMe) return NextResponse.json({ ok: true })

  const reply = readReply(msg.text)
  if (!reply) return NextResponse.json({ ok: true })

  /*
    البحث جوّه متجر الويب هوك وبس.

    الرقم الواحد ممكن يكون طالب من كذا متجر. الفلترة جوّه الاستعلام
    لا بعده: كده الرد ما يقدرش يلمس طلب متجر تاني مهما حصل.
  */
  const phone = normalizePhone(msg.phone)
  const order = await findPendingOrder(store.id, phone)
  if (!order) return NextResponse.json({ ok: true })

  const answer = await applyReply({
    orderId: order.id,
    storeId: order.storeId,
    reply,
    customerName: order.name,
  })

  await sendWhatsapp(order.storeId, phone, answer, {
    event: 'order_confirm_reply',
    orderId: order.id,
  }).catch(() => undefined)

  return NextResponse.json({ ok: true })
}

/**
 * بيطلّع الرسالة من شكل البوابة.
 *
 * الأشكال بتختلف بين نسخ البوابة وبين مزوّد وآخر، فبنجرّب المسارات
 * المعروفة بدل ما نتمسّك بواحد ونفضل صامتين لو اتغيّر.
 */
function extract(body: unknown): { phone: string; text: string; fromMe: boolean } | null {
  const b = body as Record<string, unknown>
  const data = (b?.data ?? b) as Record<string, unknown>
  const messages = (data?.messages ?? data?.message ?? data) as Record<string, unknown>

  const key = (messages?.key ?? {}) as Record<string, unknown>
  const remote = String(key.remoteJid ?? messages?.from ?? data?.from ?? '')

  /* الجروبات مش عملاء — الرد عليها ضجيج */
  if (!remote || remote.includes('@g.us')) return null

  const phone = remote.split('@')[0].replace(/\D/g, '')
  if (phone.length < 8) return null

  const inner = (messages?.message ?? {}) as Record<string, unknown>
  const extended = (inner?.extendedTextMessage ?? {}) as Record<string, unknown>
  const text = String(
    inner?.conversation ??
      extended?.text ??
      messages?.text ??
      messages?.body ??
      data?.text ??
      '',
  )

  if (!text.trim()) return null

  return { phone, text, fromMe: Boolean(key.fromMe ?? messages?.fromMe) }
}
