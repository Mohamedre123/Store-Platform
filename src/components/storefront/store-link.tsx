'use client'

import Link from 'next/link'
import { createContext, useContext, type ComponentProps, type ReactNode } from 'react'

/**
 * روابط المتجر الداخلية.
 *
 * المتجر بيتقدّم بطريقتين:
 *   متجري.zawya.cc/products   ← نطاق فرعي، الرابط الجذري صحيح
 *   zawya.cc/s/متجري/products  ← بالمسار، الرابط الجذري بيخرج من المتجر
 *
 * الفرق ده كان بيكسر كل رابط داخلي في وضع المسار — العميل يضغط
 * «المنتجات» فيروح لصفحة المنصة بدل متجره. الحل إن الروابط كلها
 * تمر من هنا وتتلقّى البادئة الصحيحة حسب طريقة التقديم.
 */

const BaseContext = createContext('')

export function StoreLinkProvider({ base, children }: { base: string; children: ReactNode }) {
  return <BaseContext.Provider value={base}>{children}</BaseContext.Provider>
}

export function useStoreBase() {
  return useContext(BaseContext)
}

/** يبني رابطًا داخل المتجر */
export function useStoreHref() {
  const base = useContext(BaseContext)
  return (path: string) => storeHref(base, path)
}

export function storeHref(base: string, path: string) {
  if (!path.startsWith('/')) return path
  // الروابط الخارجية والبروتوكولات الخاصة تُترك كما هي
  return `${base}${path === '/' ? '' : path}` || '/'
}

/** بديل Link داخل المتجر — يضيف البادئة تلقائيًا */
export function SLink({ href, ...props }: ComponentProps<typeof Link> & { href: string }) {
  const base = useContext(BaseContext)
  return <Link href={storeHref(base, href)} {...props} />
}
