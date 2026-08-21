import 'server-only'
import { cache } from 'react'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { carrierAccounts, paymentMethods } from '@/db/schema'
import { decryptJson, encryptJson } from '@/lib/crypto'
import { carrierProvider, paymentProvider, type ProviderDef } from './providers'

/**
 * تخزين إعدادات المزوّدين.
 *
 * **الأسرار في العمود المشفّر لا في config.** الـconfig بيتقرا في
 * المتصفح، ومفتاح بوابة دفع في المتصفح معناه إن أي زائر يقدر يعمل
 * عمليات على حساب التاجر.
 *
 * بوابات الدفع في `payment_methods` وشركات الشحن في `carrier_accounts`.
 * الجدولين بنفس الشكل عن قصد — الاتنين «مزوّد خارجي بمفاتيح التاجر»،
 * فالقراءة والحفظ والتحقق بيمشوا بنفس المنطق في الاتنين.
 */

export type SaveResult = { ok?: boolean; error?: string }

export type StoredProvider = {
  enabled: boolean
  /** أسماء الحقول السرّية المحفوظة — القيم عمرها ما بترجع */
  savedSecrets: string[]
  values: Record<string, string>
  testMode: boolean
  lastError: string | null
  /** سعر ثابت بالجنيه (لشركات الشحن) — صفر يعني «سيب التسعير اليدوي» */
  flatRate: number
  freeOver: number
}

const empty = (): StoredProvider => ({
  enabled: false,
  savedSecrets: [],
  values: {},
  testMode: true,
  lastError: null,
  flatRate: 0,
  freeOver: 0,
})

/** يقسم القيم لعلني وسرّي حسب تعريف المزوّد */
function split(def: ProviderDef, values: Record<string, string>) {
  const publicValues: Record<string, string> = {}
  const secrets: Record<string, string> = {}

  for (const field of def.fields) {
    const value = (values[field.key] ?? '').trim()
    if (!value) continue
    if (field.kind === 'secret') secrets[field.key] = value
    else publicValues[field.key] = value
  }

  return { publicValues, secrets }
}

/* ────────────────────────── القراءة ────────────────────────── */

/** إعدادات كل بوابات الدفع المحفوظة */
export const readPaymentProviders = cache(
  async (storeId: string, defs: ProviderDef[]): Promise<Record<string, StoredProvider>> => {
    const rows = await db
      .select()
      .from(paymentMethods)
      .where(eq(paymentMethods.storeId, storeId))

    const out: Record<string, StoredProvider> = {}

    for (const def of defs) {
      const row = rows.find((r) => r.gateway === def.slug)
      if (!row) {
        out[def.slug] = empty()
        continue
      }

      const secrets = decryptJson<Record<string, string>>(row.credentials) ?? {}
      const cfg = (row.config as Record<string, unknown>) ?? {}

      out[def.slug] = {
        enabled: row.enabled,
        savedSecrets: Object.keys(secrets),
        values: (cfg.values as Record<string, string>) ?? {},
        testMode: row.testMode,
        lastError: typeof cfg.lastError === 'string' ? cfg.lastError : null,
        flatRate: 0,
        freeOver: 0,
      }
    }

    return out
  },
)

/** إعدادات كل شركات الشحن المحفوظة */
export const readCarrierProviders = cache(
  async (storeId: string, defs: ProviderDef[]): Promise<Record<string, StoredProvider>> => {
    const rows = await db
      .select()
      .from(carrierAccounts)
      .where(eq(carrierAccounts.storeId, storeId))

    const out: Record<string, StoredProvider> = {}

    for (const def of defs) {
      const row = rows.find((r) => r.carrier === def.slug)
      if (!row) {
        out[def.slug] = empty()
        continue
      }

      const secrets = decryptJson<Record<string, string>>(row.credentials) ?? {}
      const cfg = (row.config as Record<string, unknown>) ?? {}

      out[def.slug] = {
        enabled: row.enabled,
        savedSecrets: Object.keys(secrets),
        values: (cfg.values as Record<string, string>) ?? {},
        testMode: row.testMode,
        lastError: row.lastError,
        flatRate: row.flatRate,
        freeOver: row.freeOver,
      }
    }

    return out
  },
)

/**
 * الأسرار — للخادم بس.
 *
 * منفصلة عن دوال القراءة عن قصد: دي بترجع للواجهة، ودي عمرها ما
 * بتخرج من الخادم. لو كانوا في دالة واحدة، سهل جدًا إن حد يمرّرها
 * للمتصفح من غير ما ياخد باله.
 */
