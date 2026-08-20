import 'server-only'
import { and, desc, eq, ilike, isNull, sql } from 'drizzle-orm'
import { db } from '@/db'
import { categories, coupons, orders, products, stores } from '@/db/schema'
import { formatMoney, suggestStoreSlug } from '@/lib/utils'
import type { ToolDef } from './gemini'

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
 * الطويلة بتغرق الموديل وبتزوّد التكلفة على التاجر في كل سؤال.
 */

export type ToolKind = 'read' | 'write'

export type AgentTool = ToolDef & {
  kind: ToolKind
  /** وصف الإجراء بالعربي للتاجر قبل ما يوافق */
  describe: (args: Record<string, unknown>) => string
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const num = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : NaN
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
    name: 'search_products',
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
    description: 'أقسام المتجر. استخدمها قبل ما تضيف منتج عشان تحطّه في قسم موجود بدل ما تعمل قسم مكرّر.',
    parameters: { type: 'object', properties: {} },
    describe: () => 'قراءة الأقسام',
  },

  {
    kind: 'write',
    name: 'create_product',
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
    name: 'update_order_status',
    description: 'تغيير حالة طلب برقمه. ده بيبعت رسالة للعميل تلقائيًا.',
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
    description: 'تعديل بيانات المتجر الأساسية.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'اسم المتجر' },
        tagline: { type: 'string', description: 'الجملة التعريفية' },
        email: { type: 'string', description: 'بريد المتجر' },
        phone: { type: 'string', description: 'تليفون المتجر' },
      },
    },
    describe: (a) => {
      const parts = Object.entries(a)
        .filter(([, v]) => v)
        .map(([k]) => ({ name: 'الاسم', tagline: 'الجملة التعريفية', email: 'البريد', phone: 'التليفون' })[k] ?? k)
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
 * `storeId` بيتحط هنا من الجلسة لا من الموديل — لو سبناه للموديل،
 * كلمة في رسالة عميل كانت تخلّيه يكتب في متجر تاني.
 */
export async function executeTool(
  storeId: string,
  currency: string,
  call: { name: string; args: Record<string, unknown> },
): Promise<ExecResult> {
  const a = call.args

  switch (call.name) {
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

    case 'update_store_info': {
      const values: Record<string, unknown> = {}
      if (str(a.name)) values.name = str(a.name)
      if (str(a.tagline)) values.tagline = str(a.tagline)
      if (str(a.email)) values.email = str(a.email)
      if (str(a.phone)) values.phone = str(a.phone)

      if (Object.keys(values).length === 0) return { ok: false, error: 'مفيش حاجة تتعدّل' }

      await db.update(stores).set(values).where(eq(stores.id, storeId))
      return { ok: true, summary: 'بيانات المتجر اتحدّثت' }
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
