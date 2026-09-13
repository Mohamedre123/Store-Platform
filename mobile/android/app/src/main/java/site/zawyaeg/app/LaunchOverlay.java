package site.zawyaeg.app;

import android.animation.Animator;
import android.animation.AnimatorSet;
import android.animation.ObjectAnimator;
import android.animation.ValueAnimator;
import android.app.Activity;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.Outline;
import android.graphics.drawable.GradientDrawable;
import android.os.Handler;
import android.os.Looper;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewOutlineProvider;
import android.view.animation.AccelerateDecelerateInterpolator;
import android.view.animation.DecelerateInterpolator;
import android.view.animation.LinearInterpolator;
import android.widget.FrameLayout;
import android.widget.ImageView;
import java.util.ArrayList;
import java.util.List;

/**
 * شاشة الافتتاح المتحركة — أصلية، من أول فريم.
 *
 * <p>شاشة البداية بتاعة النظام صورة ثابتة، والـWebView بياخد ثواني عشان يصحى
 * ويرسم — فالتاجر كان بيبص على لوجو واقف. هنا فوق الـWebView بنحط نفس
 * العلامة في نفس المكان والمقاس بالظبط (فمفيش قفزة لما شاشة النظام تختفي)،
 * وبتبدأ تتنفّس ويظهر تحتها اسم «زاوية» وشريط تحميل — لحد ما الطبقة تقول
 * إن اللوحة جاهزة ({@code ZawyaShell.hideLaunch}).
 *
 * <p>الحركة كلها scale وtranslation وalpha — بتتحسب على كرت الشاشة، فمش
 * بتزاحم الـWebView وهو بيحمّل.
 */
final class LaunchOverlay {

    /** سقف أمان: لو الطبقة ما ردّتش لأي سبب، الشاشة ما تفضلش فوق التطبيق */
    private static final long MAX_VISIBLE_MS = 15000;

    /** نسبة العلامة جوّه splash_icon (من generate-assets: markHeight 0.36) */
    private static final float MARK_RATIO = 0.36f;

    private static FrameLayout root;
    private static final List<Animator> loops = new ArrayList<>();
    private static boolean hiding;

    private LaunchOverlay() {}

