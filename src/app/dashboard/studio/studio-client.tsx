'use client'

import { useMemo, useState, useTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  Check,
  Copy,
  Download,
  Image as ImageIcon,
  Loader2,
  Package,
  Send,
  Sparkles,
  Type,
  Wand2,
  X,
} from 'lucide-react'
import {
  generateCopyAction,
  generateImageAction,
  savePostAction,
  searchProductsAction,
} from './actions'
import { PRESETS, TONES, platformOf, presetOf, type PresetKey, type ToneKey } from '@/lib/studio-meta'
import { Alert, Card } from '@/components/ui'
import { toast } from '@/components/dashboard/toast'
import { cn } from '@/lib/utils'

type Product = { id: string; name: string; image: string | null }
type Account = { id: string; platform: string; name: string; status: string }
type Asset = { id: string; url: string; prompt: string; preset: string }

/**
 * أداة الاستوديو.
 *
 * ## الصورة والكلام في شاشة واحدة لا شاشتين
 * البوست حاجة واحدة. لو الصورة في مكان والكلام في مكان، التاجر
 * بيعمل صورة وينسى الكلام أو العكس — والناتج نُصّ بوست في كل مرة.
 *
 * ## والتعديل بالكلام لا بالأزرار
 * «خلّي الخلفية أغمق» أسهل من عشرين شريط تمرير، وهي الطريقة اللي
 * التاجر متعوّد عليها من تطبيقات الذكاء الاصطناعي أصلًا. وكل تعديل
 * بيتحفظ كصورة جديدة، فالرجوع للي قبله ضغطة.
 */
