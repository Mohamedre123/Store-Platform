import 'server-only'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { messagingSettings, orders, storePlugins, thankYouSettings } from '@/db/schema'
import type { DashboardContext } from '@/lib/store-context'
import { can, type Permission } from '@/lib/permissions'
import { getPlugin, PLUGINS } from '@/lib/plugins'
import { mergeCustomization, type PanelKey } from '@/lib/customization'
import { getStoreTheme } from '@/lib/storefront'
import { publicStoreUrl } from '@/lib/domain'
import { readTemplates } from '@/lib/whatsapp'
import { loadCheckoutSettings } from '@/lib/checkout-settings-data'
import { orderSettingsValues } from '@/lib/order-settings-data'
import { sendCustomerMessages, type MessageChannel } from '@/lib/customer-messages'
import { checkoutPayload, whatsappPayload } from '@/lib/app-settings-pages'
import { activityPayload, teamPayload } from '@/lib/app-settings'
import { orderDetailPayload, ordersListPayload } from '@/lib/app-orders'
import { customerDetailPayload, customersListPayload } from '@/lib/app-customers'
import { productDetailPayload, productsListPayload } from '@/lib/app-products'
import { analyticsPayload } from '@/lib/app-analytics'
import { marketingPayload } from '@/lib/app-marketing'
import { inventoryPayload } from '@/lib/app-inventory'
import { shipmentsPayload } from '@/lib/app-shipments'
import { shippingPayload } from '@/lib/app-shipping'
import { paymentsPayload } from '@/lib/app-payments'
import { reviewsPayload } from '@/lib/app-reviews'
import { returnsPayload } from '@/lib/app-returns'
import { complaintsPayload, complaintThreadPayload } from '@/lib/app-complaints'
import { messagesPayload } from '@/lib/app-messages'
import { automationsPayload } from '@/lib/app-automations'
import { loyaltyPayload } from '@/lib/app-loyalty'
import { affiliatesPayload } from '@/lib/app-affiliates'
import { blogPayload } from '@/lib/app-blog'
import { bannersPayload } from '@/lib/app-banners'
import { categoriesPayload } from '@/lib/app-categories'
import { blockedPayload } from '@/lib/app-blocked'
import { couriersPayload } from '@/lib/app-couriers'
import { bookingsPayload } from '@/lib/app-bookings'
import { expensesPayload } from '@/lib/app-expenses'
import { suppliersPayload } from '@/lib/app-suppliers'
import { mediaPayload } from '@/lib/app-media'
import { postsPayload } from '@/lib/app-posts'
import { schedulesPayload } from '@/lib/app-schedules'
import { socialAccountsPayload } from '@/lib/app-social'
import { subscriptionPayload } from '@/lib/app-subscription'

/**
 * سجل أفعال مساعد المتجر — «يتحكّم في كل حاجة في اللوحة».
 *
 * ## ليه سجل مش أداة لكل حاجة
 * كل أداة بتتبعت للموديل مع كل رسالة. مية أداة معناها رسالة غالية وموديل متلخبط.
 * فالموديل عنده ٣ أدوات بس: `list_actions` (إيه اللي أقدر أعمله في الجزء ده)،
 * و`get_data` (اقرا)، و`run_action` (نفّذ) — والتفاصيل هنا.
 *
 * ## كل فعل بينادي فعل اللوحة نفسه
 * نفس `…Action` اللي زرار الصفحة بينادي عليه — فالرسايل للعملاء والسجل والأتمتة
 * والتحقّق من البيانات بيحصلوا زي ما التاجر عملها بإيده. القراءة من نفس بيانات شاشات
 * التطبيق (`src/lib/app-*.ts`).
 *
 * ## الأمان
 * - كل فعل ليه صلاحية، وبتتقاس على الموظف اللي بيكلّم المساعد (`can`).
 * - الكتابة ما بتتنفّذش غير بموافقة التاجر على الوصف العربي (`label`).
 * - مفيش فعل بيقرا أو بيرجّع مفتاح API، ولا بيغيّر الدومين أو الاشتراك أو كلمة السر.
 */

export type Area =
  | 'orders'
  | 'customers'
  | 'products'
  | 'marketing'
  | 'storefront'
  | 'settings'
  | 'messaging'
  | 'team'
  | 'reports'

export const AREA_LABELS: Record<Area, string> = {
  orders: 'الطلبات والشحن والمرتجعات والشكاوى والحجوزات',
  customers: 'العملاء والحظر والمراجعات والولاء',
  products: 'المنتجات والأقسام والمخزون والموردين',
  marketing: 'الكوبونات والعروض والحملات والأتمتة والمسوّقين والبوستات',
  storefront: 'شكل المتجر والبانرات والمدوّنة والوسائط',
  settings: 'بيانات المتجر والشيك أوت والطلبات والشحن والدفع والسيو والإيصال وواتساب والبريد والإضافات',
  messaging: 'إرسال بريد وواتساب للعملاء وسجل الرسايل',
  team: 'الفريق والاشتراك',
  reports: 'التحليلات والمصروفات وسجل النشاط',
}

export type RegistryResult = { ok: true; summary: string; data?: unknown } | { ok: false; error: string }

export type RegistryAction = {
  name: string
  area: Area
  kind: 'read' | 'write'
  permission?: Permission
  /** للموديل: الفعل بيعمل إيه */
  doc: string
  /** للموديل: شكل الخانات (JSON) */
  args?: string
  /** للتاجر: الوصف العربي اللي بيوافق عليه */
  label: (a: Record<string, unknown>) => string
  run: (ctx: DashboardContext, a: Record<string, unknown>) => Promise<RegistryResult>
}

/** رفض بجملة عربي مفهومة — بترجع للموديل والتاجر زي ما هي */
class Refuse extends Error {}

/* ────────────────────────── مساعدات ────────────────────────── */

const str = (v: unknown, max = 5000) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const num = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : NaN
}
const bool = (v: unknown) => v === true || v === 'true'
const nums = (v: unknown) =>
  (Array.isArray(v) ? v : v === undefined || v === null ? [] : [v])
    .map(num)
    .filter((n) => Number.isFinite(n))
    .map((n) => Math.trunc(n))
    .slice(0, 100)
const uuid = (v: unknown) => {
  const s = str(v, 64)
  return /^[0-9a-f-]{36}$/i.test(s) ? s : ''
}
const need = (v: string, what: string) => {
  if (!v) throw new Refuse(`${what} ناقص`)
  return v
}
const obj = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
const list = (v: unknown) => nums(v).map((n) => `#${n}`).join('، ')
const short = (v: unknown, n = 70) => {
  const s = str(v)
  return s.length > n ? `${s.slice(0, n)}…` : s
}

async function orderIdByNumber(storeId: string, n: number): Promise<string> {
  if (!Number.isFinite(n)) throw new Refuse('رقم الطلب ناقص')
  const [row] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.storeId, storeId), eq(orders.orderNumber, n)))
    .limit(1)
  if (!row) throw new Refuse(`الطلب #${n} مش موجود`)
  return row.id
}

/** نتيجة فعل من أفعال اللوحة: أي `{ error }` = فشل برسالته */
function outcome(res: unknown, summary: string): RegistryResult {
  const error = res && typeof res === 'object' && 'error' in res ? (res as { error?: unknown }).error : null
  if (typeof error === 'string' && error) return { ok: false, error }
  return { ok: true, summary }
}

/**
 * تعديل جزئي على قيم موجودة: بناخد الخانات المعروفة بس، وبنفس نوعها.
 * الأفعال بتكتب الإعداد كله، فأي خانة مش مبعوتة بتتاخد من القيمة الحالية.
 */
