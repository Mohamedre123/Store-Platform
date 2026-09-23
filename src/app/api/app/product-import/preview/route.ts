import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json, sameOrigin } from '@/lib/app-api'
import { guessColumns, mapRows, parseCsv, type ImportField } from '@/lib/product-csv'

export const dynamic = 'force-dynamic'

/**
 * POST /api/app/product-import/preview — `{ text, columns? }` ← الترويسة وربط الأعمدة (المخمَّن أو المختار)
 * والصفوف الجاهزة والمشاكل.
 *
 * صفحة اللوحة بتقرا الملف في المتصفح بنفس الدوال (`product-csv.ts`)؛ التطبيق بيبعت النص هنا عشان
 * الدوال ما تتكررش. ما بيكتبش أي حاجة — الاستيراد في `/csv`.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('products.manage')
  if (ctx instanceof NextResponse) return ctx

  const body = (await req.json().catch(() => ({}))) as { text?: unknown; columns?: unknown }
  const text = typeof body.text === 'string' ? body.text : ''
  if (text.length > 4_000_000) return json({ ok: false, error: 'الملف كبير أوي. قسّمه لملفات أصغر.' }, 400)

  const rows = parseCsv(text)
  if (rows.length < 2) {
    return json({ ok: false, error: 'الملف فاضي أو فيه سطر واحد بس. لازم يكون فيه ترويسة وصف واحد على الأقل.' }, 400)
  }

  const header = rows[0]
  const guessed = guessColumns(header)
  const given = body.columns && typeof body.columns === 'object' ? (body.columns as Record<string, unknown>) : null
  const columns = { ...guessed } as Record<ImportField, number>
  if (given) {
    for (const key of Object.keys(guessed) as ImportField[]) {
      const n = Number(given[key])
      if (Number.isInteger(n) && n >= -1 && n < header.length) columns[key] = n
    }
  }

  const { items, issues } = mapRows(rows.slice(1), columns)
  return json({ ok: true, header, columns, items, issues: issues.slice(0, 50), issueCount: issues.length })
}
