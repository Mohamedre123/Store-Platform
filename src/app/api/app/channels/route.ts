import { NextResponse } from 'next/server'
import { appContext, json } from '@/lib/app-api'
import { channelProgress, loadSalesChannels } from '@/lib/sales-channels'

export const dynamic = 'force-dynamic'

/** GET /api/app/channels — قنوات البيع وخطوات كل واحدة (نفس صفحة اللوحة — شاشة تشخيص، ما بتحفظش حاجة) */
export async function GET() {
  const ctx = await appContext('marketing.manage')
  if (ctx instanceof NextResponse) return ctx

  const channels = await loadSalesChannels({
    storeId: ctx.store.id,
    socialLinks: ctx.store.socialLinks,
    storeWhatsapp: ctx.store.whatsapp,
  })
  const totals = channels.reduce(
    (acc, c) => {
      const p = channelProgress(c)
      return { done: acc.done + p.done, total: acc.total + p.total }
    },
    { done: 0, total: 0 },
  )
  return json({ totals, channels: channels.map((c) => ({ ...c, progress: channelProgress(c) })) })
}
