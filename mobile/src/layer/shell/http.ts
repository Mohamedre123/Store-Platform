/**
 * طلبات الشاشات الأصلية — قراءة بكاش على الجهاز، وأفعال POST برسايل عربي واضحة.
 */
import { useCallback, useEffect, useRef, useState } from 'preact/hooks'

export type Result<T> =
  | { kind: 'ok'; data: T; at: number }
  | { kind: 'unauthorized' }
  | { kind: 'unavailable' }
  | { kind: 'error' }

async function getJson<T>(url: string): Promise<Result<T>> {
  try {
    const res = await fetch(url, { credentials: 'same-origin', cache: 'no-store', headers: { accept: 'application/json' } })
    const isJson = (res.headers.get('content-type') ?? '').includes('application/json')
    if (res.status === 401) return { kind: 'unauthorized' }
    /* 404 مش JSON = المسار لسه مش منشور على الموقع — الشاشة بترجع لصفحة المنصة */
    if (res.status === 404 && !isJson) return { kind: 'unavailable' }
    if (!res.ok || !isJson) return { kind: isJson ? 'error' : 'unavailable' }
    return { kind: 'ok', data: (await res.json()) as T, at: Date.now() }
  } catch {
    return { kind: 'error' }
  }
}

export type Resource<T> = {
  read(): { at: number; data: T } | null
  clear(): void
  fetch(): Promise<Result<T>>
}

/** بيانات شاشة بتتحفظ على الجهاز — الشاشة بتفتح فورًا من آخر نسخة وبتتحدّث في الخلفية */
export function cachedResource<T>(key: string, url: string): Resource<T> {
  return {
    read() {
      try {
        const raw = localStorage.getItem(key)
        return raw ? JSON.parse(raw) : null
      } catch {
        return null
      }
    },
    clear() {
      try {
        localStorage.removeItem(key)
      } catch {
        /* تجاهل */
      }
    },
    async fetch() {
      const res = await getJson<T>(url)
      if (res.kind === 'ok') {
        try {
          localStorage.setItem(key, JSON.stringify({ at: res.at, data: res.data }))
        } catch {
          /* الشاشة شغّالة من غير كاش */
        }
      }
      return res
    },
  }
}

export function useResource<T>(resource: Resource<T>, visible: boolean, onUnavailable: () => void, maxAge = 30_000) {
  const [state, setState] = useState(() => resource.read())
  const [failed, setFailed] = useState(false)
  const busy = useRef(false)

  const load = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    const res = await resource.fetch()
    busy.current = false
    if (res.kind === 'ok') {
      setState({ at: res.at, data: res.data })
      setFailed(false)
    } else if (res.kind === 'unavailable') onUnavailable()
    else if (res.kind === 'error') setFailed(true)
  }, [onUnavailable])

  useEffect(() => {
    if (visible && (!state || Date.now() - state.at > maxAge)) void load()
  }, [visible])

  return { data: state?.data ?? null, failed, load }
}

const ARABIC = /[؀-ۿ]/

export async function postAppJson<T = Record<string, unknown>>(
  url: string,
  body: object = {},
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(body),
    })
    const data = (await res.json().catch(() => null)) as (T & { ok?: boolean; error?: unknown }) | null
    if (res.ok && data?.ok) return { ok: true, data }
    if (res.status === 401) return { ok: false, error: 'الجلسة خلصت — سجّل دخول تاني' }
    if (res.status === 403) return { ok: false, error: 'ماعندكش صلاحية للإجراء ده' }
    return {
      ok: false,
      error: typeof data?.error === 'string' && ARABIC.test(data.error) ? data.error : 'ما قدرناش نكمّل — جرّب تاني',
    }
  } catch {
    return { ok: false, error: 'مفيش اتصال — جرّب تاني لما النت يرجع' }
  }
}