export function StudioClient({
  hasKey,
  products,
  accounts,
  assets,
}: {
  hasKey: boolean
  products: Product[]
  accounts: Account[]
  assets: Asset[]
}) {
  /* المنتج */
  const [product, setProduct] = useState<Product | null>(null)
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<Product[]>(products)
  const [searching, startSearch] = useTransition()

  /* الصورة */
  const [preset, setPreset] = useState<PresetKey>('square')
  const [imagePrompt, setImagePrompt] = useState('')
  const [useProductPhoto, setUseProductPhoto] = useState(true)
  /* سلسلة التعديل — آخر واحدة هي المعروضة، والرجوع بيقصّ من الآخر */
  const [chain, setChain] = useState<Array<{ id: string; url: string; prompt: string }>>([])
  const [editPrompt, setEditPrompt] = useState('')
  const [imgError, setImgError] = useState<string | null>(null)
  const [makingImage, startImage] = useTransition()

  /* الكلام */
  const [tone, setTone] = useState<ToneKey>('sell')
  const [extra, setExtra] = useState('')
  const [caption, setCaption] = useState('')
  const [hashtags, setHashtags] = useState<string[]>([])
  const [copyError, setCopyError] = useState<string | null>(null)
  const [writing, startCopy] = useTransition()

  /* النشر */
  const [targets, setTargets] = useState<string[]>([])
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, startSave] = useTransition()

  const current = chain.at(-1) ?? null
  const live = accounts.filter((a) => a.status === 'active')

  const shape = useMemo(() => presetOf(preset).css, [preset])

  function search(q: string) {
    setQuery(q)
    startSearch(async () => {
      setFound(await searchProductsAction(q))
    })
  }

  function makeImage(edit: boolean) {
    const prompt = edit ? editPrompt.trim() : imagePrompt.trim()
    if (!prompt) return

    setImgError(null)
    startImage(async () => {
      const res = await generateImageAction({
        prompt,
        preset,
        productId: product?.id ?? null,
        parentId: edit ? (current?.id ?? null) : null,
        useProductPhoto: !edit && useProductPhoto,
      })

      if (!res.ok) {
        setImgError(res.error)
        return
      }

      setChain((c) => (edit ? [...c, res] : [res]))
      setEditPrompt('')
    })
  }

  function write() {
    setCopyError(null)
    startCopy(async () => {
      const res = await generateCopyAction({
        productId: product?.id ?? null,
        tone,
        extra: extra.trim() || null,
      })
      if (!res.ok) setCopyError(res.error)
      else {
        setCaption(res.caption)
        setHashtags(res.hashtags)
      }
    })
  }

  function save(publishNow: boolean) {
    setSaveError(null)
    startSave(async () => {
      const res = await savePostAction({
        caption,
        hashtags,
        imageUrls: current ? [current.url] : [],
        productId: product?.id ?? null,
        targets,
        publishNow,
      })
      if (res.error) setSaveError(res.error)
      else toast(publishNow ? 'اتنشر' : 'اتحفظ في البوستات')
    })
  }

  if (!hasKey) {
    return (
      <Card className="flex flex-col items-center gap-3 px-6 py-10 text-center">
        <Sparkles className="h-7 w-7 text-[var(--primary)]" aria-hidden="true" />
        <h2 className="font-bold">محتاج مفتاح Gemini</h2>
        <p className="max-w-md text-sm leading-relaxed text-[var(--fg-muted)]">
          الاستوديو بيشتغل بنفس المفتاح اللي في «الردّ على عملائك» أو «مساعدك في إدارة المتجر» —
          مش محتاج مفتاح تالت. حطّه من الإضافات وارجع.
        </p>
        <Link
          href="/dashboard/plugins"
          className="mt-1 flex h-11 items-center rounded-lg bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-fg)]"
        >
          حطّ المفتاح
        </Link>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── المنتج ─────────────────────────────────────── */}
      <Card className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-semibold">
            <Package className="h-4 w-4 text-[var(--primary)]" aria-hidden="true" />
            المنتج
          </h2>
          {product && (
            <button
              type="button"
              onClick={() => setProduct(null)}
              className="text-xs text-[var(--fg-muted)] underline"
            >
              شيل الاختيار
            </button>
          )}
        </div>

        {product ? (
          <div className="flex items-center gap-3 rounded-lg border border-[var(--primary)] bg-[var(--primary-soft)] p-2.5">
            {product.image && (
              <Image
                src={product.image}
                alt=""
                width={44}
                height={44}
                className="h-11 w-11 shrink-0 rounded-lg object-cover"
              />
            )}
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{product.name}</span>
            <Check className="h-4 w-4 shrink-0 text-[var(--primary)]" aria-hidden="true" />
          </div>
        ) : (
          <>
            <input
              value={query}
              onChange={(e) => search(e.target.value)}
              placeholder="دوّر باسم المنتج… أو سيبها فاضية لبوست عن المتجر كله"
              aria-label="بحث في المنتجات"
              className="h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm focus:border-[var(--primary)] focus:outline-none"
            />
            <div className="scroll-x flex gap-2 pb-1">
              {found.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProduct(p)}
                  className="flex w-28 shrink-0 flex-col gap-1.5 rounded-lg border border-[var(--border)] p-2 text-start transition-colors hover:border-[var(--primary)]"
                >
                  <span className="relative block aspect-square w-full overflow-hidden rounded-md bg-[var(--surface-2)]">
                    {p.image && <Image src={p.image} alt="" fill sizes="112px" className="object-cover" />}
                  </span>
                  <span className="line-clamp-2 text-xs leading-snug">{p.name}</span>
                </button>
              ))}
              {found.length === 0 && !searching && (
                <p className="py-3 text-sm text-[var(--fg-muted)]">مفيش منتجات مطابقة.</p>
              )}
            </div>
          </>
        )}
      </Card>

      {/* ── الصورة ─────────────────────────────────────── */}
      <Card className="flex flex-col gap-4 p-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <ImageIcon className="h-4 w-4 text-[var(--primary)]" aria-hidden="true" />
          الصورة
        </h2>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-[var(--fg-muted)]">المقاس</span>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPreset(p.key)}
                title={p.hint}
                className={cn(
                  'flex h-10 items-center gap-1.5 rounded-lg border px-3 text-sm transition-colors',
                  preset === p.key
                    ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]'
                    : 'border-[var(--border-strong)] text-[var(--fg-muted)]',
                )}
              >
                {p.label}
                <span className="tabular text-[11px] opacity-60">{p.ratio}</span>
              </button>
            ))}
          </div>
        </div>

        {!current ? (
          <>
            <textarea
              value={imagePrompt}
              onChange={(e) => setImagePrompt(e.target.value)}
              rows={3}
              placeholder="مثال: المنتج على رخام فاتح، إضاءة طبيعية من الشباك، ورد أبيض جنبه، وجملة «وصل حديثًا» فوق"
              className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] p-3 text-sm leading-relaxed focus:border-[var(--primary)] focus:outline-none"
            />

            {product?.image && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={useProductPhoto}
                  onChange={(e) => setUseProductPhoto(e.target.checked)}
                  className="h-4 w-4"
                />
                ابدأ من صورة المنتج نفسها
                <span className="text-xs text-[var(--fg-muted)]">
                  (عشان يطلع منتجك إنت لا حاجة شبهه)
                </span>
              </label>
            )}

            <button
              type="button"
              disabled={makingImage || imagePrompt.trim().length < 3}
              onClick={() => makeImage(false)}
              className="flex h-11 w-fit items-center gap-2 rounded-lg bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-fg)] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {makingImage ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Wand2 className="h-4 w-4" aria-hidden="true" />
              )}
              {makingImage ? 'بيرسم…' : 'اعمل الصورة'}
            </button>
          </>
        ) : (
          <div className="flex flex-col gap-3">
            <div
              className={cn(
                'relative w-full max-w-sm overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-2)]',
                shape,
              )}
            >
              <Image src={current.url} alt={current.prompt} fill sizes="384px" className="object-cover" />
            </div>

            {/*
              التعديل بالكلام.

              كل تعديل بيتحفظ كصورة جديدة وأبوه بيفضل موجود — فالرجوع
              مجرد قصّ من آخر السلسلة، والتاجر مش بيخسر تعديلًا عجبه
              عشان اللي بعده طلع وحش.
            */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-[var(--fg-muted)]">
                عدّل عليها بالكلام — «خلّي الخلفية أغمق»، «كبّر الخط»، «شيل الورد»
              </span>
              <div className="flex flex-wrap gap-2">
                <input
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && editPrompt.trim()) makeImage(true)
                  }}
                  placeholder="اكتب التعديل واضغط Enter"
                  aria-label="تعديل الصورة"
                  className="h-11 min-w-0 flex-1 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm focus:border-[var(--primary)] focus:outline-none"
                />
                <button
                  type="button"
                  disabled={makingImage || !editPrompt.trim()}
                  onClick={() => makeImage(true)}
                  className="flex h-11 items-center gap-2 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-fg)] disabled:opacity-50"
                >
                  {makingImage ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Wand2 className="h-4 w-4" aria-hidden="true" />
                  )}
                  عدّل
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {chain.length > 1 && (
                <button
                  type="button"
                  onClick={() => setChain((c) => c.slice(0, -1))}
                  className="flex h-10 items-center gap-1.5 rounded-lg border border-[var(--border-strong)] px-3 text-sm text-[var(--fg-muted)]"
                >
                  رجّع اللي قبله
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setChain([])
                  setEditPrompt('')
                }}
                className="flex h-10 items-center gap-1.5 rounded-lg border border-[var(--border-strong)] px-3 text-sm text-[var(--fg-muted)]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
                صورة جديدة
              </button>
              <a
                href={current.url}
                download
                target="_blank"
                rel="noreferrer"
                className="flex h-10 items-center gap-1.5 rounded-lg border border-[var(--border-strong)] px-3 text-sm text-[var(--fg-muted)]"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                نزّلها
              </a>
              {chain.length > 1 && (
                <span className="flex h-10 items-center text-xs text-[var(--fg-subtle)]">
                  تعديل {chain.length - 1}
                </span>
              )}
            </div>
          </div>
        )}

        {imgError && <Alert tone="danger">{imgError}</Alert>}
      </Card>

      {/* ── الكلام ─────────────────────────────────────── */}
      <Card className="flex flex-col gap-4 p-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <Type className="h-4 w-4 text-[var(--primary)]" aria-hidden="true" />
          كلام البوست
        </h2>

        <div className="flex flex-wrap gap-1.5">
          {TONES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTone(t.key)}
              title={t.hint}
              className={cn(
                'flex h-10 items-center rounded-lg border px-3 text-sm transition-colors',
                tone === t.key
                  ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]'
                  : 'border-[var(--border-strong)] text-[var(--fg-muted)]',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <input
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          placeholder="عايز تضيف حاجة؟ «اذكر إن الشحن مجاني فوق ٥٠٠»"
          aria-label="ملاحظات على الكلام"
          className="h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm focus:border-[var(--primary)] focus:outline-none"
        />

        <button
          type="button"
          disabled={writing}
          onClick={write}
          className="flex h-11 w-fit items-center gap-2 rounded-lg bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-fg)] disabled:opacity-50"
        >
          {writing ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          )}
          {caption ? 'اكتب واحد تاني' : 'اكتب البوست'}
        </button>

        {copyError && <Alert tone="danger">{copyError}</Alert>}

        {caption && (
          <div className="flex flex-col gap-2">
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={5}
              aria-label="نص البوست"
              className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] p-3 text-sm leading-relaxed focus:border-[var(--primary)] focus:outline-none"
            />
            {hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {hashtags.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setHashtags((t) => t.filter((x) => x !== h))}
                    title="اضغط عشان تشيله"
                    className="flex h-8 items-center gap-1 rounded-md bg-[var(--surface-2)] px-2 text-xs text-[var(--fg-muted)]"
                  >
                    {h}
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                navigator.clipboard
                  ?.writeText([caption, hashtags.join(' ')].filter(Boolean).join('\n\n'))
                  .then(() => toast('اتنسخ'))
                  .catch(() => toast('مقدرناش ننسخ'))
              }}
              className="flex h-10 w-fit items-center gap-1.5 rounded-lg border border-[var(--border-strong)] px-3 text-sm text-[var(--fg-muted)]"
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
              انسخ الكلام
            </button>
          </div>
        )}
      </Card>

      {/* ── النشر ──────────────────────────────────────── */}
      {(caption || current) && (
        <Card className="flex flex-col gap-4 p-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <Send className="h-4 w-4 text-[var(--primary)]" aria-hidden="true" />
            النشر
          </h2>

          {live.length === 0 ? (
            /*
              مفيش حساب مربوط — والميزة لسه بتفيده.

              البوست بيتحفظ جاهزًا وبينزّله وينشره بإيده. الرسالة
              بتقول ده صراحةً بدل ما تسيبه يفتكر إن الشاشة بايظة.
            */
            <div className="flex flex-col gap-2 rounded-lg bg-[var(--surface-2)] p-3.5">
              <p className="text-sm leading-relaxed text-[var(--fg-muted)]">
                لسه ما ربطتش صفحاتك. احفظ البوست دلوقتي وهتلاقيه في «البوستات» تنزّله وتنشره بإيدك،
                أو اربط صفحتك ونخلّيه ينزل لوحده.
              </p>
              <Link
                href="/dashboard/studio/accounts"
                className="flex h-10 w-fit items-center rounded-lg border border-[var(--border-strong)] px-3 text-sm font-medium"
              >
                اربط صفحاتك
              </Link>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {live.map((a) => {
                const on = targets.includes(a.id)
                const p = platformOf(a.platform)
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() =>
                      setTargets((t) => (on ? t.filter((x) => x !== a.id) : [...t, a.id]))
                    }
                    className={cn(
                      'flex h-11 items-center gap-2 rounded-lg border px-3 text-sm transition-colors',
                      on
                        ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]'
                        : 'border-[var(--border-strong)] text-[var(--fg-muted)]',
                    )}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: p.color }}
                      aria-hidden="true"
                    />
                    <span className="max-w-[10rem] truncate">{a.name}</span>
                    <span className="text-[11px] opacity-60">{p.label}</span>
                    {on && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                  </button>
                )
              })}
            </div>
          )}

          {saveError && <Alert tone="danger">{saveError}</Alert>}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving || !caption || !current}
              onClick={() => save(false)}
              className="flex h-11 items-center gap-2 rounded-lg border border-[var(--border-strong)] px-5 text-sm font-semibold disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              احفظ البوست
            </button>
            {live.length > 0 && (
              <button
                type="button"
                disabled={saving || !caption || !current || targets.length === 0}
                onClick={() => save(true)}
                className="flex h-11 items-center gap-2 rounded-lg bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-fg)] disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="h-4 w-4" aria-hidden="true" />
                )}
                انشر دلوقتي
              </button>
            )}
          </div>

          {(!caption || !current) && (
            <p className="text-xs text-[var(--fg-subtle)]">
              محتاج صورة وكلام الاتنين عشان تحفظ البوست.
            </p>
          )}
        </Card>
      )}

      {/* ── آخر الصور ──────────────────────────────────── */}
      {assets.length > 0 && (
        <Card className="flex flex-col gap-3 p-4">
          <h2 className="font-semibold">آخر صورك</h2>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {assets.map((a) => (
              <button
                key={a.id}
                type="button"
                title={a.prompt}
                onClick={() => setChain([{ id: a.id, url: a.url, prompt: a.prompt }])}
                className="relative aspect-square overflow-hidden rounded-lg border border-[var(--border)] transition-colors hover:border-[var(--primary)]"
              >
                <Image src={a.url} alt={a.prompt} fill sizes="120px" className="object-cover" />
              </button>
            ))}
          </div>
          <p className="text-xs text-[var(--fg-subtle)]">
            اضغط على أي صورة عشان تكمّل تعديل عليها.
          </p>
        </Card>
      )}
    </div>
  )
}
