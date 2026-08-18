import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  BadgePercent,
  BarChart3,
  Boxes,
  CreditCard,
  MessageCircle,
  Palette,
  RotateCcw,
  Truck,
  Zap,
} from "lucide-react";
import {
  AuroraBackground,
  CountUp,
  Enter,
  Reveal,
  SpotlightCard,
} from "@/components/motion";
import { Logo } from "@/components/logo";
import { brand } from "@/lib/brand";

const features = [
  {
    icon: Boxes,
    title: "منتجات ومخزون",
    body: "مقاسات وألوان، مخزون لحظي، تنبيه قبل ما الكمية تخلص، ومستودعات متعددة لو احتجت.",
  },
  {
    icon: Zap,
    title: "شيك أوت بيقفل الطلب",
    body: "حقول تتحكم فيها بالكامل، دفع سريع من صفحة المنتج، وتحقق برمز قبل التأكيد.",
  },
  {
    icon: MessageCircle,
    title: "استرداد السلات المتروكة",
    body: "أول ما العميل يكتب رقمه بنحفظ الطلب. يسيبه؟ يوصله تذكير واتساب، وإنت تشوفه في لوحتك.",
  },
  {
    icon: Truck,
    title: "شحن ودفع عند الاستلام",
    body: "أسعار لكل محافظة، شحن مجاني فوق مبلغ، بوليصة تلقائية، وتتبّع للشحنة.",
  },
  {
    icon: CreditCard,
    title: "كل طرق الدفع",
    body: "دفع عند الاستلام، بطاقات، محافظ، وتحويل بنكي — برسوم أو خصم تحدده لكل طريقة.",
  },
  {
    icon: BarChart3,
    title: "ربح حقيقي مش إيراد",
    body: "بنحسب التكلفة والشحن والمرتجع والخصومات، ونقولك كسبت كام فعلًا من كل منتج.",
  },
  {
    icon: Palette,
    title: "متجر على ذوقك",
    body: "ألوان وشعار وأقسام ترتّبها بنفسك، ومعاينة حيّة قبل ما تنشر أي تعديل.",
  },
  {
    icon: BadgePercent,
    title: "كوبونات وعروض وولاء",
    body: "خصومات بشروط، باقات، نقاط، مستويات عملاء، وعجلة حظ تشغّلها بضغطة.",
  },
  {
    icon: RotateCcw,
    title: "مرتجعات واستبدال",
    body: "طلب إرجاع بمسار واضح من الطلب لحد رجوع البضاعة للمخزون — من غير واتساب ولا ورق.",
  },
];

const steps = [
  {
    t: "سجّل واختار اسم متجرك",
    d: "بيتفتحلك رابط جاهز على طول، وتقدر تربط دومينك بعدين.",
  },
  { t: "ضيف منتجاتك", d: "صور ومقاسات وألوان وأسعار — أو استورد ملف جاهز." },
  {
    t: "ظبّط الشحن والدفع",
    d: "أسعار المحافظات والدفع عند الاستلام، وابدأ تستقبل طلبات.",
  },
];

