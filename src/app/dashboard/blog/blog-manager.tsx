'use client'

import { useState, useTransition } from 'react'
import { Check, FileText, Plus, Trash2, X } from 'lucide-react'
import { deletePostAction, savePostAction, togglePostAction, type PostInput } from './actions'
import { Alert, Button, Card } from '@/components/ui'
import { ImproveButton } from '@/components/dashboard/improve-button'
import { Toggle } from '@/components/dashboard/controls'
import { ImageUpload } from '@/components/ui/image-upload'
import { formatDate } from '@/lib/utils'

export type PostRow = {
  id: string
  title: string
  slug: string
  excerpt: string | null
  content: string | null
  cover: string | null
  author: string | null
  isPublished: boolean
  publishedAt: Date | null
  views: number
}

const emptyPost = (): PostInput => ({
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  cover: null,
  author: '',
  isPublished: false,
})

const field =
  'w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm focus:border-[var(--primary)] focus:outline-none'

export function BlogManager({ posts }: { posts: PostRow[] }) {
  const [form, setForm] = useState<PostInput | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function save() {
    if (!form) return
    setError(null)
    start(async () => {
      const res = await savePostAction(form)
      if (res?.error) setError(res.error)
      else setForm(null)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {!form && (
        <Button onClick={() => setForm(emptyPost())} className="self-start">
          <Plus className="h-4 w-4" aria-hidden="true" />
          مقال جديد
        </Button>
      )}

      {form && (
        <Card className="flex flex-col gap-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{form.id ? 'تعديل المقال' : 'مقال جديد'}</h2>
            <button
              type="button"
              onClick={() => setForm(null)}
              aria-label="إغلاق"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {error && <Alert tone="danger">{error}</Alert>}

          <label className="flex flex-col gap-1.5">
            <span className="flex flex-wrap items-center justify-between gap-2 text-sm font-medium">
              العنوان
              <ImproveButton
                task="blog_title"
                value={form.title}
                onApply={(v) => setForm({ ...form, title: v })}
                fields={{ 'عنوان المقال': form.title }}
                compact
              />
            </span>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className={`${field} h-11`}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">الرابط (اختياري)</span>
            <input
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              dir="ltr"
              placeholder="هيتولّد من العنوان تلقائيًا"
              className={`${field} h-11 text-start`}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="flex flex-wrap items-center justify-between gap-2 text-sm font-medium">
              مقدّمة قصيرة
              <ImproveButton
                task="blog_excerpt"
                value={form.excerpt}
                onApply={(v) => setForm({ ...form, excerpt: v })}
                fields={{ 'عنوان المقال': form.title }}
                compact
              />
            </span>
            <textarea
              value={form.excerpt}
              onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
              rows={2}
              className={`${field} py-2.5`}
            />
            <span className="text-xs text-[var(--fg-subtle)]">بتظهر في قائمة المقالات وفي جوجل.</span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="flex flex-wrap items-center justify-between gap-2 text-sm font-medium">
              المحتوى
              <ImproveButton
                task="blog_content"
                value={form.content}
                onApply={(v) => setForm({ ...form, content: v })}
                fields={{ 'عنوان المقال': form.title }}
                compact
              />
            </span>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              rows={10}
              className={`${field} py-2.5 leading-relaxed`}
            />
            <span className="text-xs text-[var(--fg-subtle)]">سطر فاضي بيبدأ فقرة جديدة.</span>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">الكاتب</span>
              <input
                value={form.author}
                onChange={(e) => setForm({ ...form, author: e.target.value })}
                className={`${field} h-11`}
              />
            </label>
          </div>

          <ImageUpload
            label="صورة الغلاف"
            value={form.cover ? [form.cover] : []}
            onChange={(urls) => setForm({ ...form, cover: urls[0] ?? null })}
            folder="misc"
          />

          <Toggle
            label="منشور"
            hint="المقال غير المنشور مش بيظهر لعملائك."
            checked={form.isPublished}
            onChange={(v) => setForm({ ...form, isPublished: v })}
          />

          <div className="flex gap-2">
            <Button onClick={save} loading={pending}>
              <Check className="h-4 w-4" aria-hidden="true" />
              حفظ المقال
            </Button>
            <Button variant="ghost" onClick={() => setForm(null)}>
              إلغاء
            </Button>
          </div>
        </Card>
      )}

      {posts.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <FileText className="h-10 w-10 text-[var(--fg-subtle)]" aria-hidden="true" />
          <h2 className="text-lg font-semibold">مافيش مقالات</h2>
          <p className="max-w-sm text-sm text-[var(--fg-muted)]">
            المقالات بتجيبلك زوّار من جوجل من غير إعلانات — اكتب عن منتجاتك وإزاي تُستخدم.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          {posts.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              onEdit={() => {
                setError(null)
                setForm({
                  id: p.id,
                  title: p.title,
                  slug: p.slug,
                  excerpt: p.excerpt ?? '',
                  content: p.content ?? '',
                  cover: p.cover,
                  author: p.author ?? '',
                  isPublished: p.isPublished,
                })
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function PostCard({ post: p, onEdit }: { post: PostRow; onEdit: () => void }) {
  const [pending, start] = useTransition()

  return (
    <Card className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{p.title}</span>
          {!p.isPublished && (
            <span className="rounded-md bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--fg-subtle)]">
              مسوّدة
            </span>
          )}
        </div>
        <span className="mt-0.5 block text-xs text-[var(--fg-subtle)]">
          <bdi dir="ltr">/{p.slug}</bdi>
          {p.publishedAt && ` · ${formatDate(p.publishedAt)}`}
          {p.views > 0 && ` · ${p.views} مشاهدة`}
        </span>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={p.isPublished}
        aria-label={p.isPublished ? 'إخفاء المقال' : 'نشر المقال'}
        disabled={pending}
        onClick={() => start(() => togglePostAction(p.id, !p.isPublished).then(() => {}))}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          p.isPublished ? 'bg-[var(--primary)]' : 'bg-[var(--border-strong)]'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            p.isPublished ? 'start-0.5' : 'start-[1.375rem]'
          }`}
        />
      </button>

      <button
        type="button"
        onClick={onEdit}
        className="rounded-lg border border-[var(--border-strong)] px-3 py-2 text-sm text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)]"
      >
        تعديل
      </button>

      <button
        type="button"
        onClick={() => start(() => deletePostAction(p.id).then(() => {}))}
        disabled={pending}
        aria-label="حذف"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--fg-muted)] transition-colors hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>
    </Card>
  )
}
