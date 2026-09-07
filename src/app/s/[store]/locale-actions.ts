'use server'

import { cookies } from 'next/headers'
import { LOCALE_COOKIE, isLocale } from '@/lib/i18n'

/**
 * اختيار الزائر للغته.
 *
 * ## بتتحفظ زي ما جت، والتحقّق بيحصل وقت القراءة
 * `resolveLocale` بتقصّها على لغات المتجر المفتوحة — يعني قيمة
 * مخترعة بترجع للافتراضي لوحدها. التحقّق هنا كمان كان هيحتاج قراءة
 * قاعدة بيانات في فعل الغرض منه إنه فوري، ونفس منطق الأسواق
 * بالظبط.
 *
 * ## وسنة صلاحية
 * اللي اختار الإنجليزي مرة عايز يلاقيه بعد شهر. النافذة القصيرة
 * بترجّعه للعربي من غير سبب ظاهر له — وهو أوحش من إننا ما سألناهوش
 * من الأول.
 */
export async function chooseLocaleAction(locale: string): Promise<void> {
  if (!isLocale(locale)) return

  const jar = await cookies()

  jar.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 365 * 24 * 60 * 60,
    sameSite: 'lax',
    /* الخادم وحده بيقراها — الصفحة بتترسم بلغتها من عنده */
    httpOnly: true,
  })
}