export default function HomePage() {
  return (
    <>
      <AuroraBackground />

      <main className="min-h-screen-safe relative">
        {/* الهيدر */}
        <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--surface)]/85 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
            <Link
              href="/"
              aria-label={brand.name}
              className="zw-lift -mx-2 flex min-h-11 items-center gap-2 rounded-lg px-2"
            >
              <Logo size="md" priority />
            </Link>

            <nav className="hidden items-center gap-7 text-sm text-[var(--fg-muted)] md:flex">
              <a
                href="#features"
                className="zw-underline transition-colors hover:text-[var(--fg)]"
              >
                المميزات
              </a>
              <a
                href="#how"
                className="zw-underline transition-colors hover:text-[var(--fg)]"
              >
                إزاي تبدأ
              </a>
            </nav>

            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="inline-flex min-h-11 items-center rounded-lg px-3.5 text-sm font-medium text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
              >
                دخول
              </Link>
              <Link
                href="/signup"
                className="zw-lift zw-press inline-flex min-h-11 items-center rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-fg)] shadow-sm transition-opacity hover:opacity-90"
              >
                ابدأ مجانًا
              </Link>
            </div>
          </div>
        </header>

        {/* البطل */}
        <section className="relative">
          <div className="mx-auto max-w-6xl px-4 pt-16 pb-20 sm:px-6 sm:pt-24 sm:pb-28">
            <Enter>
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)]/70 px-3.5 py-1.5 text-xs font-medium text-[var(--fg-muted)] backdrop-blur-sm">
                <span className="zw-ping relative h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
                مصنوعة للسوق المصري
              </p>
            </Enter>

            <Enter as="h1" delay={80}>
              <span className="block max-w-3xl text-balance text-4xl leading-[1.25] font-bold tracking-tight sm:text-5xl md:text-6xl md:leading-[1.2]">
                متجرك الإلكتروني،
                <br />
                <span className="zw-gradient-text">جاهز في دقايق</span>
              </span>
            </Enter>

            <Enter delay={160}>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-[var(--fg-muted)]">
                سيب الإكسل والرسايل الضايعة. طلباتك ومنتجاتك وشحنك ودفعك وعملائك
                — كلهم في لوحة واحدة بتفتح بسرعة وبتشتغل على أي موبايل.
              </p>
            </Enter>

            <Enter delay={240}>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href="/signup"
                  className="zw-lift zw-press group inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-6 py-3.5 text-base font-semibold text-[var(--primary-fg)] shadow-[var(--shadow-soft)] transition-opacity hover:opacity-90"
                >
                  افتح متجرك دلوقتي
                  <ArrowLeft
                    className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1"
                    aria-hidden="true"
                  />
                </Link>
                <p className="text-sm text-[var(--fg-subtle)] sm:ms-2">
                  من غير بطاقة ائتمان · إلغاء في أي وقت
                </p>
              </div>
            </Enter>

            {/* أرقام تتحرك عند الظهور */}
            <Enter delay={320}>
              <dl className="mt-16 grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
                {[
                  { n: 3, s: " دقايق", l: "وتكون فاتح متجرك" },
                  { n: 27, s: "", l: "محافظة بأسعار شحن" },
                  { n: 100, s: "%", l: "دعم الدفع عند الاستلام" },
                  { n: 24, s: "/7", l: "متجرك شغّال" },
                ].map((s) => (
                  <div key={s.l} className="flex flex-col gap-1">
                    <dt className="text-2xl font-bold tracking-tight text-[var(--primary)] sm:text-3xl">
                      <CountUp to={s.n} suffix={s.s} />
                    </dt>
                    <dd className="text-sm text-[var(--fg-muted)]">{s.l}</dd>
                  </div>
                ))}
              </dl>
            </Enter>
          </div>
        </section>

        {/* المميزات */}
        <section id="features" className="scroll-mt-20">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
            <Reveal>
              <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
                كل اللي محتاجه عشان تبيع
              </h2>
              <p className="mt-3 max-w-xl text-[var(--fg-muted)]">
                مش قايمة مميزات طويلة عشان تبان كتير. دي الحاجات اللي بتفرق
                فعلًا في مبيعاتك اليومية.
              </p>
            </Reveal>

            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ icon: Icon, title, body }, i) => (
                <Reveal key={title} delay={(i % 3) * 90}>
                  <SpotlightCard className="flex h-full flex-col gap-2.5 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <h3 className="text-base font-semibold">{title}</h3>
                    <p className="text-sm leading-relaxed text-[var(--fg-muted)]">
                      {body}
                    </p>
                  </SpotlightCard>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* خطوات البدء */}
        <section id="how" className="scroll-mt-20">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
            <Reveal>
              <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
                تلات خطوات وتكون بايع
              </h2>
            </Reveal>

            <ol className="mt-12 grid gap-8 sm:grid-cols-3">
              {steps.map((s, i) => (
                <Reveal as="li" key={s.t} delay={i * 120}>
                  <div className="flex flex-col gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--surface)] text-sm font-bold text-[var(--primary)]">
                      {["١", "٢", "٣"][i]}
                    </span>
                    <h3 className="text-base font-semibold">{s.t}</h3>
                    <p className="text-sm leading-relaxed text-[var(--fg-muted)]">
                      {s.d}
                    </p>
                  </div>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* الدعوة الأخيرة */}
        <section>
          <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6">
            <Reveal>
              <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">
                ابدأ النهارده، وشوف أول طلب بنفسك
              </h2>
              <Link
                href="/signup"
                className="zw-lift zw-press group mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-7 py-3.5 text-base font-semibold text-[var(--primary-fg)] shadow-[var(--shadow-soft)] transition-opacity hover:opacity-90"
              >
                افتح متجرك مجانًا
                <ArrowLeft
                  className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1"
                  aria-hidden="true"
                />
              </Link>
            </Reveal>
          </div>
        </section>

        <footer className="border-t border-[var(--border)]">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-[var(--fg-subtle)] sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex items-center gap-2">
              <Logo size="sm" />
              <span className="text-[var(--fg-subtle)]">— {brand.tagline}</span>
            </div>
            <p className="tabular">
              © {new Date().getFullYear()} {brand.name}
            </p>
          </div>
        </footer>
      </main>
    </>
  );
}
