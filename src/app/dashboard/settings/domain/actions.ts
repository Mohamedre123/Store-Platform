'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { startEmailDomain } from '@/lib/store-email-domain'
import { and, eq, ne } from 'drizzle-orm'
import { db } from '@/db'
import { stores } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { featureBlock } from '@/lib/entitlements'
import { checkDomain, dnsRecordsFor, validateDomain, type DnsRecord } from '@/lib/custom-domain'
import { registerDomain, unregisterDomain, vercelDomainsReady } from '@/lib/vercel-domains'
import { generateToken } from '@/lib/crypto'

export type DomainState = {
  error?: string
  notice?: string
  domain?: string
  token?: string
  records?: DnsRecord[]
  verified?: boolean
} | null

/** رمز التحقق مشتقّ من معرّف المتجر — ثابت ولا يحتاج عمودًا إضافيًا */
function tokenFor(storeId: string) {
  return 'zawya-verify-' + storeId.replace(/-/g, '').slice(0, 24)
}

/**
 * رسالة عطل الربط بصيغة تنفع للتاجر.
 *
 * أعطال المفاتيح الناقصة مسؤوليتنا إحنا لا التاجر، فما ينفعش نحطّ
 * اسم متغيّر بيئة في وشّه — هو مالوش فيه حاجة يعملها. بيروح للّوج
 * عشان نشوفه، وهو بيشوف إن المشكلة عندنا وإحنا اللي هنحلّها.
 */
function linkError(reason: string): string {
  if (/VERCEL_(API_TOKEN|PROJECT_ID)/.test(reason)) {
    console.error('ربط النطاقات مش مضبوط:', reason)
    return 'ربط النطاقات مش مفعّل عندنا دلوقتي. كلّمنا وهنظبّطه ليك.'
  }
  return reason
}

export async function saveDomainAction(_prev: DomainState, formData: FormData): Promise<DomainState> {
  /*
    الربط والتحقّق مقفولين على غير المشترك — **الفكّ مفتوح**.

    التاجر اللي اشتراكه خلص لازم يفضل قادر يشيل النطاق ويرجّع متجره
    على نطاقه الفرعي. القفل اللي بيحبسه على إعداد مش شغّال بيحوّل
    انتهاء الاشتراك لمشكلة في متجره هو.
  */
  const blocked = await featureBlock('customDomain')
  if (blocked) return blocked

  const { store } = await getDashboardContext()

  const parsed = validateDomain(String(formData.get('domain') ?? ''))
  if (!parsed.ok) return { error: parsed.error }

  const [taken] = await db
    .select({ id: stores.id })
    .from(stores)
    .where(and(eq(stores.customDomain, parsed.domain), ne(stores.id, store.id)))
    .limit(1)

  if (taken) return { error: 'النطاق ده مربوط بمتجر تاني بالفعل.' }

  await db
    .update(stores)
    .set({ customDomain: parsed.domain, customDomainVerifiedAt: null })
    .where(eq(stores.id, store.id))

  /*
    التسجيل على المستضيف **من لحظة الحفظ** لا بعد التحقّق.

    Vercel بيبدأ يصدر شهادة SSL أول ما النطاق يتسجّل عنده ويلاقي
    الـDNS موجّه. لو أجّلنا التسجيل لحد ما التاجر يدوس «تحقّق»،
    بنكون ضيّعنا الوقت اللي كانت الشهادة ممكن تتصدر فيه وهو بيظبّط
    سجلاته — فيدوس تحقّق ويستنى تاني من غير داعي.

    ولو النطاق مربوط بمشروع تاني على Vercel، بيعرف دلوقتي مش بعد
    ما يقعد يظبّط DNS على الفاضي.
  */
  const token = tokenFor(store.id)
  const link = await registerDomain(parsed.domain)

  revalidatePath('/dashboard/settings/domain')

  return {
    domain: parsed.domain,
    token,
    records: dnsRecordsFor(parsed.domain, token),
    ...(link.error
      ? { error: linkError(link.error) }
      : { notice: 'ضيف السجلات دي في لوحة نطاقك، وبعدها اضغط «تحقّق».' }),
  }
}

