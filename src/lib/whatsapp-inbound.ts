import 'server-only'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { whatsappContacts } from '@/db/schema'

/**
 * قراءة الرسالة الواردة من شكل البوابة.
 *
 * ## ليه الملف ده موجود لوحده
 * الشكل اللي البوابة بتبعته مش عقد ثابت: بيختلف بين نسخة ونسخة، وبين
 * الحدث `messages.received` و`messages.upsert`، وواتساب نفسه غيّر
 * محتواه لما دخّل المعرّفات الداخلية. القراءة اللي كانت متمسّكة بمسار
 * واحد فضلت ساكتة لما المسار ده اتغيّر — والتاجر ما كانش عنده أي
 * طريقة يعرف إن الرد وصل أصلًا.
 *
 * فالقراءة هنا **بتدوّر على المعنى لا على المسار**: بتلاقي عقدة
 * الرسالة فين ما كانت، وبتقرا منها اللي تعرفه، وبتكمّل الناقص بمسح
 * عام على باقي الحمولة.
 */

/** أقصى عمق للمسح — الحمولة متداخلة، لكن مش لدرجة لا نهائية */
const MAX_DEPTH = 8

export type InboundMessage = {
  /**
   * رقم العميل بصيغة دولية بعلامة زائد — أو `null` لو البوابة بعتت
   * المعرّف الداخلي بس.
   */
  phone: string | null
  /** المعرّف الداخلي (`@lid`) من غير اللاحقة */
  lid: string | null
  text: string
  /** رسالتنا إحنا راجعة إلينا؟ */
  fromMe: boolean
  /** معرّف الرسالة عند واتساب — بيه بنمنع معالجتها مرتين */
  messageId: string | null
}

type Dict = Record<string, unknown>

const isDict = (v: unknown): v is Dict => typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * معرّف واتساب: أرقام، ولاحقة جهاز اختيارية، ونطاق.
 *
 * لاحقة الجهاز (`:12`) بتيجي لما العميل باعت من جهاز مربوط. تجاهُلها
 * كان بيخلّي الرقم يتقرا غلط ويطوّل رقمين زيادة.
 */
const JID = /^(\d{5,20})(?::\d+)?@(s\.whatsapp\.net|c\.us|lid|g\.us)$/

function parseJid(raw: unknown): { digits: string; domain: string } | null {
  if (typeof raw !== 'string') return null
  const m = JID.exec(raw.trim())
  return m ? { digits: m[1], domain: m[2] } : null
}

const isPhoneJid = (raw: unknown) => {
  const j = parseJid(raw)
  return j !== null && (j.domain === 's.whatsapp.net' || j.domain === 'c.us')
}

const isLidJid = (raw: unknown) => parseJid(raw)?.domain === 'lid'

/**
 * بيلاقي عقدة الرسالة في الحمولة.
 *
 * البوابة بتلفّها بشكل مختلف كل مرة: `{data:{messages:{…}}}` مرة،
 * و`{data:{messages:[{…}]}}` مرة، و`{message:{…}}` مرة. بدل ما نراهن
 * على واحد فيهم، بندوّر على أول عقدة **شكلها رسالة** — يعني فيها
 * `key.remoteJid`، وده الحقل الوحيد اللي بيوجد في كل الأشكال.
 */
function findMessageNode(root: unknown): Dict | null {
  let loose: Dict | null = null

  const visit = (node: unknown, depth: number): Dict | null => {
    if (depth > MAX_DEPTH) return null

    if (Array.isArray(node)) {
      for (const item of node) {
        const hit = visit(item, depth + 1)
        if (hit) return hit
      }
      return null
    }

    if (!isDict(node)) return null

    if (isDict(node.key) && typeof node.key.remoteJid === 'string') return node

    /*
      العقدة اللي فيها `remoteJid` أو `from` من غير `key` بتتحفظ
      كاحتياطي بس: فيه بوابات بتسطّح الشكل كده، لكن العقدة اللي فيها
      `key` أدق دايمًا لأنها بتحمل `fromMe` والمعرّف البديل معاها.
    */
    if (
      !loose &&
      (typeof node.remoteJid === 'string' ||
        typeof node.from === 'string' ||
        typeof node.chatId === 'string')
    ) {
      loose = node
    }

    for (const value of Object.values(node)) {
      const hit = visit(value, depth + 1)
      if (hit) return hit
    }
    return null
  }

  return visit(root, 0) ?? loose
}

/** بيجمّع كل معرّفات واتساب في الحمولة — احتياطي لما العقدة ناقصة */
function collectJids(root: unknown): string[] {
  const out: string[] = []

  const visit = (node: unknown, depth: number) => {
    if (depth > MAX_DEPTH || out.length > 60) return
    if (typeof node === 'string') {
      if (JID.test(node.trim())) out.push(node.trim())
      return
    }
    if (Array.isArray(node)) {
      for (const item of node) visit(item, depth + 1)
      return
    }
    if (isDict(node)) for (const value of Object.values(node)) visit(value, depth + 1)
  }

  visit(root, 0)
  return out
}

