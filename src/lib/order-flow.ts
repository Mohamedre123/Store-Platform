import 'server-only'
import { and, eq, ne, sql } from 'drizzle-orm'
import { db } from '@/db'
import {
  customers,
  inventoryMovements,
  orderEvents,
  orderItems,
  orders,
  products,
  productVariants,
  shipments,
  stores,
} from '@/db/schema'
import { recordAudit } from '@/lib/audit'
import { getStoreTheme } from '@/lib/storefront'
import { isEmailConfigured, safeReplyTo, sendEmail } from '@/lib/email'
import { isEmailableStatus, orderStatusEmail } from '@/lib/store-emails'
import { publicStoreUrl } from '@/lib/domain'
import { awardOrderPoints } from '@/lib/loyalty'
import { rewardReferralForOrder } from '@/lib/referrals'
import { approveAffiliateCommission, cancelAffiliateCommission } from '@/lib/affiliates'
import { dispatchWebhook } from '@/lib/webhooks'
import { runAutomations } from '@/lib/automation'
import { shipmentStatusMeta, type ShipmentStatus } from '@/lib/carriers'
import { queueShipmentForOrder } from '@/lib/shipment-dispatch'
import { notifyTeam } from '@/lib/notify-team'
import { whatsappOrderStatus } from '@/lib/order-whatsapp'
import { after } from 'next/server'
import type { OrderStatus } from '@/db/schema'
import {
  normalizeChannel,
  resolveChannel,
  wantsEmail,
  wantsWhatsapp,
  type NotifyChannel,
} from '@/lib/notify-channel'

/**
 * تحوّلات حالة الطلب والشحنة — بمعزل عن جلسة التاجر.
 *
 * **ليه مش في `actions.ts` زي ما كانت؟** لأن اللي بيغيّر الحالة مش
 * التاجر بس: بوابة الدفع بتأكّد الدفع، وشركة الشحن بتقول «اتسلّم».
 * دول بينادوا من مسار ويب هوك مالوش جلسة ولا كوكي، و`getDashboardContext`
 * بيوجّه على `/login` — يعني كل إشعار من الشركة كان هيقع.
 *
 * فالمنطق كله هنا، بياخد `storeId` صراحةً ومين بيعمل الإجراء. وفعل
 * اللوحة بقى غلاف رفيع بيجيب السياق ويناديه.
 *
 * الفايدة التانية إن **مسار واحد بس** بيصرف نقاط الولاء وعمولة
 * المسوّق ويبعت رسايل الحالة. لو الويب هوك كان بيكتب في `orders`
 * مباشرة، الطلب كان بيتعلّم «اتسلّم» والنقاط ما تتصرفش.
 */

export type Actor =
  | { type: 'merchant'; userId: string }
  /** البوابة أو شركة الشحن — مفيش مستخدم وراه */
  | { type: 'system'; label: string }

const LABELS: Record<OrderStatus, string> = {
  incomplete: 'ناقص',
  pending: 'قيد الانتظار',
  confirmed: 'مؤكّد',
  processing: 'بيتجهّز',
  shipped: 'اتشحن',
  delivered: 'اتسلّم',
  cancelled: 'ملغي',
  returned: 'مرتجع',
}

type FlowStore = {
  id: string
  name: string
  slug: string
  logoLight: string | null
  /** بريد التاجر — بيتحط كـReply-To في رسايل العملاء */
  email?: string | null
  /**
   * نطاق التاجر لو ربطه — روابط التتبّع بتتبني عليه.
   *
   * الرابط بالنطاق الفرعي بتاعنا بيوصل لعميل التاجر وبيوريه اسمنا
   * مكان اسمه، وده بالظبط اللي التاجر ربط نطاقه عشان يمنعه.
   */
  customDomain?: string | null
  customDomainVerifiedAt?: Date | null
}

/** بيانات المتجر اللي التحوّلات محتاجاها — للمسارات اللي مالهاش سياق لوحة */
export async function loadFlowStore(storeId: string): Promise<FlowStore | null> {
  const [row] = await db
    .select({
      id: stores.id,
      name: stores.name,
      slug: stores.slug,
      logoLight: stores.logoLight,
      email: stores.email,
      customDomain: stores.customDomain,
      customDomainVerifiedAt: stores.customDomainVerifiedAt,
    })
    .from(stores)
    .where(eq(stores.id, storeId))
    .limit(1)

  return row ?? null
}

