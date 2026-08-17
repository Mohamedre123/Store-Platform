'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, ne } from 'drizzle-orm'
import { db } from '@/db'
import { stores } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { checkDomain, dnsRecordsFor, validateDomain, type DnsRecord } from '@/lib/custom-domain'
import { generateToken } from '@/lib/crypto'

export type DomainState = {
  error?: string
  notice?: string
  domain?: string
  token?: string
  records?: DnsRecord[]
  verified?: boolean
} | null

/** رمز التحقق مشتقّ من معرّف المتجر — ثابت ولا يحتاج عمودًا إضافيًا */
function tokenFor(storeId: string) {
  return 'zawya-verify-' + storeId.replace(/-/g, '').slice(0, 24)
}

export async function saveDomainAction(_prev: DomainState, formData: FormData): Promise<DomainState> {
  const { store } = await getDashboardContext()

  const parsed = validateDomain(String(formData.get('domain') ?? ''))
  if (!parsed.ok) return { error: parsed.error }

  const [taken] = await db
    .select({ id: stores.id })
    .from(stores)
    .where(and(eq(stores.customDomain, parsed.domain), ne(stores.id, store.id)))
    .limit(1)

  if (taken) return { error: 'النطاق ده مربوط بمتجر تاني بالفعل.' }

  await db
    .update(stores)
    .set({ customDomain: parsed.domain, customDomainVerifiedAt: null })
    .where(eq(stores.id, store.id))

  revalidatePath('/dashboard/settings/domain')

  const token = tokenFor(store.id)
  return {
    domain: parsed.domain,
    token,
    records: dnsRecordsFor(parsed.domain, token),
    notice: 'ضيف السجلات دي في لوحة نطاقك، وبعدها اضغط «تحقّق».',
  }
}

export async function verifyDomainAction(): Promise<DomainState> {
  const { store } = await getDashboardContext()
  if (!store.customDomain) return { error: 'مافيش نطاق مضاف.' }

  const token = tokenFor(store.id)
  const result = await checkDomain(store.customDomain, token)

  if (result.ownershipVerified && result.pointingCorrectly) {
    await db
      .update(stores)
      .set({ customDomainVerifiedAt: new Date() })
      .where(eq(stores.id, store.id))
    revalidatePath('/dashboard/settings/domain')
    return { verified: true, notice: result.message }
  }

  return { verified: false, error: result.message }
}

export async function removeDomainAction(): Promise<DomainState> {
  const { store } = await getDashboardContext()
  await db
    .update(stores)
    .set({ customDomain: null, customDomainVerifiedAt: null })
    .where(eq(stores.id, store.id))
  revalidatePath('/dashboard/settings/domain')
  return { notice: 'اتشال الربط. متجرك شغّال على نطاقه الفرعي زي الأول.' }
}
