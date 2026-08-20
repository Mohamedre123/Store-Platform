'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { and, eq, ne } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { categories, products, inventoryMovements } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { recordAudit } from '@/lib/audit'
import { deleteImage } from '@/lib/storage'
import { suggestStoreSlug, toMinorUnits } from '@/lib/utils'
import { renderSeoSlug } from '@/lib/seo-template'

export type FormState = { error?: string; fieldErrors?: Record<string, string> } | null

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? '_')
    if (!out[key]) out[key] = issue.message
  }
  return out
}

/** رابط فريد داخل المتجر — يزوّد رقمًا لو الاسم مكرر */
async function uniqueSlug(storeId: string, base: string, table: 'products' | 'categories', excludeId?: string) {
  const root = base || 'item'
  let candidate = root

  for (let i = 2; i < 100; i++) {
    const t = table === 'products' ? products : categories
    const rows = await db
      .select({ id: t.id })
      .from(t)
      .where(
        excludeId
          ? and(eq(t.storeId, storeId), eq(t.slug, candidate), ne(t.id, excludeId))
          : and(eq(t.storeId, storeId), eq(t.slug, candidate)),
      )
      .limit(1)

    if (rows.length === 0) return candidate
    candidate = `${root}-${i}`
  }
  return `${root}-${Date.now()}`
}

/* ══════════════════════════ الأقسام ══════════════════════════ */

const categorySchema = z.object({
  name: z.string().trim().min(2, 'اكتب اسم القسم'),
  description: z.string().trim().optional(),
  image: z.string().trim().optional(),
  isActive: z.boolean(),
})

export async function saveCategoryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { store } = await getDashboardContext()
  const id = String(formData.get('id') ?? '') || null

  const parsed = categorySchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description') || undefined,
    image: formData.get('image') || undefined,
    isActive: formData.get('isActive') !== 'false',
  })

  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) }
  const data = parsed.data

  if (id) {
    await db
      .update(categories)
      .set({ name: data.name, description: data.description, image: data.image, isActive: data.isActive })
      // الفلترة بـstoreId مش بالـid وحده — وإلا يقدر تاجر يعدّل قسم تاجر تاني
      .where(and(eq(categories.id, id), eq(categories.storeId, store.id)))
  } else {
    await db.insert(categories).values({
      storeId: store.id,
      name: data.name,
      slug: await uniqueSlug(store.id, suggestStoreSlug(data.name), 'categories'),
      description: data.description,
      image: data.image,
      isActive: data.isActive,
    })
  }

  revalidatePath('/dashboard/products')
  redirect('/dashboard/products/categories')
}

export async function deleteCategoryAction(id: string) {
  const { store } = await getDashboardContext()
  // المنتجات ما تتمسحش مع القسم — بتفضل بلا قسم
  await db
    .update(products)
    .set({ categoryId: null })
    .where(and(eq(products.categoryId, id), eq(products.storeId, store.id)))

  await db.delete(categories).where(and(eq(categories.id, id), eq(categories.storeId, store.id)))
  revalidatePath('/dashboard/products')
}

/* ══════════════════════════ المنتجات ══════════════════════════ */

const productSchema = z.object({
  name: z.string().trim().min(2, 'اكتب اسم المنتج'),
  description: z.string().trim().optional(),
  categoryId: z.string().trim().optional(),
  price: z.string().min(1, 'اكتب السعر'),
  compareAtPrice: z.string().optional(),
  costPrice: z.string().optional(),
  sku: z.string().trim().optional(),
  brand: z.string().trim().max(60).optional(),
  seoTitle: z.string().trim().max(200).optional(),
  seoSlug: z.string().trim().max(200).optional(),
  seoDescription: z.string().trim().max(400).optional(),
  stock: z.string().optional(),
  trackInventory: z.boolean(),
  status: z.enum(['draft', 'active']),
  images: z.array(z.string()).default([]),
})

