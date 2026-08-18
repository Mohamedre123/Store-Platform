import Script from 'next/script'
import type { ActivePixels } from '@/lib/plugins'

/**
 * حقن بكسلات التتبّع في متجر التاجر.
 *
 * بتتحمّل بـ`afterInteractive` عشان ما تأخّرش ظهور المتجر — البكسل
 * مهم للتاجر، بس مش أهم من إن العميل يشوف المنتجات بسرعة.
 *
 * ما بتشتغلش في المعاينة: التاجر بيفتح متجره عشرات المرات وهو بيظبّط
 * شكله، ولو البكسل شغّال هيلوّث بياناته بزيارات مش حقيقية.
 */
export function StorePixels({ pixels, preview }: { pixels: ActivePixels; preview: boolean }) {
  if (preview) return null

  const { facebookPixelId, tiktokPixelId, snapchatPixelId, gaMeasurementId, googleAdsId } = pixels
  const gtagId = gaMeasurementId || googleAdsId

  return (
    <>
      {facebookPixelId && (
        <>
          <Script id="zw-fb-pixel" strategy="afterInteractive">
            {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${facebookPixelId}');fbq('track','PageView');`}
          </Script>
          <noscript>
            <img
              height="1"
              width="1"
              style={{ display: 'none' }}
              alt=""
              src={`https://www.facebook.com/tr?id=${facebookPixelId}&ev=PageView&noscript=1`}
            />
          </noscript>
        </>
      )}

      {tiktokPixelId && (
        <Script id="zw-tt-pixel" strategy="afterInteractive">
          {`!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];
ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};
ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js";
ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=r;ttq._t=ttq._t||{};ttq._t[e]=+new Date;
ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=d.createElement("script");o.type="text/javascript";
o.async=!0;o.src=r+"?sdkid="+e+"&lib="+t;var a=d.getElementsByTagName("script")[0];
a.parentNode.insertBefore(o,a)};
ttq.load('${tiktokPixelId}');ttq.page();}(window,document,'ttq');`}
        </Script>
      )}

      {snapchatPixelId && (
        <Script id="zw-sc-pixel" strategy="afterInteractive">
          {`(function(e,t,n){if(e.snaptr)return;var a=e.snaptr=function(){
a.handleRequest?a.handleRequest.apply(a,arguments):a.queue.push(arguments)};
a.queue=[];var s='script';var r=t.createElement(s);r.async=!0;
r.src=n;var u=t.getElementsByTagName(s)[0];u.parentNode.insertBefore(r,u);})
(window,document,'https://sc-static.net/scevent.min.js');
snaptr('init','${snapchatPixelId}');snaptr('track','PAGE_VIEW');`}
        </Script>
      )}

      {gtagId && (
        <>
          <Script
            id="zw-gtag-src"
            strategy="afterInteractive"
            src={`https://www.googletagmanager.com/gtag/js?id=${gtagId}`}
          />
          <Script id="zw-gtag" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}
gtag('js',new Date());
${gaMeasurementId ? `gtag('config','${gaMeasurementId}');` : ''}
${googleAdsId ? `gtag('config','${googleAdsId}');` : ''}`}
          </Script>
        </>
      )}
    </>
  )
}
