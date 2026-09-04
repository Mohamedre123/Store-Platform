import type { CampaignAudience } from '@/db/schema'

/**
 * جماهير الحملات بأسمائها العربية.
 *
 * ملف مستقل عن `campaigns.ts` لأن ده `server-only`: الإرسال بيلمس
 * قاعدة البيانات ومزوّد البريد، والشاشة محتاجة الأسماء بس. نفس
 * النمط اللي في `blocklist-meta` و`media-meta`.
 */
export const AUDIENCE_META: Record<CampaignAudience, { label: string; hint: string }> = {
  all: { label: 'كل المشتركين', hint: 'كل اللي موافق يستقبل رسايلك' },
  buyers: { label: 'اللي اشتروا قبل كده', hint: 'أعلى نسبة استجابة — بيعرفوك خلاص' },
  non_buyers: { label: 'اللي ما اشتروش لسه', hint: 'سجّلوا بريدهم وما كمّلوش' },
  abandoned: { label: 'اللي ساب سلته', hint: 'حطّ في السلة ومكمّلش الطلب' },
}
