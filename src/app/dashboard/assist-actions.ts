'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { storePlugins } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { getAiConfig, GEMINI_PRO_SLUG, resolveEngines, noteAiOutcome } from '@/lib/ai/settings'
import { getStoreBrief, briefLine } from '@/lib/ai/store-context'
import { editImage } from '@/lib/ai/gemini'
import { generateImage as openaiImage } from '@/lib/ai/openai'
import { generateText, listImageModels, listTextModels } from '@/lib/ai/llm'
import { AI_PROVIDERS, isProvider, type AiProvider } from '@/lib/ai/providers-meta'
import { uploadImage } from '@/lib/storage'

/**
 * المساعد في مكانه.
 *
 * الفكرة اللي وراه: التاجر مش عايز يفتح شات ويشرح إنه واقف فين.
 * هو واقف قدام الحتة اللي عايز يغيّرها — يحدّدها بإيده، يكتب اللي
 * عايزه، وخلاص. الشات مكانه لما يبقى عايز يفهم أو ينفّذ إجراءات
 * متسلسلة؛ ده مكانه التعديل السريع.
 *
 * **كل حاجة بتتنفّذ بمفتاح التاجر** — Gemini أو ChatGPT. ما بنشيلش
 * فاتورة استهلاك مش بتاعتنا.
 */

export type AssistState =
  | { ok: true; text: string }
  | { ok: false; error: string; needsSetup?: boolean }

const askSchema = z.object({
  /** النص اللي التاجر حدّده بالماوس */
  selection: z.string().trim().max(4000).optional(),
  /** اللي كتبه في الصندوق */
  instruction: z.string().trim().min(1, 'اكتب اللي عايزه').max(600),
  /** الصفحة اللي هو فيها — بتدّي الموديل سياقًا من غير ما التاجر يشرح */
  page: z.string().trim().max(120).optional(),
})

/**
 * سؤال سريع على حاجة محدّدة.
 *
 * الرد **نص جاهز للّصق** لا شرح: التاجر حدّد وصف منتج وكتب «خلّيه
 * أقصر» — عايز الوصف القصير، مش فقرة بتشرحله إزاي يقصّره.
 */
