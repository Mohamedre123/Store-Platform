import { NextResponse, type NextRequest } from 'next/server'
import { getStore } from '@/lib/storefront'
import { getAiConfig, isReady } from '@/lib/ai/settings'
import { getStoreBrief } from '@/lib/ai/store-context'
import { buildBotSystem, checkLimits, logBotMessage } from '@/lib/ai/bot'
import { generate, type ChatMessage } from '@/lib/ai/gemini'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * بوت المتجر.
 *
 * مفتوح من غير مصادقة — الزائر مش مسجّل دخول. فكل حاجة جاية من
 * المتصفح مُدخل غير موثوق:
 *
 * - المفتاح بيتقرا من الخادم، ما بيوصلش للمتصفح ولا بيتقبل منه.
 * - الحدود بتتفرض هنا لا في الواجهة: إخفاء الزرار مش حماية، وأي حد
 *   يقدر ينده المسار مباشرة.
 * - سجل المحادثة اللي جاي من المتصفح بيتقص ونوعه بيتفلتر — عميل
 *   بيبعت ألف رسالة مزوّرة بيستهلك رصيد التاجر في نداء واحد.
 */
export async function POST(req: NextRequest) {
  let body: {
    store?: string
    visitorId?: string
    message?: string
    history?: Array<{ role?: string; text?: string }>
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 })
  }

  const message = (body.message ?? '').trim().slice(0, 500)
  const visitorId = (body.visitorId ?? '').trim().slice(0, 64)

  if (!body.store || !message || !visitorId) {
    return NextResponse.json({ error: 'بيانات ناقصة' }, { status: 400 })
  }

  const store = await getStore(body.store)
  if (!store) return NextResponse.json({ error: 'المتجر مش موجود' }, { status: 404 })

  const cfg = await getAiConfig(store.id)
  if (!cfg.botEnabled || !isReady(cfg)) {
    return NextResponse.json({ error: 'المساعد مش مفعّل' }, { status: 404 })
  }

  const limit = await checkLimits({
    storeId: store.id,
    visitorId,
    dailyLimit: cfg.botDailyLimit,
    visitorLimit: cfg.botVisitorLimit,
  })

  if (!limit.ok) {
    // ٢٠٠ لا ٤٢٩: ده مش خطأ، ده رد مقصود العميل لازم يقراه
    return NextResponse.json({ reply: limit.message, exhausted: true })
  }

  const brief = await getStoreBrief(store.id, cfg.brief)

  /*
    آخر ٦ رسايل بس. المحادثة الطويلة بتكبّر كل نداء وبتغرق تعليمات
    النظام في كلام قديم — وده اللي بيخلّي البوت «ينسى» إنه محصور
    في المتجر.
  */
  const history: ChatMessage[] = (body.history ?? [])
    .filter((m) => (m.role === 'user' || m.role === 'model') && typeof m.text === 'string')
    .slice(-6)
    .map((m) => ({ role: m.role as 'user' | 'model', text: String(m.text).slice(0, 500) }))

  const res = await generate({
    apiKey: cfg.apiKey,
    model: cfg.model,
    system: buildBotSystem(brief, store.name),
    messages: [...history, { role: 'user', text: message }],
    // حرارة منخفضة: الرد لازم يلتزم بالأسعار المكتوبة لا يبدع فيها
    temperature: 0.4,
    maxTokens: 400,
  })

  if (!res.ok) {
    await logBotMessage({
      storeId: store.id,
      visitorId,
      question: message,
      status: 'failed',
      error: res.error.message,
    })

    /*
      الرسالة الحقيقية للتاجر في سجل الرسايل، والعميل بياخد رسالة
      مفيدة. «مفتاحك خلص رصيده» مش كلام يتقال لعميل بيسأل عن مقاس.
    */
    return NextResponse.json({
      reply: 'معلش، حصلت مشكلة عندي. كلّمنا على واتساب وهنساعدك فورًا.',
      exhausted: true,
    })
  }

  await logBotMessage({ storeId: store.id, visitorId, question: message, status: 'sent' })

  return NextResponse.json({ reply: res.data })
}
