'use client'

import { WhatsappForm } from '@/app/dashboard/settings/whatsapp/whatsapp-form'
import { TemplatesEditor } from '@/app/dashboard/settings/whatsapp/templates-editor'
import type { WhatsappSettings } from '@/lib/whatsapp'
import type { Templates } from '@/lib/whatsapp-templates'

/**
 * واتساب جوّه كارت الإضافات.
 *
 * كان في الإعدادات، والتاجر ما لقاهوش — وده منطقي: هو بيدوّر على
 * «إضافة» زي بكسل فيسبوك وجيميني، مش على إعداد جوّه إعدادات المتجر.
 *
 * نفس الشاشة بالظبط، في المكان اللي بيدوّر فيه.
 */
export function WhatsappCard({
  settings,
  templates,
  storePhone,
  hasPlatformToken,
  account,
}: {
  settings: WhatsappSettings
  templates: Templates
  storePhone: string | null
  hasPlatformToken: boolean
  /** اسم التاجر وبريده — بيتعرضوا جاهزين للنسخ عند إنشاء الحساب */
  account?: { name: string; email: string }
}) {
  return (
    <div className="flex flex-col gap-5">
      {/*
        الفرق بين الربطين — بيتقال هنا لأن ده مكان اللبس.

        الإضافة دي بتخلّي **المنصة** تبعت باسم التاجر: رمز الدخول،
        وتأكيد الطلب، وحالة الشحن. وزر الواتساب العائم في المتجر حاجة
        تانية خالص: رابط بيفتح محادثة على رقم التاجر، مالوش أي علاقة
        بالربط ده ولا محتاجه.

        التاجر اللي عايز الزر بيدخل هنا يربط ويستنى، أو بيربط هنا
        ويستغرب إن الزر مش ظاهر. السطرين دول بيوفّروا عليه الدورة.
      */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3 text-xs leading-relaxed text-[var(--fg-muted)]">
        <span className="font-medium text-[var(--fg)]">مش ده اللي بتدوّر عليه؟</span>{' '}
        الربط ده عشان <strong>المنصة تبعت رسايل باسمك</strong> (رمز الدخول، تأكيد الطلب،
        حالة الشحن).
        <br />
        أما <strong>زر واتساب العائم</strong> اللي العميل بيضغطه عشان يكلّمك، فمالوش
        علاقة بالربط ده — بيشتغل برقم متجرك وبس. تلاقيه في{' '}
        <a href="/dashboard/storefront/customize" className="text-[var(--primary)] underline">
          تخصيص المتجر ← شريط الأدوات
        </a>{' '}
        (ومعاه زر تيليجرام)، والرقم نفسه من{' '}
        <a href="/dashboard/settings" className="text-[var(--primary)] underline">
          إعدادات ← بيانات المتجر
        </a>
        .
      </div>

      <WhatsappForm
        initial={settings}
        easyLink
        storePhone={storePhone}
        hasPlatformToken={hasPlatformToken}
        account={account}
      />
      <TemplatesEditor initial={templates} />
    </div>
  )
}
