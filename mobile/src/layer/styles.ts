/**
 * التنسيق.
 *
 * `PAGE_CSS` بيتطبّق على صفحات المنصة نفسها وكل قاعدة فيه مشروطة بـ
 * `html.zw-app` — فالموقع في المتصفح ما بيتأثرش بحاجة.
 *
 * `LAYER_CSS` جوّه الـShadow DOM بتاع الطبقة بس.
 *
 * نفس قاعدة المنصة: الحركة على transform وopacity وحدهم.
 */

const NAV = 'nav[aria-label="التنقّل السريع"]'

export const PAGE_CSS = `
html.zw-app{-webkit-touch-callout:none;touch-action:manipulation;scrollbar-width:none}
html.zw-app::-webkit-scrollbar{display:none}
html.zw-app input,html.zw-app textarea,html.zw-app [contenteditable="true"]{-webkit-touch-callout:default}
html.zw-app img{-webkit-user-drag:none}
html.zw-app body{overscroll-behavior-y:none}
html.zw-app .zw-preloader{display:none!important}
html.zw-app button,html.zw-app [role="button"],html.zw-app nav a{-webkit-user-select:none;user-select:none}

html.zw-app button:not(:disabled):active,html.zw-app [role="button"]:active{scale:.97}
html.zw-app button.fixed:active{scale:none}

@keyframes zw-page-in{from{opacity:0;transform:translate3d(0,14px,0)}to{opacity:1;transform:none}}
@keyframes zw-page-back{from{opacity:0;transform:translate3d(0,-10px,0)}to{opacity:1;transform:none}}
@keyframes zw-page-soft{from{opacity:.4}to{opacity:1}}
html.zw-app main.zw-enter>:not(.fixed){animation:zw-page-in .36s cubic-bezier(.16,1,.3,1) both}
html.zw-app main.zw-enter-back>:not(.fixed){animation:zw-page-back .3s cubic-bezier(.16,1,.3,1) both}
html.zw-app main.zw-enter-soft>:not(.fixed){animation:zw-page-soft .22s ease-out both}

html.zw-app ${NAV}>*{position:relative;isolation:isolate}
html.zw-app ${NAV}>[aria-current="page"]::before{content:"";position:absolute;z-index:-1;top:6px;left:50%;width:58px;height:32px;margin-left:-29px;border-radius:16px;background:var(--primary-soft);animation:zw-pill .4s cubic-bezier(.34,1.56,.64,1) both}
@keyframes zw-pill{from{opacity:0;transform:scaleX(.4)}to{opacity:1;transform:none}}
html.zw-app ${NAV}>* svg{transition:transform .28s cubic-bezier(.34,1.56,.64,1)}
html.zw-app ${NAV}>[aria-current="page"] svg{transform:translateY(-1px) scale(1.07)}
html.zw-app ${NAV}>*:active svg{transform:scale(.84)}

/* شريط التبويبات الأصلي بياخد مكان شريط الموقع — نفس الارتفاع فمسافات الصفحة ما بتتغيّرش */
html.zw-app.zw-native-tabs ${NAV}{display:none!important}

@media (prefers-reduced-motion:reduce){
  html.zw-app main[class*="zw-enter"]>*,html.zw-app ${NAV}>*::before{animation:none!important}
}
`

