/**
 * أسماء مجلدات الوسائط بالعربي.
 *
 * ملف مستقل عن `media.ts` لأن ده `server-only`: القراءة والمزامنة
 * بتلمس قاعدة البيانات والتخزين، والشاشة محتاجة الأسماء بس. نفس
 * النمط اللي في `blocklist-meta` و`returns-meta`.
 */
export const FOLDER_LABELS: Record<string, string> = {
  products: 'صور المنتجات',
  categories: 'صور الأقسام',
  banners: 'البانرات',
  logos: 'الشعارات',
  misc: 'متنوّع',
}
