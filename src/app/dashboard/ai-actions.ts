'use server'

import { z } from 'zod'
import { getDashboardContext } from '@/lib/store-context'
import { getAiConfig, GEMINI_PRO_SLUG, GEMINI_SLUG, resolveEngines } from '@/lib/ai/settings'
import { getStoreBrief } from '@/lib/ai/store-context'
import { generateText } from '@/lib/ai/llm'
import { TASKS, buildPrompt, buildSystem, parseSuggestions, type TaskKey } from '@/lib/ai/tasks'

export type ImproveState =
  | { ok: true; suggestions: string[] }
  | { ok: false; error: string; needsSetup?: boolean }

const schema = z.object({
  task: z.string(),
  current: z.string().max(4000).default(''),
  fields: z.record(z.string(), z.string().max(500)).optional(),
  hint: z.string().max(300).optional(),
})

/**
 * تحسين نص بالذكاء الاصطناعي.
 *
 * بيشتغل بمفتاح التاجر نفسه — Gemini أو ChatGPT، اللي اختاره آخر مرة
 * في المساعد. إحنا بس بنركّب السياق ونترجم الخطأ.
 *
 * `needsSetup` بيرجع لما الإضافة مش متظبّطة، عشان الواجهة تودّي
 * التاجر لصفحة الإضافات بدل ما تقوله «فشل» وتسيبه.
 */
export async function improveTextAction(raw: unknown): Promise<ImproveState> {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: 'بيانات ناقصة' }

  const task = parsed.data.task as TaskKey
  if (!TASKS[task]) return { ok: false, error: 'نوع التحسين مش معروف' }

  const { store } = await getDashboardContext()

  /*
    أي مفتاح شغّال — مش إضافة بعينها.

    كان لازم إضافة الرد على العملاء تبقى مفعّلة عشان التحسين يشتغل،
    فالتاجر اللي حطّ مفتاحه في المساعد بس كان بيدوس «تحسين» وياخد
    «فعّل الإضافة الأول» وقدامه مفتاح شغّال.
  */
  const engines = await resolveEngines(store.id, 'tools')
  if (!engines.ok) return { ok: false, error: engines.error, needsSetup: engines.needsSetup }

  const [base, pro] = await Promise.all([
    getAiConfig(store.id, GEMINI_SLUG),
    getAiConfig(store.id, GEMINI_PRO_SLUG),
  ])
  const brief = await getStoreBrief(store.id, base.brief ?? pro.brief)

  const res = await generateText(engines.engine, {
    system: buildSystem(task, brief),
    messages: [
      {
        role: 'user',
        text: buildPrompt({
          task,
          current: parsed.data.current,
          fields: parsed.data.fields,
          hint: parsed.data.hint,
        }),
      },
    ],
    // التحسين محتاج تنوّع بين الاقتراحات التلاتة، مش دقة حرفية
    temperature: 0.9,
    maxTokens: 900,
  })

  if (!res.ok) {
    return {
      ok: false,
      error: res.error.message,
      needsSetup: res.error.kind === 'invalid_key' || res.error.kind === 'no_credit',
    }
  }

  const suggestions = parseSuggestions(res.data, task)
  if (suggestions.length === 0) {
    return { ok: false, error: 'الرد جه بشكل مش مفهوم. جرّب تاني.' }
  }

  return { ok: true, suggestions }
}
