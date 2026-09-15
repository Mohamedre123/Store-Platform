import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json, sameOrigin } from '@/lib/app-api'
import {
  linkWhatsappAction,
  saveAccessTokenAction,
  saveTemplatesAction,
  saveWhatsappAction,
  testWhatsappAction,
  unlinkWhatsappAction,
  whatsappStatusAction,
  type WaState,
} from '@/app/dashboard/settings/whatsapp/actions'
import type { TemplateKey, Templates } from '@/lib/whatsapp-templates'

export const dynamic = 'force-dynamic'
/* إنشاء الجلسة وكود المسح بيستنّوا البوابة */
export const maxDuration = 60

const TEMPLATE_KEYS: TemplateKey[] = ['otp', 'order_placed', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned']

const str = (v: unknown, max = 4000) => (typeof v === 'string' ? v.slice(0, max) : '')

function reply(res: WaState) {
  if (res?.error) return json({ ok: false, error: res.error }, 400)
  return json({ ok: true, note: res?.note ?? null })
}

/**
 * POST /api/app/whatsapp/:action — نفس أفعال صفحة واتساب:
 * `save` `{provider, apiKey, phoneId}` (المفتاح الفاضي = سيب المحفوظ)، `test` `{phone}`، `token` `{token}`،
 * `link` `{phone}` ← `{status:'connected'}` أو `{status:'scan', qrImage}`، `status` ← `{status}`، `unlink`،
 * `templates` `{templates}`.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('settings.manage')
  if (ctx instanceof NextResponse) return ctx

  const { action } = await params
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

  try {
    switch (action) {
      case 'save': {
        const provider = body.provider === 'wasender' || body.provider === 'cloud' ? body.provider : 'off'
        return reply(await saveWhatsappAction({ provider, apiKey: str(body.apiKey), phoneId: str(body.phoneId, 200) }))
      }
      case 'test':
        return reply(await testWhatsappAction(str(body.phone, 40)))
      case 'token':
        return reply(await saveAccessTokenAction(str(body.token)))
      case 'link': {
        const res = await linkWhatsappAction(str(body.phone, 40))
        if (!res.ok) return json({ ok: false, error: res.error }, 400)
        return json(res.status === 'scan' ? { ok: true, status: 'scan', qrImage: res.qrImage } : { ok: true, status: 'connected' })
      }
      case 'status':
        return json({ ok: true, status: await whatsappStatusAction() })
      case 'unlink':
        return reply(await unlinkWhatsappAction())
      case 'templates': {
        const raw = (body.templates ?? {}) as Record<string, unknown>
        const templates: Templates = {}
        for (const key of TEMPLATE_KEYS) if (typeof raw[key] === 'string') templates[key] = str(raw[key], 2000)
        return reply(await saveTemplatesAction(templates))
      }
      default:
        return json({ ok: false, error: 'not_found' }, 404)
    }
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : 'حصلت مشكلة' }, 400)
  }
}
