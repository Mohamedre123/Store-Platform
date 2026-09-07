import 'server-only'

/**
 * توليد فيديو بـVeo.
 *
 * ## ليه ملف لوحده مش جوّه `gemini.ts`
 * كل نداءات جيميناي بترد في نفس الطلب. Veo **عملية طويلة**: بتبعت
 * وبتاخد اسم عملية، وبتفضل تسأل عليها كل شوية لحد ما تخلص —
 * دقيقة لتلاتة. النموذج ده مختلف تمامًا عن `generateContent`،
 * ولزقه جنبه كان بيخلّي كل دالة هناك تفتح على احتمال إنها ترجّع
 * «لسه بيشتغل».
 *
 * ## والانتظار مش على الخادم
 * دالة الخادم عندنا عمرها ثواني. الانتظار جوّاها كان بيموت قبل ما
 * الفيديو يخلص وبيضيّع التوليد اللي التاجر دفع تمنه. فالبداية
 * بترجّع اسم العملية، والمتصفح بيسأل عليها — والفيديو بيتحفظ أول
 * ما يجهز.
 */

const BASE = 'https://generativelanguage.googleapis.com/v1beta'

export type VeoError = { message: string }
export type VeoResult<T> = { ok: true; data: T } | { ok: false; error: VeoError }

/** نسبة الفيديو — Veo بياخد الاتنين دول بس */
export type VeoAspect = '16:9' | '9:16'

/**
 * موديلات الفيديو المتاحة في حساب التاجر.
 *
 * الاسم مش مكتوب عندنا: جوجل بتدرج نسخ Veo وبتشيل القديم، والاسم
 * الثابت بيقف يومها والتاجر يشوف «الموديل مش موجود» ومش عارف ليه.
 */
