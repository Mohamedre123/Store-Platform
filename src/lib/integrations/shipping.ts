import 'server-only'
import { createHash, createHmac } from 'node:crypto'
import { apiFetch, digits, splitName, toMajor } from './http'
import type { ProviderCreds } from '@/lib/provider-store'

/**
 * تسجيل الشحنة عند شركة الشحن.
 *
 * ده اللي بيخلّي التاجر ما يقعدش ينقل الطلبات بإيده: أول ما الطلب
 * يتأكّد، بنسجّله عندهم وبناخد رقم البوليصة ونحطّه على الطلب. بعدها
 * الويب هوك بتاعهم هو اللي بيحدّث الحالة لحد «اتسلّم».
 *
 * **الفشل هنا ما بيوقعش الطلب.** الطلب بتاع التاجر اتسجّل عندنا خلاص؛
 * لو الشركة رفضت (عنوان ناقص، رصيد خلص، مفتاح باظ) بنسجّل السبب
 * ونسيب التاجر يعمل الشحنة بإيده. طلب بيتلغي عشان شركة الشحن واقعة
 * خسارة مباشرة له.
 */

export type ShipmentOrder = {
  id: string
  orderNumber: number
  /** بالقرش */
  total: number
  /** المبلغ المطلوب تحصيله عند التسليم — صفر لو الطلب مدفوع أونلاين */
  codAmount: number
  currency: string
  customerName: string | null
  customerPhone: string
  customerEmail: string | null
  country: string
  city: string | null
  area: string | null
  street: string | null
  building: string | null
  notes: string | null
  itemsCount: number
  description: string
}

export type ShipmentResult =
  | {
      ok: true
      trackingNumber: string
      carrierShipmentId: string | null
      awbUrl: string | null
      raw: unknown
    }
  | { ok: false; error: string; raw?: unknown }

type Ctx = {
  creds: ProviderCreds
  order: ShipmentOrder
  storeName: string
  storePhone: string | null
  webhookUrl: string
}

/** الشركات اللي عندها ربط فعلي — الباقي يدوي بتعريفه */
export function supportsAutoShipment(slug: string): boolean {
  return ['bosta', 'mylerz', 'jt', 'aramex', 'shipblu'].includes(slug)
}

export async function createCarrierShipment(slug: string, ctx: Ctx): Promise<ShipmentResult> {
  switch (slug) {
    case 'bosta':
      return bosta(ctx)
    case 'mylerz':
      return mylerz(ctx)
    case 'jt':
      return jt(ctx)
    case 'aramex':
      return aramex(ctx)
    case 'shipblu':
      return shipblu(ctx)
    default:
      return { ok: false, error: 'الشركة دي بتتسجّل يدويًا — اعمل البوليصة عندهم والزق رقمها' }
  }
}

/* ═══════════════════════════ بوسطة ═══════════════════════════ */

/**
 * بوسطة بتقبل العنوان نصًّا حرًّا في `firstLine` مع اسم المحافظة،
 * فمفيش لازمة نجيب معرّفات المناطق عندهم قبل كل شحنة. `type: 10`
 * يعني توصيل عادي، و`cod` بالجنيه لا بالقرش.
 */
async function bosta(ctx: Ctx): Promise<ShipmentResult> {
  const { secrets, values, testMode } = ctx.creds
  const { order } = ctx

  const base = testMode ? 'https://stg-app.bosta.co' : 'https://app.bosta.co'
  const name = splitName(order.customerName)

  const res = await apiFetch<{
    success?: boolean
    data?: { _id?: string; trackingNumber?: string }
    message?: string
  }>(`${base}/api/v2/deliveries`, {
    method: 'POST',
    headers: { Authorization: secrets.apiKey ?? '' },
    json: {
      type: 10,
      specs: {
        packageType: 'Parcel',
        size: 'SMALL',
        packageDetails: {
          itemsCount: order.itemsCount,
          description: order.description.slice(0, 200),
        },
      },
      notes: order.notes?.slice(0, 200) || `طلب رقم ${order.orderNumber}`,
      cod: order.codAmount > 0 ? Number(toMajor(order.codAmount)) : 0,
      businessReference: values.businessReference || `ZW-${order.orderNumber}`,
      ...(values.pickupAddressId ? { pickupAddressId: values.pickupAddressId } : {}),
      dropOffAddress: {
        city: order.city ?? '',
        zone: order.area ?? undefined,
        firstLine: [order.street, order.building].filter(Boolean).join('، ') || order.city || '-',
        secondLine: order.area ?? undefined,
      },
      receiver: {
        firstName: name.first,
        lastName: name.last,
        phone: digits(order.customerPhone),
        email: order.customerEmail || undefined,
      },
      webhookUrl: ctx.webhookUrl,
    },
  })

  if (!res.ok) return { ok: false, error: `بوسطة رفضت الشحنة: ${res.error}`, raw: res.data }

  const tracking = res.data.data?.trackingNumber
  if (!tracking) return { ok: false, error: 'بوسطة ما رجّعتش رقم بوليصة', raw: res.data }

  return {
    ok: true,
    trackingNumber: tracking,
    carrierShipmentId: res.data.data?._id ?? null,
    awbUrl: res.data.data?._id ? `${base}/api/v2/deliveries/awb/${res.data.data._id}` : null,
    raw: res.data,
  }
}

