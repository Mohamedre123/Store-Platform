'use server'

import { getDashboardContext } from '@/lib/store-context'
import { can } from '@/lib/permissions'
import { quickSearch, type SearchHit } from '@/lib/quick-search'

/**
 * البحث السريع — فعل خادم لا مسار API.
 *
 * الفحص بيمرّ من `getDashboardContext` زي أي صفحة، فمفيش مسار
 * تاني للبيانات دي يتنسى فيه العزل بين المتاجر. والصلاحيات بتحدّد
 * فين بيدوّر: البحث ما يصحّش يبقى الباب الخلفي اللي بيتخطّى فلترة
 * القوايم.
 */
export async function quickSearchAction(query: string): Promise<{ hits: SearchHit[] }> {
  const { store, actor } = await getDashboardContext()

  return {
    hits: await quickSearch(store.id, String(query ?? '').slice(0, 80), {
      orders: can(actor, 'orders.view'),
      products: can(actor, 'products.view'),
      customers: can(actor, 'customers.view'),
    }),
  }
}
