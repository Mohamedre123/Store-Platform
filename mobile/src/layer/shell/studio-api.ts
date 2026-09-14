/** بيانات شاشة البوستات (`/api/app/posts`) */
import { cachedResource } from './http'

export type SocialAccount = {
  id: string
  name: string
  platform: string
  platformLabel: string
  color: string
  status: string
}

export type PostResult = {
  accountId: string
  accountName: string
  color: string
  ok: boolean
  error: string | null
}

export type SocialPost = {
  id: string
  caption: string
  hashtags: string[]
  imageUrls: string[]
  videoUrl: string | null
  status: string
  statusLabel: string
  targets: string[]
  publishedAt: string | null
  createdAt: string
  results: PostResult[]
}

export type PostsPayload = {
  /** إضافة «استوديو المحتوى» مفعّلة؟ — النشر والحذف محتاجينها */
  studioEnabled: boolean
  posts: SocialPost[]
  accounts: SocialAccount[]
}

export const postsData = cachedResource<PostsPayload>('zw-posts:v1', '/api/app/posts')

/* ─── النشر التلقائي (`/api/app/schedules`) ─── */

export type Schedule = {
  id: string
  name: string
  isActive: boolean
  days: number[]
  timeOfDay: string
  targets: string[]
  source: 'auto' | 'category' | 'products'
  categoryId: string | null
  productIds: string[]
  style: string | null
  preset: string
  media: 'image' | 'carousel' | 'video'
  slides: number
  imageStyle: string
  aiProvider: string | null
  aiTextModel: string | null
  aiImageModel: string | null
  autoPublish: boolean
  lastRunAt: string | null
  nextRunAt: string | null
  lastError: string | null
  summary: string
}

export type SchedulesPayload = {
  studioEnabled: boolean
  timezone: string
  providers: Array<{ key: string; label: string }>
  weekdays: Array<{ day: number; label: string }>
  presets: Array<{ key: string; label: string; hint: string }>
  styles: Array<{ key: string; label: string; hint: string }>
  accounts: Array<{ id: string; name: string; platform: string; color: string }>
  categories: Array<{ id: string; name: string }>
  products: Array<{ id: string; name: string; image: string | null }>
  schedules: Schedule[]
}

export type ModelsResult =
  | { ok: true; provider: string; text: Array<{ id: string; label: string }>; image: Array<{ id: string; label: string }>; defaultText: string; defaultImage: string | null }
  | { ok: false; error: string }

export const schedulesData = cachedResource<SchedulesPayload>('zw-schedules:v1', '/api/app/schedules')

/* ─── حسابات السوشيال (`/api/app/social-accounts`) ─── */

export type LinkedAccount = {
  id: string
  name: string
  platform: string
  platformLabel: string
  color: string
  avatar: string | null
  canPublish: boolean
  status: string
  lastError: string | null
}

export type SocialAccountsPayload = { studioEnabled: boolean; viaProvider: boolean; accounts: LinkedAccount[] }

export const socialAccountsData = cachedResource<SocialAccountsPayload>('zw-social-accounts:v1', '/api/app/social-accounts')

export function clearStudioCaches(): void {
  postsData.clear()
  schedulesData.clear()
  socialAccountsData.clear()
}
