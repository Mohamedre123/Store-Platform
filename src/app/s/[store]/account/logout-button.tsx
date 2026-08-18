'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { logoutCustomerAction } from './actions'

export function LogoutButton({ storeIdentifier }: { storeIdentifier: string }) {
  const router = useRouter()
  const [pending, start] = useTransition()

  return (
    <button
      type="button"
      onClick={() =>
        start(async () => {
          await logoutCustomerAction(storeIdentifier)
          router.refresh()
        })
      }
      disabled={pending}
      className="flex min-h-10 items-center gap-1.5 rounded-[var(--sf-radius)] border border-[var(--sf-text)]/18 px-3 text-sm opacity-75 transition-opacity hover:opacity-100 disabled:opacity-50"
    >
      <LogOut className="h-4 w-4" aria-hidden="true" />
      خروج
    </button>
  )
}
