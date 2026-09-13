import 'server-only'
import type { ActiveStore } from '@/lib/store-context'
import { loadExpenses } from '@/lib/expenses-data'
import { EXPENSE_CATEGORIES, EXPENSE_COLORS, expenseLabel } from '@/lib/expenses'

/** شكل شاشة المصروفات اللي تطبيق الموبايل بيستلمه — المبالغ بالوحدة الصغرى */
export async function expensesPayload(store: ActiveStore) {
  const { rows, totals, monthTotal, profit } = await loadExpenses(store.id)
  return {
    currency: store.currency,
    categories: EXPENSE_CATEGORIES.map((c) => ({ key: c.key, label: c.label, hint: c.hint, color: EXPENSE_COLORS[c.key] })),
    profit: {
      revenue: profit.revenue,
      cogs: profit.cogs,
      expenses: profit.expenses,
      net: profit.net,
      marginBps: profit.marginBps,
      shippingCollected: profit.shippingCollected,
    },
    monthTotal,
    totals: totals.map((t) => ({ ...t, label: expenseLabel(t.category), color: EXPENSE_COLORS[t.category] })),
    expenses: rows.map((r) => ({ ...r, categoryLabel: expenseLabel(r.category), color: EXPENSE_COLORS[r.category] })),
  }
}