function patchValues<T extends Record<string, unknown>>(current: T, a: Record<string, unknown>, skip: string[] = []) {
  const next: Record<string, unknown> = { ...current }
  const changed: string[] = []
  for (const [k, v] of Object.entries(a)) {
    if (skip.includes(k) || !(k in current)) continue
    const cur = current[k]
    if (Array.isArray(cur)) {
      if (Array.isArray(v)) next[k] = v
      else continue
    } else if (typeof cur === 'number') {
      if (!Number.isFinite(num(v))) continue
      next[k] = num(v)
    } else if (typeof cur === 'boolean') {
      if (typeof v !== 'boolean') continue
      next[k] = v
    } else if (typeof cur === 'string' || cur === null) {
      if (typeof v !== 'string') continue
      next[k] = v
    } else continue
    changed.push(k)
  }
  if (!changed.length) throw new Refuse('مفيش خانة معروفة تتغيّر — اقرا الإعداد الأول بـget_data وابعت نفس أسماء الخانات')
  return { next: next as T, changed }
}

const read = (
  name: string,
  area: Area,
  permission: Permission | undefined,
  doc: string,
  args: string | undefined,
  run: (ctx: DashboardContext, a: Record<string, unknown>) => Promise<unknown>,
): RegistryAction => ({
  name,
  area,
  kind: 'read',
  permission,
  doc,
  args,
  label: () => `قراءة: ${doc}`,
  run: async (ctx, a) => ({ ok: true, summary: doc, data: await run(ctx, a) }),
})

const write = (
  name: string,
  area: Area,
  permission: Permission | undefined,
  doc: string,
  args: string,
  label: (a: Record<string, unknown>) => string,
  run: (ctx: DashboardContext, a: Record<string, unknown>) => Promise<RegistryResult>,
): RegistryAction => ({ name, area, kind: 'write', permission, doc, args, label, run })

const ORDER_STATUS: Record<string, string> = {
  confirmed: 'مؤكّد',
  processing: 'بيتجهّز',
  shipped: 'اتشحن',
  delivered: 'اتسلّم',
  cancelled: 'ملغي',
}

const CHANNEL_LABEL: Record<MessageChannel, string> = { email: 'بريد', whatsapp: 'واتساب', both: 'بريد وواتساب' }

const PANELS: PanelKey[] = ['identity', 'announcement', 'header', 'hero', 'listing', 'productPage', 'cart', 'footer', 'toolbar', 'preloader', 'effects']

/** تعديل بيانات المتجر — كل خانة مش مبعوتة بتفضل زي ما هي، والفاضي في `whatsapp` = امسحه */
export async function updateStoreInfo(ctx: DashboardContext, a: Record<string, unknown>): Promise<RegistryResult> {
  const s = ctx.store
  const given = (k: string) => typeof a[k] === 'string'
  const social: Record<string, string> = { ...((s.socialLinks ?? {}) as Record<string, string>) }
  const socialPatch = obj(a.social)
  if (socialPatch) for (const [k, v] of Object.entries(socialPatch)) if (typeof v === 'string') social[k] = v.trim()

  const { saveStoreInfoAction } = await import('@/app/dashboard/settings/actions')
  const res = await saveStoreInfoAction({
    name: given('name') ? str(a.name, 80) : s.name,
    nameEn: given('nameEn') ? str(a.nameEn, 80) : (s.nameEn ?? ''),
    tagline: given('tagline') ? str(a.tagline, 200) : (s.tagline ?? ''),
    email: given('email') ? str(a.email, 120) : (s.email ?? ''),
    phone: given('phone') ? str(a.phone, 30) : (s.phone ?? ''),
    whatsapp: given('whatsapp') ? str(a.whatsapp, 30) : (s.whatsapp ?? ''),
    logoLight: s.logoLight,
    favicon: s.favicon,
    social,
  })
  return outcome(res, 'بيانات المتجر اتحدّثت')
}

/* ────────────────────────── السجل ────────────────────────── */

