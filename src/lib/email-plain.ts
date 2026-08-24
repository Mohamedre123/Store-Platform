/**
 * نسخة نصّية من الـHTML.
 *
 * الرسالة اللي فيها HTML بس بتاخد نقاط سلبية عند فلاتر السبام —
 * والنسخة النصّية هي اللي بتظهر كمان في معاينة بعض التطبيقات.
 *
 * في ملف لوحده لأن الريجيكس هنا فيه شرطات مايلة كتير، وأي تعديل
 * آلي على `email.ts` كان بيكسرها.
 */
export function toPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<\/(p|div|tr|h[1-6]|li)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