/* ═══════════════════════════ مايلرز ═══════════════════════════ */

/**
 * مايلرز بتاخد اسم مستخدم وكلمة سر لا مفتاحًا: بنجيب توكن الأول ثم
 * نسجّل الطرد. التوكن عمره ساعات، بس بنجيبه في كل شحنة — الشحنات
 * أقل بكتير من إن نبني تخزينًا مؤقّتًا وننسى نبطّله.
 */
async function mylerz(ctx: Ctx): Promise<ShipmentResult> {
  const { secrets, values } = ctx.creds
  const { order } = ctx

  const base = 'https://integration.mylerz.net'

  const auth = await apiFetch<{ access_token?: string }>(`${base}/api/token`, {
    method: 'POST',
    form: {
      grant_type: 'password',
      username: values.username ?? '',
      password: secrets.password ?? '',
    },
  })
  if (!auth.ok || !auth.data.access_token) {
    return { ok: false, error: `مايلرز رفضت الدخول: ${auth.ok ? 'مفيش توكن' : auth.error}` }
  }

  const name = splitName(order.customerName)

  const res = await apiFetch<{
    Value?: Array<{ BarCode?: string; Message?: string; IsSuccess?: boolean }>
    Message?: string
  }>(`${base}/api/Orders/AddOrders`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${auth.data.access_token}` },
    json: {
      PackageItems: [
        {
          CustomerName: `${name.first} ${name.last}`.trim(),
          MobileNo: digits(order.customerPhone),
          Email: order.customerEmail || undefined,
          Street: [order.street, order.building].filter(Boolean).join('، ') || '-',
          NeighborhoodName: order.area ?? undefined,
          CityName: order.city ?? '',
          CountryName: order.country === 'EG' ? 'Egypt' : order.country,
          Reference: `ZW-${order.orderNumber}`,
          Description: order.description.slice(0, 200),
          TotalPrice: Number(toMajor(order.codAmount)),
          CODValue: Number(toMajor(order.codAmount)),
          PackageSource: 'API',
          WarehouseName: values.warehouseName || undefined,
          ServiceType: 'Delivery',
          PaymentType: order.codAmount > 0 ? 'COD' : 'PP',
          CustomerCode: values.customerCode ?? '',
          NoOfPieces: order.itemsCount,
        },
      ],
    },
  })

  if (!res.ok) return { ok: false, error: `مايلرز رفضت الشحنة: ${res.error}`, raw: res.data }

  const first = res.data.Value?.[0]
  if (!first?.BarCode) {
    return {
      ok: false,
      error: `مايلرز ما رجّعتش بوليصة: ${first?.Message ?? res.data.Message ?? 'سبب غير معروف'}`,
      raw: res.data,
    }
  }

  return {
    ok: true,
    trackingNumber: first.BarCode,
    carrierShipmentId: first.BarCode,
    awbUrl: null,
    raw: res.data,
  }
}

/* ═════════════════════════ J&T Express ═════════════════════════ */

/**
 * J&T بيوقّعوا الحمولة بـ base64(MD5(json + privateKey)) في ترويسة
 * `digest`، وبيتحقّقوا من الحساب في ترويسة تانية. أي حرف زيادة في
 * الـJSON بيبطّل التوقيع — عشان كده بنوقّع نفس النص اللي بنبعته
 * بالظبط لا نسخة تانية منه.
 */
async function jt(ctx: Ctx): Promise<ShipmentResult> {
  const { secrets, values, testMode } = ctx.creds
  const { order } = ctx

  const base = testMode
    ? 'https://demoopenapi.jtexpress-eg.com'
    : 'https://openapi.jtexpress-eg.com'

  const name = splitName(order.customerName)

  const payload = {
    customerCode: values.customerCode ?? '',
    digest: createHash('md5')
      .update(`${values.customerCode ?? ''}${secrets.password ?? ''}`)
      .digest('base64'),
    txlogisticId: `ZW-${order.orderNumber}`,
    expressType: 'EZ',
    orderType: '1',
    serviceType: '01',
    deliveryType: '04',
    payType: order.codAmount > 0 ? 'PP_CASH' : 'PP_PM',
    goodsType: 'ITN1',
    totalQuantity: order.itemsCount,
    itemsValue: Number(toMajor(order.total)),
    priceCurrency: order.currency,
    ...(order.codAmount > 0 ? { offerFee: Number(toMajor(order.codAmount)) } : {}),
    sender: {
      name: ctx.storeName.slice(0, 50),
      mobile: digits(ctx.storePhone),
      countryCode: 'EGY',
    },
    receiver: {
      name: `${name.first} ${name.last}`.trim(),
      mobile: digits(order.customerPhone),
      countryCode: 'EGY',
      prov: order.city ?? '',
      city: order.city ?? '',
      area: order.area ?? '',
      address: [order.street, order.building].filter(Boolean).join('، ') || '-',
    },
    items: [
      {
        itemName: order.description.slice(0, 100),
        number: order.itemsCount,
        itemValue: Number(toMajor(order.total)),
      },
    ],
  }

  const body = JSON.stringify(payload)
  const digest = createHash('md5')
    .update(body + (secrets.privateKey ?? ''))
    .digest('base64')

  const res = await apiFetch<{
    code?: string | number
    msg?: string
    data?: { billCode?: string; txlogisticId?: string; sortingCode?: string }
  }>(`${base}/webopenplatformapi/api/order/addOrder`, {
    method: 'POST',
    headers: {
      apiAccount: values.apiAccount ?? '',
      digest,
      timestamp: String(Date.now()),
      'Content-Type': 'application/json',
    },
    body,
  })

  if (!res.ok) return { ok: false, error: `J&T رفضت الشحنة: ${res.error}`, raw: res.data }

  const bill = res.data.data?.billCode
  if (!bill) {
    return { ok: false, error: `J&T ما رجّعتش بوليصة: ${res.data.msg ?? 'سبب غير معروف'}`, raw: res.data }
  }

  return {
    ok: true,
    trackingNumber: bill,
    carrierShipmentId: res.data.data?.txlogisticId ?? bill,
    awbUrl: null,
    raw: res.data,
  }
}

/* ═══════════════════════════ أرامكس ═══════════════════════════ */

async function aramex(ctx: Ctx): Promise<ShipmentResult> {
  const { secrets, values, testMode } = ctx.creds
  const { order } = ctx

  const base = testMode
    ? 'https://ws.dev.aramex.net/ShippingAPI.V2/Shipping/Service_1_0.svc/json'
    : 'https://ws.aramex.net/ShippingAPI.V2/Shipping/Service_1_0.svc/json'

  const clientInfo = {
    UserName: values.username ?? '',
    Password: secrets.password ?? '',
    Version: 'v1.0',
    AccountNumber: values.accountNumber ?? '',
    AccountPin: secrets.accountPin ?? '',
    AccountEntity: values.accountEntity ?? 'CAI',
    AccountCountryCode: values.accountCountryCode ?? 'EG',
    Source: 24,
  }

  const name = splitName(order.customerName)

  const res = await apiFetch<{
    HasErrors?: boolean
    Notifications?: Array<{ Message?: string }>
    Shipments?: Array<{ ID?: string; ShipmentLabel?: { LabelURL?: string } }>
  }>(`${base}/CreateShipments`, {
    method: 'POST',
    json: {
      ClientInfo: clientInfo,
      LabelInfo: { ReportID: 9201, ReportType: 'URL' },
      Shipments: [
        {
          Reference1: `ZW-${order.orderNumber}`,
          Shipper: {
            Reference1: ctx.storeName.slice(0, 50),
            AccountNumber: values.accountNumber ?? '',
            PartyAddress: { Line1: '-', City: 'Cairo', CountryCode: 'EG' },
            Contact: {
              PersonName: ctx.storeName.slice(0, 50),
              PhoneNumber1: digits(ctx.storePhone) || '0000000000',
              CellPhone: digits(ctx.storePhone) || '0000000000',
              EmailAddress: 'na@example.com',
              CompanyName: ctx.storeName.slice(0, 50),
            },
          },
          Consignee: {
            PartyAddress: {
              Line1: [order.street, order.building].filter(Boolean).join('، ') || '-',
              Line2: order.area ?? '',
              City: order.city ?? '',
              CountryCode: order.country || 'EG',
            },
            Contact: {
              PersonName: `${name.first} ${name.last}`.trim(),
              PhoneNumber1: digits(order.customerPhone),
              CellPhone: digits(order.customerPhone),
              EmailAddress: order.customerEmail || 'na@example.com',
              CompanyName: `${name.first} ${name.last}`.trim(),
            },
          },
          ShippingDateTime: new Date().toISOString(),
          Details: {
            ActualWeight: { Value: 1, Unit: 'KG' },
            NumberOfPieces: order.itemsCount,
            ProductGroup: 'DOM',
            ProductType: order.codAmount > 0 ? 'CDA' : 'ONP',
            PaymentType: 'P',
            DescriptionOfGoods: order.description.slice(0, 100),
            GoodsOriginCountry: 'EG',
            ...(order.codAmount > 0
              ? { CashOnDeliveryAmount: { Value: Number(toMajor(order.codAmount)), CurrencyCode: order.currency } }
              : {}),
          },
        },
      ],
      Transaction: { Reference1: `ZW-${order.orderNumber}` },
    },
  })

  if (!res.ok) return { ok: false, error: `أرامكس رفضت الشحنة: ${res.error}`, raw: res.data }

  if (res.data.HasErrors) {
    const msg = res.data.Notifications?.map((n) => n.Message).filter(Boolean).join('، ')
    return { ok: false, error: `أرامكس رفضت الشحنة: ${msg || 'سبب غير معروف'}`, raw: res.data }
  }

  const shipment = res.data.Shipments?.[0]
  if (!shipment?.ID) return { ok: false, error: 'أرامكس ما رجّعتش بوليصة', raw: res.data }

  return {
    ok: true,
    trackingNumber: shipment.ID,
    carrierShipmentId: shipment.ID,
    awbUrl: shipment.ShipmentLabel?.LabelURL ?? null,
    raw: res.data,
  }
}

/* ═══════════════════════════ شيب بلو ═══════════════════════════ */

async function shipblu(ctx: Ctx): Promise<ShipmentResult> {
  const { secrets } = ctx.creds
  const { order } = ctx

  const name = splitName(order.customerName)

  const res = await apiFetch<{
    id?: number
    tracking_number?: string
    label_url?: string
    error?: string
  }>('https://api.shipblu.com/api/v1/merchant/delivery-orders/', {
    method: 'POST',
    headers: { Authorization: `Token ${secrets.apiKey ?? ''}` },
    json: {
      merchant_order_reference: `ZW-${order.orderNumber}`,
      customer: {
        full_name: `${name.first} ${name.last}`.trim(),
        phone: digits(order.customerPhone),
        email: order.customerEmail || undefined,
        address: {
          line_1: [order.street, order.building].filter(Boolean).join('، ') || '-',
          line_2: order.area ?? '',
          city: order.city ?? '',
          country: order.country || 'EG',
        },
      },
      packages: [{ package_description: order.description.slice(0, 200), quantity: order.itemsCount }],
      cash_amount: Number(toMajor(order.codAmount)),
      declared_value: Number(toMajor(order.total)),
    },
  })

  if (!res.ok) return { ok: false, error: `شيب بلو رفضت الشحنة: ${res.error}`, raw: res.data }
  if (!res.data.tracking_number) {
    return { ok: false, error: 'شيب بلو ما رجّعتش رقم بوليصة', raw: res.data }
  }

  return {
    ok: true,
    trackingNumber: res.data.tracking_number,
    carrierShipmentId: res.data.id ? String(res.data.id) : null,
    awbUrl: res.data.label_url ?? null,
    raw: res.data,
  }
}

/**
 * توقيع الويب هوك اللي بنبعته للشركة وقت التسجيل.
 *
 * الشركات اللي بتقبل رابط إشعار مع الشحنة بتعيده زي ما هو — فبنحطّ
 * فيه توقيعًا مشتقًّا من السرّ عشان نتحقّق منه لما يرجع.
 */
export function webhookToken(secret: string, storeId: string): string {
  return createHmac('sha256', secret).update(storeId).digest('hex').slice(0, 32)
}
