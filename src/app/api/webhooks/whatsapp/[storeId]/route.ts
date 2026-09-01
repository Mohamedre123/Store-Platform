import { NextResponse, type NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { messageLog, stores } from '@/db/schema'
import { sendWhatsapp } from '@/lib/whatsapp'
import { applyReply, findPendingOrder, findSolePendingOrder, readReply } from '@/lib/order-confirm'
import { extractInbound, phoneForLid, rememberLid } from '@/lib/whatsapp-inbound'

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

  const msg = extractInbound(body)
  if (!msg) return NextResponse.json({ ok: true })

  /**
   * ترجمة المعرّف الداخلي بتتعلّم من أي رسالة فيها الاتنين.
   *
   * **قبل فحص `fromMe`**: صدى رسالة التأكيد اللي بعتناها إحنا بيحمل
   * المعرّف والرقم مع بعض، فالترجمة بتتعلّم من رسالتنا قبل ما العميل
   * يرد أصلًا — وردّه بيلاقي طريقه من أول مرة.
   */
  if (msg.lid && msg.phone) {
    await rememberLid(store.id, msg.lid, msg.phone)
  }

  /*
    كل رسالة واردة بتتسجّل — حتى اللي بنتجاهلها.

    قعدنا تلات جولات مش عارفين الرد وصل ولا لأ، لأن المسار كان بيرد
    200 ويسكت. السطر ده بيخلّي السؤال «البوابة بتبعتلنا؟» له إجابة في
    سجل الرسايل بدل تخمين.

    ومعرّف الرسالة معاه مفتاح تفرّد: البوابة بتبعت نفس الرسالة أكتر من
    مرة، وبدونه كنا بنقرا الرد مرتين ونرد عليه مرتين.
  */
  const logged = await db
    .insert(messageLog)
    .values({
      storeId: store.id,
      channel: 'whatsapp',
      event: 'inbound',
      recipient: msg.phone ?? (msg.lid ? `lid:${msg.lid}` : '-'),
      body: `${msg.fromMe ? '↩︎ منّا: ' : ''}${msg.text}`.slice(0, 400),
      status: 'sent',
      provider: 'whatsapp',
      providerRef: msg.messageId,
      sentAt: new Date(),
    })
    .onConflictDoNothing()
    .returning({ id: messageLog.id })
    .catch(() => [{ id: 'unknown' }])

  /*
    مفيش صف اتكتب = الرسالة دي عدّت من هنا قبل كده. الخروج هنا هو اللي
    بيمنع الرد المكرّر وتحريك حالة الطلب مرتين.
  */
  if (msg.messageId && logged.length === 0) return NextResponse.json({ ok: true })

  /*
    رسايلنا إحنا بترجع في الويب هوك كمان.

    من غير الفحص ده، الرد اللي بنبعته («طلبك اتأكّد») بيرجعلنا،
    بنقراه كأنه رد عميل، ونرد عليه — حلقة لا نهائية على رقم العميل.
  */
  if (msg.fromMe) return NextResponse.json({ ok: true })

  const reply = readReply(msg.text)
  if (!reply) return NextResponse.json({ ok: true })

  /**
   * الوصول للطلب — بالرقم، وإلا بالترجمة، وإلا بالوحدانية.
   *
   * البحث دايمًا **جوّه متجر الويب هوك**: الرقم الواحد ممكن يكون طالب
   * من كذا متجر، والفلترة جوّه الاستعلام لا بعده بتخلّي رد عميل في
   * متجر ما يقدرش يلمس طلب متجر تاني مهما حصل.
   */
  const phone = msg.phone ?? (msg.lid ? await phoneForLid(store.id, msg.lid) : null)

  const order = phone
    ? await findPendingOrder(store.id, phone)
    : /*
        العميل ردّ ومعانا معرّفه الداخلي بس. لو فيه طلب مستني واحد
        بالظبط، هو ده — ولو أكتر من واحد بنسيبها للتاجر بدل ما نأكّد
        طلب حد تاني.
      */
      await findSolePendingOrder(store.id)

  if (!order) return NextResponse.json({ ok: true })

  /*
    الترجمة بتتعلّم من الطلب اللي لقيناه.

    الرد اللي بعده بيوصل برقمه مباشرةً من غير أي استنتاج — فالوحدانية
    فوق بتلزم أول رد بس.
  */
  if (msg.lid && !msg.phone && order.phone) {
    await rememberLid(store.id, msg.lid, order.phone)
  }

  const answer = await applyReply({
    orderId: order.id,
    storeId: order.storeId,
    reply,
    customerName: order.name,
  })

  await sendWhatsapp(order.storeId, order.phone ?? phone ?? '', answer, {
    event: 'order_confirm_reply',
    orderId: order.id,
  }).catch(() => undefined)

  return NextResponse.json({ ok: true })
}
