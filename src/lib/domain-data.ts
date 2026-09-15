import 'server-only'
import type { ActiveStore } from '@/lib/store-context'
import { getEntitlements } from '@/lib/entitlements'
import { dnsRecordsFor } from '@/lib/custom-domain'
import { vercelDomainsReady } from '@/lib/vercel-domains'
import { storeUrl } from '@/lib/domain'

/** رمز التحقق مشتقّ من معرّف المتجر — نفس `tokenFor` في `settings/domain/actions.ts` */
export function domainToken(storeId: string) {
  return 'zawya-verify-' + storeId.replace(/-/g, '').slice(0, 24)
}

/** حالة النطاق المخصص — صفحة اللوحة ومسار التطبيق (`/api/app/domain`) بيقروا من هنا */
export async function loadDomain(store: ActiveStore) {
  const ent = await getEntitlements(store)
  /*
    حالة التكامل مع المستضيف: من غير مفاتيحه التاجر يقدر يضيف نطاقه ويظبّط سجلاته
    والنطاق يفضل واقف على 404 — فبننبّهه.
  */
  const link = vercelDomainsReady()
  return {
    currentHost: storeUrl(store.slug).replace(/^https?:\/\//, ''),
    domain: store.customDomain,
    verified: Boolean(store.customDomainVerifiedAt),
    records: store.customDomain ? dnsRecordsFor(store.customDomain, domainToken(store.id)) : [],
    locked: !ent.features.customDomain,
    link,
  }
}
