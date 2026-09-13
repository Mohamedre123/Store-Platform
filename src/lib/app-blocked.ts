import 'server-only'
import type { ActiveStore } from '@/lib/store-context'
import { loadBlocked } from '@/lib/blocked-data'
import { BLOCK_MATCH_LABELS } from '@/lib/blocklist-meta'

/** شكل شاشة الحظر اللي تطبيق الموبايل بيستلمه */
export async function blockedPayload(store: ActiveStore) {
  const { rows, risky } = await loadBlocked(store.id)
  return {
    matches: Object.entries(BLOCK_MATCH_LABELS).map(([key, label]) => ({ key, label })),
    rows: rows.map((r) => ({ ...r, matchLabel: BLOCK_MATCH_LABELS[r.match] })),
    risky,
  }
}
