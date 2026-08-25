import 'server-only'
import React from 'react'
import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from '@react-pdf/renderer'
import { formatMoney } from './utils'

/**
 * فاتورة PDF حقيقية — مرفق لا رابط.
 *
 * ## ليه مرفق أصلًا
 * الرابط بيتوه: العميل بيقفل الرسالة، والواتساب بيمتلي، وبعد شهر لما
 * يحتاج فاتورته بيكلّم التاجر. الملف بيفضل في تليفونه وفي بريده.
 * والتاجر بيحتاجها ورقة مع الشحنة أحيانًا.
 *
 * ## العربي في PDF مش تفصيلة
 * أغلب مكتبات الـPDF بترسم الحروف العربية منفصلة ومقلوبة، لأنها
 * بتكتب الأكواد زي ما هي من غير **تشكيل الحروف** (اللي بيوصّل
 * الحرف بجاره) ولا **ترتيب ثنائي الاتجاه**.
 *
 * `@react-pdf` بيستخدم `fontkit` اللي بينفّذ جداول OpenType —
 * فالتشكيل بيتم صح **بشرط إن الخط نفسه فيه الجداول دي**. الخطوط
 * الأساسية المدمجة (Helvetica) مافيهاش عربي أصلًا، فبنسجّل خطًا
 * عربيًا حقيقيًا.
 *
 * ## الخط من الشبكة لا من الريبو
 * ملف الخط ٩٠ كيلو، وتخزينه في المستودع بيكبّر كل نشرة. جوجل
 * بتقدّمه على CDN ثابت، و`Font.register` بيجيبه مرة واحدة ويفضل في
 * ذاكرة الاستدعاء. ولو الشبكة وقعت، بنرمي خطأ واضح بدل ما نطلّع
 * فاتورة حروفها مكسّرة — الفاتورة المكسّرة أسوأ من غيابها.
 */

/**
 * تلات أوزان لا وزن واحد.
 *
 * الفاتورة بوزن واحد بتطلع باهتة ومسطّحة — مفيش فرق بين العنوان
 * والرقم والملاحظة، والعين مش لاقية حاجة تمسك فيها. الأرقام
 * والإجمالي بالذات لازم يبقوا تقال: دول اللي العميل بيدوّر عليهم.
 */
const CAIRO = {
  400: 'https://fonts.gstatic.com/s/cairo/v31/SLXgc1nY6HkvangtZmpQdkhzfH5lkSs2SgRjCAGMQ1z0hOA-W1Q.ttf',
  600: 'https://fonts.gstatic.com/s/cairo/v31/SLXgc1nY6HkvangtZmpQdkhzfH5lkSs2SgRjCAGMQ1z0hD45W1Q.ttf',
  700: 'https://fonts.gstatic.com/s/cairo/v31/SLXgc1nY6HkvangtZmpQdkhzfH5lkSs2SgRjCAGMQ1z0hAc5W1Q.ttf',
} as const

let registered = false

function ensureFont() {
  if (registered) return

  Font.register({
    family: 'Cairo',
    fonts: [
      { src: CAIRO[400], fontWeight: 400 },
      { src: CAIRO[600], fontWeight: 600 },
      { src: CAIRO[700], fontWeight: 700 },
    ],
  })

  /*
    القطع التلقائي للكلمات بيكسر العربي: `fontkit` بيقطع في نص
    الكلمة ويحطّ شرطة، فالكلمة بتتفكّ حروفها. بنقفله.
  */
  Font.registerHyphenationCallback((word) => [word])
  registered = true
}

/*
  ألوان أغمق من الأول.

  الرمادي الفاتح بيتقرا حلو على شاشة، وبيطلع باهت في الطباعة وفي
  عارض الـPDF على الفون. الفاتورة ورقة بتتقرا بسرعة — التباين فيها
  أهم من الرقّة.
*/
const INK = '#12142b'
const MUTED = '#4a5578'
const BORDER = '#cfd3e2'