export const REGISTRY: RegistryAction[] = [
  /* ═════════ الطلبات ═════════ */
  read('orders', 'orders', 'orders.view', 'الطلبات بأرقامها وحالاتها وإجماليها والعميل', '{"filter":"all | pending | confirmed | processing | shipped | delivered | cancelled | incomplete"}', (c, a) =>
    ordersListPayload(c.store, str(a.filter) || undefined),
  ),
  read('order', 'orders', 'orders.view', 'تفاصيل طلب برقمه: المنتجات، العميل (اسمه ورقمه وبريده)، العنوان، الدفع، الشحن، السجل', '{"orderNumber":1043}', async (c, a) =>
    orderDetailPayload(c.store, await orderIdByNumber(c.store.id, num(a.orderNumber))),
  ),
  read('shipments', 'orders', 'orders.view', 'الشحنات وحالاتها والطلبات المستنية تتشحن', undefined, (c) => shipmentsPayload(c.store)),
  read('returns', 'orders', 'orders.view', 'طلبات الإرجاع', undefined, (c) => returnsPayload(c.store)),
  read('complaints', 'orders', 'orders.view', 'الشكاوى', undefined, (c) => complaintsPayload(c)),
  read('complaint', 'orders', 'orders.view', 'محادثة شكوى', '{"ticketId":"uuid"}', (c, a) => complaintThreadPayload(c, need(uuid(a.ticketId), 'معرّف الشكوى'))),
  read('bookings', 'orders', 'orders.view', 'الحجوزات ومواعيد العمل', undefined, (c) => bookingsPayload(c.store)),
  read('couriers', 'orders', 'orders.manage', 'المندوبين وحساباتهم', undefined, (c) => couriersPayload(c.store)),

  write('set_orders_status', 'orders', 'orders.manage', 'تغيير حالة طلب أو أكتر مرة واحدة — العميل بيوصله إشعار زي ما بيحصل من اللوحة',
    '{"orderNumbers":[1043,1044],"status":"confirmed | processing | shipped | delivered | cancelled"}',
    (a) => `تغيير حالة ${list(a.orderNumbers)} لـ«${ORDER_STATUS[str(a.status)] ?? str(a.status)}»`,
    async (c, a) => {
      const status = str(a.status)
      if (!ORDER_STATUS[status]) throw new Refuse('الحالة مش معروفة')
      const numbers = nums(a.orderNumbers)
      if (!numbers.length) throw new Refuse('حدّد أرقام الطلبات')
      const { updateOrderStatusAction } = await import('@/app/dashboard/orders/actions')
      const done: number[] = []
      const failed: string[] = []
      for (const n of numbers) {
        try {
          await updateOrderStatusAction(await orderIdByNumber(c.store.id, n), status as never)
          done.push(n)
        } catch (e) {
          failed.push(`#${n}: ${e instanceof Refuse ? e.message : 'ما اتغيّرش'}`)
        }
      }
      if (!done.length) return { ok: false, error: failed.join('، ') }
      return { ok: true, summary: `${done.length} طلب بقى «${ORDER_STATUS[status]}»${failed.length ? ` — وما اتغيّرش: ${failed.join('، ')}` : ''}` }
    }),

  write('add_order_note', 'orders', 'orders.manage', 'ملاحظة داخلية على طلب (بتظهر في سجله للتاجر بس)', '{"orderNumber":1043,"note":"..."}',
    (a) => `ملاحظة على الطلب #${num(a.orderNumber)}: «${short(a.note)}»`,
    async (c, a) => {
      const note = need(str(a.note, 1000), 'نص الملاحظة')
      const { addOrderNoteAction } = await import('@/app/dashboard/orders/actions')
      await addOrderNoteAction(await orderIdByNumber(c.store.id, num(a.orderNumber)), note)
      return { ok: true, summary: 'الملاحظة اتسجّلت' }
    }),

  write('request_order_confirmation', 'orders', 'orders.manage', 'ابعت طلب تأكيد على واتساب لعميل طلب أو أكتر (بيرد ١ أو ٢)', '{"orderNumbers":[1043]}',
    (a) => `طلب تأكيد على واتساب لـ${list(a.orderNumbers)}`,
    async (c, a) => {
      const { requestConfirmationAction } = await import('@/app/dashboard/orders/confirm-actions')
      const numbers = nums(a.orderNumbers)
      if (!numbers.length) throw new Refuse('حدّد أرقام الطلبات')
      const failed: string[] = []
      let done = 0
      for (const n of numbers) {
        try {
          const res = await requestConfirmationAction(await orderIdByNumber(c.store.id, n))
          if (res?.error) failed.push(`#${n}: ${res.error}`)
          else done++
        } catch (e) {
          failed.push(`#${n}: ${e instanceof Refuse ? e.message : 'ما اتبعتش'}`)
        }
      }
      if (!done) return { ok: false, error: failed.join('، ') }
      return { ok: true, summary: `اتبعت طلب تأكيد لـ${done} طلب${failed.length ? ` — وفشل: ${failed.join('، ')}` : ''}` }
    }),

  write('delete_order', 'orders', 'orders.manage', 'مسح طلب نهائيًا (المخزون بيرجع) — للطلبات التجريبية أو المكررة بس', '{"orderNumber":1043}',
    (a) => `مسح الطلب #${num(a.orderNumber)} نهائيًا`,
    async (c, a) => {
      const { deleteOrderAction } = await import('@/app/dashboard/orders/actions')
      return outcome(await deleteOrderAction(await orderIdByNumber(c.store.id, num(a.orderNumber))), 'الطلب اتمسح')
    }),

  write('set_return_status', 'orders', 'orders.manage', 'تغيير حالة طلب إرجاع', '{"returnId":"uuid","status":"requested | approved | rejected | picked_up | received | completed"}',
    (a) => `تغيير حالة المرتجع لـ«${str(a.status)}»`,
    async (_c, a) => {
      const status = str(a.status)
      if (!['requested', 'approved', 'rejected', 'picked_up', 'received', 'completed'].includes(status)) throw new Refuse('الحالة مش معروفة')
      const { updateReturnStatusAction } = await import('@/app/dashboard/returns/actions')
      return outcome(await updateReturnStatusAction(need(uuid(a.returnId), 'معرّف المرتجع'), status as never), 'حالة المرتجع اتغيّرت')
    }),

  write('reply_complaint', 'orders', 'orders.manage', 'رد على شكوى عميل', '{"ticketId":"uuid","body":"الرد"}',
    (a) => `رد على شكوى: «${short(a.body)}»`,
    async (_c, a) => {
      const { replyTicketAction } = await import('@/app/dashboard/complaints/actions')
      return outcome(await replyTicketAction({ ticketId: need(uuid(a.ticketId), 'معرّف الشكوى'), body: need(str(a.body, 4000), 'الرد') }), 'الرد اتبعت')
    }),

  write('set_complaint_status', 'orders', 'orders.manage', 'تغيير حالة شكوى', '{"ticketId":"uuid","status":"open | answered | resolved | closed"}',
    (a) => `تغيير حالة الشكوى لـ«${str(a.status)}»`,
    async (_c, a) => {
      const status = str(a.status)
      if (!['open', 'answered', 'resolved', 'closed'].includes(status)) throw new Refuse('الحالة مش معروفة')
      const { setTicketStatusAction } = await import('@/app/dashboard/complaints/actions')
      return outcome(await setTicketStatusAction(need(uuid(a.ticketId), 'معرّف الشكوى'), status as never), 'حالة الشكوى اتغيّرت')
    }),

  write('set_booking_status', 'orders', 'orders.manage', 'تغيير حالة حجز', '{"bookingId":"uuid","status":"الحالة زي ما هي في bookings"}',
    (a) => `تغيير حالة الحجز لـ«${str(a.status)}»`,
    async (_c, a) => {
      const { setBookingStatusAction } = await import('@/app/dashboard/bookings/actions')
      return outcome(await setBookingStatusAction(need(uuid(a.bookingId), 'معرّف الحجز'), need(str(a.status, 30), 'الحالة')), 'حالة الحجز اتغيّرت')
    }),

  /* ═════════ الرسايل للعملاء ═════════ */
  read('messages_log', 'messaging', 'orders.view', 'سجل الرسايل اللي اتبعتت (بريد وواتساب) ووصلت ولا لأ', undefined, (c) => messagesPayload(c.store)),

  write('message_customers', 'messaging', 'orders.manage',
    'ابعت رسالة من المتجر لعملاء طلبات محددة أو عملاء محددين — بالبريد أو واتساب أو الاتنين — بكلام التاجر، وصورة وزرار اختياريين. {{اسم_العميل}} و{{رقم_الطلب}} جوّه العنوان أو الكلام بيتبدّلوا لكل عميل. واتساب لازم يكون مربوط (get_data whatsapp): أول رسالة بتطلع فورًا والباقي واحدة كل دقيقة. الصورة لازم رابط https (زي صورة بعتها التاجر في الشات أو صورة منتج).',
    '{"orderNumbers":[1043,1044],"customerIds":["uuid"],"channel":"email | whatsapp | both","subject":"عنوان البريد","body":"نص الرسالة","imageUrl":"https://… (اختياري)","buttonLabel":"(اختياري)","buttonUrl":"https://… (اختياري)"}',
    (a) => {
      const orderCount = nums(a.orderNumbers).length
      const customerCount = Array.isArray(a.customerIds) ? a.customerIds.length : 0
      const to = [orderCount ? `عملاء ${list(a.orderNumbers)}` : '', customerCount ? `${customerCount} عميل` : ''].filter(Boolean).join(' و')
      const channel = CHANNEL_LABEL[str(a.channel) as MessageChannel] ?? str(a.channel)
      return `إرسال ${channel} لـ${to || 'عملاء'}${a.imageUrl ? ' بصورة' : ''}${a.subject ? ` — «${short(a.subject, 50)}»` : ''}: «${short(a.body, 120)}»`
    },
    async (c, a) => {
      const channel = str(a.channel) as MessageChannel
      if (!['email', 'whatsapp', 'both'].includes(channel)) throw new Refuse('اختار القناة: email أو whatsapp أو both')
      const res = await sendCustomerMessages(c.store, c.user.id, {
        orderNumbers: nums(a.orderNumbers),
        customerIds: Array.isArray(a.customerIds) ? a.customerIds.filter((x): x is string => typeof x === 'string') : [],
        channel,
        subject: str(a.subject, 150),
        body: str(a.body, 3000),
        imageUrl: str(a.imageUrl, 800) || null,
        buttonLabel: str(a.buttonLabel, 40) || null,
        buttonUrl: str(a.buttonUrl, 800) || null,
      })
      if (!res.ok) return res
      const s = res.summary
      const parts = [
        s.emailed ? `${s.emailed} بريد اتبعت` : '',
        s.whatsappSent ? `${s.whatsappSent} واتساب اتبعت` : '',
        s.whatsappQueued ? `${s.whatsappQueued} واتساب في الطابور (واحدة كل دقيقة)` : '',
      ].filter(Boolean)
      const notes = [...s.failed, ...s.skipped]
      if (!parts.length) return { ok: false, error: notes.join('، ') || 'ما اتبعتش حاجة' }
      return { ok: true, summary: `${parts.join('، ')}${notes.length ? ` — ملاحظات: ${notes.join('، ')}` : ''}` }
    }),

  /* ═════════ العملاء ═════════ */
  read('customers', 'customers', 'customers.view', 'العملاء بعدد طلباتهم وإجمالي مشترياتهم', '{"filter":"all (اختياري)"}', (c, a) => customersListPayload(c.store, str(a.filter) || undefined)),
  read('customer', 'customers', 'customers.view', 'صفحة عميل: بياناته وطلباته', '{"customerId":"uuid"}', (c, a) => customerDetailPayload(c.store, need(uuid(a.customerId), 'معرّف العميل'))),
  read('reviews', 'customers', 'customers.view', 'المراجعات (المستنية موافقة والمنشورة)', undefined, (c) => reviewsPayload(c.store)),
  read('loyalty', 'customers', 'customers.view', 'نظام النقاط والمكافآت والعجلة', undefined, (c) => loyaltyPayload(c.store)),
  read('blocked', 'customers', 'orders.manage', 'قايمة الحظر واللي رفضوا الاستلام', undefined, (c) => blockedPayload(c.store)),

  write('set_customer_blocked', 'customers', 'orders.manage', 'حظر عميل أو فك حظره', '{"customerId":"uuid","blocked":true}',
    (a) => (bool(a.blocked) ? 'حظر العميل' : 'فك حظر العميل'),
    async (_c, a) => {
      const { setCustomerBlockedAction } = await import('@/app/dashboard/customers/block-actions')
      return outcome(await setCustomerBlockedAction(need(uuid(a.customerId), 'معرّف العميل'), bool(a.blocked)), bool(a.blocked) ? 'اتحظر' : 'اتفك الحظر')
    }),

  write('add_block', 'customers', 'orders.manage', 'ضيف رقم/بريد/IP/اسم لقايمة الحظر', '{"match":"phone | email | ip | name","value":"...","action":"reject | flag","reason":"(اختياري)"}',
    (a) => `إضافة «${short(a.value, 40)}» للحظر (${str(a.action) === 'flag' ? 'تعليم' : 'رفض'})`,
    async (_c, a) => {
      const { addBlockAction } = await import('@/app/dashboard/customers/block-actions')
      return outcome(await addBlockAction({ match: str(a.match), value: str(a.value, 160), action: str(a.action) || 'reject', reason: str(a.reason, 200) || null }), 'اتضاف للحظر')
    }),

  write('remove_block', 'customers', 'orders.manage', 'شيل عنصر من قايمة الحظر', '{"blockId":"uuid"}', () => 'شيل عنصر من قايمة الحظر',
    async (_c, a) => {
      const { removeBlockAction } = await import('@/app/dashboard/customers/block-actions')
      return outcome(await removeBlockAction(need(uuid(a.blockId), 'المعرّف')), 'اتشال من الحظر')
    }),

  write('moderate_review', 'customers', 'customers.view', 'وافق على مراجعة أو اخفيها، أو رد عليها، أو امسحها', '{"reviewId":"uuid","approve":true,"reply":"(اختياري)","delete":false}',
    (a) => (bool(a.delete) ? 'مسح مراجعة' : [a.approve !== undefined ? (bool(a.approve) ? 'نشر مراجعة' : 'إخفاء مراجعة') : '', a.reply ? `رد: «${short(a.reply)}»` : ''].filter(Boolean).join(' و') || 'مراجعة'),
    async (_c, a) => {
      const id = need(uuid(a.reviewId), 'معرّف المراجعة')
      const mod = await import('@/app/dashboard/reviews/actions')
      if (bool(a.delete)) return outcome(await mod.deleteReviewAction(id), 'المراجعة اتمسحت')
      if (a.approve !== undefined) {
        const res = outcome(await mod.approveReviewAction(id, bool(a.approve)), 'اتحفظ')
        if (!res.ok) return res
      }
      if (str(a.reply)) return outcome(await mod.replyToReviewAction(id, str(a.reply, 1000)), 'الرد اتنشر')
      return { ok: true, summary: 'اتحفظ' }
    }),

  /* ═════════ المنتجات ═════════ */
  read('products', 'products', 'products.view', 'كل المنتجات بأسعارها وكمياتها وحالتها', undefined, (c) => productsListPayload(c.store)),
  read('product', 'products', 'products.view', 'تفاصيل منتج بمقاساته ومبيعاته', '{"productId":"uuid"}', (c, a) => productDetailPayload(c.store, need(uuid(a.productId), 'معرّف المنتج'))),
  read('categories', 'products', 'products.view', 'الأقسام بمعرّفاتها', undefined, (c) => categoriesPayload(c.store)),
  read('inventory', 'products', 'inventory.manage', 'المخزون والنافد والمنخفض وسجل الحركة', undefined, (c) => inventoryPayload(c.store)),
  read('suppliers', 'products', 'inventory.manage', 'الموردين والمنتجات اللي محتاجة تتطلب', undefined, (c) => suppliersPayload(c.store)),

  write('toggle_product_status', 'products', 'products.manage', 'تشغيل منتج أو إيقافه (نشط ↔ مسوّدة)', '{"productId":"uuid"}', () => 'تبديل حالة المنتج (نشط/مسوّدة)',
    async (_c, a) => {
      const { toggleProductStatusAction } = await import('@/app/dashboard/products/actions')
      return outcome(await toggleProductStatusAction(need(uuid(a.productId), 'معرّف المنتج')), 'حالة المنتج اتغيّرت')
    }),

  write('delete_product', 'products', 'products.manage', 'نقل منتج لسلة المهملات (يترجع منها)', '{"productId":"uuid"}', () => 'نقل منتج لسلة المهملات',
    async (_c, a) => {
      const { deleteProductAction } = await import('@/app/dashboard/products/actions')
      return outcome(await deleteProductAction(need(uuid(a.productId), 'معرّف المنتج')), 'المنتج اتنقل للسلة')
    }),

  write('restore_product', 'products', 'products.manage', 'رجّع منتج من سلة المهملات', '{"productId":"uuid"}', () => 'رجوع منتج من السلة',
    async (_c, a) => {
      const { restoreProductAction } = await import('@/app/dashboard/products/actions')
      return outcome(await restoreProductAction(need(uuid(a.productId), 'معرّف المنتج')), 'المنتج رجع (مسوّدة)')
    }),

  write('set_stock', 'products', 'inventory.manage', 'تعديل كمية منتج أو مقاس', '{"productId":"uuid","variantId":"uuid (للمقاس — اختياري)","stock":12,"note":"(اختياري)"}',
    (a) => `الكمية → ${num(a.stock)}`,
    async (_c, a) => {
      const stock = Math.trunc(num(a.stock))
      if (!Number.isFinite(stock) || stock < 0) throw new Refuse('الكمية لازم رقم صفر أو أكتر')
      const variantId = uuid(a.variantId)
      const { setStockAction } = await import('@/app/dashboard/inventory/actions')
      return outcome(
        await setStockAction({ kind: variantId ? 'variant' : 'product', id: variantId || need(uuid(a.productId), 'معرّف المنتج'), stock, note: str(a.note, 200) || undefined }),
        `الكمية بقت ${stock}`,
      )
    }),

  write('set_low_stock_threshold', 'products', 'inventory.manage', 'حد تنبيه «قرّب يخلص» لمنتج', '{"productId":"uuid","threshold":3}', (a) => `حد التنبيه → ${num(a.threshold)}`,
    async (_c, a) => {
      const { setLowStockThresholdAction } = await import('@/app/dashboard/inventory/actions')
      return outcome(await setLowStockThresholdAction(need(uuid(a.productId), 'معرّف المنتج'), Math.max(0, Math.trunc(num(a.threshold) || 0))), 'اتحفظ')
    }),

  write('delete_category', 'products', 'products.manage', 'مسح قسم (المنتجات بتفضل من غير قسم)', '{"categoryId":"uuid"}', () => 'مسح قسم',
    async (_c, a) => {
      const { deleteCategoryAction } = await import('@/app/dashboard/products/actions')
      return outcome(await deleteCategoryAction(need(uuid(a.categoryId), 'معرّف القسم')), 'القسم اتمسح')
    }),

  /* ═════════ التسويق ═════════ */
  read('marketing', 'marketing', 'marketing.manage', 'الكوبونات وعروض الكمية والباقات بمعرّفاتها', undefined, (c) => marketingPayload(c.store)),
  read('automations', 'marketing', 'marketing.manage', 'قواعد الأتمتة ومستقبلي الإشعارات', undefined, (c) => automationsPayload(c.store)),
  read('affiliates', 'marketing', 'marketing.manage', 'المسوّقين بالعمولة ومستحقاتهم', undefined, (c) => affiliatesPayload(c.store)),
  read('posts', 'marketing', 'marketing.manage', 'بوستات الاستوديو', undefined, (c) => postsPayload(c.store.id)),
  read('schedules', 'marketing', 'marketing.manage', 'جداول النشر التلقائي', undefined, (c) => schedulesPayload(c.store)),
  read('social_accounts', 'marketing', 'marketing.manage', 'حسابات السوشيال المربوطة', undefined, (c) => socialAccountsPayload(c.store.id)),

  write('set_coupon', 'marketing', 'marketing.manage', 'تشغيل كوبون أو إيقافه أو مسحه', '{"couponId":"uuid","isActive":true,"delete":false}',
    (a) => (bool(a.delete) ? 'مسح كوبون' : bool(a.isActive) ? 'تشغيل كوبون' : 'إيقاف كوبون'),
    async (_c, a) => {
      const id = need(uuid(a.couponId), 'معرّف الكوبون')
      const mod = await import('@/app/dashboard/marketing/actions')
      return bool(a.delete) ? outcome(await mod.deleteCouponAction(id), 'الكوبون اتمسح') : outcome(await mod.toggleCouponAction(id, bool(a.isActive)), 'اتحفظ')
    }),

  write('set_offer', 'marketing', 'marketing.manage', 'تشغيل عرض كمية/باقة أو إيقافه أو مسحه', '{"offerId":"uuid","isActive":true,"delete":false}',
    (a) => (bool(a.delete) ? 'مسح عرض' : bool(a.isActive) ? 'تشغيل عرض' : 'إيقاف عرض'),
    async (_c, a) => {
      const id = need(uuid(a.offerId), 'معرّف العرض')
      const mod = await import('@/app/dashboard/marketing/offer-actions')
      return bool(a.delete) ? outcome(await mod.deleteOfferAction(id), 'العرض اتمسح') : outcome(await mod.toggleOfferAction(id, bool(a.isActive)), 'اتحفظ')
    }),

  write('create_email_campaign', 'marketing', 'marketing.manage', 'اعمل حملة بريد لجمهور (مسوّدة — وابدأها بـstart_email_campaign)',
    '{"name":"اسم الحملة","subject":"العنوان","body":"النص","ctaLabel":"(اختياري)","ctaUrl":"(اختياري)","audience":"all | buyers | non_buyers | abandoned"}',
    (a) => `حملة بريد «${short(a.name, 40)}» — «${short(a.subject, 50)}»`,
    async (_c, a) => {
      const { saveCampaignAction } = await import('@/app/dashboard/marketing/campaigns/actions')
      const res = await saveCampaignAction({
        name: str(a.name, 80),
        subject: str(a.subject, 150),
        body: str(a.body, 5000),
        ctaLabel: str(a.ctaLabel, 40) || null,
        ctaUrl: str(a.ctaUrl, 500) || null,
        audience: str(a.audience) || 'all',
      })
      const r = outcome(res, 'الحملة اتعملت مسوّدة')
      return r.ok ? { ...r, data: { campaignId: res?.id } } : r
    }),

  write('start_email_campaign', 'marketing', 'marketing.manage', 'ابدأ إرسال حملة بريد', '{"campaignId":"uuid"}', () => 'بدء إرسال حملة البريد',
    async (_c, a) => {
      const { startCampaignAction } = await import('@/app/dashboard/marketing/campaigns/actions')
      return outcome(await startCampaignAction(need(uuid(a.campaignId), 'معرّف الحملة')), 'الحملة بدأت تتبعت')
    }),

  write('set_automation_rule', 'marketing', 'marketing.manage', 'تشغيل قاعدة أتمتة أو إيقافها أو مسحها', '{"ruleId":"uuid","enabled":true,"delete":false}',
    (a) => (bool(a.delete) ? 'مسح قاعدة أتمتة' : bool(a.enabled) ? 'تشغيل قاعدة أتمتة' : 'إيقاف قاعدة أتمتة'),
    async (_c, a) => {
      const id = need(uuid(a.ruleId), 'معرّف القاعدة')
      const mod = await import('@/app/dashboard/automations/actions')
      return bool(a.delete) ? outcome(await mod.deleteRuleAction(id), 'القاعدة اتمسحت') : outcome(await mod.toggleRuleAction(id, bool(a.enabled)), 'اتحفظ')
    }),

  write('pay_affiliate', 'marketing', 'marketing.manage', 'سجّل صرف مستحقات مسوّق', '{"affiliateId":"uuid"}', () => 'تسجيل صرف مستحقات مسوّق',
    async (_c, a) => {
      const { payAffiliateAction } = await import('@/app/dashboard/affiliates/actions')
      return outcome(await payAffiliateAction(need(uuid(a.affiliateId), 'معرّف المسوّق')), 'الصرف اتسجّل')
    }),

  /* ═════════ شكل المتجر ═════════ */
  read('storefront_customization', 'storefront', 'storefront.manage', 'تخصيص المتجر بكل لوحاته (الهوية، شريط الإعلان، الهيدر، البانر، القوائم، صفحة المنتج، السلة، الفوتر، شريط الأدوات وزر واتساب، شاشة التحميل، الحركة)', undefined, async (c) => {
    const theme = await getStoreTheme(c.store.id, true)
    return theme.custom
  }),
  read('banners', 'storefront', 'storefront.manage', 'البانرات', undefined, (c) => bannersPayload(c.store)),
  read('blog', 'storefront', 'storefront.manage', 'مقالات المدوّنة', undefined, (c) => blogPayload(c.store)),
  read('media', 'storefront', 'storefront.manage', 'معرض الصور بروابطها', undefined, (c) => mediaPayload(c.store)),

  write('update_storefront', 'storefront', 'storefront.manage',
    'غيّر خانات في لوحة من تخصيص المتجر وانشرها (اقرا storefront_customization الأول — نفس أسماء الخانات ونفس النوع). مثال: {"panel":"toolbar","values":{"whatsappEnabled":false}}',
    '{"panel":"identity | announcement | header | hero | listing | productPage | cart | footer | toolbar | preloader | effects","values":{"خانة":"قيمة"}}',
    (a) => `تعديل تخصيص المتجر (${str(a.panel)}): ${Object.keys(obj(a.values) ?? {}).join('، ')}`,
    async (c, a) => {
      const panel = str(a.panel) as PanelKey
      if (!PANELS.includes(panel)) throw new Refuse('اللوحة مش معروفة')
      const values = obj(a.values)
      if (!values) throw new Refuse('ابعت الخانات اللي هتتغيّر')
      const theme = await getStoreTheme(c.store.id, true)
      const current = theme.custom[panel] as unknown as Record<string, unknown>
      const merged: Record<string, unknown> = { ...current }
      const changed: string[] = []
      for (const [k, v] of Object.entries(values)) {
        if (!(k in current)) continue
        const cur = current[k]
        if (cur && typeof cur === 'object' && !Array.isArray(cur)) {
          const inner = obj(v)
          if (!inner) continue
          merged[k] = { ...(cur as Record<string, unknown>), ...inner }
        } else if (Array.isArray(cur)) {
          if (!Array.isArray(v)) continue
          merged[k] = v
        } else if (cur === null || cur === undefined || typeof v === typeof cur) {
          merged[k] = v
        } else continue
        changed.push(k)
      }
      if (!changed.length) throw new Refuse('مفيش خانة معروفة تتغيّر — اقرا storefront_customization الأول')
      const next = mergeCustomization(theme.custom, { [panel]: merged } as Partial<Record<PanelKey, unknown>>)
      /* الشعار مصدره جدول المتجر — زي صفحة التخصيص بالظبط */
      next.identity.logoLight = c.store.logoLight
      next.identity.logoDark = c.store.logoDark
      next.identity.favicon = c.store.favicon
      next.identity.hideNameInHeader = c.store.hideNameInHeader
      const { saveCustomizationAction } = await import('@/app/dashboard/storefront/customize/actions')
      await saveCustomizationAction(next)
      return { ok: true, summary: `اتنشر على المتجر: ${changed.join('، ')}` }
    }),

  write('set_banner', 'storefront', 'storefront.manage', 'تشغيل بانر أو إيقافه أو مسحه', '{"bannerId":"uuid","isActive":true,"delete":false}',
    (a) => (bool(a.delete) ? 'مسح بانر' : bool(a.isActive) ? 'تشغيل بانر' : 'إيقاف بانر'),
    async (_c, a) => {
      const id = need(uuid(a.bannerId), 'معرّف البانر')
      const mod = await import('@/app/dashboard/storefront/banners/actions')
      return bool(a.delete) ? outcome(await mod.deleteBannerAction(id), 'البانر اتمسح') : outcome(await mod.toggleBannerAction(id, bool(a.isActive)), 'اتحفظ')
    }),

  write('set_blog_post', 'storefront', 'storefront.manage', 'نشر مقال أو إخفاؤه أو مسحه', '{"postId":"uuid","isPublished":true,"delete":false}',
    (a) => (bool(a.delete) ? 'مسح مقال' : bool(a.isPublished) ? 'نشر مقال' : 'إخفاء مقال'),
    async (_c, a) => {
      const id = need(uuid(a.postId), 'معرّف المقال')
      const mod = await import('@/app/dashboard/blog/actions')
      return bool(a.delete) ? outcome(await mod.deletePostAction(id), 'المقال اتمسح') : outcome(await mod.togglePostAction(id, bool(a.isPublished)), 'اتحفظ')
    }),

  /* ═════════ الإعدادات ═════════ */
  read('store_info', 'settings', 'settings.manage', 'بيانات المتجر: الاسم والجملة والبريد والتليفون وواتساب والسوشيال والنشر', undefined, async (c) => ({
    name: c.store.name,
    nameEn: c.store.nameEn,
    tagline: c.store.tagline,
    email: c.store.email,
    phone: c.store.phone,
    whatsapp: c.store.whatsapp,
    social: c.store.socialLinks,
    isPublished: c.store.isPublished,
    currency: c.store.currency,
    country: c.store.country,
    url: publicStoreUrl(c.store),
  })),
  read('checkout_settings', 'settings', 'settings.manage', 'إعدادات الشيك أوت كلها', undefined, (c) => checkoutPayload(c)),
  read('order_settings', 'settings', 'settings.manage', 'إعدادات الطلب اليدوي وترقيم الطلبات', undefined, async (c) => orderSettingsValues(c.store)),
  read('shipping', 'settings', 'settings.manage', 'الشحن: المحافظات والأسعار وشركات الشحن والدفع عند الاستلام', undefined, (c) => shippingPayload(c.store)),
  read('payments', 'settings', 'settings.manage', 'طرق الدفع والبوابات (من غير أي مفتاح)', undefined, (c) => paymentsPayload(c.store)),
  read('seo', 'settings', 'settings.manage', 'السيو والظهور ووضع الصيانة', undefined, async (c) => seoValues(c)),
  read('receipt', 'settings', 'settings.manage', 'إعدادات صفحة الطلب والإيصال', undefined, async (c) => receiptValues(c.store.id)),
  read('email_prefs', 'settings', 'settings.manage', 'رسايل البريد التلقائية للعميل وللتاجر', undefined, async (c) => emailPrefs(c.store.id)),
  read('whatsapp', 'settings', 'settings.manage', 'حالة ربط واتساب المتجر (wasender/الرسمي) ونصوص الرسايل — من غير مفاتيح', undefined, async (c) => {
    const p = await whatsappPayload(c)
    return { connected: p.settings.provider !== 'off' && p.settings.hasKey, provider: p.settings.provider, templates: p.templates, templateKeys: p.templateKeys }
  }),
  read('email_status', 'settings', 'settings.manage', 'البريد اللي رسايل المتجر بتخرج منه وسجلات النطاق', undefined, async () => {
    const { emailDiagnosticsAction } = await import('@/app/dashboard/settings/email/actions')
    return emailDiagnosticsAction()
  }),
  read('plugins', 'settings', 'settings.manage', 'الإضافات المتاحة وشغّالة ولا لأ', undefined, async (c) => {
    const rows = await db.select({ slug: storePlugins.pluginSlug, enabled: storePlugins.enabled }).from(storePlugins).where(eq(storePlugins.storeId, c.store.id))
    return PLUGINS.map((p) => ({ slug: p.slug, name: p.name, group: p.group, enabled: rows.find((r) => r.slug === p.slug)?.enabled ?? false, byAssistant: !p.custom && p.group !== 'ai' }))
  }),

  write('update_store_info', 'settings', 'settings.manage', 'تعديل بيانات المتجر — ابعت الخانات اللي هتتغيّر بس. whatsapp فاضي = مسح رقم واتساب (والزر العايم بيختفي)',
    '{"name":"","nameEn":"","tagline":"","email":"","phone":"","whatsapp":"","social":{"facebook":"رابط","instagram":"رابط"}}',
    (a) => `تعديل بيانات المتجر: ${Object.keys(a).map((k) => ({ name: 'الاسم', nameEn: 'الاسم الإنجليزي', tagline: 'الجملة التعريفية', email: 'البريد', phone: 'التليفون', whatsapp: str(a.whatsapp) ? 'واتساب' : 'مسح واتساب', social: 'السوشيال' })[k] ?? k).join('، ')}`,
    (c, a) => updateStoreInfo(c, a)),

  write('update_checkout_settings', 'settings', 'settings.manage', 'تعديل إعدادات الشيك أوت — نفس أسماء خانات checkout_settings.values. minOrderAmount بالجنيه',
    '{"fieldEmail":"required | optional | hidden","otpEnabled":true,"minOrderEnabled":true,"minOrderAmount":200}',
    (a) => `تعديل الشيك أوت: ${Object.keys(a).join('، ')}`,
    async (c, a) => {
      const current = await loadCheckoutSettings(c.store.id)
      const input = { ...a }
      if (input.minOrderAmount !== undefined) input.minOrderAmount = Math.round(num(input.minOrderAmount) * 100)
      const { next, changed } = patchValues(current as unknown as Record<string, unknown>, input)
      const { saveCheckoutSettingsAction } = await import('@/app/dashboard/settings/checkout/actions')
      return outcome(await saveCheckoutSettingsAction(next), `اتحفظ: ${changed.join('، ')}`)
    }),

  write('update_order_settings', 'settings', 'settings.manage', 'تعديل إعدادات الطلبات (الطلب اليدوي، العربون، البيع فوق المخزون، تعديل السعر، البادئة واللاحقة، الرقم الجاي)',
    '{"manualOrdersEnabled":true,"manualDepositEnabled":false,"manualOversell":false,"manualCustomPricing":true,"orderPrefix":"ZW-","orderSuffix":"","nextOrderNumber":1050}',
    (a) => `تعديل إعدادات الطلبات: ${Object.keys(a).join('، ')}`,
    async (c, a) => {
      const { next, changed } = patchValues(orderSettingsValues(c.store) as unknown as Record<string, unknown>, a)
      const { saveOrderSettingsAction } = await import('@/app/dashboard/settings/orders/actions')
      return outcome(await saveOrderSettingsAction(next), `اتحفظ: ${changed.join('، ')}`)
    }),

  write('update_seo', 'settings', 'settings.manage', 'تعديل السيو والظهور ووضع الصيانة و«قريبًا» (نفس خانات seo)',
    '{"seoTitle":"","seoDescription":"","allowIndexing":true,"maintenanceMode":false,"maintenanceMessage":""}',
    (a) => `تعديل السيو والظهور: ${Object.keys(a).join('، ')}`,
    async (c, a) => {
      /* كود الـhead (سكربتات) ما بيتغيّرش من المساعد — من صفحته بس */
      const { next, changed } = patchValues(seoValues(c), a, ['headHtml'])
      const { saveSeoAction } = await import('@/app/dashboard/settings/seo/actions')
      return outcome(await saveSeoAction(next), `اتحفظ: ${changed.join('، ')}`)
    }),

  write('update_receipt', 'settings', 'settings.manage', 'تعديل صفحة الطلب والإيصال (نفس خانات receipt)', '{"showWhatsappButton":true,"customMessage":"..."}',
    (a) => `تعديل صفحة الإيصال: ${Object.keys(a).join('، ')}`,
    async (c, a) => {
      const { next, changed } = patchValues(await receiptValues(c.store.id), a)
      const { saveReceiptAction } = await import('@/app/dashboard/settings/receipt/actions')
      return outcome(await saveReceiptAction(next), `اتحفظ: ${changed.join('، ')}`)
    }),

  write('update_email_prefs', 'settings', 'settings.manage', 'تشغيل/إيقاف رسايل البريد التلقائية', '{"confirmed":true,"processing":false,"shipped":true,"delivered":true,"cancelled":true,"returned":true,"newOrderToMerchant":true}',
    (a) => `رسايل البريد التلقائية: ${Object.entries(a).map(([k, v]) => `${k} ${v ? 'شغّال' : 'مقفول'}`).join('، ')}`,
    async (c, a) => {
      const { next, changed } = patchValues(await emailPrefs(c.store.id), a)
      const { saveEmailPrefsAction } = await import('@/app/dashboard/settings/email/prefs-actions')
      return outcome(await saveEmailPrefsAction(next), `اتحفظ: ${changed.join('، ')}`)
    }),

  write('save_whatsapp_templates', 'settings', 'settings.manage', 'تعديل نصوص رسايل واتساب التلقائية (نص فاضي = يرجع الافتراضي). قالب otp لازم فيه {{كود}}',
    '{"templates":{"shipped":"طلبك #{{رقم_الطلب}} اتشحن 🚚"}}',
    (a) => `تعديل نصوص واتساب: ${Object.keys(obj(a.templates) ?? {}).join('، ')}`,
    async (c, a) => {
      const patch = obj(a.templates)
      if (!patch) throw new Refuse('ابعت النصوص')
      const current = await readTemplates(c.store.id)
      const next: Record<string, string> = { ...(current as Record<string, string>) }
      for (const [k, v] of Object.entries(patch)) if (typeof v === 'string') next[k] = v.slice(0, 2000)
      const { saveTemplatesAction } = await import('@/app/dashboard/settings/whatsapp/actions')
      return outcome(await saveTemplatesAction(next as never), 'النصوص اتحفظت')
    }),

  write('whatsapp_test', 'settings', 'settings.manage', 'ابعت رسالة تجربة من واتساب المتجر لرقم', '{"phone":"01012345678"}', (a) => `رسالة تجربة واتساب لـ${str(a.phone, 20)}`,
    async (_c, a) => {
      const { testWhatsappAction } = await import('@/app/dashboard/settings/whatsapp/actions')
      return outcome(await testWhatsappAction(need(str(a.phone, 20), 'الرقم')), 'اتبعتت')
    }),

  write('set_cod', 'settings', 'settings.manage', 'تشغيل/إيقاف الدفع عند الاستلام', '{"enabled":true}', (a) => (bool(a.enabled) ? 'تشغيل الدفع عند الاستلام' : 'إيقاف الدفع عند الاستلام'),
    async (c, a) => {
      const { saveCodAction } = await import('@/app/dashboard/shipping/actions')
      return outcome(await saveCodAction(c.store.country, bool(a.enabled)), 'اتحفظ')
    }),

  write('set_auto_ship', 'settings', 'settings.manage', 'تشغيل/إيقاف تسجيل الشحنة تلقائي عند شركة الشحن', '{"enabled":true}', (a) => (bool(a.enabled) ? 'تشغيل التسجيل التلقائي للشحن' : 'إيقاف التسجيل التلقائي للشحن'),
    async (_c, a) => {
      const { saveAutoShipAction } = await import('@/app/dashboard/shipping/actions')
      return outcome(await saveAutoShipAction(bool(a.enabled)), 'اتحفظ')
    }),

  write('set_payment_method', 'settings', 'settings.manage', 'تعديل طريقة دفع (cod أو bank_transfer…) — ابعت الخانات كلها زي payments', '{"gateway":"cod","enabled":true,"displayName":"الدفع عند الاستلام","instructions":"","fixedFee":"0"}',
    (a) => `${bool(a.enabled) ? 'تشغيل' : 'إيقاف'} طريقة الدفع «${str(a.displayName) || str(a.gateway)}»`,
    async (_c, a) => {
      const { savePaymentMethodAction } = await import('@/app/dashboard/payments/actions')
      return outcome(
        await savePaymentMethodAction({ gateway: need(str(a.gateway, 40), 'طريقة الدفع'), enabled: bool(a.enabled), displayName: str(a.displayName, 80), instructions: str(a.instructions, 1000), fixedFee: String(a.fixedFee ?? '0') }),
        'طريقة الدفع اتحفظت',
      )
    }),

  write('set_plugin', 'settings', 'settings.manage', 'تشغيل/إيقاف إضافة (البكسلات والتحليلات والاستوديو) وكتابة معرّفها العام — مفاتيح الذكاء الاصطناعي وواتساب من صفحاتهم بس',
    '{"slug":"facebook_pixel","enabled":true,"values":{"pixelId":"123"}}',
    (a) => `${bool(a.enabled) ? 'تشغيل' : 'إيقاف'} إضافة «${getPlugin(str(a.slug))?.name ?? str(a.slug)}»`,
    async (c, a) => {
      const slug = str(a.slug, 60)
      const def = getPlugin(slug)
      if (!def) throw new Refuse('الإضافة مش موجودة')
      if (def.custom || def.group === 'ai') throw new Refuse('الإضافة دي بتتظبط من صفحتها (فيها مفاتيح أو ربط)')
      const [row] = await db.select({ config: storePlugins.config }).from(storePlugins).where(and(eq(storePlugins.storeId, c.store.id), eq(storePlugins.pluginSlug, slug))).limit(1)
      const config: Record<string, string> = Object.fromEntries(Object.entries(row?.config ?? {}).map(([k, v]) => [k, String(v ?? '')]))
      const values = obj(a.values)
      if (values) {
        for (const field of def.fields) {
          if (def.secretFields?.includes(field.key)) continue
          if (typeof values[field.key] === 'string') config[field.key] = str(values[field.key], 200)
        }
      }
      const { savePluginAction } = await import('@/app/dashboard/plugins/actions')
      return outcome(await savePluginAction({ slug, enabled: bool(a.enabled), config }), bool(a.enabled) ? 'الإضافة اشتغلت' : 'الإضافة اتقفلت')
    }),

  /* ═════════ الفريق ═════════ */
  read('team', 'team', 'orders.view', 'أعضاء الفريق وصلاحياتهم والدعوات', undefined, (c) => teamPayload(c)),
  read('subscription', 'team', 'team.manage', 'الاشتراك والباقة والأيام الفاضلة', undefined, (c) => subscriptionPayload(c.store, c.user)),

  write('invite_member', 'team', 'team.manage', 'ادعي موظف بالبريد (بيوصله الإيميل ورابط)', '{"email":"staff@mail.com","role":"staff | admin","permissions":["orders.view","orders.manage"]}',
    (a) => `دعوة «${str(a.email, 120)}» للفريق (${str(a.role) === 'admin' ? 'مدير' : 'موظف'})`,
    async (_c, a) => {
      const { inviteMemberAction } = await import('@/app/dashboard/settings/team/actions')
      const res = await inviteMemberAction({ email: str(a.email, 120), role: str(a.role) === 'admin' ? 'admin' : 'staff', permissions: Array.isArray(a.permissions) ? a.permissions.filter((p) => typeof p === 'string') : [] })
      const r = outcome(res, res?.emailed ? 'الدعوة اتبعتت على بريده' : 'الدعوة اتعملت — ابعتله الرابط')
      return r.ok ? { ...r, data: { inviteUrl: res?.inviteUrl } } : r
    }),

  write('set_member_blocked', 'team', 'team.manage', 'إيقاف عضو في الفريق أو رجوعه', '{"memberId":"uuid","blocked":true}', (a) => (bool(a.blocked) ? 'إيقاف عضو من الفريق' : 'رجوع عضو للفريق'),
    async (_c, a) => {
      const { setMemberBlockedAction } = await import('@/app/dashboard/settings/team/actions')
      return outcome(await setMemberBlockedAction(need(uuid(a.memberId), 'معرّف العضو'), bool(a.blocked)), 'اتحفظ')
    }),

  /* ═════════ التقارير والمصروفات ═════════ */
  read('analytics', 'reports', 'reports.view', 'التحليلات: الإيرادات والطلبات والتحويل والأكثر مبيعًا', undefined, (c) => analyticsPayload(c.store)),
  read('expenses', 'reports', 'finance.view', 'المصروفات وصافي الربح', undefined, (c) => expensesPayload(c.store)),
  read('activity', 'reports', 'settings.manage', 'سجل النشاط (مين عمل إيه)', undefined, (c) => activityPayload(c.store.id)),

  write('add_expense', 'reports', 'finance.view', 'سجّل مصروف (المبلغ بالجنيه)', '{"title":"إعلانات فيسبوك","category":"ads | goods | shipping | salaries | packaging | rent | fees | other","amount":500,"spentAt":"2026-09-15","note":"","isRecurring":false}',
    (a) => `مصروف «${short(a.title, 40)}» بـ${num(a.amount)} ج`,
    async (_c, a) => {
      const { saveExpenseAction } = await import('@/app/dashboard/expenses/actions')
      const spentAt = /^\d{4}-\d{2}-\d{2}$/.test(str(a.spentAt)) ? str(a.spentAt) : new Date().toISOString().slice(0, 10)
      return outcome(
        await saveExpenseAction({ title: str(a.title, 120), category: str(a.category) || 'other', amount: Math.round(num(a.amount) * 100), spentAt, note: str(a.note, 500) || null, isRecurring: bool(a.isRecurring) }),
        'المصروف اتسجّل',
      )
    }),
]

