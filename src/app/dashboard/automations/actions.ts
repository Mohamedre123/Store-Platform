'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { automationRules } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { toMinorUnits } from '@/lib/utils'
import { triggerDef } from '@/lib/automation-defs'

export type RuleInput = {
  id?: string
  name: string
  trigger: string
  conditions: Array<{ field: string; op: string; value: string }>
  actions: Array<{ type: string; config: Record<string, unknown> }>
  cooldownHours: string
  enabled: boolean
}

export type RuleState = { ok?: boolean; error?: string } | null

/**
 * حفظ قاعدة أتمتة.
 *
 * قيم الشروط بتتحوّل حسب نوع الحقل: المبالغ للوحدة الصغرى والأرقام
 * لأرقام. التحويل هنا مرة واحدة بدل ما المحرّك يخمّن وقت التنفيذ.
 */
export async function saveRuleAction(input: RuleInput): Promise<RuleState> {
  const { store } = await getDashboardContext()

  const name = input.name.trim()
  if (!name) return { error: 'اكتب اسم القاعدة' }

  const def = triggerDef(input.trigger)
  if (!def) return { error: 'المحفّز مش صحيح' }

  if (input.actions.length === 0) {
    return { error: 'ضيف إجراءً واحدًا على الأقل — القاعدة من غير إجراء مبتعملش حاجة' }
  }

  const conditions = input.conditions
    .filter((c) => c.field && c.op && String(c.value).trim() !== '')
    .map((c) => {
      const field = def.fields.find((f) => f.key === c.field)
      const value =
        field?.type === 'money'
          ? toMinorUnits(c.value)
          : field?.type === 'number'
            ? Number(c.value)
            : c.value.trim()
      return { field: c.field, op: c.op, value }
    })

  const values = {
    name,
    trigger: input.trigger,
    conditions,
    actions: input.actions,
    cooldownHours: Math.max(0, Math.trunc(Number(input.cooldownHours) || 0)),
    enabled: input.enabled,
  }

  if (input.id) {
    const updated = await db
      .update(automationRules)
      .set(values)
      .where(and(eq(automationRules.id, input.id), eq(automationRules.storeId, store.id)))
      .returning({ id: automationRules.id })
    if (!updated.length) return { error: 'القاعدة مش موجودة' }
  } else {
    await db.insert(automationRules).values({ ...values, storeId: store.id })
  }

  revalidatePath('/dashboard/automations')
  return { ok: true }
}

export async function toggleRuleAction(id: string, enabled: boolean): Promise<RuleState> {
  const { store } = await getDashboardContext()
  await db
    .update(automationRules)
    .set({ enabled })
    .where(and(eq(automationRules.id, id), eq(automationRules.storeId, store.id)))
  revalidatePath('/dashboard/automations')
  return { ok: true }
}

export async function deleteRuleAction(id: string): Promise<RuleState> {
  const { store } = await getDashboardContext()
  await db
    .delete(automationRules)
    .where(and(eq(automationRules.id, id), eq(automationRules.storeId, store.id)))
  revalidatePath('/dashboard/automations')
  return { ok: true }
}
