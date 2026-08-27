import { createHmac, timingSafeEqual } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { messageLog } from '@/db/schema'

export const runtime = 'nodejs'

type ResendEvent = {
  type?: string
  data?: {
    email_id?: string
    bounce?: { message?: string }
  }
}

/**
 * Resend signs each webhook with Svix.  We verify the raw request body here
 * before parsing it, so an outside caller can never change message statuses.
 *
 * The signing format is documented by Resend/Svix as:
 *   HMAC_SHA256("${svix-id}.${svix-timestamp}.${raw-body}")
 */
function isValidSignature(input: {
  payload: string
  id: string | null
  timestamp: string | null
  signature: string | null
  secret: string
}): boolean {
  const { payload, id, timestamp, signature, secret } = input
  if (!id || !timestamp || !signature) return false

  const issuedAt = Number(timestamp)
  if (!Number.isFinite(issuedAt) || Math.abs(Date.now() / 1000 - issuedAt) > 5 * 60) return false

  const encodedKey = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret
  let key: Buffer
  try {
    key = Buffer.from(encodedKey, 'base64')
  } catch {
    return false
  }
  if (!key.length) return false

  const expected = createHmac('sha256', key).update(`${id}.${timestamp}.${payload}`).digest('base64')
  return signature.split(' ').some((part) => {
    const [, received] = part.split(',', 2)
    if (!received) return false
    const expectedBuffer = Buffer.from(expected)
    const receivedBuffer = Buffer.from(received)
    return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer)
  })
}

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) return new Response('Webhook is not configured', { status: 503 })

  const payload = await request.text()
  if (
    !isValidSignature({
      payload,
      id: request.headers.get('svix-id'),
      timestamp: request.headers.get('svix-timestamp'),
      signature: request.headers.get('svix-signature'),
      secret,
    })
  ) {
    return new Response('Invalid webhook signature', { status: 400 })
  }

  let event: ResendEvent
  try {
    event = JSON.parse(payload) as ResendEvent
  } catch {
    return new Response('Invalid payload', { status: 400 })
  }

  const providerRef = event.data?.email_id
  if (!providerRef) return Response.json({ ok: true })

  if (event.type === 'email.delivered') {
    await db
      .update(messageLog)
      .set({ status: 'delivered', errorMessage: null })
      .where(eq(messageLog.providerRef, providerRef))
  } else if (
    event.type === 'email.bounced' ||
    event.type === 'email.complained' ||
    event.type === 'email.failed' ||
    event.type === 'email.suppressed'
  ) {
    const reason =
      event.type === 'email.bounced'
        ? event.data?.bounce?.message ?? 'ارتد البريد عند المستلم'
        : event.type === 'email.complained'
          ? 'المستلم أبلغ أن الرسالة غير مرغوب فيها'
          : event.type === 'email.suppressed'
            ? 'المزوّد منع الإرسال إلى هذا العنوان'
            : 'فشل مزوّد البريد في إرسال الرسالة'

    await db
      .update(messageLog)
      .set({ status: 'failed', errorMessage: reason })
      .where(eq(messageLog.providerRef, providerRef))
  }

  return Response.json({ ok: true })
}
