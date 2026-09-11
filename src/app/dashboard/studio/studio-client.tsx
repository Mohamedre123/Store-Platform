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
import {
  PRESETS,
  STYLES,
  TONES,
  platformOf,
  presetOf,
  resolveStyle,
  styleOf,
  type ImageStyle,
  type PresetKey,
  type ToneKey,
} from '@/lib/studio-meta'
import { AI_PROVIDERS, type AiProvider } from '@/lib/ai/providers-meta'
import { Alert, Card } from '@/components/ui'
import { SharePost } from '@/components/dashboard/share-post'
import { toast } from '@/components/dashboard/toast'
import { cn } from '@/lib/utils'

type Product = { id: string; name: string; image: string | null }
type Account = { id: string; platform: string; name: string; avatar: string | null; status: string }
type Outcome = { accountId: string; ok: boolean; error?: string }

/** «حساب واحد» · «حسابين» · «٣ حسابات» — الرقم لوحده في زرار نشر بيتقرا غلط */
function accountsLabel(n: number): string {
  if (n === 1) return 'حساب واحد'
  if (n === 2) return 'حسابين'
  if (n <= 10) return n + ' حسابات'
  return n + ' حساب'
}
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
  providers,
  defaultProvider,
  publishing,
  products,
  accounts,
  assets,
}: {
  hasKey: boolean
  /** المزوّدين اللي ليهم مفتاح — Gemini وChatGPT */
  providers: AiProvider[]
  defaultProvider: AiProvider | null
  /** خدمة النشر مضبوطة على المنصة — من غيرها الربط نفسه مش متاح */
  publishing: boolean
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

  /*
    شكل الصورة — واللي مكتوب في الوصف بيغلبه.

    التاجر بيكتب «خلفية سادة» وناسي الاختيار فوق. الخادم بيفهم
    الجملة ويغلّبها، والشاشة بتعلّم نفس الشكل عشان يشوف اللي هيتنفّذ.
  */
  const [style, setStyle] = useState<ImageStyle>('auto')
  /*
    نفس دالة الخادم بالظبط.

    «زي ما أنا كاتب» بيغلب الكلام، والكلام بيغلب باقي الاختيارات. لو
    الشاشة حسبتها بطريقتها، التاجر يشوف شكل متعلّم والخادم يولّد غيره.
  */
  const effectiveStyle = resolveStyle(style, imagePrompt)
  const overridden = effectiveStyle !== style ? effectiveStyle : null

  /* Gemini ولا ChatGPT — للصورة والكاروسيل والفيديو والكلام مع بعض */
  const [provider, setProvider] = useState<AiProvider | null>(defaultProvider)

  /* النشر */
  const live = accounts.filter((a) => a.status === 'active')
  /* حساب واحد مربوط يبقى مختار من الأول — مفيش اختيار تاني يتعمل */
  const [targets, setTargets] = useState<string[]>(() => (live.length === 1 ? [live[0].id] : []))
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, startSave] = useTransition()
  /*
    البوست اللي اتحفظ ونتيجة نشره — مربوطين بالوسيط نفسه.

    `key` هو روابط الصور أو الفيديو. لو التاجر عمل صورة جديدة، المفتاح
    بيتغيّر والحالة القديمة بتسقط لوحدها: الحفظ الجاي بوست جديد،
    والحسابات اللي «اتنشر عليها» ترجع تتختار.
  */
  const [saved, setSaved] = useState<{ id: string; key: string; published: boolean } | null>(null)
  const [outcome, setOutcome] = useState<{ key: string; results: Outcome[] } | null>(null)

  /* النص المركَّب — ده اللي بيتحفظ وبيتنسخ وبينشر */
  const caption = [hook, body, [cta.trim(), link.trim()].filter(Boolean).join('\n')]
    .map((x) => x.trim())
    .filter(Boolean)
    .join('\n\n')

  const current = chain.at(-1) ?? null
  /* الوسيط اللي هيتحفظ فعلًا — بيتبع التبويب المفتوح لا اللي اتعمل */
  const hasMedia =
    media === 'video' ? Boolean(video) : media === 'carousel' ? slides.length > 0 : Boolean(current)

  const mediaUrls =
    media === 'carousel' ? slides.map((x) => x.url) : media === 'image' && current ? [current.url] : []
  const videoUrl = media === 'video' ? (video?.url ?? null) : null
  const mediaKey = [...mediaUrls, videoUrl ?? ''].join('|')

  const results = outcome?.key === mediaKey ? outcome.results : []
  /* اللي اتنشر عليه الوسيط ده خلاص — ما يتنشرش عليه تاني بالغلط */
  const doneIds = results.filter((r) => r.ok).map((r) => r.accountId)
  const pending = targets.filter((t) => !doneIds.includes(t))

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
        style,
        provider,
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
      style,
      provider,
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
      style,
      provider,
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
        provider,
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

  /**
   * حفظ أو نشر — على نفس البوست.
   *
   * ## التعديل بعد الحفظ بيحدّث مش بيكرّر
   * التاجر بيحفظ، ويعدّل الهوك، ويدوس نشر. البوست اللي لسه ما اتنشرش
   * بيتحدّث بمعرّفه. واللي اتنشر ما بيتلمسش — أي نشر بعده بوست جديد
   * على الحسابات اللي لسه ما نزلش عليها بس.
   */
  function save(publishNow: boolean) {
    const sendTargets = publishNow ? pending : targets

    if (publishNow) {
      const names = live
        .filter((a) => sendTargets.includes(a.id))
        .map((a) => a.name + ' (' + platformOf(a.platform).label + ')')
        .join('، ')
      /* النشر علني وباسم التاجر — تأكيد واحد أرخص من بوست نازل بالغلط */
      if (!confirm('هتنشر البوست دلوقتي على: ' + names + '؟')) return
    }

    const reuse = saved && saved.key === mediaKey && !saved.published ? saved.id : null
    const key = mediaKey

    setSaveError(null)
    startSave(async () => {
      const res = await savePostAction({
        id: reuse,
        caption,
        hashtags,
        imageUrls: mediaUrls,
        videoUrl,
        productId: product?.id ?? null,
        targets: sendTargets,
        publishNow,
      })

      const fresh = res.results ?? []
      const anyOk = fresh.some((r) => r.ok)

      if (res.id) setSaved({ id: res.id, key, published: publishNow && anyOk })
      if (fresh.length) {
        setOutcome((o) => ({
          key,
          results: [
            ...(o?.key === key ? o.results.filter((r) => !fresh.some((f) => f.accountId === r.accountId)) : []),
            ...fresh,
          ],
        }))
      }

      if (!publishNow) {
        if (res.error) setSaveError(res.error)
        else toast('اتحفظ في البوستات')
        return
      }

      const failed = fresh.filter((r) => !r.ok).length
      if (anyOk) {
        /* النجاح الجزئي بيتقال — «اتنشر» لوحدها بتخبّي الحساب اللي فشل */
        toast(failed ? 'اتنشر على ' + (fresh.length - failed) + ' وفشل على ' + failed : 'اتنشر')
        setTargets((t) => t.filter((id) => !fresh.some((r) => r.ok && r.accountId === id)))
      } else {
        setSaveError(res.error ?? 'فشل النشر')
      }
    })
  }

  if (!hasKey) {
    return (
      <Card className="flex flex-col items-center gap-3 px-6 py-10 text-center">
        <Sparkles className="h-7 w-7 text-[var(--primary)]" aria-hidden="true" />
        <h2 className="font-bold">محتاج مفتاح Gemini أو ChatGPT</h2>
        <p className="max-w-md text-sm leading-relaxed text-[var(--fg-muted)]">
          الاستوديو بيشتغل بنفس المفاتيح اللي في «الردّ على عملائك» أو «مساعدك في إدارة المتجر» —
          Gemini أو ChatGPT، ومش محتاج مفتاح تالت. حطّه من الإضافات وارجع.
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

        {/*
          المزوّد — بيظهر لما التاجر يبقى حاطط المفتاحين.

          الاختيار واحد للصورة والكلام: صورة بـChatGPT وكلام بـGemini كان
          هيخلّي التاجر يدفع لحسابين على بوست واحد من غير ما يقصد.
        */}
        {providers.length > 1 && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-[var(--fg-muted)]">بيولّد بـ</span>
            <div className="flex gap-1.5" role="radiogroup" aria-label="مزوّد الذكاء">
              {providers.map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={provider === p}
                  onClick={() => setProvider(p)}
                  className={cn(
                    'flex h-10 flex-1 items-center justify-center rounded-lg border px-4 text-sm font-medium transition-colors sm:flex-none',
                    provider === p
                      ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]'
                      : 'border-[var(--border-strong)] text-[var(--fg-muted)]',
                  )}
                >
                  {AI_PROVIDERS.find((x) => x.key === p)?.label ?? p}
                </button>
              ))}
            </div>
          </div>
        )}

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
          شكل الصورة — للتوليد الجديد بس.

          التعديل على صورة موجودة بيمشي بكلام التاجر زي ما هو، فالاختيار
          هناك ما بيعملش حاجة وإظهاره بيوهم إنه هيغيّر الصورة.
        */}
        {!(media === 'image' && current) && (
          <div className="flex flex-col gap-2">
            <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-xs font-medium text-[var(--fg-muted)]">شكل الصورة</span>
              <span
                className={cn(
                  'text-xs',
                  overridden ? 'text-[var(--primary)]' : 'text-[var(--fg-subtle)]',
                )}
              >
                {overridden
                  ? `كلامك فيه «${styleOf(overridden).label}» — وده اللي هيتنفّذ`
                  : styleOf(effectiveStyle).hint}
              </span>
            </span>
            <div className="flex flex-wrap gap-1.5">
              {STYLES.map((st) => (
                <button
                  key={st.key}
                  type="button"
                  aria-pressed={effectiveStyle === st.key}
                  title={st.hint}
                  onClick={() => setStyle(st.key)}
                  className={cn(
                    'flex h-10 items-center rounded-lg border px-3 text-sm transition-colors',
                    effectiveStyle === st.key
                      ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]'
                      : 'border-[var(--border-strong)] text-[var(--fg-muted)]',
                  )}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>
        )}

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
              placeholder="قوله عايزها إزاي وهو هينفّذ — «على خلفية سادة بيج»، «في مطبخ حقيقي بإضاءة الصبح»، «رندر 3D بألوان جريئة»، أو «مينيمال وجملة وصل حديثًا فوق»"
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
                  الأول بيتعمل خطة للشرايح كلها — كل شريحة لقطة مختلفة بنفس الإضاءة والألوان —
                  وبعدين بتترسم واحدة ورا التانية، يعني{' '}
                  <strong className="text-[var(--fg)]">{slideCount} صور</strong> بتاخد وقت {slideCount} صور.
                  تقدر تكتب لكل شريحة عايزها إزاي: «الأولى كذا، والأخيرة كذا، واللي في النص كذا».
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
      {/*
        النشر — ظاهر أول ما يبقى فيه صورة أو كاروسيل أو فيديو أو كلام.

        الشرط القديم كان `caption || current || video`، فالكاروسيل ما
        كانش بيظهّر زرار النشر خالص لحد ما الكلام يتكتب.
      */}
      {(caption || hasMedia) && (
        <Card className="flex flex-col gap-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-semibold">
              <Send className="h-4 w-4 text-[var(--primary)]" aria-hidden="true" />
              النشر
            </h2>
            {accounts.length > 0 && (
              <Link
                href="/dashboard/studio/accounts"
                className="text-xs text-[var(--fg-muted)] underline"
              >
                إدارة الحسابات
              </Link>
            )}
          </div>

          {/*
            الناقص قبل النشر بيتقال كقايمة.

            الزرار الرمادي من غير سبب بيخلّي التاجر يدوس عليه خمس مرات
            ويفتكر إن الشاشة بايظة.
          */}
          {(() => {
            const steps = [
              {
                done: hasMedia,
                label:
                  media === 'video'
                    ? 'اعمل الفيديو'
                    : media === 'carousel'
                      ? 'اعمل الكاروسيل'
                      : 'اعمل الصورة',
              },
              { done: Boolean(caption), label: 'اكتب كلام البوست' },
              ...(live.length > 0
                ? [{ done: pending.length > 0 || doneIds.length > 0, label: 'اختار الحساب اللي هتنشر عليه' }]
                : []),
            ]
            if (steps.every((s) => s.done)) return null
            return (
              <ol className="flex flex-col gap-1.5 rounded-lg bg-[var(--surface-2)] px-3.5 py-3">
                {steps.map((s, i) => (
                  <li key={s.label} className="flex items-center gap-2 text-sm">
                    <span
                      className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                        s.done
                          ? 'bg-[var(--color-success)] text-white'
                          : 'border border-[var(--border-strong)] text-[var(--fg-muted)]',
                      )}
                    >
                      {s.done ? <Check className="h-3 w-3" aria-hidden="true" /> : i + 1}
                    </span>
                    <span className={s.done ? 'text-[var(--fg-subtle)] line-through' : ''}>
                      {s.label}
                    </span>
                  </li>
                ))}
              </ol>
            )
          })()}

          {accounts.length === 0 ? (
            /*
              مفيش حساب مربوط — والميزة لسه بتفيده.

              البوست بيتحفظ جاهزًا، ومن الموبايل بينشره بشاشة المشاركة.
              الرسالة بتقول الطريقين صراحةً بدل ما تسيبه يدوّر على زرار.
            */
            <div className="flex flex-col gap-2 rounded-lg border border-dashed border-[var(--border-strong)] p-3.5">
              <p className="text-sm leading-relaxed text-[var(--fg-muted)]">
                {publishing ? (
                  <>
                    <strong className="font-semibold text-[var(--fg)]">اربط صفحاتك</strong> وهتنشر من
                    هنا مباشرةً بضغطة — وتختار الصفحة أو الحساب اللي ينزل عليه.
                  </>
                ) : (
                  'النشر المباشر لسه بيتجهّز على المنصة.'
                )}{' '}
                ولحد ما تربط: من موبايلك دوس «انشره من موبايلك» وتختار المنصة، أو احفظه وهتلاقيه في
                «البوستات».
              </p>
              {publishing && (
                <Link
                  href="/dashboard/studio/accounts"
                  className="flex h-10 w-fit items-center rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-fg)]"
                >
                  اربط صفحاتك
                </Link>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-[var(--fg-muted)]">
                  هتنشر على أنهي حساب؟
                </span>
                {live.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setTargets(
                        pending.length === live.filter((a) => !doneIds.includes(a.id)).length
                          ? []
                          : live.map((a) => a.id).filter((id) => !doneIds.includes(id)),
                      )
                    }
                    className="text-xs text-[var(--primary)] underline"
                  >
                    {pending.length === live.filter((a) => !doneIds.includes(a.id)).length
                      ? 'شيل الكل'
                      : 'اختار الكل'}
                  </button>
                )}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {accounts.map((a) => {
                  const p = platformOf(a.platform)
                  const active = a.status === 'active'
                  const done = doneIds.includes(a.id)
                  const on = targets.includes(a.id) && !done
                  const failed = results.find((r) => r.accountId === a.id && !r.ok)

                  return (
                    <button
                      key={a.id}
                      type="button"
                      disabled={!active || done || saving}
                      aria-pressed={on}
                      onClick={() =>
                        setTargets((t) => (on ? t.filter((x) => x !== a.id) : [...t, a.id]))
                      }
                      className={cn(
                        'flex min-h-14 items-center gap-3 rounded-xl border px-3 py-2 text-start transition-colors',
                        on
                          ? 'border-[var(--primary)] bg-[var(--primary-soft)]'
                          : done
                            ? 'border-[var(--color-success)] bg-[var(--color-success-soft)]'
                            : 'border-[var(--border-strong)]',
                        !active && 'opacity-60',
                      )}
                    >
                      <span
                        className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full"
                        style={{ background: p.color + '22' }}
                      >
                        {/*
                          `<img>` لا `Image`.

                          صور الحسابات جاية من المنصات نفسها، ونطاقاتها مش
                          في `remotePatterns` — و`Image` كان هيوقّع الشاشة
                          كلها عند أول حساب ليه صورة.
                        */}
                        {a.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={a.avatar}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="h-9 w-9 object-cover"
                          />
                        ) : (
                          <span
                            className="h-3 w-3 rounded-full"
                            style={{ background: p.color }}
                            aria-hidden="true"
                          />
                        )}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{a.name}</span>
                        <span className="block text-xs text-[var(--fg-subtle)]">
                          {p.label}
                          {!active && ' · الربط انتهى — اربطه تاني'}
                        </span>
                        {failed && (
                          <span className="mt-0.5 block text-xs text-[var(--color-danger)]">
                            {failed.error ?? 'فشل النشر'}
                          </span>
                        )}
                      </span>

                      {done ? (
                        <span className="flex shrink-0 items-center gap-1 rounded bg-[var(--color-success)] px-2 py-0.5 text-[11px] font-medium text-white">
                          <Check className="h-3 w-3" aria-hidden="true" />
                          اتنشر
                        </span>
                      ) : (
                        <span
                          className={cn(
                            'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border',
                            on
                              ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-fg)]'
                              : 'border-[var(--border-strong)]',
                          )}
                          aria-hidden="true"
                        >
                          {on && <Check className="h-3.5 w-3.5" />}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {saveError && <Alert tone="danger">{saveError}</Alert>}

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {live.length > 0 && (
              <button
                type="button"
                disabled={saving || !caption || !hasMedia || pending.length === 0}
                onClick={() => save(true)}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-fg)] disabled:opacity-50 sm:h-11 sm:w-auto"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="h-4 w-4" aria-hidden="true" />
                )}
                {saving
                  ? 'بينشر…'
                  : pending.length > 0
                    ? 'انشر على ' + accountsLabel(pending.length)
                    : doneIds.length > 0
                      ? 'اتنشر — اختار حساب تاني لو عايز'
                      : 'انشر'}
              </button>
            )}

            <button
              type="button"
              disabled={saving || !caption || !hasMedia}
              onClick={() => save(false)}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-[var(--border-strong)] px-5 text-sm font-semibold disabled:opacity-50 sm:w-auto"
            >
              {live.length > 0 ? 'احفظه من غير نشر' : 'احفظ البوست'}
            </button>

            {/*
              المشاركة من الموبايل — بتاخد أول شريحة في الكاروسيل.

              شاشة المشاركة بتاخد ملفًا واحدًا، والغلاف هو اللي بيمثّل
              البوست. والزرار بيختفي لوحده في المتصفح اللي مالوش شاشة مشاركة.
            */}
            {hasMedia && (
              <SharePost
                url={videoUrl ?? mediaUrls[0]}
                text={[caption, hashtags.join(' ')].filter(Boolean).join('\n\n')}
                kind={media === 'video' ? 'video' : 'image'}
              />
            )}
          </div>

          {saved && saved.key === mediaKey && (
            <p className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--fg-subtle)]">
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              {saved.published ? 'اتنشر واتسجّل في' : 'محفوظ في'}
              <Link href="/dashboard/studio/posts" className="underline">
                البوستات
              </Link>
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
