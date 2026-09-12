package site.zawyaeg.app;

import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.ColorFilter;
import android.graphics.Paint;
import android.graphics.PixelFormat;
import android.graphics.Rect;
import android.graphics.drawable.Drawable;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.view.Window;
import android.webkit.CookieManager;
import android.webkit.URLUtil;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.browser.customtabs.CustomTabColorSchemeParams;
import androidx.browser.customtabs.CustomTabsIntent;
import androidx.core.content.FileProvider;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Logger;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.WebViewListener;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import org.json.JSONObject;

/**
 * الطبقة الأصلية لتطبيق زاوية على أندرويد.
 *
 * <ul>
 *   <li>بتحقن طبقة التطبيق (zawya-app.js) في أول كل صفحة من المنصة.</li>
 *   <li>بتقرر كل رابط يتفتح فين: المنصة جوّه التطبيق، المتاجر والمواقع التانية
 *       في متصفح داخلي، وواتساب والسوشيال في تطبيقاتهم.</li>
 *   <li>بتلوّن شريط الحالة وشريط التنقّل بلون الصفحة.</li>
 *   <li>تنزيل وحفظ ومشاركة وطباعة — اللي الـWebView ما بيعملوش لوحده.</li>
 * </ul>
 */
@CapacitorPlugin(name = "ZawyaShell")
public class ZawyaShellPlugin extends Plugin {

    private static final String TAG = "ZawyaShell";
    private static final String LAYER_ASSET = "public/zawya-app.js";

    private static final Set<String> APP_HOSTS = new HashSet<>(Arrays.asList("www.zawyaeg.site", "zawyaeg.site"));

    /** مواقع ليها تطبيقات — الرابط بيروح للتطبيق نفسه (أو المتصفح لو مش متسطّب) */
    private static final Set<String> SYSTEM_HOSTS = new HashSet<>(
        Arrays.asList(
            "wa.me",
            "api.whatsapp.com",
            "chat.whatsapp.com",
            "web.whatsapp.com",
            "whatsapp.com",
            "www.whatsapp.com",
            "t.me",
            "telegram.me",
            "m.me",
            "maps.google.com",
            "maps.app.goo.gl",
            "goo.gl",
            "play.google.com",
            "apps.apple.com",
            "facebook.com",
            "www.facebook.com",
            "m.facebook.com",
            "instagram.com",
            "www.instagram.com",
            "tiktok.com",
            "www.tiktok.com",
            "youtube.com",
            "www.youtube.com",
            "youtu.be",
            "x.com",
            "twitter.com",
            "snapchat.com",
            "www.snapchat.com"
        )
    );

    private int topColor = Color.parseColor("#14162a");
    private int bottomColor = Color.parseColor("#14162a");

    @Override
    public void load() {
        WebView webView = getBridge().getWebView();
        injectLayer(webView);
        configureWebView(webView);
        clearSharedCache();
    }

    /* ─────────────── حقن طبقة التطبيق ─────────────── */

    /**
     * الحقن هنا في load() لأن الإضافات بتتحمّل قبل ما الجسر يحمّل أول صفحة —
     * فالسكربت بيلحق أول صفحة كمان مش اللي بعدها بس.
     */
    private void injectLayer(WebView webView) {
        String script = readAsset(LAYER_ASSET);
        if (script == null) {
            Logger.error(TAG, "App layer missing from assets — run `npm run sync`", null);
            return;
        }

        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            Set<String> origins = new HashSet<>();
            for (String host : APP_HOSTS) origins.add("https://" + host);
            WebViewCompat.addDocumentStartJavaScript(webView, script, origins);
            return;
        }

