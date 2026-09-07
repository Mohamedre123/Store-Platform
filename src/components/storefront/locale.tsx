'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { makeT, type Locale, type Translator } from '@/lib/i18n'

/**
 * لغة المتجر لمكوّنات العميل.
 *
 * ## ليه سياق مش خصائص
 * نص الزرار بيتكتب في عمق الشجرة: درج السلة جوّه الهيدر جوّه
 * التخطيط. تمرير المترجم كخاصية كان معناه إن كل مكوّن في الطريق
 * ياخده ويعدّيه — وأول واحد ينساه بيطلّع سطر عربي في نص صفحة
 * إنجليزي.
 *
 * ## والمترجم بيتبني مرة
 * `useMemo` على اللغة: `Intl.NumberFormat` جوّه المترجم غالية،
 * والصفحة الواحدة فيها عشرات الأسعار.
 */

const LocaleContext = createContext<Translator>(makeT('ar'))

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const t = useMemo(() => makeT(locale), [locale])
  return <LocaleContext.Provider value={t}>{children}</LocaleContext.Provider>
}

/** المترجم — نداه في أي مكوّن عميل جوّه المتجر */
export function useT(): Translator {
  return useContext(LocaleContext)
}