    static void show(Activity activity) {
        if (root != null) {
            if (root.getContext() == activity) return;
            root = null;
        }
        hiding = false;

        final boolean dark =
            (activity.getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        final int screenW = activity.getResources().getDisplayMetrics().widthPixels;
        final int screenH = activity.getResources().getDisplayMetrics().heightPixels;

        FrameLayout overlay = new FrameLayout(activity);
        /* اللمس ما يعدّيش للصفحة اللي بتحمّل تحتها */
        overlay.setClickable(true);
        overlay.setFocusable(true);

        GradientDrawable background = new GradientDrawable(
            GradientDrawable.Orientation.TOP_BOTTOM,
            dark
                ? new int[] { Color.parseColor("#2d2656"), Color.parseColor("#1a1838"), Color.parseColor("#0f0e24") }
                : new int[] { Color.WHITE, Color.parseColor("#f3f1f9"), Color.parseColor("#e4e0f1") }
        );
        background.setGradientType(GradientDrawable.RADIAL_GRADIENT);
        background.setGradientCenter(0.5f, 0.45f);
        background.setGradientRadius(Math.max(screenW, screenH) * 0.72f);
        overlay.setBackground(background);

        /* الهالة ورا العلامة */
        int glowSize = dp(activity, 320);
        View glow = new View(activity);
        GradientDrawable glowShape = new GradientDrawable();
        glowShape.setShape(GradientDrawable.OVAL);
        glowShape.setGradientType(GradientDrawable.RADIAL_GRADIENT);
        glowShape.setGradientRadius(glowSize / 2f);
        glowShape.setColors(new int[] { Color.argb(dark ? 107 : 66, 146, 125, 197), Color.argb(0, 146, 125, 197) });
        glow.setBackground(glowShape);
        overlay.addView(glow, new FrameLayout.LayoutParams(glowSize, glowSize, Gravity.CENTER));

        /* العلامة — نفس مقاس أيقونة شاشة النظام (240dp) عشان التسليم يبان كأنه نفس اللوجو صحي */
        int iconSize = dp(activity, 240);
        ImageView mark = new ImageView(activity);
        mark.setImageResource(R.drawable.splash_icon);
        mark.setScaleType(ImageView.ScaleType.FIT_CENTER);
        overlay.addView(mark, new FrameLayout.LayoutParams(iconSize, iconSize, Gravity.CENTER));

        float markHalf = iconSize * MARK_RATIO / 2f;

        /* «زاوية» تحت العلامة */
        int wordW = dp(activity, 112);
        int wordH = Math.round(wordW * 192f / 377f);
        ImageView word = new ImageView(activity);
        word.setImageResource(R.drawable.splash_word);
        word.setScaleType(ImageView.ScaleType.FIT_CENTER);
        overlay.addView(word, new FrameLayout.LayoutParams(wordW, wordH, Gravity.CENTER));
        float wordY = markHalf + dp(activity, 22) + wordH / 2f;
        word.setTranslationY(wordY + dp(activity, 14));
        word.setAlpha(0f);

        /* شريط التحميل */
        int barW = dp(activity, 88);
        final int barH = dp(activity, 3);
        FrameLayout bar = new FrameLayout(activity);
        GradientDrawable track = new GradientDrawable();
        track.setCornerRadius(barH);
        track.setColor(Color.argb(46, 160, 140, 208));
        bar.setBackground(track);
        bar.setClipToOutline(true);
        bar.setOutlineProvider(
            new ViewOutlineProvider() {
                @Override
                public void getOutline(View view, Outline outline) {
                    outline.setRoundRect(0, 0, view.getWidth(), view.getHeight(), barH);
                }
            }
        );
        View runner = new View(activity);
        GradientDrawable runnerShape = new GradientDrawable(
            GradientDrawable.Orientation.LEFT_RIGHT,
            new int[] { Color.argb(0, 160, 140, 208), Color.parseColor("#a08cd0"), Color.argb(0, 160, 140, 208) }
        );
        runnerShape.setCornerRadius(barH);
        runner.setBackground(runnerShape);
        int runnerW = Math.round(barW * 0.45f);
        bar.addView(runner, new FrameLayout.LayoutParams(runnerW, barH, Gravity.START | Gravity.CENTER_VERTICAL));
        overlay.addView(bar, new FrameLayout.LayoutParams(barW, barH, Gravity.CENTER));
        bar.setTranslationY(markHalf + dp(activity, 22) + wordH + dp(activity, 30) + barH / 2f);
        bar.setAlpha(0f);

        activity.addContentView(overlay, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        root = overlay;

        /* ─── الحركة ─── */

        /* العلامة بتتنفّس وبتطفو شوية */
        ValueAnimator breathe = ValueAnimator.ofFloat(0f, 1f);
        breathe.setDuration(1100);
        breathe.setStartDelay(120);
        breathe.setRepeatCount(ValueAnimator.INFINITE);
        breathe.setRepeatMode(ValueAnimator.REVERSE);
        breathe.setInterpolator(new AccelerateDecelerateInterpolator());
        final int lift = dp(activity, 5);
        breathe.addUpdateListener(a -> {
            float t = (float) a.getAnimatedValue();
            float s = 1f + 0.07f * t;
            mark.setScaleX(s);
            mark.setScaleY(s);
            mark.setTranslationY(-lift * t);
        });

        ValueAnimator pulse = ValueAnimator.ofFloat(0f, 1f);
        pulse.setDuration(1400);
        pulse.setRepeatCount(ValueAnimator.INFINITE);
        pulse.setRepeatMode(ValueAnimator.REVERSE);
        pulse.setInterpolator(new AccelerateDecelerateInterpolator());
        pulse.addUpdateListener(a -> {
            float t = (float) a.getAnimatedValue();
            float s = 0.88f + 0.22f * t;
            glow.setScaleX(s);
            glow.setScaleY(s);
            glow.setAlpha(0.7f + 0.3f * t);
        });

        ObjectAnimator slide = ObjectAnimator.ofFloat(runner, View.TRANSLATION_X, -runnerW, barW);
        slide.setDuration(1150);
        slide.setRepeatCount(ValueAnimator.INFINITE);
        slide.setInterpolator(new AccelerateDecelerateInterpolator());

        AnimatorSet wordIn = new AnimatorSet();
        wordIn.playTogether(
            ObjectAnimator.ofFloat(word, View.ALPHA, 0f, 1f),
            ObjectAnimator.ofFloat(word, View.TRANSLATION_Y, word.getTranslationY(), wordY)
        );
        wordIn.setStartDelay(260);
        wordIn.setDuration(700);
        wordIn.setInterpolator(new DecelerateInterpolator(2f));

        ObjectAnimator barIn = ObjectAnimator.ofFloat(bar, View.ALPHA, 0f, 1f);
        barIn.setStartDelay(650);
        barIn.setDuration(400);
        barIn.setInterpolator(new LinearInterpolator());

        loops.clear();
        loops.add(breathe);
        loops.add(pulse);
        loops.add(slide);
        breathe.start();
        pulse.start();
        slide.start();
        wordIn.start();
        barIn.start();

        new Handler(Looper.getMainLooper()).postDelayed(LaunchOverlay::hide, MAX_VISIBLE_MS);
    }

    /** بيتنادى من أي thread — الطبقة، أو احتياطي تحميل الصفحة، أو سقف الأمان */
    static void hide() {
        final FrameLayout overlay = root;
        if (overlay == null) return;
        overlay.post(() -> {
            if (root != overlay || hiding) return;
            hiding = true;
            overlay.setClickable(false);
            for (int i = 0; i < overlay.getChildCount(); i++) {
                View child = overlay.getChildAt(i);
                child.animate().scaleXBy(0.12f).scaleYBy(0.12f).setDuration(420).setInterpolator(new DecelerateInterpolator()).start();
            }
            overlay
                .animate()
                .alpha(0f)
                .setDuration(420)
                .setInterpolator(new AccelerateDecelerateInterpolator())
                .withEndAction(() -> {
                    for (Animator loop : loops) loop.cancel();
                    loops.clear();
                    ViewGroup parent = (ViewGroup) overlay.getParent();
                    if (parent != null) parent.removeView(overlay);
                    if (root == overlay) root = null;
                    hiding = false;
                })
                .start();
        });
    }

    private static int dp(Activity activity, float value) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value, activity.getResources().getDisplayMetrics()));
    }
}
