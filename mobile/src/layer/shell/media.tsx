/**
 * معرض الوسائط — شاشة أصلية.
 *
 * كل صورة اتفرعت في مكان واحد، بشبكة صور وفلتر بالمجلد، وعلى كل صورة «في ٣ منتجات»
 * لو مستعملة. «صوّر» و«من المعرض» بيرفعوا صور جديدة (بتتصغّر على الموبايل الأول).
 * دوسة على صورة = لوحة: معاينة، تغيير الاسم، نسخ الرابط، مشاركة، والحذف بتأكيد
 * (المستعملة في منتج ما بتتمسحش).
 */
import { useMemo, useRef, useState } from 'preact/hooks'
import { haptic, hapticNotify } from '../bridge'
import { toast } from '../dom'
import { icons } from '../icons'
import { formatNumber } from './format'
import { postAppJson, useResource } from './http'
import { openExternal } from './navigate'
import { COPY_ICON, copyText, formatSize, mediaData, type MediaItem } from './ops-api'
import { shrink, upload } from './product-new'
import { Screen, Sheet } from './screen'
import { Icon } from './ui'

const CAMERA =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>'

export function MediaScreen({ visible, onUnavailable }: { visible: boolean; onUnavailable: () => void }) {
  const { data, failed, load } = useResource(mediaData, visible, onUnavailable)
  const [folder, setFolder] = useState('all')
  const [uploading, setUploading] = useState(0)
  const [openItem, setOpenItem] = useState<MediaItem | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const camera = useRef<HTMLInputElement>(null)
  const gallery = useRef<HTMLInputElement>(null)

  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const i of data?.items ?? []) map.set(i.folder, (map.get(i.folder) ?? 0) + 1)
    return map
  }, [data])
  const shown = useMemo(() => (folder === 'all' ? (data?.items ?? []) : (data?.items ?? []).filter((i) => i.folder === folder)), [data, folder])

  const addFiles = async (input: HTMLInputElement) => {
    const files = Array.from(input.files ?? []).slice(0, 10)
    input.value = ''
    if (!files.length) return
    haptic('LIGHT')
    setUploading(files.length)
    let ok = 0
    for (const file of files) {
      const url = await upload(await shrink(file), folder === 'all' ? 'misc' : folder)
      if (url) ok++
      setUploading((n) => n - 1)
    }
    await load()
    if (ok === files.length) {
      hapticNotify('SUCCESS')
      toast(ok === 1 ? 'الصورة اترفعت' : `${formatNumber(ok)} صور اترفعوا`, { tone: 'success' })
    } else {
      hapticNotify('ERROR')
      toast(`اترفع ${formatNumber(ok)} من ${formatNumber(files.length)} — جرّب الباقي تاني`, { tone: 'danger' })
    }
  }

  const open = (item: MediaItem) => {
    haptic('LIGHT')
    setName(item.name)
    setConfirmDelete(false)
    setOpenItem(item)
  }

  const act = async (action: 'rename' | 'delete') => {
    if (!openItem || busy) return
    haptic('LIGHT')
    setBusy(action)
    const res = await postAppJson(`/api/app/media/${encodeURIComponent(openItem.id)}/${action}`, action === 'rename' ? { name } : {})
    if (!res.ok) {
      setBusy(null)
      hapticNotify('ERROR')
      toast(res.error, { tone: 'danger' })
      return
    }
    await load()
    setBusy(null)
    hapticNotify('SUCCESS')
    toast(action === 'rename' ? 'اتغيّر الاسم' : 'الصورة اتمسحت', { tone: 'success', duration: 1800 })
    setOpenItem(null)
  }

  const share = async (item: MediaItem) => {
    haptic('LIGHT')
    try {
      await navigator.share({ title: item.name, url: item.url })
    } catch {
      /* التاجر قفل شاشة المشاركة */
    }
  }

  return (
    <Screen visible={visible} title="معرض الوسائط" onRefresh={load}>
      <div class="home-body">
        <header class="page-head rise">
          <div class="page-head-text">
            <h1 class="page-title">معرض الوسائط</h1>
            <p class="page-sub">
              {data ? `${formatNumber(data.items.length)} صورة · ${formatSize(data.totalBytes)}` : 'كل صورك في مكان واحد'}
            </p>
          </div>
        </header>

        <div class="md-upload rise">
          <button type="button" class="btn btn--primary press" disabled={uploading > 0} onClick={() => camera.current?.click()}>
            {uploading > 0 ? <span class="spinner" /> : <Icon svg={CAMERA} />}
            {uploading > 0 ? `بيترفع ${formatNumber(uploading)}…` : 'صوّر'}
          </button>
          <button type="button" class="btn btn--ghost press" disabled={uploading > 0} onClick={() => gallery.current?.click()}>
            <Icon svg={icons.image()} />
            من المعرض
          </button>
          <input ref={camera} class="np-file" type="file" accept="image/*" capture="environment" onChange={(e) => void addFiles(e.currentTarget as HTMLInputElement)} />
          <input ref={gallery} class="np-file" type="file" accept="image/*" multiple onChange={(e) => void addFiles(e.currentTarget as HTMLInputElement)} />
        </div>

        {!data ? (
          failed ? (
            <div class="empty">
              <span class="empty-icon">
                <Icon svg={icons.wifiOff()} />
              </span>
              <b>مش قادرين نجيب الصور</b>
              <p>اتأكد من النت واسحب لتحت عشان تحاول تاني.</p>
            </div>
          ) : (
            <div class="md-grid">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <span key={i} class="sk md-sk" />
              ))}
            </div>
          )
        ) : (
          <>
            {data.synced > 0 && <p class="np-note rise">لقينا {formatNumber(data.synced)} صورة مرفوعة قبل كده وضفناهم للمعرض.</p>}

            {data.items.length > 0 && (
              <div class="frail" role="tablist" aria-label="فلترة الصور">
                {[{ key: 'all', label: 'الكل' }, ...data.folders].map((f) => {
                  const n = f.key === 'all' ? data.items.length : (counts.get(f.key) ?? 0)
                  if (f.key !== 'all' && n === 0) return null
                  return (
                    <button
                      key={f.key}
                      type="button"
                      role="tab"
                      aria-selected={folder === f.key}
                      class={`fchip${folder === f.key ? ' fchip--on' : ''}`}
                      onClick={() => {
                        haptic('LIGHT')
                        setFolder(f.key)
                      }}
                    >
                      {f.label}
                      <span class="fchip-n">{formatNumber(n)}</span>
                    </button>
                  )
                })}
              </div>
            )}

            {shown.length === 0 ? (
              <div class="empty empty--compact rise">
                <span class="empty-icon">
                  <Icon svg={icons.image()} />
                </span>
                <b>مافيش صور هنا</b>
                <p>كل صورة بترفعها في منتج أو بانر أو قسم بتتسجّل هنا، وتقدر ترفع صور جديدة من فوق.</p>
              </div>
            ) : (
              <div class="md-grid rise">
                {shown.map((item) => (
                  <button key={item.id} type="button" class="md-cell press" onClick={() => open(item)} aria-label={item.name}>
                    <img src={item.url} alt="" loading="lazy" />
                    {item.usedIn > 0 && <span class="md-used">في {formatNumber(item.usedIn)} منتج</span>}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <Sheet open={Boolean(openItem)} tall title={openItem?.name ?? ''} onClose={() => setOpenItem(null)}>
        {openItem && (
          <div class="np-form ops-form">
            <img class="md-preview" src={openItem.url} alt="" />
            <p class="fine center">
              {openItem.folderLabel} · {formatSize(openItem.sizeBytes)} · {new Date(openItem.createdAt).toLocaleDateString('ar-EG')}
              {openItem.usedIn > 0 ? ` · مستعملة في ${formatNumber(openItem.usedIn)} منتج` : ''}
            </p>
            <label class="np-label">
              الاسم (ليك بس — الرابط ما بيتغيّرش)
              <span class="cp-code-row">
                <input class="np-input" value={name} maxLength={200} onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)} />
                <button type="button" class="act press cp-gen" disabled={Boolean(busy) || !name.trim() || name === openItem.name} onClick={() => void act('rename')}>
                  {busy === 'rename' ? <span class="spinner" /> : <Icon svg={icons.check()} />}
                  احفظ
                </button>
              </span>
            </label>
            <div class="cr-actions">
              <button type="button" class="act press" onClick={() => void copyText(openItem.url, 'اتنسخ الرابط')}>
                <Icon svg={COPY_ICON} />
                انسخ الرابط
              </button>
              <button type="button" class="act press" onClick={() => void share(openItem)}>
                <Icon svg={icons.share()} />
                شارك
              </button>
              <button type="button" class="act press" onClick={() => openExternal(openItem.url)}>
                <Icon svg={icons.externalLink()} />
                افتح
              </button>
            </div>
            {openItem.usedIn > 0 ? (
              <p class="np-note">الصورة دي مستعملة في {formatNumber(openItem.usedIn)} منتج — شيلها من المنتج الأول لو عايز تمسحها.</p>
            ) : confirmDelete ? (
              <div class="ex-confirm">
                <p class="sheet-text">الصورة هتتمسح من التخزين نهائيًا ومش هينفع ترجع.</p>
                <div class="btn-row">
                  <button type="button" class="btn btn--ghost press" onClick={() => setConfirmDelete(false)}>
                    رجوع
                  </button>
                  <button type="button" class="btn btn--danger press" disabled={Boolean(busy)} onClick={() => void act('delete')}>
                    {busy === 'delete' ? <span class="spinner" /> : <Icon svg={icons.trash()} />}
                    أيوه، امسحها
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" class="btn btn--ghost btn--danger-text press" onClick={() => setConfirmDelete(true)}>
                <Icon svg={icons.trash()} />
                امسح الصورة
              </button>
            )}
          </div>
        )}
      </Sheet>
    </Screen>
  )
}
