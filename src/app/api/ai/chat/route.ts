import { NextResponse, type NextRequest } from 'next/server'
import { getStore } from '@/lib/storefront'
import { getAiConfig, resolveEngines } from '@/lib/ai/settings'
import { getStoreBrief } from '@/lib/ai/store-context'
import { buildBotSystem, checkLimits, logBotMessage, splitWhatsappMarker } from '@/lib/ai/bot'
import { generateText, isAccountProblem } from '@/lib/ai/llm'
import type { ChatMessage } from '@/lib/ai/gemini'

export const dynamic = 'force-dynamic'
export const maxDuration = 45

/**
 * رابط واتساب برسالة جاهزة عن اللي العميل سأل عنه بالظبط.
 *
 * الرسالة الجاهزة بتفرق: العميل اللي بيفتح واتساب على شاشة فاضية
 * بيقفلها، واللي بيلاقي سؤاله مكتوب بيبعت. والتاجر بيوصله السؤال
 * كامل فيعرف يرد من غير لفّ.
 */
function whatsappLink(phone: string | null, storeName: string, question: string): string | null {
  const digits = (phone ?? '').replace(/\D/g, '')
  if (digits.length < 8) return null

  const text = [
    `أهلًا ${storeName} 👋`,
    `سألت المساعد عن: «${question.slice(0, 180)}»`,
    'ممكن أتأكد لو ده متاح عندكم؟',
  ].join('\n')

  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}

/**
 * بوت المتجر.
 *
 * مفتوح من غير مصادقة — الزائر مش مسجّل دخول. فكل حاجة جاية من
 * المتصفح مُدخل غير موثوق:
 *
 * - المفتاح بيتقرا من الخادم، ما بيوصلش للمتصفح ولا بيتقبل منه.
 * - **المزوّد كمان**: التاجر هو اللي بيحدد البوت بيرد بـGemini ولا
 *   ChatGPT، ومفيش حقل في الطلب يغيّره. زائر يختار المزوّد الأغلى
 *   كان هيصرف رصيد التاجر بقراره هو.
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
  if (!cfg.enabled || !cfg.botEnabled) {
    return NextResponse.json({ error: 'المساعد مش مفعّل' }, { status: 404 })
  }

  /* الاشتراك والمفتاح والمزوّد اللي التاجر اختاره — من مكان واحد */
  const engines = await resolveEngines(store.id, 'bot')
  if (!engines.ok) {
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
    return NextResponse.json({
      reply: limit.message,
      exhausted: true,
      whatsapp: store.whatsapp ?? null,
    })
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

  const system = buildBotSystem(brief, store.name, Boolean(store.whatsapp))
  const messages: ChatMessage[] = [...history, { role: 'user', text: message }]

  const ask = (engine: typeof engines.engine) =>
    generateText(engine, {
      system,
      messages,
      // حرارة منخفضة: الرد لازم يلتزم بالأسعار المكتوبة لا يبدع فيها
      temperature: 0.4,
      /*
        الحد كان ٤٠٠ توكن، والرد العربي بياكل توكنز أكتر من الإنجليزي
        بكتير — فالبوت كان بيقف في نص الجملة. الرد المقطوع أسوأ من رد
        قصير: العميل بيفتكر إن الموقع باظ.
      */
      maxTokens: 1200,
    })

  let res = await ask(engines.engine)

  /**
   * الرجوع لمفتاح تاني لو الحساب وقف.
   *
   * **المتجر ما يصحّش يقف قدام العميل عشان رصيد خلص.** بنجرّب مفتاح
   * المساعد لنفس المزوّد، وبعدين المزوّد التاني لو التاجر حاطط مفتاحه —
   * رسالة عميل واحدة أرخص بكتير من بيعة ضايعة. والمشكلة نفسها بتتسجّل
   * على كارت الإضافة، فالتاجر بيعرف إن مزوّده الأساسي وقف.
   *
   * على مشاكل الحساب بس: المحتوى الممنوع مش هيتصلّح بمفتاح تاني،
   * وإعادته بتستهلك المفتاح التاني على الفاضي.
   */
  for (const fallback of engines.fallbacks) {
    if (res.ok || !isAccountProblem(res.error)) break
    res = await ask(fallback)
  }

  if (!res.ok) {
    await logBotMessage({
      storeId: store.id,
      visitorId,
      question: message,
      status: 'failed',
      error: res.error.message,
    })

    /*
      الرسالة الحقيقية للتاجر في سجل الرسايل وعلى كارت الإضافة، والعميل
      بياخد رسالة مفيدة. «مفتاحك خلص رصيده» مش كلام يتقال لعميل بيسأل
      عن مقاس.

      و**بنرجّع رقم الواتساب مع الرد**: العميل اللي البوت وقف معاه
      لازم يلاقي طريقًا لبني آدم في نفس الفقاعة.
    */
    return NextResponse.json({
      reply: 'معلش، مقدرتش أجاوبك دلوقتي. كلّمنا على واتساب وهنساعدك فورًا.',
      exhausted: true,
      whatsapp: store.whatsapp ?? null,
    })
  }

  await logBotMessage({ storeId: store.id, visitorId, question: message, status: 'sent' })

  /*
    البوت بيعلّم على الرد اللي قال فيه «مش معروض»، وإحنا بنحوّل
    العلامة لزر واتساب برسالة فيها سؤال العميل نفسه.

    العلامة بتتشال دايمًا حتى لو المتجر مش مربوط بواتساب — العميل
    ما يصحّش يشوف رمزًا داخليًا في المحادثة.
  */
  const { text, offer } = splitWhatsappMarker(res.data)

  return NextResponse.json({
    reply: text,
    whatsappHref: offer ? whatsappLink(store.whatsapp, store.name, message) : null,
  })
}
