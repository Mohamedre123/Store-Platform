import 'server-only'
import { and, desc, eq, ilike, isNull, sql } from 'drizzle-orm'
import { db } from '@/db'
import {
  categories,
  coupons,
  orders,
  products,
  shippingRates,
  shippingZones,
  stores,
} from '@/db/schema'
import { formatMoney, suggestStoreSlug } from '@/lib/utils'
import type { DashboardContext } from '@/lib/store-context'
import { can, type Permission } from '@/lib/permissions'
import type { ToolDef } from './gemini'
import { AREA_LABELS, availableActions, describeAction, runRegistryAction, updateStoreInfo } from './agent-registry'

/**
 * أدوات مساعد التاجر.
 *
 * مقسومة قسمين بقاعدة واحدة:
 *
 * - **قراءة**: بتتنفّذ فورًا. المساعد محتاج يشوف قبل ما يقترح، ولو
 *   استأذن على كل قراءة الحوار بيبقى غير محتمل.
 * - **كتابة**: **ما بتتنفّذش غير بموافقة التاجر على كل واحدة.**
 *   مساعد بيغيّر أسعار من نفسه كارثة — غلطة واحدة في الفهم تبيع
 *   مخزون المتجر بجنيه.
 *
 * وعدد الأدوات مقصود إنه محدود: كل أداة بتتبعت مع كل رسالة، والقايمة
 * الطويلة بتغرق الموديل وبتزوّد التكلفة على التاجر في كل سؤال. باقي
 * اللوحة كلها (الإعدادات، الرسايل للعملاء، التخصيص، الإضافات…) ورا
 * `list_actions` / `get_data` / `run_action` في `agent-registry.ts`.
 *
 * وكل أداة ليها صلاحية بتتقاس على الموظف اللي بيكلّم المساعد — الموظف اللي
 * ما يقدرش يغيّر الأسعار من اللوحة ما يقدرش يغيّرها من الشات.
 */

export type ToolKind = 'read' | 'write'

export type AgentTool = ToolDef & {
  kind: ToolKind
  /** الصلاحية المطلوبة (مفيش = أي عضو في الفريق) */
  permission?: Permission
  /** وصف الإجراء بالعربي للتاجر قبل ما يوافق */
  describe: (args: Record<string, unknown>) => string
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const num = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : NaN
}

