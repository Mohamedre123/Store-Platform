'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { deleteProductAction } from './actions'
import { Button } from '@/components/ui'

export function DeleteProduct({ id }: { id: string }) {
  const [pending, start] = useTransition()
  const router = useRouter()

  return (
    <Button
      variant="ghost"
      loading={pending}
      onClick={() => {
        // الحذف نهائي ويشيل الصور معاه — نتأكد قبل ما ننفّذ
        if (!confirm('هتمسح المنتج وصوره نهائيًا. متأكد؟')) return
        start(async () => {
          await deleteProductAction(id)
          router.push('/dashboard/products')
        })
      }}
      className="text-[var(--color-danger)]"
    >
      <Trash2 className="h-4 w-4" aria-hidden="true" />
      حذف
    </Button>
  )
}
