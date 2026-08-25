import { NextResponse, type NextRequest } from 'next/server'
import { sendToAssistantAction } from '@/app/dashboard/assistant/actions'

export const dynamic = 'force-dynamic'

/**
 * مساعد اللوحة — مسار مستقل بمهلته.
 *
 * ## ليه مسار مش فعل خادم زي ما كان
 * **`maxDuration` بتتحدّد على الصفحة اللي بتنادي الفعل، لا على ملف
 * الفعل نفسه.** ولوحة المساعد بتتعرض في تخطيط اللوحة كله — يعني
 * الفعل بيتنادى من ٣٠ صفحة، كل واحدة بمهلة المضيف الافتراضية.
 *
 * والمساعد المنفّذ بيلفّ على الموديل أكتر من مرة (يقرا الطلبات،
 * يشوف النتيجة، يقرّر)، فأول سؤال محتاج أداة كان بيتقطع في نصّه
 * والتاجر بيشوف «TimeoutError» بالإنجليزي.
 *
 * المسار ليه مهلته هو — والصفحات اللي بتعرض اللوحة ما بتتأثرش.
 *
 * ## الأمان
 * الفعل نفسه بينادي `getDashboardContext` جوّاه، وهي بتوجّه لصفحة
 * الدخول لو مفيش جلسة. فالمسار ده مالوش أي امتياز زيادة — نفس
 * الحاجز بالظبط، مكان تنفيذ مختلف.
 */
export const maxDuration = 60

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'طلب غير صالح' }, { status: 400 })
  }

  try {
    const res = await sendToAssistantAction(body)
    return NextResponse.json(res)
  } catch (e) {
    /*
      الانهيار بيتسجّل بنصّه عندنا، والتاجر بياخد جملة يفهمها.
      «حصلت مشكلة» من غير سجل بتخلّينا نخمّن لما يشتكي.
    */
    console.error('انهيار في مساعد اللوحة:', e)
    return NextResponse.json({
      ok: false,
      error: 'المساعد وقف فجأة. جرّب تاني، ولو تكرر ابعتلنا رقم الطلب.',
    })
  }
}