/** خانات `run_action`/`get_data` — نص JSON (أو كائن لو المزوّد بعته كده) */
function registryArgs(a: Record<string, unknown>): Record<string, unknown> {
  if (a.args && typeof a.args === 'object' && !Array.isArray(a.args)) return a.args as Record<string, unknown>
  const raw = str(a.argsJson)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

/** البيانات الكبيرة بتتقص — الموديل مش محتاج آلاف الأسطر ورسالته بتغلى */
function compact(data: unknown): unknown {
  const text = JSON.stringify(data ?? null)
  if (text.length <= 16_000) return data
  return { ملحوظة: 'البيانات كتير فدي أولها بس — اسأل عن حاجة محددة لو محتاج الباقي', جزء: text.slice(0, 16_000) }
}

/* ────────────────────────── التعريفات ────────────────────────── */

export const AGENT_TOOLS: AgentTool[] = [
  {
    kind: 'read',
    name: 'get_store_overview',
    description:
      'حالة المتجر دلوقتي: عدد المنتجات والطلبات ومبيعات آخر ٣٠ يوم والمنتجات اللي قرّبت تخلص وهل المتجر منشور. استخدمها أول ما التاجر يسأل «إيه أخبار متجري» أو قبل ما تنصحه بحاجة.',
    parameters: { type: 'object', properties: {} },
    describe: () => 'قراءة حالة المتجر',
  },
  {
    kind: 'read',
    name: 'list_actions',
    description:
      'كل اللي تقدر تقراه وتنفّذه في اللوحة (بصلاحيات الحساب ده) — مع شكل الخانات. استخدمها لما التاجر يطلب حاجة مالهاش أداة مباشرة: إعدادات، رسايل للعملاء بالبريد أو واتساب، تخصيص المتجر وزر واتساب، الإضافات، الفريق، المرتجعات، الشكاوى، الحملات، وغيرها.',
    parameters: {
      type: 'object',
      properties: {
        area: {
          type: 'string',
          description: `الجزء (اختياري — من غيره بترجع الكل): ${Object.entries(AREA_LABELS)
            .map(([k, v]) => `${k} = ${v}`)
            .join(' · ')}`,
          enum: Object.keys(AREA_LABELS),
        },
      },
    },
    describe: () => 'قراءة الإجراءات المتاحة',
  },
  {
    kind: 'read',
    name: 'get_data',
    description: 'اقرا بيانات من اللوحة بإجراء قراءة من list_actions (زي order أو checkout_settings أو whatsapp).',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'اسم إجراء القراءة من list_actions' },
        argsJson: { type: 'string', description: 'الخانات كنص JSON بالشكل المكتوب في list_actions — أو فاضي' },
      },
      required: ['action'],
    },
    describe: (a) => `قراءة «${str(a.action)}»`,
  },
  {
    kind: 'write',
    name: 'run_action',
    description:
      'نفّذ إجراء بيغيّر حاجة في المتجر من list_actions (زي message_customers أو update_checkout_settings أو update_storefront). التاجر بيشوفه بالعربي ويوافق قبل التنفيذ.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', description: 'اسم الإجراء من list_actions' },
        argsJson: { type: 'string', description: 'الخانات كنص JSON بالشكل المكتوب في list_actions' },
      },
      required: ['action', 'argsJson'],
    },
    describe: (a) => describeAction(str(a.action), registryArgs(a)),
  },
  {
    kind: 'read',
    name: 'search_products',
    permission: 'products.view',
    description: 'دوّر على منتجات بالاسم. استخدمها قبل أي تعديل عشان تجيب معرّف المنتج الصح.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'جزء من اسم المنتج' } },
      required: ['query'],
    },
    describe: (a) => `بحث عن «${str(a.query)}»`,
  },
  {
    kind: 'read',
    name: 'list_recent_orders',
    permission: 'orders.view',
    description: 'آخر الطلبات وحالتها. استخدمها لو التاجر سأل عن طلباته أو عايز يعرف فيه إيه محتاج تدخّل.',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'فلترة بالحالة (اختياري)',
          enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
        },
      },
    },
    describe: () => 'قراءة آخر الطلبات',
  },
  {
    kind: 'read',
    name: 'list_categories',
    permission: 'products.view',
    description: 'أقسام المتجر. استخدمها قبل ما تضيف منتج عشان تحطّه في قسم موجود بدل ما تعمل قسم مكرّر.',
    parameters: { type: 'object', properties: {} },
    describe: () => 'قراءة الأقسام',
  },

  {
    kind: 'write',
    name: 'create_product',
    permission: 'products.manage',
    description:
      'إضافة منتج جديد للمتجر. لو التاجر بعت صور، حطّ روابطها في imageUrls زي ما وصلتك بالظبط. اسأله عن أي بيانات ناقصة قبل ما تستخدمها.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'اسم المنتج' },
        price: { type: 'number', description: 'السعر بالجنيه (رقم عادي مش قرش)' },
        description: { type: 'string', description: 'وصف المنتج' },
        categoryName: { type: 'string', description: 'اسم القسم — لازم يكون موجود' },
        stock: { type: 'number', description: 'الكمية المتاحة' },
        sku: { type: 'string', description: 'كود المنتج' },
        brand: { type: 'string', description: 'الماركة' },
        imageUrls: { type: 'string', description: 'روابط الصور مفصولة بفاصلة' },
        publish: { type: 'boolean', description: 'ينشر فورًا ولا يفضل مسوّدة' },
      },
      required: ['name', 'price'],
    },
    describe: (a) =>
      `إضافة منتج «${str(a.name)}» بسعر ${num(a.price)} ج${a.publish === false ? ' (مسوّدة)' : ''}`,
  },
  {
    kind: 'write',
    name: 'update_product',
    permission: 'products.manage',
    description:
      'تعديل منتج موجود. استخدم search_products الأول عشان تجيب productId. عدّل الحقول اللي التاجر طلبها بس.',
    parameters: {
      type: 'object',
      properties: {
        productId: { type: 'string', description: 'معرّف المنتج من search_products' },
        name: { type: 'string', description: 'الاسم الجديد' },
        price: { type: 'number', description: 'السعر الجديد بالجنيه' },
        stock: { type: 'number', description: 'الكمية الجديدة' },
        description: { type: 'string', description: 'الوصف الجديد' },
        status: { type: 'string', description: 'الحالة', enum: ['active', 'draft'] },
      },
      required: ['productId'],
    },
    describe: (a) => {
      const parts: string[] = []
      if (a.name) parts.push(`الاسم → «${str(a.name)}»`)
      if (a.price !== undefined) parts.push(`السعر → ${num(a.price)} ج`)
      if (a.stock !== undefined) parts.push(`الكمية → ${num(a.stock)}`)
      if (a.description) parts.push('الوصف')
      if (a.status) parts.push(`الحالة → ${a.status === 'active' ? 'نشط' : 'مسوّدة'}`)
      return `تعديل منتج: ${parts.join('، ') || 'من غير تغيير'}`
    },
  },
  {
    kind: 'write',
    name: 'create_category',
    permission: 'products.manage',
    description: 'إضافة قسم جديد للمتجر.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'اسم القسم' },
        description: { type: 'string', description: 'وصف مختصر' },
      },
      required: ['name'],
    },
    describe: (a) => `إضافة قسم «${str(a.name)}»`,
  },
  {
    kind: 'write',
    name: 'create_coupon',
    permission: 'marketing.manage',
    description: 'إنشاء كود خصم. النسبة بالمئة (مثلًا 10 يعني ١٠٪) والمبلغ بالجنيه.',
    parameters: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'الكود بحروف إنجليزي وأرقام' },
        type: { type: 'string', description: 'نوع الخصم', enum: ['percent', 'fixed', 'free_shipping'] },
        value: { type: 'number', description: 'النسبة بالمئة أو المبلغ بالجنيه' },
        minOrder: { type: 'number', description: 'أقل قيمة طلب بالجنيه' },
        usageLimit: { type: 'number', description: 'أقصى عدد استخدامات' },
      },
      required: ['code', 'type'],
    },
    describe: (a) => {
      const t = a.type === 'percent' ? `${num(a.value)}٪` : a.type === 'fixed' ? `${num(a.value)} ج` : 'شحن مجاني'
      return `كوبون «${str(a.code)}» — ${t}`
    },
  },
  {
    kind: 'write',
    name: 'set_shipping_prices',
    permission: 'settings.manage',
    description:
      'تظبيط أسعار الشحن. تقدر تحدّد سعرًا موحّدًا لكل المحافظات، أو سعرًا لمحافظة بعينها، أو الاتنين. السعر بالجنيه.',
    parameters: {
      type: 'object',
      properties: {
        defaultPrice: {
          type: 'number',
          description: 'السعر الموحّد لكل المحافظات اللي مالهاش سعر خاص، بالجنيه',
        },
        cities: {
          type: 'array',
          description: 'أسعار محافظات بعينها',
          items: {
            type: 'object',
            properties: {
              city: { type: 'string', description: 'اسم المحافظة زي ما هو مكتوب في المتجر' },
              price: { type: 'number', description: 'السعر بالجنيه' },
            },
            required: ['city', 'price'],
          },
        },
        freeOver: {
          type: 'number',
          description: 'الشحن يبقى مجاني فوق المبلغ ده بالجنيه. صفر معناه إلغاء الشحن المجاني.',
        },
      },
    },
    describe: (a) => {
      const parts: string[] = []
      if (a.defaultPrice !== undefined) parts.push(`سعر موحّد ${num(a.defaultPrice)} ج`)
      const cities = Array.isArray(a.cities) ? a.cities.length : 0
      if (cities) parts.push(`${cities} محافظة`)
      if (a.freeOver !== undefined) {
        parts.push(
          num(a.freeOver) > 0
            ? `شحن مجاني فوق ${num(a.freeOver)} ج`
            : 'إلغاء الشحن المجاني',
        )
      }
      return `تظبيط الشحن — ${parts.join('، ') || 'من غير تغيير'}`
    },
  },
  {
    kind: 'read',
    name: 'get_shipping',
    permission: 'settings.manage',
    description: 'قراءة إعدادات الشحن الحالية: السعر الموحّد، أسعار المحافظات، وحد الشحن المجاني.',
    parameters: { type: 'object', properties: {} },
    describe: () => 'قراءة إعدادات الشحن',
  },
  {
    kind: 'write',
    name: 'update_order_status',
    permission: 'orders.manage',
    description: 'تغيير حالة طلب برقمه. ده بيبعت رسالة للعميل تلقائيًا. (لأكتر من طلب مرة واحدة: run_action set_orders_status)',
    parameters: {
      type: 'object',
      properties: {
        orderNumber: { type: 'number', description: 'رقم الطلب' },
        status: {
          type: 'string',
          description: 'الحالة الجديدة',
          enum: ['confirmed', 'processing', 'shipped', 'delivered', 'cancelled'],
        },
      },
      required: ['orderNumber', 'status'],
    },
    describe: (a) => `تغيير حالة الطلب #${num(a.orderNumber)} لـ${str(a.status)}`,
  },
  {
    kind: 'write',
    name: 'set_store_published',
    permission: 'settings.manage',
    description: 'نشر المتجر أو إيقافه. المتجر غير المنشور ما حدش يقدر يطلب منه.',
    parameters: {
      type: 'object',
      properties: { published: { type: 'boolean', description: 'true = ينشر' } },
      required: ['published'],
    },
    describe: (a) => (a.published ? 'نشر المتجر' : 'إيقاف نشر المتجر'),
  },
  {
    kind: 'write',
    name: 'update_store_info',
    permission: 'settings.manage',
    description:
      'تعديل بيانات المتجر الأساسية. ابعت الخانات اللي هتتغيّر بس. whatsapp فاضي ("") = مسح رقم واتساب المتجر وزر واتساب بيختفي من المتجر.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'اسم المتجر' },
        tagline: { type: 'string', description: 'الجملة التعريفية' },
        email: { type: 'string', description: 'بريد المتجر' },
        phone: { type: 'string', description: 'تليفون المتجر' },
        whatsapp: { type: 'string', description: 'رقم واتساب المتجر (فاضي = امسحه)' },
      },
    },
    describe: (a) => {
      const names: Record<string, string> = { name: 'الاسم', tagline: 'الجملة التعريفية', email: 'البريد', phone: 'التليفون' }
      const parts = Object.entries(a)
        .filter(([k, v]) => typeof v === 'string' && (v || k === 'whatsapp'))
        .map(([k, v]) => (k === 'whatsapp' ? (v ? 'واتساب' : 'مسح واتساب') : (names[k] ?? k)))
      return `تعديل بيانات المتجر: ${parts.join('، ')}`
    },
  },
]

