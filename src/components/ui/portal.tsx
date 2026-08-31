'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * بيرسم النوافذ في `body` مباشرةً.
 *
 * ## المشكلة اللي بيحلّها
 * `position: fixed` بيتموضع بالنسبة للشاشة — **إلا** لو فيه عنصر فوقه
 * عليه `transform` أو `filter`. ساعتها بيتموضع بالنسبة للعنصر ده.
 *
 * وكل صفحات اللوحة ملفوفة في `Reveal`، وهو بيستخدم `transform` عشان
 * حركة الظهور. فالنافذة اللي `inset-0` والمفروض تملا الشاشة كانت
 * بتتموضع بالنسبة لكارت جوّه الصفحة — وتظهر مكان الكارت، يعني تحت
 * بمئات البكسلات. التاجر كان بيدوس «اضغط هنا للتفعيل» وما يشوفش
 * حاجة، ولازم ينزل لآخر الصفحة عشان يلاقي النموذج مفتوح.
 *
 * ## ليه portal لا حيلة في الـCSS
 * الـtransform ده مطلوب للحركة، فما ينفعش نشيله. والـportal بيشيل
 * النافذة من الشجرة كلها ويحطها في `body` — يعني مفيش أي عنصر فوقها
 * يقدر يأثر على تموضعها، مهما اتغيّرت أنماط الصفحة بعدين.
 *
 * ## `mounted`
 * `document` مش موجود على الخادم. بنرجّع `null` في أول رسمة وبنركّب
 * بعد التحميل — النوافذ ما بتظهرش إلا بضغطة من المستخدم أصلًا، فمفيش
 * أي فرق في اللي بيتشاف.
 */
export function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) return null
  return createPortal(children, document.body)
}