/**
 * `textAlign: 'right'` على كل نص عربي — مش `direction` وبس.
 *
 * `direction: 'rtl'` بيرتّب **العناصر** جنب بعض من اليمين، لكن النص
 * جوّه العنصر بيفضل متحاذي شمال لأن الافتراضي كده. فالفاتورة كانت
 * بتطلع بعناصرها في مكانها الصح وكلامها ملزوق في الشمال.
 */
const styles = StyleSheet.create({
  page: {
    fontFamily: 'Cairo',
    fontSize: 10,
    color: INK,
    paddingTop: 36,
    paddingBottom: 44,
    paddingHorizontal: 34,
    textAlign: 'right',
  },
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1.5,
    borderBottomColor: BORDER,
    paddingBottom: 14,
    marginBottom: 18,
  },
  storeName: { fontSize: 18, fontWeight: 700, textAlign: 'right' },
  label: { fontSize: 8, fontWeight: 600, color: MUTED, textAlign: 'left' },
  number: { fontSize: 16, fontWeight: 700, textAlign: 'left' },
  headSide: { alignItems: 'flex-start' },
  section: { flexDirection: 'row-reverse', gap: 24, marginBottom: 20 },
  col: { flex: 1, alignItems: 'flex-end' },
  colLabel: { fontSize: 8, fontWeight: 600, color: MUTED, marginBottom: 3, textAlign: 'right' },
  strong: { fontWeight: 600, textAlign: 'right' },
  row: { flexDirection: 'row-reverse', alignItems: 'flex-start' },
  th: {
    fontSize: 8.5,
    fontWeight: 700,
    color: MUTED,
    borderBottomWidth: 1.5,
    borderBottomColor: BORDER,
    paddingBottom: 6,
  },
  td: { borderBottomWidth: 1, borderBottomColor: '#e8eaf2', paddingVertical: 8 },
  cName: { flex: 3, textAlign: 'right' },
  cQty: { flex: 1, textAlign: 'center', fontWeight: 600 },
  cPrice: { flex: 1.4, textAlign: 'left' },
  cTotal: { flex: 1.4, textAlign: 'left', fontWeight: 600 },
  itemName: { fontWeight: 600, textAlign: 'right' },
  option: { fontSize: 8.5, color: MUTED, marginTop: 3, textAlign: 'right' },
  totals: { marginTop: 16, alignSelf: 'flex-start', width: 235 },
  totalRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', paddingVertical: 3.5 },
  totalKey: { color: MUTED, textAlign: 'right' },
  totalValue: { fontWeight: 600, textAlign: 'left' },
  grand: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    borderTopWidth: 1.5,
    borderTopColor: BORDER,
    paddingTop: 8,
    marginTop: 5,
  },
  grandText: { fontSize: 13, fontWeight: 700 },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 34,
    right: 34,
    textAlign: 'center',
    fontSize: 8.5,
    color: MUTED,
  },
})

export type InvoiceData = {
  storeName: string
  storeEmail: string | null
  primary: string
  orderNumber: number
  placedAt: string
  currency: string
  customerName: string | null
  customerPhone: string | null
  customerEmail: string | null
  address: string | null
  paymentLabel: string
  paid: boolean
  lines: Array<{
    name: string
    quantity: number
    price: number
    total: number
    options: Array<{ name: string; value: string }>
  }>
  subtotal: number
  discount: number
  shipping: number
  codFee: number
  tax: number
  total: number
}

