import type { ExpenseCategory } from '@/db/schema'

/**
 * تصنيفات المصروفات بأسمائها العربية.
 *
 * مرتّبة **بحسب حجم البند عند التاجر المصري لا أبجديًا**: الإعلانات
 * أول واحد لأنها أكبر مصروف وأكتر واحد بيتسجّل، والباقي وراها.
 * الترتيب الأبجدي كان بيحطّ «أخرى» في النص وبيخلّي التاجر يدوّر
 * على «إعلانات» في قايمة كل مرة.
 */
export const EXPENSE_CATEGORIES: Array<{
  key: ExpenseCategory
  label: string
  hint: string
}> = [
  { key: 'ads', label: 'إعلانات', hint: 'فيسبوك، تيك توك، جوجل، مؤثّرين' },
  { key: 'goods', label: 'شراء بضاعة', hint: 'فواتير الموردين' },
  { key: 'shipping', label: 'شحن ومرتجعات', hint: 'اللي بتدفعه لشركة الشحن، والمرتجع اللي رجع على حسابك' },
  { key: 'salaries', label: 'مرتبات وعمولات', hint: 'الموظفين والمندوبين' },
  { key: 'packaging', label: 'تغليف ومطبوعات', hint: 'كراتين، أكياس، استيكرات' },
  { key: 'rent', label: 'إيجار ومرافق', hint: 'المحل، المخزن، كهربا، نت' },
  { key: 'fees', label: 'رسوم واشتراكات', hint: 'بوابات الدفع، الاشتراكات الشهرية' },
  { key: 'other', label: 'أخرى', hint: 'أي حاجة تانية' },
]

const BY_KEY = new Map(EXPENSE_CATEGORIES.map((c) => [c.key, c]))

export function expenseLabel(key: string): string {
  return BY_KEY.get(key as ExpenseCategory)?.label ?? key
}

/**
 * لون التصنيف في الرسم.
 *
 * ثابت لكل تصنيف: التاجر بيشوف نفس اللون لـ«إعلانات» في كل شاشة،
 * فبيتعرّف على البند من لونه من غير ما يقرا الأسماء كل مرة.
 */
export const EXPENSE_COLORS: Record<ExpenseCategory, string> = {
  ads: '#634b9a',
  goods: '#0f4c81',
  shipping: '#0d9488',
  salaries: '#c9a227',
  packaging: '#a8577a',
  rent: '#6b5644',
  fees: '#b3341f',
  other: '#7a7a85',
}

export type ProfitBreakdown = {
  /** إجمالي اللي دخل من الطلبات الحقيقية */
  revenue: number
  /** تكلفة البضاعة المباعة — منسوخة على كل طلب وقت الشرا */
  cogs: number
  /** الشحن اللي التاجر حصّله من العميل */
  shippingCollected: number
  /** مجمل الربح: الإيراد ناقص تكلفة البضاعة */
  gross: number
  /** المصروفات المسجّلة في نفس الفترة */
  expenses: number
  /** صافي الربح بعد المصروفات — الرقم الوحيد اللي بيهمّ آخر الشهر */
  net: number
  /** هامش الربح بنقاط الأساس (1400 = 14%) */
  marginBps: number
}

/**
 * صافي الربح.
 *
 * ## ليه الحساب هنا مش في الصفحة
 * نفس الرقم بيتعرض في التحليلات وفي صفحة المصروفات وفي الرئيسية.
 * لو كل شاشة حسبته بطريقتها، أول تغيير في تعريف «الطلب الحقيقي»
 * بيخلّيهم يقولوا تلات أرقام مختلفة — والتاجر بيصدّق أحلاهم.
 *
 * ## الشحن مش ربح ومش خسارة هنا
 * اللي التاجر حصّله شحن بيدفعه لشركة الشحن، فبيتشال من الإيراد
 * ومن التكلفة معًا. اللي فاضل — الفرق بين اللي حصّله واللي دفعه —
 * بيبان لما يسجّل فاتورة الشحن في المصروفات، وده مكانه الصح.
 */
export function computeProfit(input: {
  revenue: number
  cogs: number
  shippingCollected: number
  expenses: number
}): ProfitBreakdown {
  const netRevenue = input.revenue - input.shippingCollected
  const gross = netRevenue - input.cogs
  const net = gross - input.expenses

  return {
    revenue: input.revenue,
    cogs: input.cogs,
    shippingCollected: input.shippingCollected,
    gross,
    expenses: input.expenses,
    net,
    marginBps: netRevenue > 0 ? Math.round((net / netRevenue) * 10000) : 0,
  }
}