export async function paymentSecrets(
  storeId: string,
  slug: string,
): Promise<Record<string, string> | null> {
  const [row] = await db
    .select({ credentials: paymentMethods.credentials })
    .from(paymentMethods)
    .where(and(eq(paymentMethods.storeId, storeId), eq(paymentMethods.gateway, slug)))
    .limit(1)

  return decryptJson<Record<string, string>>(row?.credentials ?? null)
}

export async function carrierSecrets(
  storeId: string,
  slug: string,
): Promise<Record<string, string> | null> {
  const [row] = await db
    .select({ credentials: carrierAccounts.credentials })
    .from(carrierAccounts)
    .where(and(eq(carrierAccounts.storeId, storeId), eq(carrierAccounts.carrier, slug)))
    .limit(1)

  return decryptJson<Record<string, string>>(row?.credentials ?? null)
}

/** كل اللي منشئ الجلسة أو الشحنة بيحتاجه: أسرار + قيم + وضع تجريبي */
export type ProviderCreds = {
  secrets: Record<string, string>
  values: Record<string, string>
  testMode: boolean
}

export async function paymentCreds(
  storeId: string,
  slug: string,
): Promise<ProviderCreds | null> {
  const [row] = await db
    .select({
      credentials: paymentMethods.credentials,
      config: paymentMethods.config,
      testMode: paymentMethods.testMode,
      enabled: paymentMethods.enabled,
    })
    .from(paymentMethods)
    .where(and(eq(paymentMethods.storeId, storeId), eq(paymentMethods.gateway, slug)))
    .limit(1)

  if (!row || !row.enabled) return null
  const secrets = decryptJson<Record<string, string>>(row.credentials)
  if (!secrets) return null

  const cfg = (row.config as Record<string, unknown>) ?? {}
  return {
    secrets,
    values: (cfg.values as Record<string, string>) ?? {},
    testMode: row.testMode,
  }
}

export async function carrierCreds(storeId: string, slug: string): Promise<ProviderCreds | null> {
  const [row] = await db
    .select({
      credentials: carrierAccounts.credentials,
      config: carrierAccounts.config,
      testMode: carrierAccounts.testMode,
      enabled: carrierAccounts.enabled,
    })
    .from(carrierAccounts)
    .where(and(eq(carrierAccounts.storeId, storeId), eq(carrierAccounts.carrier, slug)))
    .limit(1)

  if (!row || !row.enabled) return null
  const secrets = decryptJson<Record<string, string>>(row.credentials)
  if (!secrets) return null

  const cfg = (row.config as Record<string, unknown>) ?? {}
  return {
    secrets,
    values: (cfg.values as Record<string, string>) ?? {},
    testMode: row.testMode,
  }
}

/**
 * فيه شركة شحن **بسعر** مربوطة؟
 *
 * ده اللي بيقفل التسعيرة اليدوية: سعر الشركة هو اللي بيتحسب، ولو
 * سبنا التسعيرة اليدوية شغّالة معاه، العميل يدفع رقمًا والتاجر
 * يتحاسب برقم تاني والفرق من جيبه.
 *
 * **والشرط هو السعر لا التفعيل.** الشركة المربوطة من غير سعر ما
 * بتغيّرش حاجة في الحساب — أسعار المحافظات هي اللي بتشتغل زي ما
 * هي. لو قفلنا التسعيرة ساعتها، التاجر يقرا «متوقّف» وأسعاره
 * بتتحصّل فعلًا: رسالة بتكدّب على اللي بيحصل.
 */
export async function hasActiveCarrier(storeId: string): Promise<boolean> {
  const rows = await db
    .select({ flatRate: carrierAccounts.flatRate })
    .from(carrierAccounts)
    .where(and(eq(carrierAccounts.storeId, storeId), eq(carrierAccounts.enabled, true)))

  return rows.some((r) => r.flatRate > 0)
}

/** أول شركة شحن مفعّلة بربط تلقائي — اللي الطلبات هتروحلها */
export async function activeCarrier(
  storeId: string,
): Promise<{ slug: string; displayName: string | null } | null> {
  const rows = await db
    .select({ carrier: carrierAccounts.carrier, displayName: carrierAccounts.displayName })
    .from(carrierAccounts)
    .where(and(eq(carrierAccounts.storeId, storeId), eq(carrierAccounts.enabled, true)))
    .orderBy(carrierAccounts.sortOrder)

  // اليدوي ما بينفعش يتسجّل عنده تلقائي — بندوّر على أول واحد بـAPI
  const auto = rows.find((r) => carrierProvider(r.carrier)?.mode === 'api')
  if (!auto) return null

  return { slug: auto.carrier, displayName: auto.displayName }
}