/* ────────────────────────── القيم الحالية للإعدادات ────────────────────────── */

function seoValues(c: DashboardContext) {
  const s = c.store
  return {
    seoTitle: s.seoTitle ?? '',
    seoDescription: s.seoDescription ?? '',
    seoKeywords: s.seoKeywords ?? '',
    ogImage: s.ogImage ?? '',
    ogTitle: s.ogTitle ?? '',
    ogDescription: s.ogDescription ?? '',
    headHtml: s.headHtml ?? '',
    allowIndexing: s.allowIndexing,
    hideOutOfStock: s.hideOutOfStock,
    maintenanceMode: s.maintenanceMode,
    maintenanceMessage: s.maintenanceMessage ?? '',
    comingSoon: s.comingSoon,
    comingSoonMessage: s.comingSoonMessage ?? '',
  }
}

async function receiptValues(storeId: string) {
  const [row] = await db.select().from(thankYouSettings).where(eq(thankYouSettings.storeId, storeId)).limit(1)
  return {
    showOrderSummary: row?.showOrderSummary ?? true,
    showProgressTracker: row?.showProgressTracker ?? true,
    showWhatsappButton: row?.showWhatsappButton ?? true,
    showTelegramButton: row?.showTelegramButton ?? false,
    allowDownloadReceipt: row?.allowDownloadReceipt ?? true,
    customMessage: row?.customMessage ?? '',
  }
}