/**
 * تغيير حالة الطلب.
 *
 * الإلغاء والإرجاع بيرجّعوا الكمية للمخزون. من غير كده التاجر بيلاقي
 * مخزونه ناقص بسبب طلبات اتلغت — ومحدش بيلاحظ غير لما يقف عن البيع.
 */
export async function applyOrderStatus(
  store: FlowStore,
  orderId: string,
  status: OrderStatus,
  actor: Actor,
  /**
   * القناة اللي التاجر اختارها لحظة الضغط.
   *
   * الافتراضي «الاتنين» عن قصد: الويب هوك من بوابة الدفع وشركة
   * الشحن بينادي نفس الدالة ومالوش تاجر يختار — والعميل ساعتها لازم
   * يتبلّغ بكل طريق متاح.
   */
  channel: NotifyChannel = 'auto',
): Promise<void> {
  const requested = normalizeChannel(channel)
  const [order] = await db
    .select({
      id: orders.id,
      status: orders.status,
      orderNumber: orders.orderNumber,
      customerName: orders.customerName,
      customerEmail: orders.customerEmail,
      customerPhone: orders.customerPhone,
      total: orders.total,
      currency: orders.currency,
      recoveryToken: orders.recoveryToken,
      customerId: orders.customerId,
      trackingNumber: orders.trackingNumber,
      shippingCarrier: orders.shippingCarrier,
      shippingAddress: orders.shippingAddress,
    })
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.storeId, store.id)))
    .limit(1)

  if (!order || order.status === status) return

  const restocking = ['cancelled', 'returned'].includes(status)
  const wasCounted = !['cancelled', 'returned', 'incomplete'].includes(order.status)

  /**
   * الانتقال بيتقفل على مستوى قاعدة البيانات لا في الذاكرة.
   *
   * الحارس فوق (`order.status === status`) بيقرا وبعدين يكتب، ومفيش
   * حاجة بينهم. ضغطتين على «بيتجهّز» في نفس اللحظة بيقروا الاتنين
   * «مؤكّد»، فيعدّوا الاتنين، ويتبعت إيميلين لنفس العميل عن نفس
   * الخطوة — وده ظهر فعلًا في سجل الرسايل: نفس الطلب ونفس الحدث
   * مرتين بفارق أربع دقايق.
   *
   * وأخطر منه في الإلغاء: الاتنين بيرجّعوا المخزون، فالكمية بتتزوّد
   * الضِّعف وتفضل غلط من غير ما حد ياخد باله.
   *
   * الشرط `ne(status)` بيخلّي التحديث نفسه هو القفل: أول واحد بيغيّر
   * صفًّا، والتاني بيرجع صفر صفوف فبيقف قبل أي أثر جانبي.
   */
  let applied = false

  await db.transaction(async (tx) => {
    const changed = await tx
      .update(orders)
      .set({
        status,
        isIncomplete: status === 'incomplete',
        confirmedAt: status === 'confirmed' ? new Date() : undefined,
        deliveredAt: status === 'delivered' ? new Date() : undefined,
        paymentStatus: status === 'delivered' ? 'paid' : undefined,
      })
      .where(
        and(eq(orders.id, orderId), eq(orders.storeId, store.id), ne(orders.status, status)),
      )
      .returning({ id: orders.id })

    if (changed.length === 0) return
    applied = true

    if (restocking && wasCounted) {
      const items = await tx
        .select({
          productId: orderItems.productId,
          variantId: orderItems.variantId,
          quantity: orderItems.quantity,
        })
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId))

      for (const item of items) {
        if (!item.productId) continue

        /**
         * الترجيع لازم يروح لنفس المكان اللي اتخصم منه.
         *
         * لو الطلب كان على متغيّر والترجيع راح للمنتج، مخزون «أحمر XL»
         * يفضل ناقص ومخزون المنتج العام يزيد بالغلط — رقمين غلط بضربة
         * واحدة.
         */
        if (item.variantId) {
          await tx
            .update(productVariants)
            .set({ stock: sql`${productVariants.stock} + ${item.quantity}` })
            .where(
              and(eq(productVariants.id, item.variantId), eq(productVariants.storeId, store.id)),
            )
        } else {
          await tx
            .update(products)
            .set({ stock: sql`${products.stock} + ${item.quantity}` })
            .where(and(eq(products.id, item.productId), eq(products.storeId, store.id)))
        }

        await tx
          .update(products)
          .set({ soldCount: sql`greatest(0, ${products.soldCount} - ${item.quantity})` })
          .where(and(eq(products.id, item.productId), eq(products.storeId, store.id)))

        await tx.insert(inventoryMovements).values({
          storeId: store.id,
          productId: item.productId,
          variantId: item.variantId,
          delta: item.quantity,
          reason: status === 'returned' ? 'return' : 'cancel',
          referenceId: orderId,
          note: `طلب رقم ${order.orderNumber}`,
        })
      }
    }

    await tx.insert(orderEvents).values({
      orderId,
      storeId: store.id,
      type: 'status_changed',
      message:
        actor.type === 'system'
          ? `الحالة اتغيّرت إلى «${LABELS[status]}» — تلقائيًا من ${actor.label}`
          : `الحالة اتغيّرت إلى «${LABELS[status]}»`,
      actorType: actor.type === 'system' ? 'system' : 'merchant',
      actorId: actor.type === 'merchant' ? actor.userId : null,
    })
  })

  await recordAudit({
    storeId: store.id,
    userId: actor.type === 'merchant' ? actor.userId : null,
    action: status === 'cancelled' ? 'order.cancel' : 'order.status_change',
    resource: 'order',
    resourceId: order.id,
    before: { status: order.status },
    after: { status, by: actor.type === 'system' ? actor.label : 'merchant' },
  })

  /**
   * الطلب المؤكّد بيروح لشركة الشحن لوحده.
   *
   * هنا لا في مكان تاني، عشان يشتغل مع التلات مسارات بنفس الطريقة:
   * التاجر بيأكّد بإيده، والبوابة بتأكّد بعد الدفع، والمساعد بيأكّد
   * من الشات. والدالة بتتأكد إن الطلب مالوش شحنة قبل ما تعمل واحدة،
   * فالتأكيد مرتين ما بيعملش بوليصتين.
   *
   * بغير await: الشيك أوت واللوحة ما يصحّش يستنّوا API شركة شحن.
   */
  if (status === 'confirmed') {
    void queueShipmentForOrder(store.id, order.id).catch((e) =>
      console.error('فشل تسجيل الشحنة تلقائيًا:', e),
    )
  }

  /**
   * نقاط الولاء عند التسليم لا عند الطلب.
   *
   * لو منحناها عند الطلب، عميل يطلب ويلغي عشرين مرة يطلع بنقاط من غير
   * ما يشتري حاجة. والدالة نفسها بتتأكد إن الطلب ما اتمنحش قبل كده،
   * فتغيير الحالة ذهابًا وإيابًا ما يمنحش مرتين.
   */
  if (status === 'delivered' && order.customerId) {
    try {
      await awardOrderPoints({
        storeId: store.id,
        customerId: order.customerId,
        orderId: order.id,
        orderTotal: order.total,
        orderNumber: order.orderNumber,
      })
    } catch (e) {
      console.error('فشل منح نقاط الولاء:', e)
    }

    try {
      await rewardReferralForOrder(store.id, order.id)
    } catch (e) {
      console.error('فشل صرف نقاط الإحالة:', e)
    }
  }

  if (status === 'delivered' || status === 'cancelled') {
    void (async () => {
      let customerOrders = 0
      let customerSpent = 0
      if (order.customerId) {
        const [c] = await db
          .select({ ordersCount: customers.ordersCount, totalSpent: customers.totalSpent })
          .from(customers)
          .where(eq(customers.id, order.customerId))
          .limit(1)
        customerOrders = c?.ordersCount ?? 0
        customerSpent = c?.totalSpent ?? 0
      }

      runAutomations(status === 'delivered' ? 'order.delivered' : 'order.cancelled', {
        storeId: store.id,
        storeName: store.name,
        storeSlug: store.slug,
        storeDomain: store.customDomain,
        storeDomainVerifiedAt: store.customDomainVerifiedAt,
        currency: order.currency,
        orderId: order.id,
        orderNumber: order.orderNumber,
        orderTotal: order.total,
        customerId: order.customerId ?? undefined,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        customerOrders,
        customerSpent,
        recoveryToken: order.recoveryToken,
      })
    })().catch((e) => console.error('فشل محفّز الأتمتة:', e))
  }

  /*
    الفريق بيتبلّغ بتغيّر الحالة زي ما بيتبلّغ بالطلب الجديد.

    أهمها «اتلغى»: الطلب اللي بيتلغي بعد ما اتغلّف بيرجع بضاعة
    للمخزن ومصاريف شحن على التاجر — واللي بيعرف بيه بدري بيوقّف
    الشحنة قبل ما تخرج.
  */
  const TEAM_EVENT: Partial<Record<OrderStatus, Parameters<typeof notifyTeam>[0]>> = {
    confirmed: 'order_confirmed',
    shipped: 'order_shipped',
    delivered: 'order_delivered',
    cancelled: 'order_cancelled',
  }
  const teamEvent = TEAM_EVENT[status]
  if (teamEvent) {
    notifyTeam(teamEvent, {
      storeId: store.id,
      storeName: store.name,
      orderId: order.id,
      orderNumber: order.orderNumber,
      total: order.total,
      currency: order.currency,
      customerName: order.customerName,
    })
  }

  dispatchWebhook(store.id, 'order.status_changed', {
    orderId: order.id,
    orderNumber: order.orderNumber,
    from: order.status,
    to: status,
  })
  if (status === 'delivered') {
    dispatchWebhook(store.id, 'order.delivered', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      total: order.total,
    })
  } else if (status === 'cancelled') {
    dispatchWebhook(store.id, 'order.cancelled', {
      orderId: order.id,
      orderNumber: order.orderNumber,
    })
  }

  try {
    if (status === 'delivered') await approveAffiliateCommission(order.id)
    else if (restocking) await cancelAffiliateCommission(order.id)
  } catch (e) {
    console.error('فشل تحديث عمولة المسوّق:', e)
  }

  /**
   * إشعار العميل بالحالة الجديدة.
   *
   * برّه المعاملة وبغير await: العميل لازم يتبلّغ، بس لو البريد وقع
   * الحالة تفضل متغيّرة — الحالة اتغيّرت فعلًا والمخزون اتعدّل.
   */
  /**
   * «تلقائي» بيتحوّل لقناة حقيقية حسب اللي على الطلب.
   *
   * العميل سجّل دخوله برقمه أو ببريده، والطلب حافظ الاتنين. الإرسال
   * على الاتنين دايمًا معناه رسالة على بريد فاضي — أو إزعاج مضاعف
   * لواحد الاتنين بيوصلوه.
   */
  const notify = resolveChannel(requested, {
    phone: Boolean(order.customerPhone),
    email: Boolean(order.customerEmail),
  })

  if (wantsEmail(notify) && order.customerEmail && isEmailableStatus(status) && isEmailConfigured()) {
    void (async () => {
      const theme = await getStoreTheme(store.id)
      const storeEmail = store.email

      /*
        أصناف الطلب بتتقرا هنا لا في القالب.

        الرسايل اللي بتوصل الوارد عندنا كلها فيها محتوى حقيقي —
        أصناف وأسعار وعنوان. واللي كان بيروح السبام أرفعهم: سطرين
        ورقم. والاستعلام ده رخيص وبيتعمل مرة لكل تغيير حالة.
      */
      const lines = await db
        .select({
          name: orderItems.name,
          quantity: orderItems.quantity,
          total: orderItems.total,
          options: orderItems.options,
        })
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id))

      const addr = order.shippingAddress
      const address =
        [addr?.city, addr?.area, addr?.street, addr?.building].filter(Boolean).join(' — ') || null

      const mail = orderStatusEmail(
        { name: store.name, logo: store.logoLight, primary: theme.custom.identity.primary, email: store.email, slug: store.slug },
        status,
        {
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          total: order.total,
          currency: order.currency,
          trackingNumber: order.trackingNumber,
          carrier: order.shippingCarrier,
          trackUrl: `${publicStoreUrl(store)}/order/${order.orderNumber}?t=${encodeURIComponent(order.recoveryToken ?? '')}`,
          lines,
          address,
        },
      )
      await sendEmail({
        to: order.customerEmail!,
        ...mail,
        // الرد على التاجر — العميل بيرد على رسالة الحالة كتير
        replyTo: safeReplyTo(storeEmail),
        // الرسالة بتيجي باسم متجره لا باسمنا
        sender: { name: store.name, slug: store.slug },
        log: {
          storeId: store.id,
          event: `order_${status}`,
          orderId: order.id,
          customerId: order.customerId ?? undefined,
        },
      })
    })().catch((e) => console.error('فشل إرسال بريد حالة الطلب:', e))
  }

  /**
   * وواتساب — للعميل اللي مساب بريده.
   *
   * ده مش بديل للبريد، ده الطريق الوحيد لجزء كبير من العملاء:
   * الشراء من الموبايل بيسيب خانة البريد فاضية غالبًا، والرقم
   * مطلوب في الطلب أصلًا. من غير ده، العميل ما بيعرفش إن طلبه
   * اتشحن إلا لو فتح المتجر بنفسه.
   *
   * بيسكت لو الواتساب مش مربوط — الحالة اتغيّرت فعلًا ومينفعش
   * إشعار يوقّعها.
   */
  if (wantsWhatsapp(notify) && order.customerPhone) {
    const sending = whatsappOrderStatus(store, {
      orderNumber: order.orderNumber,
      orderId: order.id,
      customerName: order.customerName,
      phone: order.customerPhone,
      status,
      trackUrl: `${publicStoreUrl(store)}/order/${order.orderNumber}?t=${encodeURIComponent(order.recoveryToken ?? '')}`,
    }).catch((e) => console.error('فشل إرسال واتساب حالة الطلب:', e))

    try {
      after(sending)
    } catch {
      void sending
    }
  }
}

