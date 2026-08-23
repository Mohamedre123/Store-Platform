import 'server-only'
import { and, eq, gte, lt, ne } from 'drizzle-orm'
import { db } from '@/db'
import { bookings, products, stores } from '@/db/schema'
import { DEFAULT_HOURS, type Slot } from './bookings-meta'

/*
  الثوابت المشتركة في bookings-meta — الملف ده server-only،
  وشاشات المتصفح محتاجة نفس الأسماء والحالات.
*/
export * from './bookings-meta'

/**
 * الحجوزات والمواعيد.
 *
 * المتجر اللي بيبيع خدمة (قص شعر، جلسة تصوير، صيانة) مش بيبيع
 * قطعة — بيبيع **وقت**. والوقت مخزون من نوع تاني: المقعد اللي
 * اتحجز الساعة ٥ مش متاح لحد تاني الساعة ٥، لكنه متاح الساعة ٦.
 *
 * القاعدة الحاكمة هنا: **المواعيد المتاحة بتتحسب على الخادم لا في
 * المتصفح.** لو المتصفح حسبها، اتنين يفتحوا الصفحة في نفس اللحظة
 * ويحجزوا نفس المعاد — والتاجر يلاقي عميلين على الباب.
 */

function parseTime(v: string): number {
  const [h, m] = v.split(':').map(Number)
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0)
}

/**
 * المواعيد المتاحة ليوم معيّن.
 *
 * **بيستبعد اللي فات.** عرض معاد الساعة ٩ الصبح والساعة دلوقتي ١١
 * بيخلّي العميل يحجزه ويكتشف إنه راح — والتاجر بيتصل يعتذر.
 *
 * والملغي مش بيحجز مكانًا: المعاد اللي اتلغى بيرجع متاح فورًا، وده
 * فرق حقيقي في اليوم اللي فيه إلغاءات.
 */
export async function availableSlots(input: {
  storeId: string
  productId: string
  /** yyyy-mm-dd بتوقيت المتجر */
  date: string
}): Promise<Slot[]> {
  const [store] = await db
    .select({ hours: stores.bookingHours, enabled: stores.bookingsEnabled })
    .from(stores)
    .where(eq(stores.id, input.storeId))
    .limit(1)

  if (!store?.enabled) return []

  const [product] = await db
    .select({ duration: products.bookingDuration, type: products.type })
    .from(products)
    .where(and(eq(products.id, input.productId), eq(products.storeId, input.storeId)))
    .limit(1)

  if (!product || product.type !== 'service') return []

  const hours = { ...DEFAULT_HOURS, ...(store.hours ?? {}) }

  const dayStart = new Date(`${input.date}T00:00:00`)
  if (Number.isNaN(dayStart.getTime())) return []
  if (!hours.days.includes(dayStart.getDay())) return []

  const open = parseTime(hours.from)
  const close = parseTime(hours.to)
  const step = Math.max(15, hours.slotMinutes)
  const duration = Math.max(15, product.duration)

  const dayEnd = new Date(dayStart)
  dayEnd.setDate(dayEnd.getDate() + 1)

  /*
    الحجوزات القايمة لنفس الخدمة في اليوم ده.
    الملغي والغياب مستبعدين — المعاد بتاعهم رجع متاح.
  */
  const taken = await db
    .select({ startsAt: bookings.startsAt, endsAt: bookings.endsAt })
    .from(bookings)
    .where(
      and(
        eq(bookings.storeId, input.storeId),
        eq(bookings.productId, input.productId),
        gte(bookings.startsAt, dayStart),
        lt(bookings.startsAt, dayEnd),
        ne(bookings.status, 'cancelled'),
      ),
    )

  const now = Date.now()
  const slots: Slot[] = []

  for (let minute = open; minute + duration <= close; minute += step) {
    const start = new Date(dayStart)
    start.setMinutes(minute)
    const end = new Date(start.getTime() + duration * 60_000)

    // اللي فات مش بيتعرض أصلًا
    if (start.getTime() <= now) continue

    const clash = taken.some(
      (b) => start < new Date(b.endsAt) && end > new Date(b.startsAt),
    )

    slots.push({
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      label: start.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      available: !clash,
    })
  }

  return slots
}

/**
 * يسجّل الحجز مع الطلب.
 *
 * بيتأكّد إن المعاد لسه فاضي **جوّه نفس اللحظة**: العميل ممكن يكون
 * فاتح الصفحة من عشر دقايق وحد تاني حجز في الوقت ده. من غير الفحص
 * ده، الاتنين بيحجزوا والتاجر بيكتشف على الباب.
 */
export async function createBooking(input: {
  storeId: string
  orderId: string
  productId: string
  customerId?: string | null
  customerName?: string | null
  customerPhone?: string | null
  startsAt: string
  notes?: string | null
}): Promise<{ ok: boolean; error?: string }> {
  const start = new Date(input.startsAt)
  if (Number.isNaN(start.getTime())) return { ok: false, error: 'معاد غير صحيح' }

  const [product] = await db
    .select({ duration: products.bookingDuration })
    .from(products)
    .where(and(eq(products.id, input.productId), eq(products.storeId, input.storeId)))
    .limit(1)

  if (!product) return { ok: false, error: 'الخدمة مش موجودة' }

  const end = new Date(start.getTime() + Math.max(15, product.duration) * 60_000)

  const dayStart = new Date(start)
  dayStart.setHours(0, 0, 0, 0)
  const dayEnd = new Date(dayStart)
  dayEnd.setDate(dayEnd.getDate() + 1)

  const taken = await db
    .select({ startsAt: bookings.startsAt, endsAt: bookings.endsAt })
    .from(bookings)
    .where(
      and(
        eq(bookings.storeId, input.storeId),
        eq(bookings.productId, input.productId),
        gte(bookings.startsAt, dayStart),
        lt(bookings.startsAt, dayEnd),
        ne(bookings.status, 'cancelled'),
      ),
    )

  const clash = taken.some((b) => start < new Date(b.endsAt) && end > new Date(b.startsAt))
  if (clash) return { ok: false, error: 'المعاد ده اتحجز للأسف. اختار معادًا تاني.' }

  await db.insert(bookings).values({
    storeId: input.storeId,
    orderId: input.orderId,
    productId: input.productId,
    customerId: input.customerId ?? null,
    customerName: input.customerName ?? null,
    customerPhone: input.customerPhone ?? null,
    startsAt: start,
    endsAt: end,
    status: 'pending',
    notes: input.notes ?? null,
  })

  return { ok: true }
}