export const LAYER_CSS = `
*{box-sizing:border-box}
.launch,.ob,.toasts,.net,.ptr,.progress{font-family:var(--font-plex-arabic),'IBM Plex Sans Arabic','Segoe UI',Tahoma,system-ui,sans-serif;direction:rtl;-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent}
button{font:inherit;cursor:pointer}
img{display:block;-webkit-user-drag:none}

@keyframes spin{to{transform:rotate(360deg)}}
@keyframes fade{from{opacity:0}to{opacity:1}}
@keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}

/* ─── شريط التقدّم ─── */
.progress{position:fixed;top:0;left:0;right:0;height:3px;display:flex;opacity:0;transition:opacity .3s ease}
.progress.on{opacity:1;transition:none}
.progress>span{display:block;height:100%;width:0;border-radius:3px 0 0 3px;background:linear-gradient(270deg,#765eb0,#a08cd0 60%,#d5cdea);box-shadow:0 0 12px rgba(160,140,208,.8)}

/* ─── شاشة الافتتاح ─── */
.launch{position:fixed;top:0;right:0;bottom:0;left:0;pointer-events:auto;display:flex;align-items:center;justify-content:center;overflow:hidden;background:radial-gradient(120% 75% at 50% 42%,#2d2656 0%,#1a1838 52%,#0f0e24 100%);transition:opacity .55s cubic-bezier(.4,0,.2,1),visibility 0s linear .55s}
.launch--light{background:radial-gradient(120% 75% at 50% 42%,#ffffff 0%,#f3f1f9 52%,#e4e0f1 100%)}
.launch--out{opacity:0;visibility:hidden}
.launch-glow{position:absolute;top:50%;left:50%;width:440px;height:440px;margin:-250px 0 0 -220px;border-radius:50%;background:radial-gradient(circle,rgba(146,125,197,.42) 0%,rgba(146,125,197,0) 62%);animation:launch-glow 2.8s ease-in-out infinite alternate}
.launch--light .launch-glow{background:radial-gradient(circle,rgba(146,125,197,.26) 0%,rgba(146,125,197,0) 62%)}
.launch-stack{position:relative;display:flex;flex-direction:column;align-items:center;transition:transform .55s cubic-bezier(.4,0,.2,1),filter .55s ease}
.launch--out .launch-stack{transform:scale(1.14);filter:blur(8px)}
.launch-mark{position:relative;width:104px;animation:launch-mark 1s cubic-bezier(.16,1,.3,1) both}
.launch-mark img{width:100%;height:auto}
.launch-mark::after{content:"";position:absolute;top:0;right:0;bottom:0;left:0;background:linear-gradient(105deg,rgba(255,255,255,0) 30%,rgba(255,255,255,.6) 50%,rgba(255,255,255,0) 70%);background-size:260% 100%;background-position:130% 0;-webkit-mask:var(--mark) center/contain no-repeat;mask:var(--mark) center/contain no-repeat;animation:launch-shine 1.5s .75s ease-in-out both}
.launch-word{width:112px;height:auto;margin-top:22px;animation:rise .8s .32s cubic-bezier(.16,1,.3,1) both}
.launch-bar{width:88px;height:3px;margin-top:30px;border-radius:3px;overflow:hidden;background:rgba(160,140,208,.18);animation:fade .5s .75s both}
.launch-bar span{display:block;width:45%;height:100%;border-radius:3px;background:linear-gradient(90deg,rgba(160,140,208,0),#a08cd0,rgba(160,140,208,0));animation:launch-slide 1.15s ease-in-out infinite}
@keyframes launch-mark{0%{opacity:0;transform:translateY(16px) scale(.7);filter:blur(10px)}60%{opacity:1;filter:blur(0)}100%{opacity:1;transform:none}}
@keyframes launch-shine{from{background-position:130% 0}to{background-position:-30% 0}}
@keyframes launch-slide{from{transform:translateX(-120%)}to{transform:translateX(260%)}}
@keyframes launch-glow{from{transform:scale(.9);opacity:.75}to{transform:scale(1.08);opacity:1}}

/* ─── التعريف بالتطبيق ─── */
.ob{position:fixed;top:0;right:0;bottom:0;left:0;pointer-events:auto;display:flex;flex-direction:column;overflow:hidden;color:#eceef6;background:linear-gradient(165deg,#241f42 0%,#171633 55%,#0f0e24 100%);padding-bottom:env(safe-area-inset-bottom,0px);animation:fade .45s both}
.ob--light{color:#222540;background:linear-gradient(165deg,#faf9fd 0%,#eceaf6 55%,#e2def0 100%)}
.ob--out{animation:ob-out .42s cubic-bezier(.4,0,.2,1) forwards;pointer-events:none}
@keyframes ob-out{to{opacity:0;transform:scale(1.04)}}
.ob-orb{position:absolute;border-radius:50%;filter:blur(46px);opacity:.5;pointer-events:none}
.ob-orb--a{width:280px;height:280px;top:-70px;right:-90px;background:#634b9a;animation:ob-drift 9s ease-in-out infinite alternate}
.ob-orb--b{width:250px;height:250px;bottom:90px;left:-100px;background:#3d4fa0;animation:ob-drift 11s ease-in-out infinite alternate-reverse}
.ob--light .ob-orb{opacity:.24}
@keyframes ob-drift{from{transform:translate(0,0)}to{transform:translate(34px,44px)}}
.ob-top{position:relative;display:flex;align-items:center;justify-content:space-between;height:60px;padding:0 20px}
.ob-brand{height:30px;width:auto}
.ob-skip{border:0;background:transparent;color:inherit;opacity:.7;font-size:15px;min-height:44px;padding:0 6px}
.ob-track{position:relative;flex:1;display:flex;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;scrollbar-width:none;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain}
.ob-track::-webkit-scrollbar{display:none}
.ob-slide{flex:0 0 100%;scroll-snap-align:center;scroll-snap-stop:always;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 32px;text-align:center}
.ob-art{position:relative;width:236px;height:236px;margin-bottom:40px;opacity:0}
.ob-ring{position:absolute;top:0;right:0;bottom:0;left:0;border-radius:50%;border:1.5px dashed rgba(160,140,208,.38);animation:spin 40s linear infinite}
.ob-ring--in{top:34px;right:34px;bottom:34px;left:34px;border-style:solid;border-color:rgba(160,140,208,.2);animation-direction:reverse;animation-duration:26s}
.ob-core{position:absolute;top:62px;right:62px;bottom:62px;left:62px;border-radius:32px;display:flex;align-items:center;justify-content:center;color:#fff;background:linear-gradient(145deg,#8a72c4,#634b9a 55%,#47366a);box-shadow:0 24px 50px -18px rgba(99,75,154,.8),inset 0 1px 0 rgba(255,255,255,.25)}
.ob-core svg{width:50px;height:50px}
.ob-chip{position:absolute;display:flex;align-items:center;gap:6px;padding:8px 12px;border-radius:14px;font-size:12.5px;font-weight:600;white-space:nowrap;color:#222540;background:rgba(255,255,255,.97);box-shadow:0 14px 30px -14px rgba(0,0,0,.5);opacity:0}
.ob-chip svg{width:15px;height:15px;color:#634b9a;flex:none}
.ob-chip--good svg{color:#15803d}
.ob-chip--a{top:16px;right:-20px}
.ob-chip--b{bottom:24px;left:-24px}
.ob-slide h2{margin:0 0 12px;font-size:26px;line-height:1.35;font-weight:700;opacity:0}
.ob-slide p{margin:0;max-width:320px;font-size:15.5px;line-height:1.85;opacity:0}
.ob-slide.is-active .ob-art{animation:ob-pop .7s cubic-bezier(.16,1,.3,1) both}
.ob-slide.is-active .ob-chip--a{animation:ob-chip .7s .25s cubic-bezier(.34,1.56,.64,1) both,ob-float 4s 1s ease-in-out infinite alternate}
.ob-slide.is-active .ob-chip--b{animation:ob-chip .7s .4s cubic-bezier(.34,1.56,.64,1) both,ob-float 4.6s 1.2s ease-in-out infinite alternate-reverse}
.ob-slide.is-active h2{animation:rise .6s .12s cubic-bezier(.16,1,.3,1) both}
.ob-slide.is-active p{animation:ob-soft .6s .2s cubic-bezier(.16,1,.3,1) both}
@keyframes ob-pop{from{opacity:0;transform:scale(.8)}to{opacity:1;transform:none}}
@keyframes ob-chip{from{opacity:0;transform:translateY(14px) scale(.85)}to{opacity:1;transform:none}}
@keyframes ob-float{from{transform:translateY(0)}to{transform:translateY(-8px)}}
@keyframes ob-soft{from{opacity:0;transform:translateY(14px)}to{opacity:.72;transform:none}}
.ob-bottom{position:relative;padding:10px 24px 22px}
.ob-dots{display:flex;justify-content:center;gap:7px;margin-bottom:22px}
.ob-dot{width:7px;height:7px;border-radius:7px;background:currentColor;opacity:.25;transition:width .35s cubic-bezier(.16,1,.3,1),opacity .35s}
.ob-dot.on{width:24px;opacity:1;background:#a08cd0}
.ob--light .ob-dot.on{background:#634b9a}
.ob-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:54px;border:0;border-radius:16px;font-size:16.5px;font-weight:700;color:#16182b;background:linear-gradient(135deg,#c4b8e4,#a08cd0);box-shadow:0 14px 30px -14px rgba(160,140,208,.85);transition:transform .15s ease}
.ob--light .ob-btn{color:#fff;background:linear-gradient(135deg,#765eb0,#634b9a);box-shadow:0 14px 30px -14px rgba(99,75,154,.8)}
.ob-btn:active{transform:scale(.97)}
.ob-btn svg{width:20px;height:20px}
.ob-link{display:block;width:100%;margin-top:8px;min-height:48px;border:0;background:transparent;color:inherit;font-size:15px;opacity:.85}
.ob-link b{color:#a08cd0;font-weight:700}
.ob--light .ob-link b{color:#634b9a}
.ob-link[hidden]{display:none}

/* ─── السحب للتحديث ─── */
.ptr{position:fixed;top:0;left:50%;width:44px;height:44px;margin-left:-22px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--primary,#634b9a);background:var(--surface,#fff);box-shadow:0 8px 22px -8px rgba(34,37,64,.45);opacity:0;transform:translate3d(0,-60px,0);will-change:transform}
.ptr svg{width:22px;height:22px}
.ptr--settle{transition:transform .32s cubic-bezier(.16,1,.3,1),opacity .32s ease}
.ptr--spin svg{animation:spin .75s linear infinite}

/* ─── الاتصال ─── */
.net{position:fixed;top:10px;left:50%;display:flex;align-items:center;gap:8px;padding:9px 16px;border-radius:999px;background:#b91c1c;color:#fff;font-size:13px;font-weight:600;white-space:nowrap;box-shadow:0 12px 28px -12px rgba(0,0,0,.55);transform:translate3d(-50%,-160%,0);transition:transform .5s cubic-bezier(.16,1,.3,1)}
.net--on{transform:translate3d(-50%,0,0)}
.net svg{width:16px;height:16px;flex:none}

/* ─── الإشعارات ─── */
.toasts{position:fixed;left:16px;right:16px;bottom:calc(var(--dash-nav,0px) + 16px);display:flex;flex-direction:column;align-items:center;gap:8px}
.toast{pointer-events:auto;display:flex;align-items:center;gap:10px;max-width:420px;min-height:48px;padding:10px 14px;border-radius:14px;color:#fff;font-size:14px;line-height:1.5;background:rgba(22,24,43,.95);box-shadow:0 14px 34px -12px rgba(0,0,0,.55);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);animation:toast-in .38s cubic-bezier(.16,1,.3,1) both}
.toast--out{animation:toast-out .26s ease forwards}
.toast-icon{width:18px;height:18px;flex:none}
.toast--success .toast-icon{color:#4ade80}
.toast--danger .toast-icon{color:#f87171}
.toast-text{flex:1}
.toast-action{flex:none;border:0;border-radius:9px;padding:6px 12px;color:#fff;font-weight:700;background:rgba(255,255,255,.14)}
@keyframes toast-in{from{opacity:0;transform:translateY(16px) scale(.96)}to{opacity:1;transform:none}}
@keyframes toast-out{to{opacity:0;transform:translateY(8px) scale(.97)}}

@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}
}
`