export function getTool(name: string): AgentTool | undefined {
  return AGENT_TOOLS.find((t) => t.name === name)
}

/* ────────────────────────── التنفيذ ────────────────────────── */

export type ExecResult = { ok: true; summary: string; data?: unknown } | { ok: false; error: string }

/**
 * تنفيذ أداة.
 *
 * المتجر والموظف بيتحطّوا هنا من الجلسة لا من الموديل — لو سبناهم للموديل،
 * كلمة في رسالة عميل كانت تخلّيه يكتب في متجر تاني أو بصلاحيات حد تاني.
 */
export async function executeTool(
  ctx: DashboardContext,
  call: { name: string; args: Record<string, unknown> },
): Promise<ExecResult> {
  const a = call.args
  const storeId = ctx.store.id
  const currency = ctx.store.currency

  const tool = getTool(call.name)
  if (tool?.permission && !can(ctx.actor, tool.permission)) {
    return { ok: false, error: 'الحساب ده مالوش صلاحية على الجزء ده من المتجر' }
  }

  switch (call.name) {
    case 'list_actions': {
      const area = str(a.area)
      const actions = availableActions(ctx, area || undefined)
      return { ok: true, summary: `${actions.length} إجراء متاح`, data: actions }
    }

    case 'get_data': {
      const res = await runRegistryAction(ctx, 'read', str(a.action), registryArgs(a))
      return res.ok ? { ...res, data: compact(res.data) } : res
    }

    case 'run_action':
      return runRegistryAction(ctx, 'write', str(a.action), registryArgs(a))

    case 'get_store_overview': {
      const [[store], [stats], [orderStats], low] = await Promise.all([
        db
          .select({ name: stores.name, isPublished: stores.isPublished })
          .from(stores)
          .where(eq(stores.id, storeId))
          .limit(1),
        db
          .select({
            total: sql<number>`count(*)::int`,
            active: sql<number>`count(*) filter (where ${products.status} = 'active')::int`,
          })
          .from(products)
          .where(and(eq(products.storeId, storeId), isNull(products.deletedAt))),
        db
          .select({
            month: sql<number>`count(*) filter (where ${orders.createdAt} > now() - interval '30 days' and ${orders.isIncomplete} = false)::int`,
            revenue: sql<number>`coalesce(sum(${orders.total}) filter (where ${orders.createdAt} > now() - interval '30 days' and ${orders.isIncomplete} = false and ${orders.status} not in ('cancelled','returned')), 0)::int`,
            needsAction: sql<number>`count(*) filter (where ${orders.status} in ('pending','confirmed') and ${orders.isIncomplete} = false)::int`,
          })
          .from(orders)
          .where(eq(orders.storeId, storeId)),
        db
          .select({ name: products.name, stock: products.stock })
          .from(products)
          .where(
            and(
              eq(products.storeId, storeId),
              eq(products.status, 'active'),
              eq(products.trackInventory, true),
              isNull(products.deletedAt),
              sql`${products.stock} <= ${products.lowStockThreshold}`,
            ),
          )
          .limit(10),
      ])

      return {
        ok: true,
        summary: 'حالة المتجر',
        data: {
          المتجر: store?.name,
          منشور: store?.isPublished ? 'أيوه' : 'لأ',
          منتجات: `${stats?.active ?? 0} نشط من ${stats?.total ?? 0}`,
          'طلبات آخر ٣٠ يوم': orderStats?.month ?? 0,
          'مبيعات آخر ٣٠ يوم': formatMoney(Number(orderStats?.revenue ?? 0), currency),
          'طلبات محتاجة تدخّل': orderStats?.needsAction ?? 0,
          'قرّبت تخلص': low.map((p) => `${p.name} (${p.stock})`),
        },
      }
    }

    case 'search_products': {
      const q = str(a.query)
      if (!q) return { ok: false, error: 'اكتب اللي بتدوّر عليه' }

      const rows = await db
        .select({
          id: products.id,
          name: products.name,
          price: products.price,
          stock: products.stock,
          status: products.status,
        })
        .from(products)
        .where(
          and(eq(products.storeId, storeId), isNull(products.deletedAt), ilike(products.name, `%${q}%`)),
        )
        .limit(10)

      return {
        ok: true,
        summary: `${rows.length} نتيجة`,
        data: rows.map((r) => ({
          productId: r.id,
          الاسم: r.name,
          السعر: formatMoney(r.price, currency),
          الكمية: r.stock,
          الحالة: r.status === 'active' ? 'نشط' : 'مسوّدة',
        })),
      }
    }

    case 'list_recent_orders': {
      const status = str(a.status)
      const rows = await db
        .select({
          orderNumber: orders.orderNumber,
          status: orders.status,
          total: orders.total,
          customerName: orders.customerName,
          createdAt: orders.createdAt,
        })
        .from(orders)
        .where(
          status
            ? and(eq(orders.storeId, storeId), eq(orders.isIncomplete, false), eq(orders.status, status as never))
            : and(eq(orders.storeId, storeId), eq(orders.isIncomplete, false)),
        )
        .orderBy(desc(orders.createdAt))
        .limit(15)

      return {
        ok: true,
        summary: `${rows.length} طلب`,
        data: rows.map((r) => ({
          رقم: r.orderNumber,
          الحالة: r.status,
          الإجمالي: formatMoney(r.total, currency),
          العميل: r.customerName,
        })),
      }
    }

    case 'list_categories': {
      const rows = await db
        .select({ id: categories.id, name: categories.name })
        .from(categories)
        .where(eq(categories.storeId, storeId))
        .limit(50)

      return { ok: true, summary: `${rows.length} قسم`, data: rows.map((r) => r.name) }
    }

    /* ─────────── الكتابة ─────────── */

    case 'create_product': {
      const name = str(a.name)
      const price = num(a.price)
      if (!name) return { ok: false, error: 'اسم المنتج ناقص' }
      if (!Number.isFinite(price) || price <= 0) return { ok: false, error: 'السعر لازم يكون أكبر من صفر' }

      let categoryId: string | null = null
      const catName = str(a.categoryName)
      if (catName) {
        const [c] = await db
          .select({ id: categories.id })
          .from(categories)
          .where(and(eq(categories.storeId, storeId), ilike(categories.name, catName)))
          .limit(1)
        categoryId = c?.id ?? null
      }

      const images = str(a.imageUrls)
        .split(',')
        .map((s) => s.trim())
        // روابط تخزيننا بس — الموديل ما ينفعش يحقن رابط من بره
        .filter((s) => s.startsWith('http'))

      const slug = await uniqueProductSlug(storeId, suggestStoreSlug(name))
      const stock = Math.max(0, Math.trunc(num(a.stock) || 0))
      const publish = a.publish !== false

      const [created] = await db
        .insert(products)
        .values({
          storeId,
          name,
          slug,
          description: str(a.description) || null,
          price: Math.round(price * 100),
          categoryId,
          stock,
          sku: str(a.sku) || null,
          brand: str(a.brand) || null,
          images,
          status: publish ? 'active' : 'draft',
          publishedAt: publish ? new Date() : null,
        })
        .returning({ id: products.id })

      return {
        ok: true,
        summary: `اتضاف «${name}» بسعر ${formatMoney(Math.round(price * 100), currency)}`,
        data: { productId: created.id },
      }
    }

    case 'update_product': {
      const id = str(a.productId)
      if (!id) return { ok: false, error: 'معرّف المنتج ناقص' }

      const values: Record<string, unknown> = {}
      if (str(a.name)) values.name = str(a.name)
      if (str(a.description)) values.description = str(a.description)
      if (a.price !== undefined) {
        const p = num(a.price)
        if (!Number.isFinite(p) || p <= 0) return { ok: false, error: 'السعر غير صالح' }
        values.price = Math.round(p * 100)
      }
      if (a.stock !== undefined) values.stock = Math.max(0, Math.trunc(num(a.stock) || 0))
      if (a.status === 'active' || a.status === 'draft') values.status = a.status

      if (Object.keys(values).length === 0) return { ok: false, error: 'مفيش حاجة تتعدّل' }

      const updated = await db
        .update(products)
        .set(values)
        .where(and(eq(products.id, id), eq(products.storeId, storeId)))
        .returning({ name: products.name })

      if (!updated.length) return { ok: false, error: 'المنتج مش موجود' }
      return { ok: true, summary: `اتعدّل «${updated[0].name}»` }
    }

    case 'create_category': {
      const name = str(a.name)
      if (!name) return { ok: false, error: 'اسم القسم ناقص' }

      await db.insert(categories).values({
        storeId,
        name,
        slug: suggestStoreSlug(name) || `cat-${Date.now()}`,
        description: str(a.description) || null,
      })

      return { ok: true, summary: `اتضاف قسم «${name}»` }
    }

    case 'create_coupon': {
      const code = str(a.code).toUpperCase()
      const type = str(a.type)
      if (!code) return { ok: false, error: 'الكود ناقص' }
      if (!['percent', 'fixed', 'free_shipping'].includes(type)) {
        return { ok: false, error: 'نوع الخصم غير معروف' }
      }

      const [clash] = await db
        .select({ id: coupons.id })
        .from(coupons)
        .where(and(eq(coupons.storeId, storeId), sql`upper(${coupons.code}) = ${code}`))
        .limit(1)

      if (clash) return { ok: false, error: `الكود «${code}» موجود بالفعل` }

      const raw = num(a.value)
      // النسبة بنقاط الأساس والمبلغ بالقرش — نفس وحدات المشروع
      const value =
        type === 'percent'
          ? Math.round((Number.isFinite(raw) ? raw : 0) * 100)
          : type === 'fixed'
            ? Math.round((Number.isFinite(raw) ? raw : 0) * 100)
            : 0

      if (type !== 'free_shipping' && value <= 0) {
        return { ok: false, error: 'قيمة الخصم لازم تكون أكبر من صفر' }
      }

      await db.insert(coupons).values({
        storeId,
        code,
        type: type as never,
        value,
        // صفر = مفيش حد أدنى؛ العمود مش بيقبل فاضي
        minOrder: a.minOrder !== undefined ? Math.round(num(a.minOrder) * 100) : 0,
        usageLimit: a.usageLimit !== undefined ? Math.trunc(num(a.usageLimit)) : null,
        isActive: true,
      })

      return { ok: true, summary: `اتعمل كوبون «${code}»` }
    }

    case 'update_order_status': {
      const n = Math.trunc(num(a.orderNumber))
      const status = str(a.status)
      if (!Number.isFinite(n)) return { ok: false, error: 'رقم الطلب غير صالح' }

      const [order] = await db
        .select({ id: orders.id })
        .from(orders)
        .where(and(eq(orders.storeId, storeId), eq(orders.orderNumber, n)))
        .limit(1)

      if (!order) return { ok: false, error: `الطلب #${n} مش موجود` }

      /*
        بننادي فعل الطلبات نفسه لا بنكتب مباشرة: الرسالة للعميل
        والويب هوك والأتمتة ونقاط الولاء كلهم متعلّقين بيه. التحديث
        المباشر كان هيغيّر الحالة ويسكّت كل ده.
      */
      const { updateOrderStatusAction } = await import('@/app/dashboard/orders/actions')
      await updateOrderStatusAction(order.id, status as never)

      return { ok: true, summary: `الطلب #${n} بقى «${status}»` }
    }

    case 'set_store_published': {
      const published = a.published === true
      const { togglePublishAction } = await import('@/app/dashboard/actions')
      await togglePublishAction(published)
      return { ok: true, summary: published ? 'المتجر اتنشر' : 'المتجر اتوقف' }
    }

    /*
      بفعل صفحة «بيانات المتجر» نفسه — عشان مسح رقم واتساب يمسح نسخه في التخصيص
      كمان (الزر العايم والفوتر) زي ما بيحصل لما التاجر يمسحه بإيده.
    */
    case 'update_store_info':
      return updateStoreInfo(ctx, a)

    case 'get_shipping': {
      const [zone] = await db
        .select()
        .from(shippingZones)
        .where(eq(shippingZones.storeId, storeId))
        .limit(1)

      if (!zone) return { ok: true, summary: 'مفيش إعدادات شحن متظبّطة لسه.' }

      const rates = await db
        .select({ city: shippingRates.city, price: shippingRates.price })
        .from(shippingRates)
        .where(eq(shippingRates.zoneId, zone.id))
        .orderBy(shippingRates.city)

      const lines = [
        `السعر الموحّد: ${zone.defaultPrice / 100} ج`,
        zone.freeShippingEnabled && zone.freeOverAmount > 0
          ? `شحن مجاني فوق ${zone.freeOverAmount / 100} ج`
          : 'مفيش شحن مجاني',
        rates.length
          ? `أسعار خاصة: ${rates.map((r) => `${r.city} ${r.price / 100} ج`).join('، ')}`
          : 'مفيش أسعار خاصة بمحافظات',
      ]

      return { ok: true, summary: lines.join('\n') }
    }

    /**
     * تظبيط الشحن.
     *
     * ## ليه الأداة دي لازمة
     * المساعد كان بيقدر يعمل كوبونات ومنتجات وأقسام، وبيقول «ما عنديش
     * صلاحية أعدّل أسعار الشحن» — والتاجر بيسأله سؤالًا طبيعيًا («سعّر
     * شحن كل المحافظات ٩٠») ويتردّ عليه بالرفض.
     *
     * ## المنطقة بتتعمل لو مش موجودة
     * المتجر الجديد مالوش منطقة شحن. الرفض بـ«ظبّط الشحن الأول» بيرجّع
     * التاجر لنفس المكان اللي هرب منه — فبنعملها بدولة المتجر ونكمّل.
     *
     * ## والأسعار بالقرش زي كل مبالغ المشروع
     * التاجر بيقول «٩٠ جنيه»، والتخزين بالقرش. الضرب هنا مرة واحدة —
     * ولو اتنسي، كل شحنة بتتحسب بجنيه واحد بدل تسعين.
     */
    case 'set_shipping_prices': {
      const [existing] = await db
        .select()
        .from(shippingZones)
        .where(eq(shippingZones.storeId, storeId))
        .limit(1)

      const [store] = await db
        .select({ country: stores.country })
        .from(stores)
        .where(eq(stores.id, storeId))
        .limit(1)

      let zone = existing
      if (!zone) {
        const [created] = await db
          .insert(shippingZones)
          .values({ storeId, country: store?.country ?? 'EG', name: 'الشحن', enabled: true })
          .returning()
        zone = created
      }

      const done: string[] = []

      const toMinor = (v: unknown) => Math.round((Number(v) || 0) * 100)

      if (a.defaultPrice !== undefined) {
        await db
          .update(shippingZones)
          .set({ defaultPrice: toMinor(a.defaultPrice) })
          .where(eq(shippingZones.id, zone.id))
        done.push(`السعر الموحّد بقى ${num(a.defaultPrice)} ج`)
      }

      if (a.freeOver !== undefined) {
        const amount = toMinor(a.freeOver)
        await db
          .update(shippingZones)
          .set({ freeOverAmount: amount, freeShippingEnabled: amount > 0 })
          .where(eq(shippingZones.id, zone.id))
        done.push(amount > 0 ? `شحن مجاني فوق ${num(a.freeOver)} ج` : 'الشحن المجاني اتلغى')
      }

      const cities = Array.isArray(a.cities) ? a.cities : []
      let touched = 0
      for (const raw of cities) {
        const row = raw as Record<string, unknown>
        const city = str(row.city).trim()
        if (!city) continue
        const price = toMinor(row.price)

        /*
          `onConflictDoUpdate` لا حذف وإضافة: الفهرس الفريد على
          (المنطقة، المحافظة)، والحذف كان هيضيّع مواعيد التوصيل
          المتخزّنة على الصف.
        */
        await db
          .insert(shippingRates)
          .values({ zoneId: zone.id, storeId, city, price, enabled: true })
          .onConflictDoUpdate({
            target: [shippingRates.zoneId, shippingRates.city],
            set: { price, enabled: true },
          })
        touched++
      }
      if (touched) done.push(`${touched} محافظة اتسعّرت`)

      return done.length
        ? { ok: true, summary: done.join('، ') }
        : { ok: false, error: 'ما حددتش أي سعر أغيّره' }
    }

    default:
      return { ok: false, error: `أداة غير معروفة: ${call.name}` }
  }
}

/** رابط فريد للمنتج — بيزوّد رقمًا لو الاسم مكرّر */
async function uniqueProductSlug(storeId: string, base: string): Promise<string> {
  const root = base || 'product'
  for (let i = 1; i < 100; i++) {
    const candidate = i === 1 ? root : `${root}-${i}`
    const [clash] = await db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.storeId, storeId), eq(products.slug, candidate)))
      .limit(1)
    if (!clash) return candidate
  }
  return `${root}-${Date.now()}`
}
