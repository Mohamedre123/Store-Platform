import 'server-only'
import { listPosts } from '@/lib/content-schedules'
import { listAccounts } from '@/lib/social'

/**
 * بيانات صفحة البوستات — صفحة اللوحة ومسار التطبيق (`/api/app/posts`) بيقروا من هنا.
 */
export async function loadPosts(storeId: string) {
  const [posts, accounts] = await Promise.all([listPosts(storeId, 60), listAccounts(storeId)])
  return { posts, accounts }
}