function InvoiceDoc({ d }: { d: InvoiceData }) {
  const money = (n: number) => formatMoney(n, d.currency)

  return (
    <Document title={`فاتورة ${d.orderNumber}`} author={d.storeName}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.storeName}>{d.storeName}</Text>
          <View style={styles.headSide}>
            <Text style={styles.label}>فاتورة رقم</Text>
            <Text style={{ ...styles.number, color: d.primary }}>#{d.orderNumber}</Text>
            <Text style={styles.label}>{d.placedAt}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.col}>
            <Text style={styles.colLabel}>فاتورة إلى</Text>
            <Text style={styles.strong}>{d.customerName || 'عميل'}</Text>
            {d.customerPhone ? <Text style={styles.option}>{d.customerPhone}</Text> : null}
            {d.customerEmail ? <Text style={styles.option}>{d.customerEmail}</Text> : null}
            {d.address ? <Text style={styles.option}>{d.address}</Text> : null}
          </View>
          <View style={styles.col}>
            <Text style={styles.colLabel}>حالة الدفع</Text>
            <Text style={{ ...styles.strong, color: d.paid ? '#1a7f4b' : '#b06b00' }}>
              {d.paid ? 'مدفوعة' : 'مستحقّة الدفع'}
            </Text>
            <Text style={styles.option}>{d.paymentLabel}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <Text style={{ ...styles.th, ...styles.cName }}>الصنف</Text>
          <Text style={{ ...styles.th, ...styles.cQty }}>الكمية</Text>
          <Text style={{ ...styles.th, ...styles.cPrice }}>السعر</Text>
          <Text style={{ ...styles.th, ...styles.cTotal }}>الإجمالي</Text>
        </View>

        {d.lines.map((l, i) => (
          <View key={i} style={{ ...styles.row, ...styles.td }}>
            <View style={styles.cName}>
              <Text style={styles.itemName}>{l.name}</Text>
              {/* الخيارات مفكوكة — الفاتورة بتنفع مرجعًا وقت الخلاف على مرتجع */}
              {l.options.length > 0 && (
                <Text style={styles.option}>
                  {l.options.map((o) => `${o.name}: ${o.value}`).join('  ·  ')}
                </Text>
              )}
            </View>
            <Text style={styles.cQty}>{l.quantity}</Text>
            <Text style={styles.cPrice}>{money(l.price)}</Text>
            <Text style={styles.cTotal}>{money(l.total)}</Text>
          </View>
        ))}

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalKey}>المنتجات</Text>
            <Text style={styles.totalValue}>{money(d.subtotal)}</Text>
          </View>
          {d.discount > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalKey}>الخصم</Text>
              <Text style={styles.totalValue}>− {money(d.discount)}</Text>
            </View>
          )}
          <View style={styles.totalRow}>
            <Text style={styles.totalKey}>الشحن</Text>
            <Text style={styles.totalValue}>
              {d.shipping > 0 ? money(d.shipping) : 'مجاني'}
            </Text>
          </View>
          {d.codFee > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalKey}>رسوم الدفع عند الاستلام</Text>
              <Text style={styles.totalValue}>{money(d.codFee)}</Text>
            </View>
          )}
          {d.tax > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalKey}>الضريبة</Text>
              <Text style={styles.totalValue}>{money(d.tax)}</Text>
            </View>
          )}
          <View style={styles.grand}>
            <Text style={styles.grandText}>الإجمالي</Text>
            <Text style={{ ...styles.grandText, color: d.primary }}>{money(d.total)}</Text>
          </View>
        </View>

        <Text style={styles.footer} fixed>
          شكرًا إنك اشتريت من {d.storeName}
          {d.storeEmail ? `  ·  ${d.storeEmail}` : ''}
        </Text>
      </Page>
    </Document>
  )
}

/**
 * بيطلّع الفاتورة كبايتات.
 *
 * `renderToBuffer` لا `renderToStream`: الاستخدامات كلها (مرفق بريد،
 * رد HTTP) محتاجة الملف كامل، والتحويل من دفق لبَفر بعدين شغل زيادة.
 */
export async function renderInvoicePdf(data: InvoiceData): Promise<Buffer> {
  ensureFont()
  return renderToBuffer(<InvoiceDoc d={data} />)
}