/** سجّل خطأ من المزوّد عشان يظهر للتاجر على الكارت */
export async function recordCarrierError(
  storeId: string,
  slug: string,
  message: string | null,
): Promise<void> {
  await db
    .update(carrierAccounts)
    .set({ lastError: message, lastSyncAt: new Date() })
    .where(and(eq(carrierAccounts.storeId, storeId), eq(carrierAccounts.carrier, slug)))
    .catch(() => undefined)
}

export async function recordPaymentError(
  storeId: string,
  slug: string,
  message: string | null,
): Promise<void> {
  const [row] = await db
    .select({ id: paymentMethods.id, config: paymentMethods.config })
    .from(paymentMethods)
    .where(and(eq(paymentMethods.storeId, storeId), eq(paymentMethods.gateway, slug)))
    .limit(1)

  if (!row) return

  const cfg = (row.config as Record<string, unknown>) ?? {}
  await db
    .update(paymentMethods)
    .set({ config: { ...cfg, lastError: message } })
    .where(eq(paymentMethods.id, row.id))
    .catch(() => undefined)
}

/* ────────────────────────── الكتابة ────────────────────────── */

type SaveInput = {
  enabled: boolean
  values: Record<string, string>
  testMode: boolean
  /** بالجنيه من الواجهة — بيتحوّل لقرش هنا */
  flatRate?: number
  freeOver?: number
}

/**
 * التحقّق قبل التفعيل.
 *
 * السرّ الفاضي معناه «سيب المحفوظ» لا «امسحه»: الواجهة بتعرض نجوم
 * بدل السرّ، فلو الفاضي كان بيمسح، أي حفظ لإعداد تاني كان هيفقد
 * المفاتيح.
 */
function checkRequired(
  def: ProviderDef,
  publicValues: Record<string, string>,
  merged: Record<string, string>,
): string | null {
  const missing = def.fields.filter((f) => {
    if (!f.required) return false
    return f.kind === 'secret' ? !merged[f.key] : !publicValues[f.key]
  })

  return missing.length ? `ناقص: ${missing.map((f) => f.label).join('، ')}` : null
}

export async function savePaymentProvider(
  storeId: string,
  slug: string,
  input: SaveInput,
): Promise<SaveResult> {
  const def = paymentProvider(slug)
  if (!def) return { error: 'البوابة دي مش موجودة' }

  const { publicValues, secrets } = split(def, input.values)
  const existing = (await paymentSecrets(storeId, slug)) ?? {}
  const merged = { ...existing, ...secrets }

  if (input.enabled) {
    const error = checkRequired(def, publicValues, merged)
    if (error) return { error }
  }

  const values = {
    enabled: input.enabled,
    config: { values: publicValues, lastError: null },
    credentials: Object.keys(merged).length ? encryptJson(merged) : null,
    testMode: def.hasTestMode ? input.testMode : false,
    displayName: def.name,
  }

  const [row] = await db
    .select({ id: paymentMethods.id })
    .from(paymentMethods)
    .where(and(eq(paymentMethods.storeId, storeId), eq(paymentMethods.gateway, slug)))
    .limit(1)

  if (row) {
    await db.update(paymentMethods).set(values).where(eq(paymentMethods.id, row.id))
  } else {
    await db.insert(paymentMethods).values({ storeId, gateway: slug, ...values })
  }

  return { ok: true }
}

export async function saveCarrierProvider(
  storeId: string,
  slug: string,
  input: SaveInput,
): Promise<SaveResult> {
  const def = carrierProvider(slug)
  if (!def) return { error: 'شركة الشحن دي مش موجودة' }

  const { publicValues, secrets } = split(def, input.values)
  const existing = (await carrierSecrets(storeId, slug)) ?? {}
  const merged = { ...existing, ...secrets }

  if (input.enabled) {
    const error = checkRequired(def, publicValues, merged)
    if (error) return { error }
  }

  const values = {
    enabled: input.enabled,
    displayName: def.name,
    config: { values: publicValues },
    credentials: Object.keys(merged).length ? encryptJson(merged) : null,
    testMode: def.hasTestMode ? input.testMode : false,
    flatRate: Math.round((input.flatRate ?? 0) * 100),
    freeOver: Math.round((input.freeOver ?? 0) * 100),
    lastError: null,
  }

  const [row] = await db
    .select({ id: carrierAccounts.id })
    .from(carrierAccounts)
    .where(and(eq(carrierAccounts.storeId, storeId), eq(carrierAccounts.carrier, slug)))
    .limit(1)

  if (row) {
    await db.update(carrierAccounts).set(values).where(eq(carrierAccounts.id, row.id))
  } else {
    await db.insert(carrierAccounts).values({ storeId, carrier: slug, ...values })
  }

  return { ok: true }
}
