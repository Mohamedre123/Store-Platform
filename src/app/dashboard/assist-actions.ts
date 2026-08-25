'use server'

import { z } from 'zod'
import { getDashboardContext } from '@/lib/store-context'
import { getAiConfig, GEMINI_PRO_SLUG, GEMINI_SLUG } from '@/lib/ai/settings'
import { getStoreBrief, briefLine } from '@/lib/ai/store-context'
import { editImage, generate, listImageModels, listModels } from '@/lib/ai/gemini'
import { uploadImage } from '@/lib/storage'

/**
 * المساعد في مكانه.
 *
 * الفكرة اللي وراه: التاجر مش عايز يفتح شات ويشرح إنه واقف فين.
 * هو واقف قدام الحتة اللي عايز يغيّرها — يحدّدها بإيده، يكتب اللي
 * عايزه، وخلاص. الشات مكانه لما يبقى عايز يفهم أو ينفّذ إجراءات
 * متسلسلة؛ ده مكانه التعديل السريع.
 *
 * **كل حاجة بتتنفّذ بمفتاح التاجر.** ما بنشيلش فاتورة استهلاك مش
 * بتاعنا — ونفس القاعدة سارية على النص والصور.
 */

export type AssistState =
  | { ok: true; text: string }
  | { ok: false; error: string; needsSetup?: boolean }

/**
 * المفتاح المستخدم.
 *
 * بيدوّر على مفتاح المساعد الأول وبعدين العادي. **الاتنين بيشتغلوا**
 * — التاجر اللي حطّ مفتاحًا واحدًا بس ما ينفعش نقوله «مش مفعّل»
 * وعنده مفتاح شغّال قدامنا.
 */
async function anyKey(
  storeId: string,
): Promise<{ ok: true; apiKey: string; model: string } | { ok: false; error: string }> {
  const pro = await getAiConfig(storeId, GEMINI_PRO_SLUG)
  const base = await getAiConfig(storeId, GEMINI_SLUG)

  const apiKey = pro.apiKey ?? base.apiKey
  const model = pro.model ?? base.model

  if (!apiKey || !model) {
    return { ok: false, error: 'محتاج مفتاح Gemini من صفحة الإضافات الأول.' }
  }

  return { ok: true, apiKey, model }
}

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
  const key = await anyKey(store.id)
  if (!key.ok) return { ok: false, error: key.error, needsSetup: true }

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

  const res = await generate({
    apiKey: key.apiKey,
    model: key.model,
    system,
    messages: [{ role: 'user', text: prompt }],
    temperature: 0.7,
    maxTokens: 700,
  })

  if (!res.ok) {
    return { ok: false, error: res.error.message, needsSetup: res.error.kind === 'invalid_key' }
  }

  return { ok: true, text: res.data }
}

/**
 * موديلات المفتاح — للتبديل من جوّه المساعد.
 *
 * **مش قايمة مكتوبة عندنا.** أي قايمة نكتبها بتبقى قديمة بعد شهرين،
 * والمفاتيح مش كلها ليها نفس الصلاحيات أصلًا — فالمتاح بيتسأل عنه
 * جوجل بمفتاح التاجر نفسه.
 */
export async function listChatModelsAction(): Promise<{
  models: Array<{ id: string; label: string }>
  current: string | null
}> {
  const { store } = await getDashboardContext()
  const key = await anyKey(store.id)
  if (!key.ok) return { models: [], current: null }

  const res = await listModels(key.apiKey)
  return {
    models: res.ok ? res.data.map((m) => ({ id: m.id, label: m.label })) : [],
    current: key.model,
  }
}

/* ────────────────────────── الصور ────────────────────────── */

export type ImageState =
  | { ok: true; url: string }
  | { ok: false; error: string; needsSetup?: boolean }

const imageSchema = z.object({
  /** رابط الصورة الأصلية — سيبه فاضي عشان يولّد صورة جديدة */
  sourceUrl: z.string().url().optional(),
  instruction: z.string().trim().min(1, 'اكتب التعديل اللي عايزه').max(600),
  /** موديل صور بعينه — فاضي يعني أول موديل صور متاح */
  model: z.string().trim().optional(),
})

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
  const key = await anyKey(store.id)
  if (!key.ok) return { ok: false, error: key.error, needsSetup: true }

  /*
    موديل الصور بيتجاب من المفتاح نفسه.
    موديل النص المختار (flash مثلًا) ما بيرجّعش صور، والنداء بيه
    بيرجّع فقرة بتوصف التعديل بدل ما تعمله.
  */
  let model = parsed.data.model
  if (!model) {
    const list = await listImageModels(key.apiKey)
    if (!list.ok) return { ok: false, error: list.error.message }
    model = list.data[0]?.id
  }

  if (!model) {
    return {
      ok: false,
      error: 'مفيش موديل صور متاح على مفتاحك. فعّل الفوترة في Google AI Studio وجرّب تاني.',
    }
  }

  /* الصورة الأصلية بتتجاب وبتتحوّل لـbase64 — جوجل بتاخدها كده */
  let image: { mimeType: string; dataBase64: string } | undefined
  if (parsed.data.sourceUrl) {
    try {
      const res = await fetch(parsed.data.sourceUrl, { signal: AbortSignal.timeout(20_000) })
      if (!res.ok) return { ok: false, error: 'مقدرناش نجيب الصورة الأصلية.' }

      const buf = Buffer.from(await res.arrayBuffer())
      /*
        حد على الحجم: جوجل بترفض فوق ٢٠ ميجا، والصورة الكبيرة
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

  const prompt = image
    ? `عدّل الصورة دي: ${parsed.data.instruction}. حافظ على المنتج نفسه زي ما هو — التعديل على الخلفية والإضاءة والكادر بس، إلا لو الطلب بيقول غير كده صراحةً.`
    : `صورة منتج احترافية لمتجر إلكتروني: ${parsed.data.instruction}`

  const res = await editImage({ apiKey: key.apiKey, model, prompt, image })
  if (!res.ok) {
    return { ok: false, error: res.error.message, needsSetup: res.error.kind === 'invalid_key' }
  }

  const ext = res.data.mimeType.includes('jpeg') ? 'jpg' : 'png'
  const file = new File(
    [Buffer.from(res.data.dataBase64, 'base64') as unknown as BlobPart],
    `ai-${Date.now()}.${ext}`,
    { type: res.data.mimeType },
  )

  const up = await uploadImage(store.id, 'products', file)
  if (!up.ok) return { ok: false, error: up.error }

  return { ok: true, url: up.url }
}

/** موديلات الصور المتاحة — الواجهة بتعرضها للتاجر يختار */
export async function listImageModelsAction(): Promise<
  { ok: true; models: Array<{ id: string; label: string }> } | { ok: false; error: string }
> {
  const { store } = await getDashboardContext()
  const key = await anyKey(store.id)
  if (!key.ok) return { ok: false, error: key.error }

  const res = await listImageModels(key.apiKey)
  if (!res.ok) return { ok: false, error: res.error.message }

  return { ok: true, models: res.data.map((m) => ({ id: m.id, label: m.label })) }
}
