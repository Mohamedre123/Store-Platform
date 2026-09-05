'use server'

import { getDashboardContext } from '@/lib/store-context'
import { assertCan } from '@/lib/permissions'
import { liveSnapshot, type LiveSnapshot } from '@/lib/live-view'

/**
 * لقطة جديدة — بتتنادى من المتصفح كل ١٥ ثانية.
 *
 * فعل خادم لا مسار API: الفحص بيمرّ من `getDashboardContext` زي أي
 * صفحة، فما فيش مسار تاني للبيانات دي يتنسى فيه العزل بين المتاجر.
 */
export async function refreshLiveAction(): Promise<LiveSnapshot | { error: string }> {
  const { store, actor } = await getDashboardContext()
  assertCan(actor, 'reports.view')
  return liveSnapshot(store.id)
}
