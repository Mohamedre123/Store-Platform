import { NextResponse, type NextRequest } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { carrierAccounts, shipments } from '@/db/schema'
import { carrierSecrets, recordCarrierError } from '@/lib/provider-store'
import { carrierProvider } from '@/lib/providers'
import { webhookToken } from '@/lib/integrations/shipping'
import { verifyHmac, verifyToken } from '@/lib/webhook-verify'
import { applyShipmentStatus, loadFlowStore } from '@/lib/order-flow'
import type { ShipmentStatus } from '@/lib/carriers'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * تحديث حالة الشحنة من شركة الشحن.
 *
 * ده اللي بيخلّي «اتسلّم» تظهر في المتجر لوحدها — التاجر ما يفضلش
 * يفتح لوحة الشركة ويقارن.
 *
 * التحقّق من التوقيع إلزامي: من غيره حد يبعت «اتسلّم» فنقاط الولاء
 * وعمولة المسوّق تتصرف على طلب لسه في الشارع.
 */

/**
 * ترجمة حالة الشركة لحالتنا.
 *
 * كل شركة وتسمياتها. اللي مش معروف بيرجع null — **وما بنغيّرش حاجة**
 * بدل ما نخمّن. تخمين غلط هنا معناه طلب بيتعلّم «اتسلّم» وهو لأ.
 */
function mapStatus(slug: string, raw: string): ShipmentStatus | null {
  const s = raw.toUpperCase().replace(/[\s-]+/g, '_')

  const common: Record<string, ShipmentStatus> = {
    DELIVERED: 'delivered',
    PICKED_UP: 'picked_up',
    IN_TRANSIT: 'in_transit',
    OUT_FOR_DELIVERY: 'out_for_delivery',
    RETURNED: 'returned',
    CANCELLED: 'returned',
    EXCEPTION: 'failed',
  }

  const perCarrier: Record<string, Record<string, ShipmentStatus>> = {
    bosta: {
      PICKED_UP_FROM_BUSINESS: 'picked_up',
      RECEIVED_AT_WAREHOUSE: 'in_transit',
      IN_TRANSIT_BETWEEN_HUBS: 'in_transit',
      OUT_FOR_DELIVERY: 'out_for_delivery',
      DELIVERED: 'delivered',
      RETURNED_TO_BUSINESS: 'returned',
      EXCEPTION: 'failed',
      CANCELLED: 'returned',
      TERMINATED: 'failed',
    },
    mylerz: {
      PICKED: 'picked_up',
      PICKED_UP: 'picked_up',
      OUT_FOR_DELIVERY: 'out_for_delivery',
      DELIVERED: 'delivered',
      RETURNED: 'returned',
      FAILED: 'failed',
    },
    jt: {
      COLLECTED: 'picked_up',
      DISPATCH: 'in_transit',
      DELIVERING: 'out_for_delivery',
      SIGNED: 'delivered',
      RETURN: 'returned',
      PROBLEM_PIECE: 'failed',
    },
    shipblu: {
      PICKED_UP: 'picked_up',
      IN_TRANSIT: 'in_transit',
      OUT_FOR_DELIVERY: 'out_for_delivery',
      DELIVERED: 'delivered',
      RETURNED: 'returned',
    },
  }

  return perCarrier[slug]?.[s] ?? common[s] ?? null
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; storeId: string }> },
) {
  const { slug, storeId } = await params

  const def = carrierProvider(slug)
  if (!def) return NextResponse.json({ error: 'unknown carrier' }, { status: 404 })

  const raw = await req.text()

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(raw) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'bad payload' }, { status: 400 })
  }

  const [account] = await db
    .select({ id: carrierAccounts.id, enabled: carrierAccounts.enabled })
    .from(carrierAccounts)
    .where(and(eq(carrierAccounts.storeId, storeId), eq(carrierAccounts.carrier, slug)))
    .limit(1)

  if (!account) return NextResponse.json({ error: 'not connected' }, { status: 404 })

  const secrets = await carrierSecrets(storeId, slug)
  if (!secrets) return NextResponse.json({ error: 'no credentials' }, { status: 404 })

  /*
    شركات الشحن أغلبها بتبعت توكنًا ثابتًا مش توقيعًا على الحمولة.
    أضعف من HMAC، بس أحسن كتير من مسار مفتوح — وبنقبل التلاتة:
    السرّ اللي التاجر كتبه، والتوكن المشتقّ اللي بنبعته مع الشحنة،
    والتوقيع على النص الخام.
  */
  const headerToken =
    req.headers.get('x-webhook-token') ??
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    req.headers.get('x-api-key') ??
    req.nextUrl.searchParams.get('token') ??
    null

  const signature = req.headers.get('x-signature') ?? req.headers.get('x-hub-signature-256') ?? ''
  const baseSecret = secrets.apiKey ?? secrets.privateKey ?? secrets.password ?? ''
  const configured = secrets.webhookSecret ?? ''

  const verified =
    (configured && verifyToken(headerToken, configured)) ||
    verifyToken(headerToken, baseSecret) ||
    (baseSecret ? verifyToken(headerToken, webhookToken(baseSecret, storeId)) : false) ||
    (signature ? verifyHmac(raw, signature, configured || baseSecret) : false)

  if (!verified) {
    await recordCarrierError(
      storeId,
      slug,
      'وصل إشعار بتوقيع مش مطابق — اتّرفض. راجع الرابط والمفتاح عندهم.',
    )

    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }

  /* ─────────── التطبيق ─────────── */

  const data = (payload.data ?? payload) as Record<string, unknown>

  const tracking = String(
    data.trackingNumber ??
      data.tracking_number ??
      data.awb ??
      data.billCode ??
      data.BarCode ??
      '',
  ).trim()

  const rawStatus = String(
    data.state ??
      data.status ??
      (data.CurrentStatus as Record<string, unknown> | undefined)?.value ??
      '',
  ).trim()

  if (!tracking || !rawStatus) {
    return NextResponse.json({ ok: true, note: 'missing tracking or status' })
  }

  const status = mapStatus(slug, rawStatus)
  if (!status) {
    // حالة مش معروفة: بنسجّلها ومش بنغيّر حاجة — التخمين هنا خطر
    await recordCarrierError(storeId, slug, `حالة مش معروفة من ${def.name}: ${rawStatus}`)
    return NextResponse.json({ ok: true, note: 'unmapped status' })
  }

  const [shipment] = await db
    .select({ id: shipments.id, status: shipments.status })
    .from(shipments)
    .where(and(eq(shipments.storeId, storeId), eq(shipments.trackingNumber, tracking)))
    .limit(1)

  if (!shipment) return NextResponse.json({ ok: true, note: 'shipment not found' })

  if (shipment.status !== status) {
    /*
      بننادي التحوّل نفسه اللي اللوحة بتناديه: هو اللي بينقل التسليم
      والرجوع للطلب، وبيصرف نقاط الولاء وعمولة المسوّق. التحديث
      المباشر كان هيغيّر الحالة ويسكّت كل ده.
    */
    const store = await loadFlowStore(storeId)
    if (store) {
      await applyShipmentStatus(
        store,
        shipment.id,
        status,
        { type: 'system', label: def.name },
        `تحديث تلقائي من ${def.name}`,
        rawStatus,
      ).catch((e) => console.error('فشل تطبيق حالة الشحنة:', e))
    }
  }

  await recordCarrierError(storeId, slug, null)

  return NextResponse.json({ ok: true })
}
