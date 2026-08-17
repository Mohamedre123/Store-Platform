'use client'

import { useActionState, useState, useTransition } from 'react'
import Image from 'next/image'
import { Layers, Pencil, Plus, Trash2, X } from 'lucide-react'
import { deleteCategoryAction, saveCategoryAction, type FormState } from '../actions'
import { Alert, Button, Card, Field, Input, Textarea } from '@/components/ui'
import { ImageUpload } from '@/components/ui/image-upload'

type Category = {
  id: string
  name: string
  description: string | null
  image: string | null
  isActive: boolean
  productCount: number
}

export function CategoriesManager({ initial }: { initial: Category[] }) {
  const [editing, setEditing] = useState<Category | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, startDelete] = useTransition()

  const open = creating || editing !== null

  return (
    <div className="flex flex-col gap-5">
      {!open && (
        <Button onClick={() => setCreating(true)} className="self-start">
          <Plus className="h-4 w-4" aria-hidden="true" />
          قسم جديد
        </Button>
      )}

      {open && (
        <CategoryForm
          category={editing}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
        />
      )}

      {initial.length === 0 && !open ? (
        <Card className="flex flex-col items-center gap-4 px-6 py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)]">
            <Layers className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-semibold">لسه مافيش أقسام</h2>
            <p className="mt-1 max-w-sm text-sm text-[var(--fg-muted)]">
              الأقسام بتساعد العميل يلاقي اللي بيدوّر عليه بسرعة. زي «تيشيرتات» و«بناطيل».
            </p>
          </div>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {initial.map((c) => (
            <li key={c.id}>
              <Card className="flex items-center gap-3 p-3">
                <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[var(--surface-2)]">
                  {c.image ? (
                    <Image src={c.image} alt="" fill sizes="56px" className="object-cover" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-[var(--fg-subtle)]">
                      <Layers className="h-5 w-5" aria-hidden="true" />
                    </span>
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{c.name}</span>
                    {!c.isActive && (
                      <span className="shrink-0 rounded-md bg-[var(--surface-2)] px-1.5 py-0.5 text-xs text-[var(--fg-subtle)]">
                        مخفي
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--fg-subtle)]">
                    {c.productCount} منتج
                  </p>
                </div>

                <div className="flex shrink-0 gap-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setCreating(false)
                      setEditing(c)
                    }}
                    aria-label={`تعديل ${c.name}`}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => {
                      // المنتجات ما بتتمسحش — بس بتفضل بلا قسم
                      const msg = c.productCount
                        ? `هتمسح «${c.name}». الـ${c.productCount} منتج اللي فيه هيفضلوا موجودين بس من غير قسم. متأكد؟`
                        : `هتمسح «${c.name}». متأكد؟`
                      if (!confirm(msg)) return
                      startDelete(() => deleteCategoryAction(c.id))
                    }}
                    aria-label={`حذف ${c.name}`}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--fg-muted)] transition-colors hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)] disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function CategoryForm({ category, onClose }: { category: Category | null; onClose: () => void }) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(saveCategoryAction, null)
  const [image, setImage] = useState<string[]>(category?.image ? [category.image] : [])
  const [isActive, setIsActive] = useState(category?.isActive ?? true)

  return (
    <Card className="p-5">
      <form action={formAction} className="flex flex-col gap-5">
        {category && <input type="hidden" name="id" value={category.id} />}
        <input type="hidden" name="image" value={image[0] ?? ''} />
        <input type="hidden" name="isActive" value={String(isActive)} />

        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{category ? 'تعديل القسم' : 'قسم جديد'}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {state?.error && <Alert>{state.error}</Alert>}

        <Field label="اسم القسم" required htmlFor="name" error={state?.fieldErrors?.name}>
          <Input id="name" name="name" required defaultValue={category?.name} placeholder="تيشيرتات" />
        </Field>

        <Field label="الوصف" htmlFor="description" hint="اختياري — يظهر أعلى صفحة القسم">
          <Textarea id="description" name="description" rows={2} defaultValue={category?.description ?? ''} />
        </Field>

        <ImageUpload
          label="صورة القسم"
          value={image}
          onChange={setImage}
          folder="categories"
          specKey="categoryImage"
        />

        <label className="flex items-center gap-2.5">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 accent-[var(--primary)]"
          />
          <span className="text-sm">ظاهر في المتجر</span>
        </label>

        <div className="flex gap-2">
          <Button type="submit" loading={pending}>
            {category ? 'حفظ' : 'إضافة'}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
        </div>
      </form>
    </Card>
  )
}