export async function listVideoModels(apiKey: string): Promise<VeoResult<string[]>> {
  try {
    const res = await fetch(`${BASE}/models?key=${encodeURIComponent(apiKey)}&pageSize=200`)
    if (!res.ok) return { ok: false, error: { message: await readError(res) } }

    const data = (await res.json()) as {
      models?: Array<{ name?: string; supportedGenerationMethods?: string[] }>
    }

    const ids = (data.models ?? [])
      .map((m) => (m.name ?? '').replace(/^models\//, ''))
      /*
        الفلترة على `predictLongRunning` لا على الاسم.

        جوجل بتدرج موديلات اسمها فيه «veo» وما بتولّدش (نسخ معاينة
        مقفولة مثلًا). الطريقة المدعومة هي اللي بتقول إنه بيشتغل.
      */
      .filter((id, i) =>
        /veo/i.test(id) &&
        (data.models?.[i]?.supportedGenerationMethods ?? []).includes('predictLongRunning'),
      )

    if (ids.length === 0) {
      return {
        ok: false,
        error: {
          message:
            'مفتاحك مافيهوش موديل بيولّد فيديو. Veo محتاج مفتاح عليه فوترة — الحصّة المجانية مابتشملهوش.',
        },
      }
    }

    return { ok: true, data: ids }
  } catch (e) {
    return { ok: false, error: { message: netMessage(e) } }
  }
}

/**
 * بدء التوليد — بيرجّع اسم العملية.
 *
 * الصورة اختيارية: بعتّها يبقى «حرّك الصورة دي»، سيبتها يبقى توليد
 * من الوصف. الأولى أهم للتاجر لأنها بتحرّك **منتجه هو** لا منتجًا
 * شبهه — والفرق ده هو الفرق بين إعلان وصورة عامة.
 */
export async function startVideo(input: {
  apiKey: string
  model: string
  prompt: string
  aspect: VeoAspect
  image?: { mimeType: string; dataBase64: string }
}): Promise<VeoResult<string>> {
  try {
    const instance: Record<string, unknown> = { prompt: input.prompt }
    if (input.image) {
      instance.image = { bytesBase64Encoded: input.image.dataBase64, mimeType: input.image.mimeType }
    }

    const res = await fetch(
      `${BASE}/models/${encodeURIComponent(input.model)}:predictLongRunning?key=${encodeURIComponent(input.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [instance],
          parameters: {
            aspectRatio: input.aspect,
            /*
              فيديو واحد لا أربعة.

              الافتراضي عند جوجل بيولّد أكتر من واحد وبيتحاسب على
              كلهم. التاجر بيختار واحدًا ويرمي الباقي — يعني بيدفع
              أربع مرات تمن اللي هيستخدمه.
            */
            sampleCount: 1,
            personGeneration: 'allow_adult',
          },
        }),
      },
    )

    if (!res.ok) return { ok: false, error: { message: await readError(res) } }

    const data = (await res.json()) as { name?: string }
    if (!data.name) return { ok: false, error: { message: 'جوجل ما رجّعتش معرّف العملية' } }

    return { ok: true, data: data.name }
  } catch (e) {
    return { ok: false, error: { message: netMessage(e) } }
  }
}

export type VideoStatus =
  | { state: 'running' }
  | { state: 'done'; uri: string }
  | { state: 'failed'; message: string }

/**
 * السؤال على العملية.
 *
 * ## الرابط اللي بيرجع محتاج المفتاح عشان يتحمّل
 * جوجل بترجّع رابط ملف على سيرفرها مش رابط عام. التخزين بتاعنا
 * لازم يجيبه بالمفتاح ويرفعه عندنا — ولو حفظنا رابط جوجل زي ما هو،
 * البوست كان هيبان شغّالًا وبيقع أول ما حد تاني يفتحه.
 */
export async function checkVideo(apiKey: string, operation: string): Promise<VeoResult<VideoStatus>> {
  try {
    const res = await fetch(
      `${BASE}/${operation.replace(/^\//, '')}?key=${encodeURIComponent(apiKey)}`,
    )
    if (!res.ok) return { ok: false, error: { message: await readError(res) } }

    const data = (await res.json()) as {
      done?: boolean
      error?: { message?: string }
      response?: {
        generateVideoResponse?: {
          generatedSamples?: Array<{ video?: { uri?: string } }>
        }
        generatedVideos?: Array<{ video?: { uri?: string } }>
      }
    }

    if (!data.done) return { ok: true, data: { state: 'running' } }

    if (data.error?.message) {
      return { ok: true, data: { state: 'failed', message: data.error.message } }
    }

    /*
      شكل الرد اتغيّر بين نسخ Veo.

      القراءة من المكانين مقصودة: النسخة الأقدم بتحطّه في
      `generatedSamples` والأحدث في `generatedVideos`. الاعتماد على
      واحد كان بيخلّي التاجر يستنّى دقيقتين ويلاقي «ما رجّعش فيديو»
      والفيديو موجود فعلًا في الرد.
    */
    const uri =
      data.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri ??
      data.response?.generatedVideos?.[0]?.video?.uri

    if (!uri) return { ok: true, data: { state: 'failed', message: 'ما رجعش فيديو' } }

    return { ok: true, data: { state: 'done', uri } }
  } catch (e) {
    return { ok: false, error: { message: netMessage(e) } }
  }
}

/** تحميل الفيديو من سيرفر جوجل بالمفتاح */
export async function downloadVideo(
  apiKey: string,
  uri: string,
): Promise<VeoResult<Buffer>> {
  try {
    const sep = uri.includes('?') ? '&' : '?'
    const res = await fetch(`${uri}${sep}key=${encodeURIComponent(apiKey)}`)
    if (!res.ok) return { ok: false, error: { message: 'مقدرناش نحمّل الفيديو من جوجل' } }

    return { ok: true, data: Buffer.from(await res.arrayBuffer()) }
  } catch (e) {
    return { ok: false, error: { message: netMessage(e) } }
  }
}

/**
 * رسالة الخطأ بالعربي لما تكون معروفة.
 *
 * «403» لوحدها ما بتقولش للتاجر يعمل إيه. وأشهر سببين للفشل هما
 * مفتاح من غير فوترة وحصّة خلصت — والاتنين ليهم حل واضح.
 */
async function readError(res: Response): Promise<string> {
  const body = await res.text().catch(() => '')

  if (res.status === 400 && /billing|billed/i.test(body)) {
    return 'Veo محتاج مفتاح عليه فوترة — فعّل الفوترة في حساب جوجل وجرّب.'
  }
  if (res.status === 403) {
    return 'مفتاحك مش مسموح له بـVeo. اتأكد إن الفوترة مفعّلة على المشروع.'
  }
  if (res.status === 429) {
    return 'حصّتك خلصت دلوقتي. استنّى شوية وجرّب تاني.'
  }
  if (res.status === 404) {
    return 'موديل الفيديو مش متاح في حسابك.'
  }

  const msg = body.match(/"message"\s*:\s*"([^"]{5,200})"/)?.[1]
  return msg ? `جوجل ردّت: ${msg}` : `جوجل ردّت بخطأ ${res.status}`
}

function netMessage(e: unknown): string {
  return e instanceof Error ? `مقدرناش نوصل لجوجل: ${e.message}` : 'مقدرناش نوصل لجوجل'
}
