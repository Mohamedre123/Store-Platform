import 'server-only'
import { and, eq, inArray, ne, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { customers, orders } from '@/db/schema'

/**
 * ربط رقم العميل ببريده في حساب واحد.
 *
 * ## المشكلة
 * العميل بيطلب برقمه النهارده وببريده بعد شهر، فبيبقى عنده **حسابين
 * في نفس المتجر**: كل واحد فيه نص طلباته، ونقاط الولاء متقسّمة، وهو
 * بيفتح «طلباتي» ويلاقي نصّها ضايع ويكلّم التاجر يشتكي.
 *
 * ## الربط بيحصل لما نتأكد إنه هو
 * **مش بنربط على أساس إن حد كتب بريدًا في خانة.** بنربط لما العميل
 * يثبت إنه بيستقبل على الوسيلة دي:
 *
 * - أكّد رمز الدخول عليها → أكيد بيستقبل عليها
 * - سجّل دخوله بوسيلة وكتب التانية في طلب اتأكّد → الطلب نفسه إثبات
 *
 * لو ربطنا من غير إثبات، حد يكتب بريد شخص تاني في الشيك أوت ويورّث
 * نفسه طلباته.
 *
 * ## العزل بين المتاجر مطلق
 * كل استعلام هنا مقيّد بـ`storeId`، والجدول نفسه مفهرس
 * `(storeId, phone)` و`(storeId, email)`. عميل عند تاجر A مالوش أي
 * وجود عند تاجر B حتى لو نفس الرقم ونفس البريد — والربط بيحصل
 * **جوّه المتجر الواحد بس**. ده مش تفصيلة: بيانات عملاء تاجر ما
 * تصحّش تعدّي لتاجر تاني بأي حال.
 */

export type LinkResult = {
  customerId: string
  /** اندمج حسابان؟ بيتقال للعميل عشان ما يتفاجئش بطلبات ظهرت */
  merged: boolean
}

/**
 * بيلاقي حساب العميل بأي وسيلة، وبيدمج التاني لو لقيه.
 *
 * بيتنادى بعد التحقق من الرمز: الوسيلة اللي `verified` هي اللي
 * العميل أثبت إنه بيستقبل عليها.
 */
export async function linkCustomerIdentity(input: {
  storeId: string
  phone?: string | null
  email?: string | null
  name?: string | null
  /** الوسيلة اللي اتحقّق منها دلوقتي */
  verified: 'phone' | 'email'
}): Promise<LinkResult> {
  const phone = input.phone?.trim() || null
  const email = input.email?.trim().toLowerCase() || null

  /* الوسيلة المتحقَّق منها هي اللي بتحدّد الحساب الأساسي */
  const primaryValue = input.verified === 'phone' ? phone : email
  if (!primaryValue) throw new Error('الوسيلة المتحقَّق منها فاضية')

  const rows = await db
    .select({
      id: customers.id,
      phone: customers.phone,
      email: customers.email,
      ordersCount: customers.ordersCount,
      createdAt: customers.createdAt,
    })
    .from(customers)
    .where(
      and(
        eq(customers.storeId, input.storeId),
        or(
          phone ? eq(customers.phone, phone) : undefined,
          email ? eq(customers.email, email) : undefined,
        ),
      ),
    )

  /* مفيش حساب — نعمل واحدًا بالوسيلتين */
  if (rows.length === 0) {
    const [created] = await db
      .insert(customers)
      .values({
        storeId: input.storeId,
        phone,
        email,
        name: input.name || null,
        ...(input.verified === 'phone'
          ? { phoneVerifiedAt: new Date() }
          : { emailVerifiedAt: new Date() }),
      })
      .returning({ id: customers.id })

    return { customerId: created.id, merged: false }
  }

  /*
    الحساب اللي هيفضل: الأقدم.

    الأقدم غالبًا فيه تاريخ الطلبات والنقاط. لو خلّينا الأحدث هو
    الباقي، العميل بيخسر أقدم طلباته — وهي اللي بيدوّر عليها.
  */
  const sorted = [...rows].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  )
  const keep = sorted[0]
  const extras = sorted.slice(1)

  /**
   * **الحذف قبل الكتابة — والترتيب ده مش تفصيلة.**
   *
   * الفهرس `(store_id, email)` فريد. لو كتبنا البريد على الحساب
   * الباقي والحساب التاني لسه شايله، بوستجرس بترفض بـ٢٣٥٠٥ —
   * والعميل ما يقدرش يدخل خالص. اتأكدنا من ده عمليًا قبل النشر.
   *
   * فبنجمّع اللي هينتقل، نفضّي الحسابات الزيادة، وبعدين نكتب مرة
   * واحدة على الباقي.
   */
  const carry = {
    phone: keep.phone ?? phone ?? extras.find((e) => e.phone)?.phone ?? null,
    email: keep.email ?? email ?? extras.find((e) => e.email)?.email ?? null,
    ordersCount: extras.reduce((n, e) => n + e.ordersCount, 0),
  }

  /*
    الطلبات بتنتقل قبل الحذف: `customerId` عليها `set null` عند
    الحذف، فالترتيب المعكوس كان هيسيب طلبات بلا صاحب.
  */
  for (const extra of extras) {
    await db
      .update(orders)
      .set({ customerId: keep.id })
      .where(and(eq(orders.customerId, extra.id), eq(orders.storeId, input.storeId)))
  }

  if (extras.length) {
    await db.delete(customers).where(
      and(
        eq(customers.storeId, input.storeId),
        ne(customers.id, keep.id),
        inArray(
          customers.id,
          extras.map((e) => e.id),
        ),
      ),
    )
  }

  await db
    .update(customers)
    .set({
      phone: carry.phone,
      email: carry.email,
      ...(input.name ? { name: input.name } : {}),
      ...(carry.ordersCount
        ? { ordersCount: sql`${customers.ordersCount} + ${carry.ordersCount}` }
        : {}),
      ...(input.verified === 'phone'
        ? { phoneVerifiedAt: new Date() }
        : { emailVerifiedAt: new Date() }),
    })
    .where(and(eq(customers.id, keep.id), eq(customers.storeId, input.storeId)))

  return { customerId: keep.id, merged: extras.length > 0 }
}

