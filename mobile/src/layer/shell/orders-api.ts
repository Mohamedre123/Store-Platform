/**
 * بيانات شاشات الطلبات.
 *
 * القايمة بتتحفظ على الجهاز (لكل فلتر) فبتفتح فورًا. التفاصيل في الذاكرة
 * بس، ومعاها «معاينة» من سطر القايمة: التاجر بيدوس على طلب، والرقم
 * والحالة والإجمالي بيظهروا في نفس اللحظة قبل ما التفاصيل توصل.
 */

export type TrustLevel = 'good' | 'watch' | 'risky' | 'new'

export type ListOrder = {
  id: string
  number: string
  status: string
  statusLabel: string
  incomplete: boolean
  name: string | null
  phone: string | null
  email: string | null
  city: string | null
  total: number
  createdAt: string
  trust: { level: TrustLevel; label: string } | null
  whatsappText: string
}

export type OrdersPayload = {
  currency: string
  canCreate: boolean
  filter: string
  totalCount: number
  incompleteCount: number
  tabs: Array<{ key: string; label: string; n: number }>
  orders: ListOrder[]
}

export type OrderDetail = {
  currency: string
  order: {
    id: string
    number: string
    status: string
    statusLabel: string
    incomplete: boolean
    createdAt: string
    name: string | null
    phone: string | null
    email: string | null
    address: string | null
    notes: string | null
    subtotal: number
    shippingTotal: number
    codFee: number
    total: number
    costTotal: number
    profit: number
    paymentStatus: string
    stage: { label: string; detail: string } | null
    confirm: { hasPhone: boolean; reply: 'yes' | 'no' | null; sentAt: string | null; repliedAt: string | null }
  }
  items: Array<{
    id: string
    name: string
    image: string | null
    options: Array<{ name: string; value: string }>
    price: number
    quantity: number
    total: number
  }>
  events: Array<{ id: string; type: string; message: string | null; createdAt: string }>
  trust: { level: TrustLevel; label: string; score: number | null; reasons: string[]; networkStores: number } | null
  courier: { name: string; phone: string | null } | null
  next: { key: string; label: string } | null
  statuses: Array<{ key: string; label: string }>
  whatsappText: string
}

export type Result<T> =
  | { kind: 'ok'; data: T; at: number }
  | { kind: 'unauthorized' }
  | { kind: 'unavailable' }
  | { kind: 'notFound' }
  | { kind: 'error' }

async function getJson<T>(url: string): Promise<Result<T>> {
  try {
    const res = await fetch(url, { credentials: 'same-origin', cache: 'no-store', headers: { accept: 'application/json' } })
    const isJson = (res.headers.get('content-type') ?? '').includes('application/json')
    if (res.status === 401) return { kind: 'unauthorized' }
    if (res.status === 404) return isJson ? { kind: 'notFound' } : { kind: 'unavailable' }
    if (!res.ok) return { kind: 'error' }
    if (!isJson) return { kind: 'unavailable' }
    return { kind: 'ok', data: (await res.json()) as T, at: Date.now() }
  } catch {
    return { kind: 'error' }
  }
}

/* ─────────────── القايمة ─────────────── */

const LIST_PREFIX = 'zw-orders:v1:'

export function readOrdersCache(filter: string): { at: number; data: OrdersPayload } | null {
  try {
    const raw = localStorage.getItem(LIST_PREFIX + filter)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearOrdersCache(): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (key?.startsWith(LIST_PREFIX)) localStorage.removeItem(key)
    }
  } catch {
    /* تجاهل */
  }
  details.clear()
  previews.clear()
}

export async function fetchOrders(filter: string): Promise<Result<OrdersPayload>> {
  const url = filter === 'all' ? '/api/app/orders' : `/api/app/orders?filter=${encodeURIComponent(filter)}`
  const res = await getJson<OrdersPayload>(url)
  if (res.kind === 'ok') {
    try {
      localStorage.setItem(LIST_PREFIX + filter, JSON.stringify({ at: res.at, data: res.data }))
    } catch {
      /* الشاشة شغّالة من غير كاش */
    }
  }
  return res
}

/*
  كل تغيير على طلب بيزوّد الرقم ده. القايمة بتقارنه باللي شافته آخر مرة
  وبتتحدّث أول ما تظهر — التاجر اللي غيّر حالة طلب ورجع، يلاقيها اتغيّرت.
*/
let staleVersion = 0
export const ordersVersion = () => staleVersion
export function markOrdersStale(): void {
  staleVersion++
}

/* ─────────────── التفاصيل ─────────────── */

export const previews = new Map<string, ListOrder & { currency: string }>()
export const details = new Map<string, OrderDetail>()

export function fetchOrder(id: string): Promise<Result<OrderDetail>> {
  return getJson<OrderDetail>(`/api/app/orders/${encodeURIComponent(id)}`)
}

export async function postOrderAction(
  id: string,
  action: 'status' | 'note' | 'confirm',
  body: object = {},
): Promise<{ ok: true; detail: OrderDetail } | { ok: false; error: string }> {
  try {
    const res = await fetch(`/api/app/orders/${encodeURIComponent(id)}/${action}`, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
    })
    const data = (await res.json().catch(() => null)) as { ok?: boolean; detail?: OrderDetail; error?: string } | null
    if (res.ok && data?.ok && data.detail) {
      details.set(id, data.detail)
      markOrdersStale()
      return { ok: true, detail: data.detail }
    }
    if (res.status === 401) return { ok: false, error: 'الجلسة خلصت — سجّل دخول تاني' }
    if (res.status === 403) return { ok: false, error: 'ماعندكش صلاحية للإجراء ده' }
    return { ok: false, error: data?.error && data.error.length > 3 ? data.error : 'ما قدرناش نكمّل — جرّب تاني' }
  } catch {
    return { ok: false, error: 'مفيش اتصال — جرّب تاني لما النت يرجع' }
  }
}

/* ─────────────── قناة الإشعار ─────────────── */

export type NotifyChannel = 'auto' | 'both' | 'whatsapp' | 'email' | 'none'

/* نفس `NOTIFY_CHANNELS` والمفتاح في المنصة — الاختيار واحد على الموبايل واللابتوب */
export const NOTIFY_CHANNELS: Array<{ key: NotifyChannel; label: string; hint: string }> = [
  { key: 'auto', label: 'تلقائي', hint: 'يروح على اللي العميل مسجّل بيه' },
  { key: 'both', label: 'بريد + واتساب', hint: 'يوصل على الاتنين' },
  { key: 'whatsapp', label: 'واتساب بس', hint: 'أسرع طريق للعميل المصري' },
  { key: 'email', label: 'بريد بس', hint: 'للعميل اللي بيتابع بريده' },
  { key: 'none', label: 'من غير إشعار', hint: 'غيّر الحالة في الهدوء' },
]
const CHANNEL_KEY = 'zw_notify_channel'

export function readChannel(): NotifyChannel {
  try {
    const saved = localStorage.getItem(CHANNEL_KEY)
    return NOTIFY_CHANNELS.some((c) => c.key === saved) ? (saved as NotifyChannel) : 'auto'
  } catch {
    return 'auto'
  }
}

export function saveChannel(channel: NotifyChannel): void {
  try {
    localStorage.setItem(CHANNEL_KEY, channel)
  } catch {
    /* تجاهل */
  }
}

export const whatsappLink = (phone: string, text: string) =>
  `https://wa.me/${phone.replace(/[^\d]/g, '')}?text=${encodeURIComponent(text)}`
