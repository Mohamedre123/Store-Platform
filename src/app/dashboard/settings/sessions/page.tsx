import { cookies } from 'next/headers'
import { and, desc, eq, gt } from 'drizzle-orm'
import { db } from '@/db'
import { sessions } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { hashToken } from '@/lib/crypto'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { SessionsList, type SessionRow } from './sessions-list'

export const metadata = { title: 'الأجهزة والجلسات' }

const SESSION_COOKIE = 'zawya_session'

/**
 * اسم الجهاز من ترويسة المتصفح.
 *
 * ## ليه مش بنعرض الترويسة زي ما هي
 * `Mozilla/5.0 (Linux; Android 13; SM-A536E) AppleWebKit/537.36…` مش
 * اسم — التاجر بيبص عليه ومش عارف ده جهازه ولا لأ. «كروم على أندرويد»
 * بيتعرف من نظرة، وده كل الغرض من الشاشة.
 */
function describe(ua: string | null): { device: 'mobile' | 'tablet' | 'desktop'; label: string } {
  const s = ua ?? ''

  const device: 'mobile' | 'tablet' | 'desktop' = /iPad|Tablet/i.test(s)
    ? 'tablet'
    : /Mobi|Android|iPhone/i.test(s)
      ? 'mobile'
      : 'desktop'

  /* الترتيب مهم: إيدج وأوبرا بيحطّوا «Chrome» في ترويستهم كمان */
  const browser = /Edg\//i.test(s)
    ? 'إيدج'
    : /OPR\/|Opera/i.test(s)
      ? 'أوبرا'
      : /Firefox\//i.test(s)
        ? 'فايرفوكس'
        : /Chrome\//i.test(s)
          ? 'كروم'
          : /Safari\//i.test(s)
            ? 'سفاري'
            : 'متصفح'

  const os = /iPhone|iPad|iOS/i.test(s)
    ? 'آيفون'
    : /Android/i.test(s)
      ? 'أندرويد'
      : /Windows/i.test(s)
        ? 'ويندوز'
        : /Mac OS X|Macintosh/i.test(s)
          ? 'ماك'
          : /Linux/i.test(s)
            ? 'لينكس'
            : null

  return { device, label: os ? `${browser} على ${os}` : browser }
}

export default async function SessionsPage() {
  const { user } = await getDashboardContext()

  const raw = (await cookies()).get(SESSION_COOKIE)?.value
  const currentHash = raw ? hashToken(raw) : null

  /*
    السارية بس.

    الجلسة المنتهية مش «جهاز داخل» — عرضها بيخلّي التاجر يشوف عشرين
    صفًا ويفتكر إن عشرين حد فاتحين حسابه.
  */
  const rows = await db
    .select({
      id: sessions.id,
      userAgent: sessions.userAgent,
      ip: sessions.ip,
      tokenHash: sessions.tokenHash,
      createdAt: sessions.createdAt,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .where(and(eq(sessions.userId, user.id), gt(sessions.expiresAt, new Date())))
    .orderBy(desc(sessions.createdAt))
    .limit(50)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="الأجهزة والجلسات"
        description="مين داخل على حسابك دلوقتي. لو فيه جهاز مش بتاعك، اقفله من هنا."
      />

      <Reveal>
        <SessionsList
          rows={rows.map((r): SessionRow => {
            const { device, label } = describe(r.userAgent)
            return {
              id: r.id,
              device,
              label,
              ip: r.ip,
              createdAt: r.createdAt.toISOString(),
              expiresAt: r.expiresAt.toISOString(),
              isCurrent: Boolean(currentHash && r.tokenHash === currentHash),
            }
          })}
        />
      </Reveal>
    </div>
  )
}
