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
  Film,
  LayoutGrid,
  Send,
  Sparkles,
  Type,
  Wand2,
  X,
} from 'lucide-react'
import {
  checkVideoAction,
  generateCarouselAction,
  generateCopyAction,
  generateImageAction,
  savePostAction,
  searchProductsAction,
  startVideoAction,
} from './actions'
import { PRESETS, TONES, platformOf, presetOf, type PresetKey, type ToneKey } from '@/lib/studio-meta'
import { Alert, Card } from '@/components/ui'
import { SharePost } from '@/components/dashboard/share-post'
import { toast } from '@/components/dashboard/toast'
import { cn } from '@/lib/utils'

type Product = { id: string; name: string; image: string | null }
type Account = { id: string; platform: string; name: string; status: string }
type Asset = { id: string; url: string; prompt: string; preset: string; kind: string }

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

  /* الوسيط */
  const [media, setMedia] = useState<'image' | 'carousel' | 'video'>('image')

  /*
    الكاروسيل — قايمة مرتّبة، والترتيب هو اللي بينشر.

    الشريحة الأولى هي الغلاف، والأخيرة هي الدعوة. أي ترتيب تاني
    بيخلّي الحكاية مالهاش معنى.
  */
  const [slides, setSlides] = useState<Array<{ id: string; url: string; prompt: string }>>([])
  const [slideCount, setSlideCount] = useState(5)
  const [carouselBusy, setCarouselBusy] = useState(false)

  /* الصورة */
  const [preset, setPreset] = useState<PresetKey>('portrait')
  const [imagePrompt, setImagePrompt] = useState('')
  const [useProductPhoto, setUseProductPhoto] = useState(true)
  /* سلسلة التعديل — آخر واحدة هي المعروضة، والرجوع بيقصّ من الآخر */
  const [chain, setChain] = useState<Array<{ id: string; url: string; prompt: string }>>([])
  const [editPrompt, setEditPrompt] = useState('')
  const [imgError, setImgError] = useState<string | null>(null)
  const [makingImage, startImage] = useTransition()

  /*
    الفيديو — حالته لوحدها لأن انتظاره دقايق لا ثواني.

    `useTransition` بيغطّي نداءً واحدًا. الفيديو نداء بداية وعشرات
    نداءات سؤال، والتاجر لازم يشوف إنه ماشي طول الوقت ده — مش مؤشّر
    بيلفّ من غير كلام.
  */
  const [video, setVideo] = useState<{ id: string; url: string } | null>(null)
  const [videoBusy, setVideoBusy] = useState(false)
  const [videoWaited, setVideoWaited] = useState(0)

  /* الكلام */
  const [tone, setTone] = useState<ToneKey>('sell')
  const [extra, setExtra] = useState('')
  /*
    الأجزاء منفصلة عن بعض.

    التاجر بيعدّل الهوك لوحده لما يبقى مش عاجبه من غير ما يخاف
    يلخبط الباقي — والنص الواحد كان بيخلّي أي تعديل مغامرة.
  */
  const [hook, setHook] = useState('')
  const [body, setBody] = useState('')
  const [cta, setCta] = useState('')
  /* الرابط بيتحط عندنا لا في كلام الموديل — بيغلط فيه */
  const [link, setLink] = useState('')
  const [hashtags, setHashtags] = useState<string[]>([])
  const [copyError, setCopyError] = useState<string | null>(null)
  const [writing, startCopy] = useTransition()

  /* النشر */
  const [targets, setTargets] = useState<string[]>([])
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, startSave] = useTransition()

  /* النص المركَّب — ده اللي بيتحفظ وبيتنسخ وبينشر */
  const caption = [hook, body, [cta.trim(), link.trim()].filter(Boolean).join('\n')]
    .map((x) => x.trim())
    .filter(Boolean)
    .join('\n\n')

  const current = chain.at(-1) ?? null
  /* الوسيط اللي هيتحفظ فعلًا — بيتبع التبويب المفتوح لا اللي اتعمل */
  const hasMedia =
    media === 'video' ? Boolean(video) : media === 'carousel' ? slides.length > 0 : Boolean(current)
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

  /**
   * توليد فيديو — بداية وسؤال متكرر.
   *
   * السؤال كل خمس ثواني لمدة تلات دقايق. Veo بياخد من دقيقة
   * لتلاتة، والوقوف قبلها بيضيّع توليدًا التاجر دفع تمنه.
   */
  async function makeVideo() {
    const prompt = imagePrompt.trim()
    if (!prompt) return

    setImgError(null)
    setVideoBusy(true)
    setVideoWaited(0)

    const started = await startVideoAction({
      prompt,
      preset,
      productId: product?.id ?? null,
      useProductPhoto,
      /* الصورة المعروضة دلوقتي بتتحرّك — أدق من صورة المنتج الخام */
      seedAssetUrl: current?.url ?? null,
    })

    if (!started.ok) {
      setImgError(started.error)
      setVideoBusy(false)
      return
    }

    for (let i = 0; i < 36; i++) {
      await new Promise((r) => setTimeout(r, 5000))
      setVideoWaited((n) => n + 5)

      const step = await checkVideoAction({
        operation: started.operation,
        prompt,
        preset,
        productId: product?.id ?? null,
      })

      if (step.state === 'failed') {
        setImgError(step.error)
        setVideoBusy(false)
        return
      }
      if (step.state === 'done') {
        setVideo({ id: step.id, url: step.url })
        setVideoBusy(false)
        return
      }
    }

    setImgError('الفيديو أخد وقت أطول من المتوقّع. جرّب تاني.')
    setVideoBusy(false)
  }

  /**
   * توليد كاروسيل.
   *
   * الشرايح بتتولّد **واحدة ورا التانية** لأن كل واحدة محتاجة اللي
   * قبلها كمرجع — التوازي كان بيطلّع خمس صور مالهمش علاقة ببعض.
   */
  async function makeCarouselNow() {
    const prompt = imagePrompt.trim()
    if (!prompt) return

    setImgError(null)
    setCarouselBusy(true)

    const res = await generateCarouselAction({
      prompt,
      preset,
      count: slideCount,
      productId: product?.id ?? null,
      useProductPhoto,
    })

    if (!res.ok) setImgError(res.error)
    else {
      setSlides(res.images)
      /*
        الناتج الناقص بيتقال صراحةً.

        الطلب خمسة والراجع تلاتة معناه إن اتنين فشلوا — والسكوت
        بيخلّي التاجر يفتكر إنه طلب تلاتة.
      */
      if (res.images.length < slideCount) {
        toast('طلعت ' + res.images.length + ' شرايح من ' + slideCount + ' — الباقي فشل')
      }
    }
    setCarouselBusy(false)
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
        setHook(res.hook)
        setBody(res.body)
        setCta(res.cta)
        setLink(res.link)
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
        imageUrls:
          media === 'carousel'
            ? slides.map((x) => x.url)
            : media === 'image' && current
              ? [current.url]
              : [],
        videoUrl: media === 'video' ? (video?.url ?? null) : null,
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-semibold">
            {media === 'video' ? (
              <Film className="h-4 w-4 text-[var(--primary)]" aria-hidden="true" />
            ) : media === 'carousel' ? (
              <LayoutGrid className="h-4 w-4 text-[var(--primary)]" aria-hidden="true" />
            ) : (
              <ImageIcon className="h-4 w-4 text-[var(--primary)]" aria-hidden="true" />
            )}
            {media === 'video' ? 'الفيديو' : media === 'carousel' ? 'الكاروسيل' : 'الصورة'}
          </h2>

          {/*
            التبديل صورة/فيديو.

            الفيديو بيتولّد **من الصورة المعروضة** لو فيه واحدة —
            فالتاجر بيظبّط الصورة لحد ما تعجبه وبعدين يحرّكها،
            بدل ما يبدأ من الصفر ويجيب حاجة تانية خالص.
          */}
          <div className="flex rounded-lg border border-[var(--border-strong)] p-0.5">
            {(['image', 'carousel', 'video'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMedia(m)}
                className={cn(
                  'flex h-9 items-center gap-1.5 rounded-md px-3 text-sm transition-colors',
                  media === m
                    ? 'bg-[var(--primary)] text-[var(--primary-fg)]'
                    : 'text-[var(--fg-muted)]',
                )}
              >
                {m === 'image' ? (
                  <ImageIcon className="h-4 w-4" aria-hidden="true" />
                ) : m === 'carousel' ? (
                  <LayoutGrid className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Film className="h-4 w-4" aria-hidden="true" />
                )}
                {m === 'image' ? 'صورة' : m === 'carousel' ? 'كاروسيل' : 'فيديو'}
              </button>
            ))}
          </div>
        </div>

        {media === 'video' && (
          <p className="rounded-lg bg-[var(--surface-2)] px-3.5 py-2.5 text-xs leading-relaxed text-[var(--fg-muted)]">
            {/*
              التشديد بوسم لا بنجوم.

              الماركداون ما بيتفسّرش في JSX — النجمتين كانوا بيظهروا
              حرفيًا للتاجر وكأن الصفحة بايظة.
            */}
            الفيديو بياخد من دقيقة لتلاتة، و
            <strong className="font-semibold text-[var(--fg)]">أغلى من الصورة بمراحل</strong> —
            محتاج مفتاح عليه فوترة.
            {current && ' وهيتحرّك من الصورة اللي فوق.'}
          </p>
        )}

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

        {/*
          الوصف مشترك بين الاتنين، والزرار لا.

          إظهار «اعمل الصورة» وإنت في وضع الفيديو بيخلّي التاجر
          يدوس الغلط ويدفع تمن حاجة مش عايزها — والاتنين جنب بعض
          مافيش منهم واحد واضح إنه المقصود.
        */}
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

            {media === 'image' && (
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
            )}
          </>
        ) : (
          <div className="flex flex-col gap-3">
            {/*
              الصورة بتفضل ظاهرة في وضع الفيديو كمان — لأنها الأساس
              اللي هيتحرّك منه. اللي بيختفي هو أدوات تعديلها.
            */}
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
            {media === 'image' && (
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
            )}

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

        {media === 'carousel' && (
          <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-4">
            {slides.length === 0 ? (
              <>
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-medium text-[var(--fg-muted)]">عدد الشرايح</span>
                  <div className="flex flex-wrap gap-1.5">
                    {[3, 4, 5, 6, 8, 10].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setSlideCount(n)}
                        className={cn(
                          'flex h-10 min-w-11 items-center justify-center rounded-lg border px-3 text-sm transition-colors',
                          slideCount === n
                            ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]'
                            : 'border-[var(--border-strong)] text-[var(--fg-muted)]',
                        )}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <p className="rounded-lg bg-[var(--surface-2)] px-3.5 py-2.5 text-xs leading-relaxed text-[var(--fg-muted)]">
                  الشرايح بتتعمل واحدة ورا التانية عشان يطلعوا بنفس الشكل — يعني{' '}
                  <strong className="text-[var(--fg)]">{slideCount} صور</strong> بتاخد وقت{' '}
                  {slideCount} صور. الأولى غلاف، والأخيرة دعوة للطلب، واللي بينهم فوايد وتفاصيل.
                </p>

                <button
                  type="button"
                  disabled={carouselBusy || imagePrompt.trim().length < 3}
                  onClick={makeCarouselNow}
                  className="flex h-11 w-fit items-center gap-2 rounded-lg bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-fg)] disabled:opacity-50"
                >
                  {carouselBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <LayoutGrid className="h-4 w-4" aria-hidden="true" />
                  )}
                  {carouselBusy ? 'بيرسم الشرايح…' : 'اعمل الكاروسيل'}
                </button>
              </>
            ) : (
              <>
                {/*
                  الشرايح بترتيبها، ورقم كل واحدة ظاهر.

                  الترتيب هو اللي بينشر — والرقم بيخلّي التاجر يعرف
                  الغلاف من الدعوة من غير ما يعدّ.
                */}
                <div className="scroll-x flex gap-2 pb-1">
                  {slides.map((sl, i) => (
                    <div key={sl.id} className="relative w-40 shrink-0">
                      <div
                        className={cn(
                          'relative overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-2)]',
                          shape,
                        )}
                      >
                        <Image src={sl.url} alt="" fill sizes="160px" className="object-cover" />
                      </div>
                      <span className="absolute start-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs font-bold text-white">
                        {i + 1}
                      </span>
                      <button
                        type="button"
                        aria-label={'شيل الشريحة ' + (i + 1)}
                        onClick={() => setSlides((v) => v.filter((x) => x.id !== sl.id))}
                        className="absolute end-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
                      >
                        <X className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSlides([])}
                    className="flex h-10 items-center gap-1.5 rounded-lg border border-[var(--border-strong)] px-3 text-sm text-[var(--fg-muted)]"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                    كاروسيل جديد
                  </button>
                  <span className="flex h-10 items-center text-xs text-[var(--fg-subtle)]">
                    {slides.length} شرايح — الترتيب ده هو اللي هينشر
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        {media === 'video' && (
          <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-4">
            {video ? (
              <>
                <video
                  src={video.url}
                  controls
                  playsInline
                  className={cn(
                    'w-full max-w-sm rounded-xl border border-[var(--border)] bg-black',
                    presetOf(preset).css,
                  )}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setVideo(null)}
                    className="flex h-10 items-center gap-1.5 rounded-lg border border-[var(--border-strong)] px-3 text-sm text-[var(--fg-muted)]"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                    فيديو جديد
                  </button>
                  <a
                    href={video.url}
                    download
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-10 items-center gap-1.5 rounded-lg border border-[var(--border-strong)] px-3 text-sm text-[var(--fg-muted)]"
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    نزّله
                  </a>
                </div>
              </>
            ) : (
              <button
                type="button"
                disabled={videoBusy || imagePrompt.trim().length < 3}
                onClick={makeVideo}
                className="flex h-11 w-fit items-center gap-2 rounded-lg bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-fg)] disabled:opacity-50"
              >
                {videoBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Film className="h-4 w-4" aria-hidden="true" />
                )}
                {/*
                  العدّاد ظاهر عن قصد.

                  تلات دقايق قدام مؤشّر بيلفّ من غير رقم بتخلّي
                  التاجر يفتكر إنها وقفت ويعيد — فيدفع تمن توليدين.
                */}
                {videoBusy ? `بيصوّر… ${videoWaited} ثانية` : 'اعمل الفيديو'}
              </button>
            )}
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
          <div className="flex flex-col gap-3">
            {/*
              كل جزء في خانته وباسمه.

              البوست البيعي له تركيب: هوك بيوقّف التمرير، متن
              بيقنع، ودعوة بتقول اعمل إيه. الخانة الواحدة كانت
              بتطلّع فقرة مالهاش أول ولا آخر، والتاجر مش عارف
              يعدّل جزءًا من غير ما يقرا الباقي كله.
            */}
            {[
              {
                label: 'الهوك',
                hint: 'أول سطر — ده اللي بيوقّف الإصبع',
                value: hook,
                set: setHook,
                rows: 2,
              },
              { label: 'النص', hint: 'الفوايد والتفاصيل', value: body, set: setBody, rows: 5 },
              {
                label: 'الدعوة للفعل',
                hint: 'بيقول للعميل يعمل إيه دلوقتي',
                value: cta,
                set: setCta,
                rows: 2,
              },
              {
                label: 'الرابط',
                hint: 'بينزل آخر البوست — امسحه لو مش عايزه',
                value: link,
                set: setLink,
                rows: 2,
              },
            ].map((f) => (
              <label key={f.label} className="flex flex-col gap-1.5">
                <span className="flex flex-wrap items-baseline gap-2">
                  <span className="text-sm font-medium">{f.label}</span>
                  <span className="text-xs text-[var(--fg-subtle)]">{f.hint}</span>
                </span>
                <textarea
                  value={f.value}
                  onChange={(e) => f.set(e.target.value)}
                  rows={f.rows}
                  className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] p-3 text-sm leading-relaxed focus:border-[var(--primary)] focus:outline-none"
                />
              </label>
            ))}
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
      {(caption || current || video) && (
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
                لسه ما ربطتش صفحاتك. من موبايلك تقدر تنشره دلوقتي بضغطة — بتفتحلك شاشة المشاركة
                بالصورة والكلام مع بعض وتختار المنصة. أو احفظه وهتلاقيه في «البوستات».
              </p>
              <div className="flex flex-wrap gap-2">
                {/*
                  المشاركة من الموبايل هنا كمان.

                  التاجر اللي لسه عامل البوست دلوقتي عايز ينشره
                  دلوقتي — تحويله لصفحة تانية عشان يعمل ضغطة كان
                  بيخلّيه ينسى.
                */}
                {/*
                  المشاركة بتاخد أول شريحة في الكاروسيل.

                  شاشة المشاركة بتاخد ملفًا واحدًا، والغلاف هو اللي
                  بيمثّل البوست. والباقي بيتنزّل من «البوستات».
                */}
                {hasMedia && (
                  <SharePost
                    url={
                      media === 'video'
                        ? video!.url
                        : media === 'carousel'
                          ? slides[0].url
                          : current!.url
                    }
                    text={[caption, hashtags.join(' ')].filter(Boolean).join('\n\n')}
                    kind={media === 'video' ? 'video' : 'image'}
                  />
                )}
                <Link
                  href="/dashboard/studio/accounts"
                  className="flex h-10 w-fit items-center rounded-lg border border-[var(--border-strong)] px-3 text-sm font-medium"
                >
                  اربط صفحاتك
                </Link>
              </div>
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
              disabled={saving || !caption || !hasMedia}
              onClick={() => save(false)}
              className="flex h-11 items-center gap-2 rounded-lg border border-[var(--border-strong)] px-5 text-sm font-semibold disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              احفظ البوست
            </button>
            {live.length > 0 && (
              <button
                type="button"
                disabled={saving || !caption || !hasMedia || targets.length === 0}
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

          {(!caption || !hasMedia) && (
            <p className="text-xs text-[var(--fg-subtle)]">
              محتاج {media === 'video' ? 'فيديو' : 'صورة'} وكلام الاتنين عشان تحفظ البوست.
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
                onClick={() => {
                  if (a.kind === 'video') {
                    setMedia('video')
                    setVideo({ id: a.id, url: a.url })
                  } else {
                    setMedia('image')
                    setChain([{ id: a.id, url: a.url, prompt: a.prompt }])
                  }
                }}
                className="relative aspect-square overflow-hidden rounded-lg border border-[var(--border)] transition-colors hover:border-[var(--primary)]"
              >
                {/*
                  `<img>` على ملف mp4 بيرسم أيقونة مكسورة من غير ما
                  يقول ليه — فالفيديو بيتعرض بعنصره.
                */}
                {a.kind === 'video' ? (
                  <>
                    <video src={a.url} muted playsInline className="h-full w-full object-cover" />
                    <span className="absolute bottom-1 end-1 rounded bg-black/60 p-1">
                      <Film className="h-3 w-3 text-white" aria-hidden="true" />
                    </span>
                  </>
                ) : (
                  <Image src={a.url} alt={a.prompt} fill sizes="120px" className="object-cover" />
                )}
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
