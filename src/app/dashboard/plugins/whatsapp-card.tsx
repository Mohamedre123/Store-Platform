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
}: {
  settings: WhatsappSettings
  templates: Templates
  storePhone: string | null
  hasPlatformToken: boolean
}) {
  return (
    <div className="flex flex-col gap-5">
      <WhatsappForm
        initial={settings}
        easyLink
        storePhone={storePhone}
        hasPlatformToken={hasPlatformToken}
      />
      <TemplatesEditor initial={templates} />
    </div>
  )
}
