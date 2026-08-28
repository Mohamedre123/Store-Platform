/**
 * مخطط قاعدة البيانات لمنصة زاوية.
 *
 * قاعدة ثابتة: كل جدول يخصّ متجرًا يحمل store_id، وكل استعلام
 * لا بد أن يفلتر به. العزل بين المتاجر مسؤولية طبقة الوصول
 * (src/db/tenant.ts) وليس اجتهادًا في كل صفحة.
 */
export * from './_shared'
export * from './tenancy'
export * from './catalog'
export * from './customers'
export * from './orders'
export * from './marketing'
export * from './loyalty'
export * from './integrations'
export * from './storefront'
export * from './messaging'
export * from './analytics'
export * from './platform'
