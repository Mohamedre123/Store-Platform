'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { Check, Clock, Loader2, Wrench } from 'lucide-react'
import { subscribeAction } from '@/app/s/[store]/newsletter-actions'

/**
 * شاشة المتجر المقفول — صيانة أو «قريبًا».
 *
 * ## بهوية التاجر لا بهويتنا
 * الشعار والاسم بتوعه هو. الصفحة دي ممكن تكون أول حاجة عميل يشوفها
 * من المتجر (رابط من إعلان قبل الافتتاح)، وشاشة عليها اسمنا إحنا
 * بتخلّيه يفتكر إنه غلط في الرابط ويقفل.
 *
 * ## و«قريبًا» بتجمّع مش بتعتذر
 * الفرق بين الوضعين مش في الرسالة: الصيانة بتقول «ارجع بعدين»،
 * و«قريبًا» بتاخد بريد الزائر. التاجر اللي بيعلن قبل ما يفتح بيوصّل
 * ناس فعلًا — ولو الصفحة ما جمعتش منهم حاجة، فلوس الإعلان ضاعت.
 *
 * والبريد بيروح على **جدول عملاء التاجر** زي أي اشتراك نشرة: العميل
 * اللي سجّل هنا وبعدين طلب لازم يبقى شخصًا واحدًا.
 */
export function StoreClosed({
  kind,
  storeName,
  storeSlug,
  logo,
  message,
}: {
  kind: 'maintenance' | 'coming_soon'
  storeName: string
  storeSlug: string
  logo: string | null
  message: string | null
}) {
  const maintenance = kind === 'maintenance'
  const Icon = maintenance ? Wrench : Clock

  return (
    <main className="flex min-h-dvh items-center justify-center px-5 py-16">
      <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
        {logo ? (
          <Image
            src={logo}
            alt={storeName}
            width={96}
            height={96}
            className="h-20 w-20 rounded-2xl object-contain"
          />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--sf-primary)]/12 text-[var(--sf-primary)]">
            <Icon className="h-7 w-7" aria-hidden="true" />
          </span>
        )}

        <div className="flex flex-col gap-2">
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ fontFamily: 'var(--sf-font-heading)' }}
          >
            {storeName}
          </h1>
          <p className="text-base leading-relaxed opacity-70">
            {message?.trim() ||
              (maintenance
                ? 'بنعمل صيانة سريعة دلوقتي. ارجع بعد شوية وهتلاقي كل حاجة شغّالة.'
                : 'قربنا نفتح. سيب بريدك وهنبعتلك أول ما نبدأ.')}
          </p>
        </div>

        {/*
          خانة البريد في «قريبًا» بس.

          حطّها في شاشة صيانة معناه وعد بحاجة مش هتحصل: التاجر راجع
          بعد ساعة، ومفيش رسالة افتتاح هتتبعت لحد.
        */}
        {!maintenance && <NotifyForm storeSlug={storeSlug} />}
      </div>
    </main>
  )
}

function NotifyForm({ storeSlug }: { storeSlug: string }) {
  const [email, setEmail] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  if (done) {
    return (
      <p className="flex items-center gap-2 rounded-[var(--sf-radius)] bg-[var(--sf-primary)]/10 px-4 py-3 text-sm font-medium text-[var(--sf-primary)]">
        <Check className="h-4 w-4" aria-hidden="true" />
        تمام، هنعرّفك أول ما نفتح.
      </p>
    )
  }

  return (
    <form
      className="flex w-full flex-col gap-2 sm:flex-row"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        start(async () => {
          setError(null)
          const res = await subscribeAction({ storeIdentifier: storeSlug, email })
          if (res.ok) setDone(true)
          else setError(res.error)
        })
      }}
    >
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        type="email"
        dir="ltr"
        autoComplete="email"
        placeholder="بريدك الإلكتروني"
        aria-label="بريدك الإلكتروني"
        className="h-12 min-w-0 flex-1 rounded-[var(--sf-radius)] border border-[var(--sf-text)]/18 bg-[var(--sf-surface)] px-4 text-base outline-none transition-colors focus:border-[var(--sf-primary)]"
      />
      <button
        type="submit"
        disabled={pending || email.trim().length < 5}
        className="flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-[var(--sf-radius)] bg-[var(--sf-primary)] px-6 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        عرّفني
      </button>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}