        /* WebView قديم جدًا: الحقن بعد ما الصفحة تبدأ ترسم — متأخر شوية بس شغّال */
        final String fallback = script;
        getBridge()
            .addWebViewListener(
                new WebViewListener() {
                    @Override
                    public void onPageCommitVisible(WebView view, String url) {
                        Uri uri = Uri.parse(url);
                        if (uri.getHost() != null && APP_HOSTS.contains(uri.getHost())) {
                            view.evaluateJavascript(fallback, null);
                        }
                    }
                }
            );
    }

    @Nullable
    private String readAsset(String path) {
        try (InputStream in = getContext().getAssets().open(path); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[16384];
            int read;
            while ((read = in.read(buffer)) != -1) out.write(buffer, 0, read);
            return new String(out.toByteArray(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            return null;
        }
    }

    private void configureWebView(WebView webView) {
        /* توهّج الحافة بتاع أندرويد مش من شكل المنصة — السحب للتحديث بيعوّضه */
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        WebSettings settings = webView.getSettings();
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        webView.setDownloadListener(this::handleDownload);
    }

    /* ─────────────── توجيه الروابط ─────────────── */

    @Override
    public Boolean shouldOverrideLoad(Uri url) {
        String scheme = url.getScheme();
        String host = url.getHost();
        if (scheme == null || host == null) return null;
        scheme = scheme.toLowerCase();
        host = host.toLowerCase();

        /* tel: mailto: whatsapp: intent: — الجسر بيفتحهم في تطبيقاتهم */
        if (!scheme.equals("http") && !scheme.equals("https")) return null;

        if (APP_HOSTS.contains(host)) {
            String path = url.getPath() == null ? "" : url.getPath();
            /*
             * واجهة المتجر بتشغّل أكواد التاجر في رأس الصفحة. جوّه التطبيق كان
             * هيبقى ليها وصول لجسر التطبيق — فبتتفتح في متصفح داخلي. إطار
             * المعاينة في محرّر الثيم (preview=1) استثناء لأنه جوّه اللوحة.
             */
            if (path.startsWith("/s/") && !"1".equals(url.getQueryParameter("preview"))) {
                openInAppBrowser(url);
                return true;
            }
            return null;
        }

        if (SYSTEM_HOSTS.contains(host)) return null;

        openInAppBrowser(url);
        return true;
    }

    private void openInAppBrowser(Uri url) {
        try {
            CustomTabColorSchemeParams colors = new CustomTabColorSchemeParams.Builder().setToolbarColor(topColor).build();
            CustomTabsIntent intent = new CustomTabsIntent.Builder()
                .setDefaultColorSchemeParams(colors)
                .setShowTitle(true)
                .setShareState(CustomTabsIntent.SHARE_STATE_ON)
                .build();
            intent.launchUrl(getActivity(), url);
        } catch (ActivityNotFoundException e) {
            try {
                getActivity().startActivity(new Intent(Intent.ACTION_VIEW, url));
            } catch (ActivityNotFoundException ignored) {
                Toast.makeText(getContext(), "مفيش متصفح يفتح الرابط ده", Toast.LENGTH_SHORT).show();
            }
        }
    }

    /* ─────────────── ألوان الأشرطة ─────────────── */

    @PluginMethod
    public void setChrome(PluginCall call) {
        Integer top = parseColor(call.getString("top"));
        Integer bottom = parseColor(call.getString("bottom"));
        if (top != null) topColor = top;
        if (bottom != null) bottomColor = bottom;
        getBridge()
            .executeOnMainThread(() -> {
                applyChrome();
                call.resolve();
            });
    }

    /**
     * المحتوى متحط بين الشريطين (نظام الأشرطة بيحط padding على الـDecorView)،
     * فاللي بيبان وراهم هو خلفية النافذة. خلفية بنصّين بلونين = شريط حالة
     * بلون أعلى الصفحة وشريط تنقّل بلون أسفلها.
     */
    @SuppressWarnings("deprecation")
    private void applyChrome() {
        Window window = getActivity().getWindow();
        window.setBackgroundDrawable(new SplitColorDrawable(topColor, bottomColor));
        if (Build.VERSION.SDK_INT < 35) {
            window.setStatusBarColor(topColor);
            window.setNavigationBarColor(bottomColor);
        }
        getBridge().getWebView().setBackgroundColor(topColor);
    }

    @Nullable
    private static Integer parseColor(@Nullable String value) {
        if (value == null) return null;
        try {
            return Color.parseColor(value);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private static final class SplitColorDrawable extends Drawable {

        private final Paint top = new Paint();
        private final Paint bottom = new Paint();

        SplitColorDrawable(int topColor, int bottomColor) {
            top.setColor(topColor);
            bottom.setColor(bottomColor);
        }

        @Override
        public void draw(@NonNull Canvas canvas) {
            Rect r = getBounds();
            float middle = r.top + r.height() / 2f;
            canvas.drawRect(r.left, r.top, r.right, middle, top);
            canvas.drawRect(r.left, middle, r.right, r.bottom, bottom);
        }

        @Override
        public void setAlpha(int alpha) {}

        @Override
        public void setColorFilter(@Nullable ColorFilter colorFilter) {}

        @Override
        @SuppressWarnings("deprecation")
        public int getOpacity() {
            return PixelFormat.OPAQUE;
        }
    }

    /* ─────────────── الطباعة ─────────────── */

    @PluginMethod
    public void print(PluginCall call) {
        String title = call.getString("title", "");
        getBridge()
            .executeOnMainThread(() -> {
                try {
                    PrintManager manager = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                    String job = title == null || title.isEmpty() ? getContext().getString(R.string.app_name) : title;
                    PrintDocumentAdapter adapter = getBridge().getWebView().createPrintDocumentAdapter(job);
                    manager.print(job, adapter, new PrintAttributes.Builder().build());
                    call.resolve();
                } catch (Exception e) {
                    call.reject("Print failed", e);
                }
            });
    }

    /* ─────────────── الملفات ─────────────── */

    /** تنزيلات الخادم (فاتورة PDF، ملف كتالوج) — بكوكيز الجلسة عشان الرابط المحمي يشتغل */
    private void handleDownload(String url, String userAgent, String contentDisposition, String mimeType, long contentLength) {
        Uri uri = Uri.parse(url);
        String scheme = uri.getScheme();
        /* blob: و data: طبقة التطبيق بتلقطهم قبل ما يوصلوا هنا */
        if (scheme == null || !(scheme.equals("http") || scheme.equals("https"))) return;

        String name = URLUtil.guessFileName(url, contentDisposition, mimeType);
        try {
            DownloadManager.Request request = new DownloadManager.Request(uri);
            request.setMimeType(mimeType);
            String cookies = CookieManager.getInstance().getCookie(url);
            if (cookies != null) request.addRequestHeader("Cookie", cookies);
            request.addRequestHeader("User-Agent", userAgent);
            request.setTitle(name);
            request.setDescription(getContext().getString(R.string.app_name));
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "Zawya/" + name);
            }
            DownloadManager manager = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
            manager.enqueue(request);
            Toast.makeText(getContext(), "بدأ تنزيل " + name, Toast.LENGTH_SHORT).show();
        } catch (Exception e) {
            Logger.error(TAG, "Download failed, opening in browser", e);
            openInAppBrowser(uri);
        }
    }

    @PluginMethod
    public void saveFile(PluginCall call) {
        String name = sanitize(call.getString("name", "zawya-file"));
        String mimeType = call.getString("mimeType", "application/octet-stream");
        String data = call.getString("data");
        if (data == null) {
            call.reject("Missing data");
            return;
        }

        try {
            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            Uri uri;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                /* مجلد التنزيلات العام — من غير أي صلاحية تخزين */
                ContentResolver resolver = getContext().getContentResolver();
                ContentValues values = new ContentValues();
                values.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
                values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
                values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Zawya");
                values.put(MediaStore.MediaColumns.IS_PENDING, 1);
                uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri == null) throw new IOException("Could not create download entry");
                try (OutputStream out = resolver.openOutputStream(uri)) {
                    if (out == null) throw new IOException("No output stream");
                    out.write(bytes);
                }
                values.clear();
                values.put(MediaStore.MediaColumns.IS_PENDING, 0);
                resolver.update(uri, values, null, null);
            } else {
                File dir = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                if (dir == null) dir = new File(getContext().getFilesDir(), "downloads");
                File file = writeFile(dir, name, bytes, true);
                uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
            }
            JSObject result = new JSObject();
            result.put("uri", uri.toString());
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Save failed", e);
        }
    }

    @PluginMethod
    public void openFile(PluginCall call) {
        String uri = call.getString("uri");
        String mimeType = call.getString("mimeType", "*/*");
        if (uri == null) {
            call.reject("Missing uri");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(Uri.parse(uri), mimeType);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getActivity().startActivity(intent);
            call.resolve();
        } catch (ActivityNotFoundException e) {
            call.reject("No app can open this file");
        }
    }

    @PluginMethod
    public void shareFiles(PluginCall call) {
        JSArray files = call.getArray("files");
        if (files == null || files.length() == 0) {
            call.reject("No files");
            return;
        }

        try {
            File dir = new File(getContext().getCacheDir(), "shared");
            ArrayList<Uri> uris = new ArrayList<>();
            String type = null;
            for (int i = 0; i < files.length(); i++) {
                JSONObject file = files.getJSONObject(i);
                byte[] bytes = Base64.decode(file.getString("data"), Base64.DEFAULT);
                File written = writeFile(dir, sanitize(file.optString("name", "zawya-file")), bytes, false);
                uris.add(FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", written));
                String mime = file.optString("mimeType", "*/*");
                type = type == null || type.equals(mime) ? mime : "*/*";
            }

            Intent intent;
            if (uris.size() == 1) {
                intent = new Intent(Intent.ACTION_SEND);
                intent.putExtra(Intent.EXTRA_STREAM, uris.get(0));
            } else {
                intent = new Intent(Intent.ACTION_SEND_MULTIPLE);
                intent.putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris);
            }
            intent.setType(type);
            String text = call.getString("text");
            if (text != null && !text.isEmpty()) intent.putExtra(Intent.EXTRA_TEXT, text);

            /* من غير ClipData بعض التطبيقات (واتساب منهم) ما بتاخدش صلاحية قراءة الملف */
            ClipData clip = ClipData.newRawUri("", uris.get(0));
            for (int i = 1; i < uris.size(); i++) clip.addItem(new ClipData.Item(uris.get(i)));
            intent.setClipData(clip);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            getActivity().startActivity(Intent.createChooser(intent, "مشاركة"));
            call.resolve();
        } catch (Exception e) {
            call.reject("Share failed", e);
        }
    }

    private File writeFile(File dir, String name, byte[] bytes, boolean unique) throws IOException {
        if (!dir.exists() && !dir.mkdirs()) throw new IOException("Could not create " + dir);
        File file = new File(dir, name);
        if (unique) {
            int dot = name.lastIndexOf('.');
            String base = dot > 0 ? name.substring(0, dot) : name;
            String ext = dot > 0 ? name.substring(dot) : "";
            for (int i = 1; file.exists(); i++) file = new File(dir, base + " (" + i + ")" + ext);
        }
        try (FileOutputStream out = new FileOutputStream(file)) {
            out.write(bytes);
        }
        return file;
    }

    private void clearSharedCache() {
        File[] old = new File(getContext().getCacheDir(), "shared").listFiles();
        if (old == null) return;
        for (File f : old) {
            //noinspection ResultOfMethodCallIgnored
            f.delete();
        }
    }

    private static String sanitize(@Nullable String name) {
        String clean = name == null ? "" : name.replaceAll("[\\\\/:*?\"<>|]+", "-").trim();
        if (clean.isEmpty()) clean = "zawya-file";
        return clean.length() > 120 ? clean.substring(0, 120) : clean;
    }
}
