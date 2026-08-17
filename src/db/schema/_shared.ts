import { integer, timestamp } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

/**
 * كل المبالغ تُخزَّن كأعداد صحيحة بالوحدة الصغرى (قرش / هللة / سنت).
 * السبب: الأرقام العشرية في JavaScript غير دقيقة، وأي خطأ في الكسور
 * يتحوّل لفروق حقيقية في فواتير التجار. 490.00 ج.م تُخزَّن 49000.
 */
export const money = (name: string) => integer(name).notNull().default(0)
export const moneyNullable = (name: string) => integer(name)

/** الطوابع الزمنية دائمًا بتوقيت UTC مع المنطقة الزمنية. */
export const createdAt = () =>
  timestamp('created_at', { withTimezone: true }).notNull().defaultNow()

export const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date())

/** الحذف الناعم — لا نمسح بيانات تجار نهائيًا. */
export const deletedAt = () => timestamp('deleted_at', { withTimezone: true })

export const uuidPk = sql`gen_random_uuid()`