/**
 * بيدوّر على `fromMe: true` في أي مكان في الحمولة.
 *
 * ## ليه مش من العقدة وبس
 * الفحص القديم كان بيقرا `key.fromMe` من عقدة بيلاقيها بتخمين مسار.
 * لما المسار غاب، القيمة رجعت `undefined` — يعني «مش منّا» — فرسالتنا
 * إحنا رجعتلنا واتقرت كأنها رد عميل. ولو نص رسالتنا كان فيه «١»
 * كنّا هنرد على نفسنا في حلقة.
 *
 * الغياب هنا مش دليل، فبندوّر على القيمة نفسها في كل الحمولة: `true`
 * في أي مكان معناها الرسالة صادرة منّا، وده كافي نسكت.
 */
function anyFromMe(root: unknown): boolean {
  let found = false

  const visit = (node: unknown, depth: number) => {
    if (found || depth > MAX_DEPTH) return
    if (Array.isArray(node)) {
      for (const item of node) visit(item, depth + 1)
      return
    }
    if (!isDict(node)) return

    for (const [key, value] of Object.entries(node)) {
      if (found) return
      if ((key === 'fromMe' || key === 'isFromMe' || key === 'self') && value === true) {
        found = true
        return
      }
      visit(value, depth + 1)
    }
  }

  visit(root, 0)
  return found
}

/** الحقول اللي واتساب بيحط فيها نص الرسالة — على اختلاف نوعها */
function readText(node: Dict | null, root: unknown): string {
  const fromMessage = (msg: unknown): string => {
    if (!isDict(msg)) return ''
    const extended = isDict(msg.extendedTextMessage) ? msg.extendedTextMessage : {}
    const image = isDict(msg.imageMessage) ? msg.imageMessage : {}
    const video = isDict(msg.videoMessage) ? msg.videoMessage : {}
    /* رد على زرار أو قايمة — الجلسات ما بتدعمهاش، بس ما بتضرّش */
    const buttons = isDict(msg.buttonsResponseMessage) ? msg.buttonsResponseMessage : {}
    const list = isDict(msg.listResponseMessage) ? msg.listResponseMessage : {}
    const template = isDict(msg.templateButtonReplyMessage) ? msg.templateButtonReplyMessage : {}

    for (const candidate of [
      msg.conversation,
      extended.text,
      image.caption,
      video.caption,
      buttons.selectedDisplayText,
      buttons.selectedButtonId,
      list.title,
      template.selectedDisplayText,
      template.selectedId,
    ]) {
      if (typeof candidate === 'string' && candidate.trim()) return candidate
    }

    /* الرسالة ملفوفة في غلاف (رسالة مؤقّتة، أو مُعاد توجيهها) */
    for (const wrapper of [msg.ephemeralMessage, msg.viewOnceMessage, msg.documentWithCaptionMessage]) {
      if (isDict(wrapper)) {
        const inner = fromMessage(wrapper.message)
        if (inner) return inner
      }
    }
    return ''
  }

  if (node) {
    const direct = fromMessage(node.message)
    if (direct) return direct

    for (const candidate of [node.text, node.body, node.content, node.caption]) {
      if (typeof candidate === 'string' && candidate.trim()) return candidate
      if (isDict(candidate) && typeof candidate.body === 'string' && candidate.body.trim()) {
        return candidate.body
      }
    }
  }

  /*
    آخر محاولة: مسح عام على الحمولة كلها.

    شكل جديد ما نعرفوش مايستاهلش نسكت عنده — رد العميل «١» أهم من
    نظافة القراءة.
  */
  let hit = ''
  const visit = (n: unknown, depth: number) => {
    if (hit || depth > MAX_DEPTH) return
    if (Array.isArray(n)) {
      for (const item of n) visit(item, depth + 1)
      return
    }
    if (!isDict(n)) return
    const direct = fromMessage(n)
    if (direct) {
      hit = direct
      return
    }
    for (const value of Object.values(n)) visit(value, depth + 1)
  }
  visit(root, 0)
  return hit
}

/** معرّف الرسالة — لمنع معالجة نفس الرسالة مرتين */
function readMessageId(node: Dict | null, root: unknown): string | null {
  const key = node && isDict(node.key) ? node.key : null
  for (const candidate of [key?.id, node?.id, node?.messageId, (root as Dict | null)?.messageId]) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim().slice(0, 120)
    if (typeof candidate === 'number') return String(candidate)
  }
  return null
}