/**
 * بيسجّل الوسيلة التانية على حساب العميل بعد طلب اتأكّد.
 *
 * العميل داخل برقمه وكتب بريده في الشيك أوت — الطلب ده إثبات كافي
 * إنه بيستخدم البريد ده. لما يدخل ببريده بعدين، `linkCustomerIdentity`
 * هتلاقي نفس الحساب بدل ما تعمل واحدًا جديدًا.
 *
 * **بس ما بيدهسش وسيلة موجودة.** لو الحساب عليه بريد وكتب بريدًا
 * تاني في الطلب (بريد صاحبه مثلًا)، الأصلي بيفضل — ده اللي هو
 * أثبت إنه بيستقبل عليه.
 */
export async function rememberContact(input: {
  storeId: string
  customerId: string
  phone?: string | null
  email?: string | null
}): Promise<void> {
  const phone = input.phone?.trim() || null
  const email = input.email?.trim().toLowerCase() || null
  if (!phone && !email) return

  const [current] = await db
    .select({ phone: customers.phone, email: customers.email })
    .from(customers)
    .where(and(eq(customers.id, input.customerId), eq(customers.storeId, input.storeId)))
    .limit(1)

  if (!current) return

  /**
   * كل وسيلة لوحدها — مش الاتنين في تحديث واحد.
   *
   * الرقم ممكن يكون فاضي والبريد مسجّل على حساب تاني. لو كتبناهم
   * مع بعض، تعارض البريد بيلغي كتابة الرقم كمان — والعميل بيفضل
   * بلا رقم على حسابه بلا سبب.
   *
   * والتعارض نفسه مش خطأ: الوسيلة مسجّلة على حساب تاني في نفس
   * المتجر، والدمج مكانه لحظة التحقق لا لحظة الطلب — لأن كتابة
   * حاجة في خانة مش إثبات ملكية.
   */
  const writes: Array<Record<string, string>> = []
  if (phone && !current.phone) writes.push({ phone })
  if (email && !current.email) writes.push({ email })

  for (const patch of writes) {
    try {
      await db
        .update(customers)
        .set(patch)
        .where(and(eq(customers.id, input.customerId), eq(customers.storeId, input.storeId)))
    } catch {
      /* الوسيلة على حساب تاني — بنسيبها، والدمج بيحصل وقت التحقق */
    }
  }
}
