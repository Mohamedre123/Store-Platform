import Link from "next/link";
import { and, count, eq, gte, sum } from "drizzle-orm";
import {
  ArrowLeft,
  Check,
  CreditCard,
  Package,
  Palette,
  ShoppingBag,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import { db } from "@/db";
import {
  orders,
  products,
  customers,
  paymentMethods,
  shippingZones,
} from "@/db/schema";
import { getDashboardContext } from "@/lib/store-context";
import { publicStoreUrl } from "@/lib/domain";
import { formatMoney } from "@/lib/utils";
import { Card } from "@/components/ui";
import { Rail } from "@/components/rail";
import { Reveal, SpotlightCard } from "@/components/motion";
import { PublishBanner } from "./publish-banner";

export const metadata = { title: "لوحة التحكم" };

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export default async function DashboardHome() {
  const { store } = await getDashboardContext();
  const today = startOfToday();

  // كل الأرقام في دفعة واحدة متوازية بدل ٧ رحلات متتالية للخادم — ده اللي
  // كان بيخلي الصفحة الرئيسية تقيلة على مابتفتح.
  const [
    [todayStats],
    [pending],
    [incomplete],
    [productCount],
    [customerCount],
    [hasPayment],
    [hasShipping],
  ] = await Promise.all([
    db
      .select({ orders: count(), revenue: sum(orders.total) })
      .from(orders)
      .where(
        and(
          eq(orders.storeId, store.id),
          eq(orders.isIncomplete, false),
          gte(orders.createdAt, today),
        ),
      ),
    db
      .select({ n: count() })
      .from(orders)
      .where(and(eq(orders.storeId, store.id), eq(orders.status, "pending"))),
    db
      .select({ n: count() })
      .from(orders)
      .where(and(eq(orders.storeId, store.id), eq(orders.isIncomplete, true))),
    db
      .select({ n: count() })
      .from(products)
      .where(and(eq(products.storeId, store.id), eq(products.status, "active"))),
    db
      .select({ n: count() })
      .from(customers)
      .where(eq(customers.storeId, store.id)),
    db
      .select({ n: count() })
      .from(paymentMethods)
      .where(and(eq(paymentMethods.storeId, store.id), eq(paymentMethods.enabled, true))),
    db
      .select({ n: count() })
      .from(shippingZones)
      .where(and(eq(shippingZones.storeId, store.id), eq(shippingZones.enabled, true))),
  ]);

  const stats = [
    {
      label: "إيرادات اليوم",
      value: formatMoney(Number(todayStats?.revenue ?? 0), store.currency),
      icon: Wallet,
    },
    {
      label: "طلبات اليوم",
      value: String(todayStats?.orders ?? 0),
      icon: ShoppingBag,
    },
    {
      label: "طلبات مستنية",
      value: String(pending?.n ?? 0),
      icon: Package,
      href: "/dashboard/orders",
    },
    {
      label: "سلات متروكة",
      value: String(incomplete?.n ?? 0),
      icon: Users,
      href: "/dashboard/orders?filter=incomplete",
      highlight: (incomplete?.n ?? 0) > 0,
    },
  ];

  // خطوات التجهيز — تظهر لحد ما المتجر يبقى جاهز للبيع
  const setup = [
    {
      done: (productCount?.n ?? 0) > 0,
      label: "ضيف أول منتج",
      href: "/dashboard/products",
      icon: Package,
    },
    {
      done: (hasShipping?.n ?? 0) > 0,
      label: "ظبّط الشحن",
      href: "/dashboard/shipping",
      icon: Truck,
    },
    {
      done: (hasPayment?.n ?? 0) > 0,
      label: "فعّل طريقة دفع",
      href: "/dashboard/payments",
      icon: CreditCard,
    },
    {
      done: !!store.logoLight,
      label: "ارفع شعار متجرك",
      href: "/dashboard/storefront",
      icon: Palette,
    },
    {
      done: store.isPublished,
      label: "انشر المتجر",
      href: "/dashboard/settings",
      icon: ShoppingBag,
    },
  ];

  const remaining = setup.filter((s) => !s.done);

  return (
    <div className="flex flex-col gap-8">
      <Reveal>
        <PublishBanner initialPublished={store.isPublished} storeUrl={publicStoreUrl(store)} />
      </Reveal>

      <Reveal>
        <h1 className="text-2xl font-bold tracking-tight">
          أهلًا، {store.name}
        </h1>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">
          {remaining.length > 0
            ? `فاضل ${remaining.length} خطوة عشان متجرك يبقى جاهز للبيع.`
            : "متجرك جاهز. بالتوفيق في مبيعاتك."}
        </p>
      </Reveal>

      {/* الأرقام */}
      <Rail desktop="sm:grid sm:grid-cols-2 lg:grid-cols-4" itemWidth="basis-[46%]">
        {stats.map(({ label, value, icon: Icon, href, highlight }, i) => {
          const body = (
            <SpotlightCard className="flex h-full flex-col gap-2 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-[var(--fg-muted)]">{label}</span>
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    highlight
                      ? "text-[var(--color-warning)]"
                      : "text-[var(--fg-subtle)]"
                  }`}
                  aria-hidden="true"
                />
              </div>
              <span className="tabular text-xl font-bold tracking-tight sm:text-2xl">
                {value}
              </span>
            </SpotlightCard>
          );
          return (
            <Reveal key={label} delay={i * 70} className="h-full">
              {href ? (
                <Link href={href} className="block h-full">
                  {body}
                </Link>
              ) : (
                body
              )}
            </Reveal>
          );
        })}
      </Rail>

      {/* خطوات التجهيز */}
      {remaining.length > 0 && (
        <Reveal delay={120}>
          <div className="flex flex-col gap-3">
            <h2 className="font-semibold">جهّز متجرك</h2>

            {/*
              الخطوات جنب بعض على الموبايل بتمرير بالإصبع.
              فوق بعض كانت بتاخد نص الشاشة وتزقّ باقي اللوحة تحت،
              والتاجر اللي خلّص خطوتين بيفضل يمرّر عليهم كل مرة.
            */}
            <Rail
              as="ul"
              desktop="sm:grid sm:grid-cols-2 lg:grid-cols-4"
              itemWidth="basis-[70%]"
            >
              {setup.map(({ done, label, href, icon: Icon }) => (
                <li key={label} className="h-full">
                  <Link
                    href={href}
                    className="flex h-full items-center gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:bg-[var(--surface-2)]"
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                        done
                          ? "bg-[var(--color-success-soft)] text-[var(--color-success)]"
                          : "bg-[var(--surface-2)] text-[var(--fg-subtle)]"
                      }`}
                    >
                      {done ? (
                        <Check className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      )}
                    </span>
                    <span
                      className={`min-w-0 flex-1 text-sm ${
                        done
                          ? "text-[var(--fg-subtle)] line-through"
                          : "font-medium"
                      }`}
                    >
                      {label}
                    </span>
                    {!done && (
                      <ArrowLeft
                        className="h-4 w-4 shrink-0 text-[var(--fg-subtle)]"
                        aria-hidden="true"
                      />
                    )}
                  </Link>
                </li>
              ))}
            </Rail>
          </div>
        </Reveal>
      )}

      <Reveal delay={180}>
        <p className="text-sm text-[var(--fg-subtle)]">
          عندك {productCount?.n ?? 0} منتج نشط و{customerCount?.n ?? 0} عميل
          مسجّل.
        </p>
      </Reveal>
    </div>
  );
}
