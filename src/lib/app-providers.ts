import 'server-only'
import type { readPaymentProviders } from '@/lib/provider-store'
import type { ProviderDef } from '@/lib/providers'
import { fromMinorUnits } from '@/lib/utils'

type Stored = Awaited<ReturnType<typeof readPaymentProviders>>[string]

const amount = (v: number) => (v ? String(fromMinorUnits(v)) : '')

/**
 * كارت مزوّد (بوابة دفع أو شركة شحن) في تطبيق الموبايل — نفس `ProviderCard` في اللوحة.
 *
 * الخانات العادية بقيمها، والسرّية **اسمها بس** («محفوظ») — قيمة المفتاح عمرها ما بتخرج من الخادم.
 */
export function providerView(def: ProviderDef, state: Stored | undefined, webhookUrl: string) {
  const values = state?.values ?? {}
  const saved = state?.savedSecrets ?? []
  return {
    slug: def.slug,
    name: def.name,
    brand: def.brand,
    desc: def.desc,
    color: def.color,
    mode: def.mode,
    signupUrl: def.signupUrl,
    where: def.where,
    docsUrl: def.docsUrl ?? null,
    hasTestMode: def.hasTestMode,
    webhookUrl: def.webhook ? webhookUrl : null,
    fields: def.fields.map((f) => ({
      key: f.key,
      label: f.label,
      secret: f.kind === 'secret',
      placeholder: f.placeholder ?? '',
      hint: f.hint ?? '',
      required: Boolean(f.required),
      value: f.kind === 'secret' ? '' : (values[f.key] ?? ''),
      saved: f.kind === 'secret' && saved.includes(f.key),
    })),
    enabled: state?.enabled ?? false,
    testMode: state?.testMode ?? true,
    lastError: state?.lastError ?? null,
    hasCreds: saved.length > 0 || Object.values(values).some(Boolean),
    flatRate: amount(state?.flatRate ?? 0),
    freeOver: amount(state?.freeOver ?? 0),
  }
}

/**
 * قيم خانات المزوّد اللي جاية من التطبيق — الخانات المعروفة بس.
 *
 * الخانة السرّية الفاضية بتتشال: معناها «سيب المحفوظ زي ما هو»، ولو اتبعتت فاضية
 * كانت هتكتب فوق المفتاح المحفوظ.
 */
export function providerValues(def: ProviderDef, raw: unknown): Record<string, string> {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const out: Record<string, string> = {}
  for (const f of def.fields) {
    const v = typeof src[f.key] === 'string' ? (src[f.key] as string).trim().slice(0, 500) : ''
    if (f.kind === 'secret' && !v) continue
    out[f.key] = v
  }
  return out
}
