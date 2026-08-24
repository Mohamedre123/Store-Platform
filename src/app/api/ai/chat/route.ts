import { NextResponse, type NextRequest } from 'next/server'
import { getStore } from '@/lib/storefront'
import { getAiConfig, isReady, GEMINI_PRO_SLUG } from '@/lib/ai/settings'
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

  const system = buildBotSystem(brief, store.name)
  const messages: ChatMessage[] = [...history, { role: 'user', text: message }]

  let res = await generate({
    apiKey: cfg.apiKey,
    model: cfg.model,
    system,
    messages,
    // حرارة منخفضة: الرد لازم يلتزم بالأسعار المكتوبة لا يبدع فيها
    temperature: 0.4,
    /*
      الحد كان ٤٠٠ توكن، والرد العربي بياكل توكنز أكتر من الإنجليزي
      بكتير — فالبوت كان بيقف في نص الجملة («لو محتاج أي مساعدة
      تانية بخصوص»). الرد المقطوع أسوأ من رد قصير: العميل بيفتكر
      إن الموقع باظ.
    */
    maxTokens: 1200,
  })

  /**
   * الرجوع لمفتاح المساعد لو كوته البوت خلصت.
   *
   * **المتجر ما يصحّش يقف قدام العميل عشان حصّة مجانية خلصت.**
   * التاجر اللي حاطط مفتاحًا عليه فوترة للمساعد، بيستخدمه هنا كشبكة
   * أمان — رسالة عميل واحدة أرخص بكتير من بيعة ضايعة.
   *
   * بيحصل على الكوته بس: المفتاح الباطل والمحتوى الممنوع مش هيتصلّحوا
   * بمفتاح تاني، وإعادة المحاولة بيهم بتستهلك المفتاح المدفوع على
   * الفاضي.
   */
  if (!res.ok && res.error.kind === 'quota') {
    const pro = await getAiConfig(store.id, GEMINI_PRO_SLUG)
    if (pro.apiKey && pro.apiKey !== cfg.apiKey) {
      res = await generate({
        apiKey: pro.apiKey,
        model: pro.model ?? cfg.model,
        system,
        messages,
        temperature: 0.4,
        /*
      الحد كان ٤٠٠ توكن، والرد العربي بياكل توكنز أكتر من الإنجليزي
      بكتير — فالبوت كان بيقف في نص الجملة («لو محتاج أي مساعدة
      تانية بخصوص»). الرد المقطوع أسوأ من رد قصير: العميل بيفتكر
      إن الموقع باظ.
    */
    maxTokens: 1200,
      })
    }
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
      الرسالة الحقيقية للتاجر في سجل الرسايل، والعميل بياخد رسالة
      مفيدة. «مفتاحك خلص رصيده» مش كلام يتقال لعميل بيسأل عن مقاس.

      و**بنرجّع رقم الواتساب مع الرد**: العميل اللي البوت وقف معاه
      لازم يلاقي طريقًا لبني آدم في نفس الفقاعة. «كلّمنا على واتساب»
      من غير رابط بتخلّيه يدوّر — وأغلبهم بيسيب.
    */
    return NextResponse.json({
      reply: 'معلش، مقدرتش أجاوبك دلوقتي. كلّمنا على واتساب وهنساعدك فورًا.',
      exhausted: true,
      whatsapp: store.whatsapp ?? null,
    })
  }

  await logBotMessage({ storeId: store.id, visitorId, question: message, status: 'sent' })

  return NextResponse.json({ reply: res.data })
}
