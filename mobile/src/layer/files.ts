/**
 * الملفات: التنزيل، المشاركة، والطباعة.
 *
 * كل التلاتة بيشتغلوا في المتصفح وبيقعوا جوّه WebView:
 * - رابط `download` أو ملف `blob:` → الـWebView بيتجاهله، فالتاجر يدوس
 *   «تصدير» ومفيش حاجة تحصل.
 * - `navigator.share` مش موجود على أندرويد WebView أصلًا.
 * - `window.print()` ما بيعملش حاجة.
 *
 * هنا بناخد البيانات من الصفحة ونسلّمها للطبقة الأصلية تتصرّف بيها.
 */
import { IS_ANDROID, SITE_HOST } from './env'
import { native } from './bridge'
import { toast } from './dom'

const blobs = new Map<string, Blob>()

function trackBlobs(): void {
  const create = URL.createObjectURL.bind(URL)
  const revoke = URL.revokeObjectURL.bind(URL)

  URL.createObjectURL = (object: Blob | MediaSource) => {
    const url = create(object)
    if (object instanceof Blob) {
      blobs.set(url, object)
      setTimeout(() => blobs.delete(url), 120_000)
    }
    return url
  }

  /*
    المنصة بتعمل `a.click()` وبعدها `revokeObjectURL` على طول. في المتصفح
    التنزيل بيبدأ في نفس اللحظة، لكن هنا القراءة غير متزامنة — فالرابط
    كان هيتلغي قبل ما نقرا الملف. بنأخّر الإلغاء دقيقة.
  */
  URL.revokeObjectURL = (url: string) => {
    setTimeout(() => revoke(url), 60_000)
  }
}

const MIME: Record<string, string> = {
  pdf: 'application/pdf',
  csv: 'text/csv',
  json: 'application/json',
  txt: 'text/plain',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  zip: 'application/zip',
  xml: 'application/xml',
}

const guessMime = (name: string) => MIME[name.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream'

const cleanName = (name: string) => name.replace(/[\\/:*?"<>|]+/g, '-').trim().slice(0, 120) || 'zawya-file'

function nameFromDisposition(header: string | null): string | null {
  if (!header) return null
  const star = header.match(/filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i)
  if (star) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ''))
    } catch {
      /* نكمّل على الشكل العادي */
    }
  }
  const plain = header.match(/filename\s*=\s*"?([^";]+)"?/i)
  return plain ? plain[1].trim() : null
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

async function resolveFile(href: string, suggested: string): Promise<{ blob: Blob; name: string }> {
  const known = blobs.get(href)
  if (known) return { blob: known, name: suggested || `zawya-${Date.now()}` }

  const res = await fetch(href, { credentials: 'include' })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const blob = await res.blob()
  const fromHeader = nameFromDisposition(res.headers.get('content-disposition'))
  const fromPath = decodeURIComponent(new URL(href, location.href).pathname.split('/').pop() || '')
  return { blob, name: suggested || fromHeader || fromPath || `zawya-${Date.now()}` }
}

let saving = false

async function saveFile(href: string, suggested: string): Promise<void> {
  if (saving) return
  saving = true
  const slow = setTimeout(() => toast('بنجهّز الملف…', { duration: 1600 }), 450)
  try {
    const { blob, name: rawName } = await resolveFile(href, suggested)
    let name = cleanName(rawName)
    const mimeType = blob.type || guessMime(name)
    if (!name.includes('.')) {
      const ext = Object.keys(MIME).find((k) => MIME[k] === mimeType)
      if (ext) name = `${name}.${ext}`
    }
    const data = await blobToBase64(blob)
    const result = await native<{ uri?: string }>('ZawyaShell', 'saveFile', { name, mimeType, data })
    clearTimeout(slow)
    if (!result) throw new Error('native save failed')
    /* على iOS شاشة الحفظ نفسها هي التأكيد */
    if (IS_ANDROID) {
      const uri = result.uri
      toast(`اتحفظ «${name}» في التنزيلات`, {
        tone: 'success',
        action: uri ? { label: 'فتح', run: () => void native('ZawyaShell', 'openFile', { uri, mimeType }) } : undefined,
      })
    }
  } catch (err) {
    clearTimeout(slow)
    console.debug('[zawya] save failed', err)
    toast('ما قدرناش نحفظ الملف. جرّب تاني.', { tone: 'danger' })
  } finally {
    saving = false
  }
}

/**
 * الروابط اللي لازم تتحفظ بدل ما تتفتح.
 *
 * على iOS كمان روابط الفواتير والكتالوج: الـWebView بيحاول يعرضها ولما
 * يلاقيها «مرفق» بيوقف بصمت. على أندرويد الطبقة الأصلية بتلقطها كتنزيل.
 */
function shouldSave(anchor: HTMLAnchorElement): boolean {
  const href = anchor.getAttribute('href') ?? ''
  if (!href || href.startsWith('#') || href.startsWith('javascript:')) return false
  if (anchor.hasAttribute('download') || href.startsWith('blob:') || href.startsWith('data:')) return true
  if (IS_ANDROID) return false
  try {
    const url = new URL(anchor.href)
    return url.host === SITE_HOST && (url.pathname.startsWith('/api/invoice/') || url.pathname.startsWith('/api/feeds/'))
  } catch {
    return false
  }
}

function interceptDownloads(): void {
  const nativeClick = HTMLAnchorElement.prototype.click
  /* روابط التنزيل المتولّدة بالكود ومش مضافة للصفحة — ما بتطلعش حدث click نقدر نسمعه */
  HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
    if (shouldSave(this)) {
      void saveFile(this.href, this.getAttribute('download') ?? '')
      return
    }
    nativeClick.call(this)
  }

  document.addEventListener(
    'click',
    (event) => {
      if (event.defaultPrevented) return
      const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!anchor || !shouldSave(anchor)) return
      event.preventDefault()
      void saveFile(anchor.href, anchor.getAttribute('download') ?? '')
    },
    true,
  )
}

function installShare(): void {
  /* ‏iOS عنده مشاركة أصلية شغّالة في الـWebView — بنسيبها */
  if (!IS_ANDROID && typeof navigator.share === 'function') return

  const share = async (data: ShareData = {}): Promise<void> => {
    const files = data.files ? Array.from(data.files) : []
    const text = [data.text, data.url].filter(Boolean).join('\n')
    let result: unknown
    if (files.length) {
      const payload = await Promise.all(
        files.map(async (file) => ({
          name: cleanName(file.name || 'zawya-file'),
          mimeType: file.type || guessMime(file.name || ''),
          data: await blobToBase64(file),
        })),
      )
      result = await native('ZawyaShell', 'shareFiles', { files: payload, text, title: data.title ?? '' })
    } else {
      result = await native('Share', 'share', { title: data.title, text: data.text, url: data.url, dialogTitle: 'مشاركة' })
    }
    /* نفس سلوك المتصفح: الإلغاء بيرمي AbortError والكود بيتجاهله */
    if (result === undefined) throw new DOMException('Share canceled', 'AbortError')
  }

  Object.defineProperty(navigator, 'share', { value: share, configurable: true, writable: true })
  Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true, writable: true })
}

export function installFileSupport(): void {
  trackBlobs()
  interceptDownloads()
  installShare()
  window.print = () => {
    void native('ZawyaShell', 'print', { title: document.title })
  }
}