export async function verifyDomainAction(): Promise<DomainState> {
  const blocked = await featureBlock('customDomain')
  if (blocked) return blocked

  const { store } = await getDashboardContext()
  if (!store.customDomain) return { error: 'مافيش نطاق مضاف.' }

  const token = tokenFor(store.id)
  const result = await checkDomain(store.customDomain, token)

  /* الـDNS غلط — مفيش لازمة نسأل المستضيف أصلًا */
  if (!result.ownershipVerified || !result.pointingCorrectly) {
    return { verified: false, error: result.message }
  }

  /*
    التسجيل على المشروع — ده اللي كان ناقص وخلّى النطاق يقف على 404.

    الـDNS كان بيتظبط صح وإحنا نقول «شغّال»، لكن Vercel ما كانش يعرف
    إن النطاق ده بتاعنا: الزائر بيوصل لسيرفراته، يبص في نطاقاته ما
    يلاقيهوش، فيرد DEPLOYMENT_NOT_FOUND. توجيه بلا تسجيل = صفحة 404
    على نطاق كل سجلاته مضبوطة.

    والاستدعاء idempotent — «موجود قبل كده» بيتحسب نجاحًا.
  */
  const link = await registerDomain(store.customDomain)

  if (link.error) {
    return { verified: false, error: linkError(link.error) }
  }

  if (!link.registered) {
    return {
      verified: false,
      error: 'سجلاتك مظبوطة، بس تسجيل النطاق عند المستضيف ما تمّش. جرّب تاني بعد شوية.',
    }
  }

  if (!link.verified) {
    /*
      Vercel ساعات بيطلب سجل تحقّق خاص بيه فوق سجلاتنا — بيحصل لما
      النطاق مستخدَم في حساب تاني. بنعرضه بدل ما نقول «شغّال» وهو لأ.
    */
    const extra = link.challenges
      .map((c) => c.type.toUpperCase() + ' على ' + c.domain + ' = ' + c.value)
      .join(' · ')
    return {
      verified: false,
      error: extra
        ? 'المستضيف طالب سجل تحقّق إضافي: ' + extra
        : 'النطاق اتسجّل ولسه بيتأكّد منه. استنى دقيقة واضغط «تحقّق» تاني.',
    }
  }

  {
    await db
      .update(stores)
      .set({ customDomainVerifiedAt: new Date() })
      .where(eq(stores.id, store.id))

    /**
     * البريد بيتظبط لوحده مع النطاق — من غير أي خطوة زيادة.
     *
     * **التاجر ما يصحّش يتعلّم إن فيه صفحة تانية لازم يفتحها.** هو
     * وثّق نطاقه خلاص، والبريد جزء من نطاقه زي الموقع بالظبط. فبنسجّل
     * `mail.<نطاقه>` عند مزوّد البريد في نفس اللحظة، والسجلات بتظهر
     * له في صفحة النطاق مع باقي سجلاته.
     *
     * ولو فشل، النطاق بيفضل موثّقًا للموقع والبريد بيكمّل من نطاق
     * المنصة — عطل في البريد ما يصحّش يمنع متجره من الاشتغال.
     */
    after(
      startEmailDomain(store.id).catch((e) =>
        console.error('فشل تجهيز بريد النطاق:', e),
      ),
    )

    revalidatePath('/dashboard/settings/domain')
    revalidatePath('/dashboard/settings/email')
    return {
      verified: true,
      notice:
        'النطاق اتربط واتسجّل عند المستضيف. الشهادة بتتصدر خلال دقايق وبعدها يفتح على https.',
    }
  }
}

export async function removeDomainAction(): Promise<DomainState> {
  const { store } = await getDashboardContext()
  const previous = store.customDomain

  await db
    .update(stores)
    .set({ customDomain: null, customDomainVerifiedAt: null })
    .where(eq(stores.id, store.id))

  /*
    الشيل من المشروع كمان.

    النطاق اللي بيفضل متسجّل عندنا بعد ما التاجر شاله بيمنع أي حد
    تاني — بما فيهم صاحبه نفسه — إنه يربطه في مشروع تاني، ورسالة
    الرفض ساعتها بتقول «مستخدَم» من غير ما حد يعرف فين.
  */
  if (previous) {
    after(unregisterDomain(previous).catch((e) => console.error('فشل شيل النطاق:', e)))
  }

  revalidatePath('/dashboard/settings/domain')
  return { notice: 'اتشال الربط. متجرك شغّال على نطاقه الفرعي زي الأول.' }
}