export async function saveProductAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { store } = await getDashboardContext()
  const id = String(formData.get('id') ?? '') || null

  const parsed = productSchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description') || undefined,
    categoryId: formData.get('categoryId') || undefined,
    price: formData.get('price'),
    compareAtPrice: formData.get('compareAtPrice') || undefined,
    costPrice: formData.get('costPrice') || undefined,
    sku: formData.get('sku') || undefined,
    brand: formData.get('brand') || undefined,
    seoTitle: formData.get('seoTitle') || undefined,
    seoSlug: formData.get('seoSlug') || undefined,
    seoDescription: formData.get('seoDescription') || undefined,
    stock: formData.get('stock') || undefined,
    trackInventory: formData.get('trackInventory') !== 'false',
    status: formData.get('status') === 'active' ? 'active' : 'draft',
    images: JSON.parse(String(formData.get('images') ?? '[]')) as string[],
  })

  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) }
  const d = parsed.data

  const price = toMinorUnits(d.price)
  if (price <= 0) return { fieldErrors: { price: 'السعر لازم يكون أكبر من صفر' } }

  const compareAt = d.compareAtPrice ? toMinorUnits(d.compareAtPrice) : null
  if (compareAt !== null && compareAt > 0 && compareAt <= price) {
    return { fieldErrors: { compareAtPrice: 'السعر قبل الخصم لازم يكون أكبر من السعر الحالي' } }
  }

  const stock = d.stock ? Math.max(0, Math.trunc(Number(d.stock) || 0)) : 0

  // اسم القسم — عشان {Category} في قالب الرابط يتحلّ
  let categoryName: string | null = null
  if (d.categoryId) {
    const [c] = await db
      .select({ name: categories.name })
      .from(categories)
      .where(and(eq(categories.id, d.categoryId), eq(categories.storeId, store.id)))
      .limit(1)
    categoryName = c?.name ?? null
  }

  const seoCtx = {
    name: d.name,
    category: categoryName,
    brand: d.brand ?? null,
    sku: d.sku ?? null,
    price: `${d.price} ${store.currency}`,
    store: store.name,
  }

  const values = {
    name: d.name,
    description: d.description,
    categoryId: d.categoryId || null,
    price,
    compareAtPrice: compareAt && compareAt > 0 ? compareAt : null,
    costPrice: d.costPrice ? toMinorUnits(d.costPrice) : null,
    sku: d.sku,
    brand: d.brand || null,
    /*
      العنوان والوصف بيتحفظوا **كقوالب** زي ما التاجر كتبهم — بيتحلّوا
      وقت العرض. لو حفظنا النص المحلول، تغيير اسم المنتج بعد شهر كان
      هيسيب العنوان على الاسم القديم من غير ما حد ياخد باله.
    */
    seoTitle: d.seoTitle || null,
    seoDescription: d.seoDescription || null,
    stock,
    trackInventory: d.trackInventory,
    status: d.status,
    images: d.images,
    publishedAt: d.status === 'active' ? new Date() : null,
  }

  if (id) {
    const [before] = await db
      .select({ stock: products.stock, slug: products.slug })
      .from(products)
      .where(and(eq(products.id, id), eq(products.storeId, store.id)))
      .limit(1)

    if (!before) return { error: 'المنتج مش موجود' }

    /*
      الرابط بيتغيّر بس لو التاجر كتبه بنفسه بالفعل.
      تغييره تلقائيًا مع كل تعديل اسم كان هيكسر كل لينك اتبعت على
      واتساب أو اتفهرس في جوجل — والتاجر ما يعرفش غير من شكوى عميل.
    */
    const slugUpdate =
      d.seoSlug && d.seoSlug !== before.slug
        ? { slug: await uniqueSlug(store.id, renderSeoSlug(d.seoSlug, seoCtx), 'products', id) }
        : {}

    await db
      .update(products)
      .set({ ...values, ...slugUpdate })
      .where(and(eq(products.id, id), eq(products.storeId, store.id)))

    // أي تعديل يدوي على الكمية يتسجّل — عشان سؤال «المخزون راح فين؟» يبقى له إجابة
    if (before.stock !== stock) {
      await db.insert(inventoryMovements).values({
        storeId: store.id,
        productId: id,
        delta: stock - before.stock,
        reason: 'manual',
        note: 'تعديل من صفحة المنتج',
      })
    }
  } else {
    const [created] = await db
      .insert(products)
      .values({
        ...values,
        storeId: store.id,
        slug: await uniqueSlug(
          store.id,
          d.seoSlug ? renderSeoSlug(d.seoSlug, seoCtx) : suggestStoreSlug(d.name),
          'products',
        ),
      })
      .returning({ id: products.id })

    if (stock > 0) {
      await db.insert(inventoryMovements).values({
        storeId: store.id,
        productId: created.id,
        delta: stock,
        reason: 'restock',
        note: 'الكمية الأولى عند إضافة المنتج',
      })
    }
  }

  revalidatePath('/dashboard/products')
  redirect('/dashboard/products')
}

export async function deleteProductAction(id: string) {
  const { store, user } = await getDashboardContext()

  const [product] = await db
    .select({ images: products.images, name: products.name, price: products.price })
    .from(products)
    .where(and(eq(products.id, id), eq(products.storeId, store.id)))
    .limit(1)

  if (!product) return

  await db.delete(products).where(and(eq(products.id, id), eq(products.storeId, store.id)))

  await recordAudit({
    storeId: store.id,
    userId: user.id,
    action: 'product.delete',
    resource: 'product',
    resourceId: id,
    before: { name: product.name, price: product.price },
  })

  // تنظيف الصور بعد حذف الصف — لو فشل الحذف ما نبقاش مسحنا صور منتج موجود
  for (const url of product.images) {
    await deleteImage(store.id, url).catch(() => undefined)
  }

  revalidatePath('/dashboard/products')
}

export async function toggleProductStatusAction(id: string) {
  const { store } = await getDashboardContext()

  const [product] = await db
    .select({ status: products.status })
    .from(products)
    .where(and(eq(products.id, id), eq(products.storeId, store.id)))
    .limit(1)

  if (!product) return

  const next = product.status === 'active' ? 'draft' : 'active'
  await db
    .update(products)
    .set({ status: next, publishedAt: next === 'active' ? new Date() : null })
    .where(and(eq(products.id, id), eq(products.storeId, store.id)))

  revalidatePath('/dashboard/products')
}