export async function assistAskAction(raw: unknown): Promise<AssistState> {
  const parsed = askSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'بيانات ناقصة' }

  const { store } = await getDashboardContext()
  const engines = await resolveEngines(store.id, 'tools')
  if (!engines.ok) return { ok: false, error: engines.error, needsSetup: engines.needsSetup }

  const pro = await getAiConfig(store.id, GEMINI_PRO_SLUG)
  const info = await getStoreBrief(store.id, pro.brief)

  const system = [
    `إنت مساعد جوّه لوحة تحكم متجر «${store.name}».`,
    `عن المتجر: ${briefLine(info)}`,
    '',
    'التاجر حدّد حتة من الشاشة وكتب اللي عايزه فيها.',
    '',
    'قواعد ملزمة:',
    '- **رُدّ بالناتج نفسه جاهز للّصق، من غير مقدمات ولا شرح.**',
    '  لو طلب يقصّر وصفًا، ابعت الوصف القصير بس.',
    '- بالعربي المصري البسيط زي ما التاجر بيتكلم، إلا لو طلب غير كده.',
    '- ما تخترعش أسعار ولا مقاسات ولا أرقام. لو ناقصك رقم، سيب مكانه واضحًا.',
    '- لو الطلب سؤال (مش تعديل)، جاوب في سطرين على الأكثر.',
    parsed.data.page ? `- التاجر واقف في صفحة: ${parsed.data.page}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const prompt = parsed.data.selection
    ? `النص المحدّد:\n"""\n${parsed.data.selection}\n"""\n\nالمطلوب: ${parsed.data.instruction}`
    : parsed.data.instruction

  const res = await generateText(engines.engine, {
    system,
    messages: [{ role: 'user', text: prompt }],
    temperature: 0.7,
    maxTokens: 700,
  })

  if (!res.ok) {
    return {
      ok: false,
      error: res.error.message,
      needsSetup: res.error.kind === 'invalid_key' || res.error.kind === 'no_credit',
    }
  }

  return { ok: true, text: res.data }
}

export type ProviderModels = {
  provider: AiProvider
  label: string
  models: Array<{ id: string; label: string }>
}

/**
 * موديلات المفاتيح — للتبديل من جوّه المساعد.
 *
 * **مش قايمة مكتوبة عندنا.** أي قايمة نكتبها بتبقى قديمة بعد شهرين،
 * والمفاتيح مش كلها ليها نفس الصلاحيات أصلًا — فالمتاح بيتسأل عنه
 * المزوّد بمفتاح التاجر نفسه. ولكل مزوّد ليه مفتاح قايمته.
 */
export async function listChatModelsAction(): Promise<{
  providers: ProviderModels[]
  current: { provider: AiProvider; model: string } | null
}> {
  const { store } = await getDashboardContext()
  const engines = await resolveEngines(store.id, 'tools')
  if (!engines.ok) return { providers: [], current: null }

  const all = [engines.engine, ...engines.fallbacks]
  const providers = await Promise.all(
    all.map(async (e) => {
      const res = await listTextModels(e.provider, e.apiKey)
      return {
        provider: e.provider,
        label: AI_PROVIDERS.find((p) => p.key === e.provider)!.label,
        models: res.ok ? res.data : [{ id: e.model, label: e.model }],
      }
    }),
  )

  return {
    providers,
    current: { provider: engines.engine.provider, model: engines.engine.model },
  }
}

/**
 * المزوّد الافتراضي للمساعد والأدوات.
 *
 * التبديل من الشات بيتحفظ على الإضافة لا في المتصفح بس: زرار
 * «تحسين» و«حدّد واسأل» والاستوديو بيمشوا ورا نفس الاختيار — التاجر
 * اللي بدّل لـChatGPT عشان Gemini خلص رصيده ما يصحّش يلاقي باقي
 * الأدوات لسه واقفة على Gemini.
 */
export async function setAssistantProviderAction(provider: string): Promise<{ ok: boolean }> {
  if (!isProvider(provider)) return { ok: false }

  const { store } = await getDashboardContext()
  const engines = await resolveEngines(store.id, 'tools', provider)
  if (!engines.ok || engines.engine.provider !== provider) return { ok: false }

  const patch = JSON.stringify({ provider })
  const updated = await db
    .update(storePlugins)
    .set({ config: sql`coalesce(${storePlugins.config}, '{}'::jsonb) || ${patch}::jsonb` })
    .where(and(eq(storePlugins.storeId, store.id), eq(storePlugins.pluginSlug, GEMINI_PRO_SLUG)))
    .returning({ id: storePlugins.id })

  if (updated.length) revalidatePath('/dashboard/plugins')
  return { ok: true }
}

/* ────────────────────────── الصور ────────────────────────── */

export type ImageState =
  | { ok: true; url: string }
  | { ok: false; error: string; needsSetup?: boolean }

const imageSchema = z.object({
  /** رابط الصورة الأصلية — سيبه فاضي عشان يولّد صورة جديدة */
  sourceUrl: z.string().url().optional(),
  instruction: z.string().trim().min(1, 'اكتب التعديل اللي عايزه').max(600),
  /** مزوّد بعينه — فاضي يعني اختيار التاجر المحفوظ */
  provider: z.string().trim().max(20).optional(),
  /** موديل صور بعينه — فاضي يعني أول موديل صور متاح */
  model: z.string().trim().optional(),
})

/**
 * جودة الصورة — بتتلزق في آخر كل وصف.
 *
 * الوصف القصير («خلفية بيضا») كان بيطلع صورة نضيفة بس عادية. الجملة
 * دي بتطلب مستوى صورة إعلانات البراندات من غير ما تغيّر اللي التاجر
 * طلبه: لا زاوية ولا عزل ولا مكان.
 */
const IMAGE_QUALITY =
  'Ultra-high-resolution photorealistic commercial product photography. Razor-sharp focus, zero artifacts, ' +
  'true-to-life textures and materials, professional lighting suited to the request, rich clean accurate colors, ' +
  'premium brand aesthetic. Do not add anything that was not requested.'

/**
 * تعديل صورة منتج بالوصف.
 *
 * **الصور في المنتجات بس** عن قصد: ده المكان اللي التعديل فيه بيفرق
 * في البيع (خلفية بيضا، شيل حاجة من الكادر، وضّح الألوان). البوت
 * اللي بيرد على العملاء مالوش دعوة بيها — توليد صور في محادثة عميل
 * بيستهلك رصيد التاجر بسرعة على حاجة محدش طلبها.
 *
 * الناتج بيترفع للتخزين وبيرجع كرابط، فالتاجر يقدر يحطّه في المنتج
 * على طول.
 */
export async function assistImageAction(raw: unknown): Promise<ImageState> {
  const parsed = imageSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'بيانات ناقصة' }

  const { store } = await getDashboardContext()
  const engines = await resolveEngines(store.id, 'tools', parsed.data.provider)
  if (!engines.ok) return { ok: false, error: engines.error, needsSetup: engines.needsSetup }
  const engine = engines.engine

  /* الصورة الأصلية بتتجاب وبتتحوّل لـbase64 — المزوّدين الاتنين بياخدوها كده */
  let image: { mimeType: string; dataBase64: string } | undefined
  if (parsed.data.sourceUrl) {
    try {
      const res = await fetch(parsed.data.sourceUrl, { signal: AbortSignal.timeout(20_000) })
      if (!res.ok) return { ok: false, error: 'مقدرناش نجيب الصورة الأصلية.' }

      const buf = Buffer.from(await res.arrayBuffer())
      /*
        حد على الحجم: المزوّدين بيرفضوا الكبير، والصورة الكبيرة
        بتتحاسب على التاجر أضعاف من غير فرق في الناتج.
      */
      if (buf.byteLength > 15 * 1024 * 1024) {
        return { ok: false, error: 'الصورة كبيرة أوي. استخدم نسخة أصغر.' }
      }

      image = {
        mimeType: res.headers.get('content-type') ?? 'image/png',
        dataBase64: buf.toString('base64'),
      }
    } catch {
      return { ok: false, error: 'مقدرناش نجيب الصورة الأصلية.' }
    }
  }

  const prompt = [
    image
      ? `عدّل الصورة دي: ${parsed.data.instruction}. حافظ على المنتج نفسه زي ما هو — التعديل على الخلفية والإضاءة والكادر بس، إلا لو الطلب بيقول غير كده صراحةً.`
      : `صورة منتج احترافية لمتجر إلكتروني: ${parsed.data.instruction}`,
    '',
    IMAGE_QUALITY,
  ].join('\n')

  let result: { ok: true; data: { mimeType: string; dataBase64: string } } | { ok: false; error: { kind: string; message: string } }

  if (engine.provider === 'openai') {
    result = await openaiImage({
      apiKey: engine.apiKey,
      model: parsed.data.model || null,
      prompt,
      images: image ? [image] : [],
      aspect: '1:1',
    })
  } else {
    /*
      موديل الصور بيتجاب من المفتاح نفسه.
      موديل النص المختار (flash مثلًا) ما بيرجّعش صور، والنداء بيه
      بيرجّع فقرة بتوصف التعديل بدل ما تعمله.
    */
    let model = parsed.data.model
    if (!model) {
      const list = await listImageModels('gemini', engine.apiKey)
      if (!list.ok) return { ok: false, error: list.error.message }
      model = list.data[0]?.id
    }
    if (!model) {
      return {
        ok: false,
        error: 'مفيش موديل صور متاح على مفتاح Gemini. فعّل الفوترة في Google AI Studio وجرّب تاني.',
      }
    }
    result = await editImage({ apiKey: engine.apiKey, model, prompt, image })
  }

  await noteAiOutcome(engine, result)

  if (!result.ok) {
    return {
      ok: false,
      error: result.error.message,
      needsSetup: result.error.kind === 'invalid_key' || result.error.kind === 'no_credit',
    }
  }

  const ext = result.data.mimeType.includes('jpeg') ? 'jpg' : 'png'
  const file = new File(
    [Buffer.from(result.data.dataBase64, 'base64') as unknown as BlobPart],
    `ai-${Date.now()}.${ext}`,
    { type: result.data.mimeType },
  )

  const up = await uploadImage(store.id, 'products', file)
  if (!up.ok) return { ok: false, error: up.error }

  return { ok: true, url: up.url }
}

/** موديلات الصور المتاحة لكل مزوّد — الواجهة بتعرضها للتاجر يختار */
export async function listImageModelsAction(): Promise<
  | { ok: true; providers: ProviderModels[]; current: AiProvider }
  | { ok: false; error: string }
> {
  const { store } = await getDashboardContext()
  const engines = await resolveEngines(store.id, 'tools')
  if (!engines.ok) return { ok: false, error: engines.error }

  const all = [engines.engine, ...engines.fallbacks]
  const providers = await Promise.all(
    all.map(async (e) => {
      const res = await listImageModels(e.provider, e.apiKey)
      return {
        provider: e.provider,
        label: AI_PROVIDERS.find((p) => p.key === e.provider)!.label,
        models: res.ok ? res.data : [],
      }
    }),
  )

  return { ok: true, providers, current: engines.engine.provider }
}
