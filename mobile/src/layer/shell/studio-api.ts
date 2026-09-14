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

export function clearStudioCaches(): void {
  postsData.clear()
}
