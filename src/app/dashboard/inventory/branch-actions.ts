'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { inventoryLocations } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { recordAudit } from '@/lib/audit'
import { setBranchLevel, transferStock } from '@/lib/branches'

export type BranchState = { ok?: boolean; error?: string } | null

const branchSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, 'اكتب اسم الفرع').max(80),
  city: z.string().trim().max(80).optional(),
  address: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(30).optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

/**
 * حفظ فرع.
 *
 * **فرع افتراضي واحد بس.** الافتراضي هو اللي البيع بيخصم منه، ولو
 * بقى فيه اتنين، الخصم بيروح لواحد عشوائي والتاجر بيلاقي رقمين
 * ما بيتفقوش مع العدّ اليدوي ومش عارف ليه.
 */
export async function saveBranchAction(raw: unknown): Promise<BranchState> {
  const parsed = branchSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'بيانات ناقصة' }

  const { store, user } = await getDashboardContext()
  const input = parsed.data

  const values = {
    name: input.name,
    city: input.city || null,
    address: input.address || null,
    phone: input.phone || null,
    isDefault: input.isDefault ?? false,
    isActive: input.isActive ?? true,
  }

  await db.transaction(async (tx) => {
    if (values.isDefault) {
      await tx
        .update(inventoryLocations)
        .set({ isDefault: false })
        .where(eq(inventoryLocations.storeId, store.id))
    }

    if (input.id) {
      await tx
        .update(inventoryLocations)
        .set(values)
        .where(
          and(eq(inventoryLocations.id, input.id), eq(inventoryLocations.storeId, store.id)),
        )
    } else {
      await tx.insert(inventoryLocations).values({ ...values, storeId: store.id })
    }
  })

  await recordAudit({
    storeId: store.id,
    userId: user.id,
    action: 'settings.update',
    resource: 'inventory_location',
    resourceId: input.id,
    after: { name: values.name, isDefault: values.isDefault, isActive: values.isActive },
  })

  revalidatePath('/dashboard/inventory')
  return { ok: true }
}

/**
 * حذف فرع.
 *
 * الأرصدة اللي جوّاه بتتمسح معاه (cascade)، فبنمنع حذف الافتراضي:
 * من غيره الخصم عند البيع ما بيلاقيش فرعًا يروحله، والتوزيع كله
 * بيقف من غير ما التاجر ياخد باله.
 */
export async function deleteBranchAction(id: string): Promise<BranchState> {
  const { store, user } = await getDashboardContext()

  const [row] = await db
    .select({ isDefault: inventoryLocations.isDefault })
    .from(inventoryLocations)
    .where(and(eq(inventoryLocations.id, id), eq(inventoryLocations.storeId, store.id)))
    .limit(1)

  if (!row) return { error: 'الفرع مش موجود' }
  if (row.isDefault) return { error: 'ما ينفعش تمسح الفرع الافتراضي. خلّي فرعًا تاني افتراضيًا الأول.' }

  await db
    .delete(inventoryLocations)
    .where(and(eq(inventoryLocations.id, id), eq(inventoryLocations.storeId, store.id)))

  await recordAudit({
    storeId: store.id,
    userId: user.id,
    action: 'settings.update',
    resource: 'inventory_location',
    resourceId: id,
    after: { deleted: true },
  })

  revalidatePath('/dashboard/inventory')
  return { ok: true }
}

const levelSchema = z.object({
  locationId: z.string().uuid(),
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullable().optional(),
  available: z.coerce.number().int().min(0).max(1_000_000),
})

export async function setBranchLevelAction(raw: unknown): Promise<BranchState> {
  const parsed = levelSchema.safeParse(raw)
  if (!parsed.success) return { error: 'بيانات ناقصة' }

  const { store } = await getDashboardContext()
  const res = await setBranchLevel({ storeId: store.id, ...parsed.data })
  if (res.error) return res

  revalidatePath('/dashboard/inventory')
  return { ok: true }
}

const transferSchema = z.object({
  fromId: z.string().uuid(),
  toId: z.string().uuid(),
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullable().optional(),
  quantity: z.coerce.number().int().min(1).max(1_000_000),
  note: z.string().trim().max(200).optional(),
})

export async function transferStockAction(raw: unknown): Promise<BranchState> {
  const parsed = transferSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'بيانات ناقصة' }

  const { store, user } = await getDashboardContext()
  const res = await transferStock({ storeId: store.id, ...parsed.data })
  if (res.error) return res

  await recordAudit({
    storeId: store.id,
    userId: user.id,
    action: 'settings.update',
    resource: 'stock_transfer',
    resourceId: parsed.data.productId,
    after: { from: parsed.data.fromId, to: parsed.data.toId, quantity: parsed.data.quantity },
  })

  revalidatePath('/dashboard/inventory')
  return { ok: true }
}
