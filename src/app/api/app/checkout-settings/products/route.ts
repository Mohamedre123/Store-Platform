import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json } from '@/lib/app-api'
import { searchPickerProducts } from '@/app/dashboard/storefront/picker-actions'

export const dynamic = 'force-dynamic'

/** GET /api/app/checkout-settings/products?q= — منتجات لاختيار مقترحات السلة (نفس `ProductPicker`) */
export async function GET(req: NextRequest) {
  const ctx = await appContext('settings.manage')
  if (ctx instanceof NextResponse) return ctx

  const q = (req.nextUrl.searchParams.get('q') ?? '').slice(0, 80)
  const rows = await searchPickerProducts({ query: q, limit: 40 })
  return json({
    products: rows.map((p) => ({ id: p.id, name: p.name, image: p.image, price: p.price, status: p.status })),
  })
}