/**
 * تحديث حالة الشحنة.
 *
 * كل تحديث بيتضاف لسجل الشحنة مش بيستبدل الحالة بس — التاجر بيحتاج
 * يعرف الشحنة فضلت قد إيه في كل مرحلة لما يقيّم شركة الشحن.
 *
 * التسليم والرجوع بيتنقلوا للطلب: من غير كده الطلب يفضل «اتشحن»
 * بعد ما العميل استلم، ونقاط الولاء وعمولة المسوّق ما تتصرفش.
 */
export async function applyShipmentStatus(
  store: FlowStore,
  shipmentId: string,
  status: ShipmentStatus,
  actor: Actor,
  note?: string,
  carrierStatus?: string,
): Promise<{ ok?: boolean; error?: string }> {
  const [row] = await db
    .select({ id: shipments.id, orderId: shipments.orderId, status: shipments.status })
    .from(shipments)
    .where(and(eq(shipments.id, shipmentId), eq(shipments.storeId, store.id)))
    .limit(1)

  if (!row) return { error: 'الشحنة مش موجودة' }
  if (row.status === status) return { ok: true }

  const event = { at: new Date().toISOString(), status, note: note?.trim() || undefined }

  await db.transaction(async (tx) => {
    await tx
      .update(shipments)
      .set({
        status,
        carrierStatus: carrierStatus ?? undefined,
        // الإضافة في SQL لا في الذاكرة: قراءة السجل وكتابته تاني كانت
        // هتضيّع أي حدث اتسجّل بينهم
        events: sql`${shipments.events} || ${JSON.stringify([event])}::jsonb`,
      })
      .where(eq(shipments.id, shipmentId))

    await tx.insert(orderEvents).values({
      orderId: row.orderId,
      storeId: store.id,
      type: 'status_changed',
      message: `الشحنة: ${shipmentStatusMeta(status).label}${note ? ` — ${note}` : ''}`,
      actorType: actor.type === 'system' ? 'system' : 'merchant',
      actorId: actor.type === 'merchant' ? actor.userId : null,
    })
  })

  /*
    حالة الشحنة بتتحوّل لحالة الطلب — والعميل بيتبلّغ.

    ## ليه `picked_up` و`in_transit` اتضافوا
    كان الطلب بيتحرّك عند «اتسلّم» و«رجع» بس. يعني الشحنة تخرج من
    المخزن وتفضل يومين في الطريق، والعميل شايف طلبه «قيد التجهيز»
    وبيسأل التاجر «فين طلبي؟» — وهي أكتر لحظة بيسأل فيها أصلًا.

    خروج الشحنة هو الخبر اللي مستنيه، ورسالة «طلبك في الطريق»
    بتشيل المكالمة دي من على التاجر.

    ## و`applyOrderStatus` بتتخطّى المكرّر
    `in_transit` بيتبعت أكتر من مرة من بعض الشركات، والدالة بتخرج
    من غير ما تعمل حاجة لو الحالة زي ما هي — فالعميل ما بيتبعتلوش
    «طلبك اتشحن» تلات مرات.
  */
  if (status === 'delivered') await applyOrderStatus(store, row.orderId, 'delivered', actor)
  else if (status === 'returned') await applyOrderStatus(store, row.orderId, 'returned', actor)
  else if (status === 'picked_up' || status === 'in_transit' || status === 'out_for_delivery') {
    await applyOrderStatus(store, row.orderId, 'shipped', actor)
  }

  return { ok: true }
}
