import 'server-only'
import { apiFetch } from './http'
import type { ProviderCreds } from '@/lib/provider-store'
import { zonesFor, type ZoneKey } from '@/lib/shipping-zones'

/**
 * جلب تعريفة الشحن من شركة الشحن نفسها.
 *
 * ## المشكلة
 * التاجر بيربط شركة الشحن، وبعدها بيقعد يملا ٢٧ محافظة بإيده من
 * كارت أسعار في ملف PDF بعتوهوله. وأول ما الشركة تغيّر أسعارها،
 * أرقام المتجر بتبقى قديمة ومحدّش واخد باله — والفرق بيتحمّله التاجر
 * من ربحه على كل طلب.
 *
 * ## الحل
 * الشركة عندها الأسعار، فنسألها. بنجيب سعر **محافظة واحدة ممثِّلة
 * لكل منطقة** لا الـ٢٧ واحدة واحدة: ست نداءات بدل ٢٧، ونفس النتيجة
 * لأن الشركات بتسعّر بالمنطقة أصلًا. والنداء الواحد بيتأخّر ثواني،
 * فالفرق بين الطريقتين هو الفرق بين زرار بيرد وزرار بيعلّق.
 *
 * ## والفشل بيتقال لا بيتخبّى
 * الشركة ممكن ترفض (مفتاح ناقص، خطة ما فيهاش تسعير، واجهة اتغيّرت).
 * ساعتها بنرجّع السبب نصًّا، والتاجر بيملا بالمناطق يدويًا — **وما
 * بنخترعش أرقامًا**. رقم مخترع بيتحطّ في خانة سعر بيتحوّل لخسارة
 * صامتة على كل طلب، وده أسوأ بكتير من خانة فاضية.
 */

export type TariffRow = {
  zone: ZoneKey
  /** بالقرش */
  price: number
  minDays?: number | null
  maxDays?: number | null
}

export type TariffResult =
  | { ok: true; rows: TariffRow[]; carrier: string }
  | { ok: false; error: string }

/** الشركات اللي بنعرف نسألها عن تعريفتها */
export function supportsTariff(slug: string): boolean {
  return slug === 'bosta'
}

/** محافظة ممثِّلة لكل منطقة — أكبر واحدة فيها، لأنها الأضمن إن الشركة بتغطّيها */
function representative(country: string): Array<{ zone: ZoneKey; city: string }> {
  return zonesFor(country)
    .map((z) => ({ zone: z.key, city: z.cities[0] }))
    .filter((r) => Boolean(r.city))
}

export async function fetchCarrierTariff(
  slug: string,
  creds: ProviderCreds,
  input: { country: string; pickupCity: string | null },
): Promise<TariffResult> {
  switch (slug) {
    case 'bosta':
      return bostaTariff(creds, input)
    default:
      return {
        ok: false,
        error: 'الشركة دي ما بتوفّرش تعريفة عبر الربط — املا الأسعار بالمناطق تحت.',
      }
  }
}

/* ═══════════════════════════ بوسطة ═══════════════════════════ */

/**
 * حاسبة أسعار بوسطة.
 *
 * الرد بيرجع بأشكال مختلفة حسب خطة التاجر (`priceBeforeVat` أو
 * `tier.cost` أو `total`)، فبنقرا اللي نلاقيه ونتخطّى الباقي.
 * **الشكل اللي ما نعرفهوش بيترفض** لا بيتفسّر بالتخمين: رقم متقري
 * غلط بيبقى سعر شحن غلط في متجر شغّال.
 */
async function bostaTariff(
  creds: ProviderCreds,
  input: { country: string; pickupCity: string | null },
): Promise<TariffResult> {
  const { secrets, testMode } = creds
  const apiKey = secrets.apiKey?.trim()
  if (!apiKey) return { ok: false, error: 'مفتاح بوسطة مش متسجّل' }

  const base = testMode ? 'https://stg-app.bosta.co' : 'https://app.bosta.co'
  const pickup = input.pickupCity?.trim() || 'القاهرة'

  const targets = representative(input.country)
  const rows: TariffRow[] = []
  const failures: string[] = []

  for (const t of targets) {
    const res = await apiFetch<Record<string, unknown>>(
      `${base}/api/v2/pricing/shipment/calculate`,
      {
        method: 'POST',
        headers: { Authorization: apiKey },
        json: {
          cod: 0,
          dropOffCity: t.city,
          pickupCity: pickup,
          size: 'Normal',
          type: 'SEND',
        },
      },
    )

    if (!res.ok) {
      failures.push(t.city)
      continue
    }

    const price = readPrice(res.data)
    if (price === null) {
      failures.push(t.city)
      continue
    }

    rows.push({ zone: t.zone, price })
  }

  if (rows.length === 0) {
    return {
      ok: false,
      error:
        'بوسطة ما رجّعتش أسعار — يمكن المفتاح ما فيهوش صلاحية التسعير أو خطتك مش شاملاه. املا بالمناطق تحت.',
    }
  }

  return { ok: true, rows, carrier: 'بوسطة' }
}

/**
 * بيقرا السعر من رد بوسطة ويحوّله لقرش.
 *
 * بيدوّر في المفاتيح المعروفة بالترتيب، وبيرجّع `null` لو ما لقاش
 * حاجة — والمنطقة دي بتتخطّى وبتتقال للتاجر إنها فشلت، بدل ما
 * تتحط بصفر أو برقم من منطقة تانية.
 */
function readPrice(data: unknown): number | null {
  if (!data || typeof data !== 'object') return null

  const root = data as Record<string, unknown>
  const nested = (root.data ?? root.result ?? root) as Record<string, unknown>
  if (!nested || typeof nested !== 'object') return null

  const tier = (nested.tier ?? {}) as Record<string, unknown>
  const candidates = [
    nested.priceAfterVat,
    nested.priceBeforeVat,
    nested.total,
    nested.cost,
    tier.cost,
  ]

  for (const c of candidates) {
    const n = typeof c === 'string' ? Number(c) : c
    /* بوسطة بتحسب بالجنيه — والتخزين عندنا بالقرش */
    if (typeof n === 'number' && Number.isFinite(n) && n > 0) return Math.round(n * 100)
  }

  return null
}
