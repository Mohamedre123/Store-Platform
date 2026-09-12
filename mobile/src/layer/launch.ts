/**
 * شاشة الافتتاح المتحركة.
 *
 * الشاشة الأصلية (splash) ثابتة بحكم النظام. أول ما الصفحة تبدأ ترسم،
 * الشاشة دي بتاخد مكانها بنفس الخلفية والشعار — فالانتقال بيبان كأنه
 * الشعار نفسه صحي واتحرّك — وبتفضل لحد ما اللوحة تجهز فعلًا، فالتاجر
 * ما يشوفش صفحة نص محمّلة.
 */
import { ASSETS, isDarkTheme } from './env'
import { el, layer } from './dom'
import { setChromeOverride } from './chrome'

export type Launch = { hide(): Promise<void> }

export function mountLaunch(): Launch {
  const dark = isDarkTheme()
  const mark = dark ? ASSETS.markWhite : ASSETS.mark
  const word = dark ? ASSETS.typoWhite : ASSETS.typo

  const node = el(
    'div',
    `launch${dark ? '' : ' launch--light'}`,
    `<div class="launch-glow"></div>
     <div class="launch-stack">
       <div class="launch-mark" style="--mark:url(${mark})"><img src="${mark}" alt=""></div>
       <img class="launch-word" src="${word}" alt="زاوية">
       <div class="launch-bar"><span></span></div>
     </div>`,
  )
  node.setAttribute('role', 'status')
  node.setAttribute('aria-label', 'جاري فتح زاوية')
  layer().appendChild(node)
  setChromeOverride(dark ? '#1a1838' : '#f3f1f9')

  let hidden = false
  return {
    hide() {
      if (hidden) return Promise.resolve()
      hidden = true
      node.classList.add('launch--out')
      setChromeOverride(null)
      return new Promise((resolve) =>
        setTimeout(() => {
          node.remove()
          resolve()
        }, 600),
      )
    },
  }
}

/**
 * الصفحة جاهزة للعرض.
 *
 * `load` بيستنى كل الصور — في لوحة فيها صور منتجات كتير ممكن ياخد وقت
 * طويل والمحتوى نفسه ظاهر من بدري. فبنكتفي بثانية ونص بعد ما الـDOM
 * يجهز، وسقف خمس ثواني على أي حال.
 */
export function pageReady(): Promise<void> {
  return new Promise((resolve) => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      resolve()
    }
    if (document.readyState === 'complete') return finish()
    window.addEventListener('load', finish, { once: true })
    const afterDom = () => setTimeout(finish, 1500)
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', afterDom, { once: true })
    else afterDom()
    setTimeout(finish, 5000)
  })
}