/**
 * بيطلّع الرسالة الواردة من حمولة الويب هوك.
 *
 * بيرجّع `null` لو الحمولة مش رسالة نصية من فرد (حالة اتصال، رسالة
 * جروب، إيصال قراية) — دي مش أخطاء، بس مالهاش لازمة عندنا.
 */
export function extractInbound(body: unknown): InboundMessage | null {
  const node = findMessageNode(body)
  const key = node && isDict(node.key) ? node.key : null

  const remote = (key?.remoteJid ?? node?.remoteJid ?? node?.from ?? node?.chatId) as unknown

  /* الجروبات مش عملاء — الرد عليها ضجيج */
  if (parseJid(remote)?.domain === 'g.us') return null

  /**
   * الرقم الحقيقي.
   *
   * واتساب بيبعت المعرّف الداخلي في `remoteJid` وبيسيب الرقم في حقل
   * جنبه — واسمه بيختلف حسب النسخة (`remoteJidAlt` أو `senderPn`).
   * فبنجرّب المعروفين، وبعدين `remoteJid` نفسه لو طلع رقمًا، وبعدين
   * أول رقم في الحمولة كلها.
   */
  const phoneCandidates: unknown[] = [
    key?.remoteJidAlt,
    key?.senderPn,
    key?.participantPn,
    key?.participantAlt,
    node?.remoteJidAlt,
    node?.senderPn,
    remote,
  ]

  let phoneDigits: string | null = null
  for (const candidate of phoneCandidates) {
    if (isPhoneJid(candidate)) {
      phoneDigits = parseJid(candidate)!.digits
      break
    }
  }

  const lidCandidates: unknown[] = [remote, key?.senderLid, key?.participantLid, node?.senderLid]
  let lidDigits: string | null = null
  for (const candidate of lidCandidates) {
    if (isLidJid(candidate)) {
      lidDigits = parseJid(candidate)!.digits
      break
    }
  }

  /*
    مفيش ولا واحد فيهم؟ نمسح الحمولة كلها.

    الشكل اللي ما نعرفوش لسه ممكن يكون فيه المعرّفين في مكان تاني،
    والسكوت هنا معناه رد عميل بيضيع.
  */
  if (!phoneDigits && !lidDigits) {
    for (const jid of collectJids(body)) {
      const parsed = parseJid(jid)!
      if (parsed.domain === 'g.us') continue
      if (!phoneDigits && parsed.domain !== 'lid') phoneDigits = parsed.digits
      if (!lidDigits && parsed.domain === 'lid') lidDigits = parsed.digits
    }
  }

  if (!phoneDigits && !lidDigits) return null

  const text = readText(node, body)
  if (!text.trim()) return null

  /*
    القيمة الصريحة أولى من المسح العام.

    المسح بيدوّر على `fromMe: true` في أي مكان — وده الصح لما العقدة
    ساكتة. لكن لو العقدة قالت `false` بوضوح، الكلمة كلمتها: حمولة
    فيها أكتر من رسالة (واحدة منّا وواحدة من العميل) كان المسح
    هيسكّتنا عن رد العميل فيها.
  */
  const declared =
    typeof key?.fromMe === 'boolean'
      ? key.fromMe
      : typeof node?.fromMe === 'boolean'
        ? node.fromMe
        : null

  return {
    phone: phoneDigits && phoneDigits.length >= 8 ? `+${phoneDigits}` : null,
    lid: lidDigits,
    text,
    /* الغياب مش دليل على إن الرسالة مش منّا — ساعتها بنمسح الحمولة */
    fromMe: declared ?? anyFromMe(body),
    messageId: readMessageId(node, body),
  }
}

/* ────────────────────────── ترجمة المعرّف الداخلي ────────────────────────── */

/**
 * بيحفظ ربط المعرّف الداخلي بالرقم.
 *
 * بيتنادى في كل مرة نشوف فيها الاتنين مع بعض — حتى في صدى رسايلنا
 * إحنا. كده الربط بيتعلّم من رسالة التأكيد اللي بعتناها، قبل ما
 * العميل يرد أصلًا.
 */
export async function rememberLid(storeId: string, lid: string, phone: string): Promise<void> {
  if (!lid || !phone) return
  await db
    .insert(whatsappContacts)
    .values({ storeId, lid, phone })
    .onConflictDoUpdate({
      target: [whatsappContacts.storeId, whatsappContacts.lid],
      set: { phone, updatedAt: new Date() },
    })
    .catch(() => undefined)
}

/** بيترجم معرّفًا داخليًا لرقم — لو اتعلّمناه قبل كده */
export async function phoneForLid(storeId: string, lid: string): Promise<string | null> {
  if (!lid) return null
  const [row] = await db
    .select({ phone: whatsappContacts.phone })
    .from(whatsappContacts)
    .where(and(eq(whatsappContacts.storeId, storeId), eq(whatsappContacts.lid, lid)))
    .limit(1)
  return row?.phone ?? null
}
