/**
 * صلاحيات الـAPI.
 *
 * في ملف مستقل عن api-auth.ts لأن ده `server-only`، ولوحة المطوّرين
 * شغّالة على المتصفح ومحتاجة نفس القائمة — فالمصدر واحد.
 */
export const API_SCOPES = [
  { key: 'products:read', label: 'قراءة المنتجات' },
  { key: 'products:write', label: 'تعديل المنتجات' },
  { key: 'orders:read', label: 'قراءة الطلبات' },
  { key: 'orders:write', label: 'تعديل الطلبات' },
  { key: 'customers:read', label: 'قراءة العملاء' },
] as const

export type ApiScope = (typeof API_SCOPES)[number]['key']