async function emailPrefs(storeId: string) {
  const [row] = await db.select().from(messagingSettings).where(eq(messagingSettings.storeId, storeId)).limit(1)
  return {
    confirmed: row?.emailOnConfirmed ?? true,
    processing: row?.emailOnProcessing ?? true,
    shipped: row?.emailOnShipped ?? true,
    delivered: row?.emailOnDelivered ?? true,
    cancelled: row?.emailOnCancelled ?? true,
    returned: row?.emailOnReturned ?? true,
    newOrderToMerchant: row?.emailNewOrderToMerchant ?? true,
  }
}

/* ────────────────────────── التنفيذ ────────────────────────── */

export function findAction(name: string): RegistryAction | undefined {
  return REGISTRY.find((a) => a.name === name)
}

/** الأفعال اللي الموظف ده يقدر عليها — في جزء معيّن أو الكل */
export function availableActions(ctx: DashboardContext, area?: string) {
  return REGISTRY.filter((a) => (!area || a.area === area) && (!a.permission || can(ctx.actor, a.permission))).map((a) => ({
    action: a.name,
    kind: a.kind === 'read' ? 'get_data' : 'run_action',
    doc: a.doc,
    args: a.args ?? null,
  }))
}

export function describeAction(name: string, args: Record<string, unknown>): string {
  const act = findAction(name)
  return act ? act.label(args) : `إجراء «${name}»`
}

export async function runRegistryAction(
  ctx: DashboardContext,
  kind: 'read' | 'write',
  name: string,
  args: Record<string, unknown>,
): Promise<RegistryResult> {
  const act = findAction(name)
  if (!act) return { ok: false, error: `مفيش إجراء اسمه «${name}» — شوف list_actions` }
  if (act.kind !== kind) {
    return { ok: false, error: kind === 'read' ? `«${name}» بيغيّر حاجة — استخدم run_action` : `«${name}» قراءة — استخدم get_data` }
  }
  if (act.permission && !can(ctx.actor, act.permission)) {
    return { ok: false, error: 'الحساب ده مالوش صلاحية على الجزء ده من المتجر' }
  }
  try {
    return await act.run(ctx, args)
  } catch (e) {
    if (e instanceof Refuse) return { ok: false, error: e.message }
    console.error(`فشل إجراء المساعد ${name}:`, e)
    const message = e instanceof Error ? e.message : ''
    return { ok: false, error: /[؀-ۿ]/.test(message) ? message : 'ما قدرتش أنفّذها — جرّبها من صفحتها في اللوحة' }
  }
}
