-- موديل الكلام وموديل الصور لكل جدول نشر — فاضي يعني افتراضي الإضافات
ALTER TABLE "content_schedules" ADD COLUMN IF NOT EXISTS "ai_text_model" text;--> statement-breakpoint
ALTER TABLE "content_schedules" ADD COLUMN IF NOT EXISTS "ai_image_model" text;
