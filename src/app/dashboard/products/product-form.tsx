'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { Save } from 'lucide-react'
import { saveProductAction, type FormState } from './actions'
import { Alert, Button, Card, Field, Input, Textarea } from '@/components/ui'
import { ImageUpload } from '@/components/ui/image-upload'
import { formatMoney, fromMinorUnits, toMinorUnits } from '@/lib/utils'
import { SeoFields } from '@/components/dashboard/seo-fields'

type Product = {
  id: string
  name: string
  description: string | null
  brand: string | null
  seoTitle: string | null
  seoDescription: string | null
  slug: string
  categoryId: string | null
  price: number
  compareAtPrice: number | null
  costPrice: number | null
  sku: string | null
  stock: number
  trackInventory: boolean
  status: string
  images: string[]
}

/** يحوّل المبلغ المخزَّن بالقروش لنص يكتبه التاجر */
const asAmount = (v: number | null | undefined) => (v ? String(fromMinorUnits(v)) : '')

export function ProductForm({
  product,
  categories,
  currency,
  storeName,
}: {
  product?: Product
  categories: Array<{ id: string; name: string }>
  currency: string
  storeName: string
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(saveProductAction, null)
  const [images, setImages] = useState<string[]>(product?.images ?? [])
  const [trackInventory, setTrackInventory] = useState(product?.trackInventory ?? true)
  const [status, setStatus] = useState(product?.status === 'active' ? 'active' : 'draft')

  /*
    الاسم والقسم والماركة في حالة لأن معاينة السيو بتتحرّك معاهم وهو
    بيكتب. من غير كده التاجر بيكتب «{Name}» ويشوف «{Name}» — ومعاينة
    ما بتوريش النتيجة مالهاش لازمة.
  */
  const [name, setName] = useState(product?.name ?? '')
  const [brand, setBrand] = useState(product?.brand ?? '')
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? '')
  const [sku, setSku] = useState(product?.sku ?? '')

  const [price, setPrice] = useState(asAmount(product?.price))
  const [cost, setCost] = useState(asAmount(product?.costPrice))

  // هامش الربح يُحسب لحظيًا — التاجر بيسعّر وهو شايف مكسبه لا بعدين
  const margin = (() => {
    const p = Number(price)
    const c = Number(cost)
    if (!p || !c || c <= 0) return null
    const profit = p - c
    return { profit, percent: Math.round((profit / p) * 100) }
  })()

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {product && <input type="hidden" name="id" value={product.id} />}
      <input type="hidden" name="images" value={JSON.stringify(images)} />
      <input type="hidden" name="trackInventory" value={String(trackInventory)} />
      <input type="hidden" name="status" value={status} />

      {state?.error && <Alert>{state.error}</Alert>}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        {/* العمود الأساسي */}
        <div className="flex flex-col gap-6">
          <Card className="flex flex-col gap-5 p-5">
            <Field label="اسم المنتج" required htmlFor="name" error={state?.fieldErrors?.name}>
              <Input
                id="name"
                name="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="تيشيرت قطن رجالي"
              />
            </Field>

            <Field
              label="الوصف"
              htmlFor="description"
              hint="اكتب المقاسات والخامة وأي تفصيلة العميل هيسأل عنها."
            >
              <Textarea
                id="description"
                name="description"
                rows={5}
                defaultValue={product?.description ?? ''}
                placeholder="قطن ١٠٠٪، متوفر بمقاسات M و L و XL…"
              />
            </Field>
          </Card>

          <Card className="p-5">
            <ImageUpload
              label="صور المنتج"
              value={images}
              onChange={setImages}
              folder="products"
              specKey="productImage"
              multiple
              max={8}
            />
          </Card>

          <Card className="flex flex-col gap-5 p-5">
            <h2 className="font-semibold">السعر</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={`السعر (${currency})`} required htmlFor="price" error={state?.fieldErrors?.price}>
                <Input
                  id="price"
                  name="price"
                  inputMode="decimal"
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="490"
                  dir="ltr"
                  className="text-start"
                />
              </Field>

              <Field
                label="السعر قبل الخصم"
                htmlFor="compareAtPrice"
                hint="يظهر مشطوبًا جنب السعر"
                error={state?.fieldErrors?.compareAtPrice}
              >
                <Input
                  id="compareAtPrice"
                  name="compareAtPrice"
                  inputMode="decimal"
                  defaultValue={asAmount(product?.compareAtPrice)}
                  placeholder="660"
                  dir="ltr"
                  className="text-start"
                />
              </Field>
            </div>

            <Field
              label="تكلفة الشراء"
              htmlFor="costPrice"
              hint="ما بتظهرش للعميل. منها بنحسب ربحك الحقيقي في التقارير."
            >
              <Input
                id="costPrice"
                name="costPrice"
                inputMode="decimal"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="300"
                dir="ltr"
                className="text-start"
              />
            </Field>

            {margin && (
              <div
                className={`rounded-lg px-3.5 py-2.5 text-sm ${
                  margin.profit > 0
                    ? 'bg-[var(--color-success-soft)] text-[var(--color-success)]'
                    : 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]'
                }`}
              >
                {margin.profit > 0 ? (
                  <>
                    ربحك من القطعة{' '}
                    <bdi dir="ltr" className="num font-bold">
                      {margin.profit.toLocaleString('ar-EG')}
                    </bdi>{' '}
                    {currency} — هامش <span className="num font-bold">{margin.percent}%</span>
                  </>
                ) : (
                  'التكلفة أعلى من السعر — هتخسر في كل قطعة.'
                )}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <SeoFields
              defaultTitle={product?.seoTitle}
              defaultSlug={product?.slug}
              defaultDescription={product?.seoDescription}
              context={{
                name: name || 'اسم المنتج',
                category: categories.find((c) => c.id === categoryId)?.name ?? null,
                brand: brand || null,
                sku: sku || null,
                // نفس تنسيق المتجر — المعاينة اللي بتعرض شكلًا تاني بتكدب
                price: price ? formatMoney(toMinorUnits(price), currency) : null,
                store: storeName,
              }}
            />
          </Card>
        </div>

        {/* العمود الجانبي */}
        <div className="flex flex-col gap-6">
          <Card className="flex flex-col gap-4 p-5">
            <h2 className="font-semibold">النشر</h2>

            <div className="flex flex-col gap-2">
              {[
                { v: 'active', t: 'نشط', d: 'ظاهر في المتجر وقابل للشراء' },
                { v: 'draft', t: 'مسوّدة', d: 'مخفي عن العملاء' },
              ].map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setStatus(o.v)}
                  className={`rounded-lg border p-3 text-start transition-colors ${
                    status === o.v
                      ? 'border-[var(--primary)] bg-[var(--primary-soft)]'
                      : 'border-[var(--border-strong)] hover:bg-[var(--surface-2)]'
                  }`}
                >
                  <span className="block text-sm font-medium">{o.t}</span>
                  <span className="block text-xs text-[var(--fg-muted)]">{o.d}</span>
                </button>
              ))}
            </div>
          </Card>

          <Card className="flex flex-col gap-4 p-5">
            <h2 className="font-semibold">التصنيف</h2>
            <Field label="القسم" htmlFor="categoryId">
              <select
                id="categoryId"
                name="categoryId"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm transition-colors focus:border-[var(--primary)] focus:outline-none"
              >
                <option value="">بدون قسم</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="الماركة" htmlFor="brand" hint="بتستخدم في عنوان صفحة المنتج">
              <Input
                id="brand"
                name="brand"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="اختياري"
              />
            </Field>

            {categories.length === 0 && (
              <p className="text-xs text-[var(--fg-subtle)]">
                لسه مافيش أقسام.{' '}
                <Link href="/dashboard/products/categories" className="font-medium text-[var(--primary)] hover:underline">
                  أضف قسم
                </Link>
              </p>
            )}
          </Card>

          <Card className="flex flex-col gap-4 p-5">
            <h2 className="font-semibold">المخزون</h2>

            <Field label="كود المنتج (SKU)" htmlFor="sku" hint="اختياري — للتنظيم الداخلي">
              <Input
                id="sku"
                name="sku"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                dir="ltr"
                className="text-start"
              />
            </Field>

            <label className="flex items-start gap-2.5">
              <input
                type="checkbox"
                checked={trackInventory}
                onChange={(e) => setTrackInventory(e.target.checked)}
                className="mt-1 h-4 w-4 accent-[var(--primary)]"
              />
              <span>
                <span className="block text-sm font-medium">تتبّع الكمية</span>
                <span className="block text-xs text-[var(--fg-muted)]">
                  لما تخلص، المنتج يبقى «نفد» ولا يتباع
                </span>
              </span>
            </label>

            {trackInventory && (
              <Field label="الكمية المتاحة" htmlFor="stock">
                <Input
                  id="stock"
                  name="stock"
                  inputMode="numeric"
                  defaultValue={String(product?.stock ?? 0)}
                  dir="ltr"
                  className="text-start"
                />
              </Field>
            )}
          </Card>
        </div>
      </div>

      <div className="sticky bottom-0 -mx-4 flex items-center gap-3 border-t border-[var(--border)] bg-[var(--surface)]/95 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6">
        <Button type="submit" loading={pending}>
          <Save className="h-4 w-4" aria-hidden="true" />
          {product ? 'حفظ التعديلات' : 'إضافة المنتج'}
        </Button>
        <Link
          href="/dashboard/products"
          className="min-h-11 rounded-lg px-4 py-2.5 text-sm font-medium text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)]"
        >
          إلغاء
        </Link>
      </div>
    </form>
  )
}
