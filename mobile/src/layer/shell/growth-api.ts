/** بيانات شاشات حملات البريد وقنوات البيع والفروع واستيراد المنتجات وحسابي */
import { cachedResource } from './http'

export type CampaignAudience = 'all' | 'buyers' | 'non_buyers' | 'abandoned'
export type CampaignStatus = 'draft' | 'sending' | 'sent' | 'failed'

export type Campaign = {
  id: string
  name: string
  subject: string
  body: string
  ctaLabel: string | null
  ctaUrl: string | null
  audience: CampaignAudience
  status: CampaignStatus
  audienceCount: number
  sentCount: number
  failedCount: number
  createdAt: string
}

export type CampaignsPayload = {
  subscribers: number
  withoutEmail: number
  rows: Campaign[]
  audiences: Array<{ key: CampaignAudience; label: string; hint: string; size: number }>
}

export type ChannelStep = { label: string; hint: string; status: 'done' | 'missing'; href: string }
export type ChannelsPayload = {
  totals: { done: number; total: number }
  channels: Array<{ key: string; name: string; color: string; why: string; steps: ChannelStep[]; progress: { done: number; total: number } }>
}

export type Branch = { id: string; name: string; city: string | null; address: string | null; phone: string | null; isDefault: boolean; isActive: boolean }
export type BranchProduct = { id: string; name: string; total: number; byBranch: Record<string, number> }
export type BranchesPayload = { branches: Branch[]; products: BranchProduct[] }

export type ImportSource = {
  key: string
  name: string
  intro: string
  steps: string[]
  fields: Array<{ key: string; label: string; hint?: string; placeholder?: string; secret?: boolean }>
}
export type ImportPayload = { currency: string; sources: ImportSource[] }

export type AccountPayload = {
  name: string
  email: string
  phone: string
  publicId: string | null
  stores: Array<{ id: string; name: string; slug: string }>
}

export const campaignsData = cachedResource<CampaignsPayload>('zw-campaigns:v1', '/api/app/campaigns')
export const channelsData = cachedResource<ChannelsPayload>('zw-channels:v1', '/api/app/channels')
export const branchesData = cachedResource<BranchesPayload>('zw-branches:v1', '/api/app/branches')
export const importData = cachedResource<ImportPayload>('zw-product-import:v1', '/api/app/product-import')
export const accountData = cachedResource<AccountPayload>('zw-account:v1', '/api/app/account')

export function clearGrowthCaches(): void {
  campaignsData.clear()
  channelsData.clear()
  branchesData.clear()
  importData.clear()
  accountData.clear()
}
