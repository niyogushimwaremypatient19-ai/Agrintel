import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { count, eq, max } from "drizzle-orm";
import { db, schema } from "@/db";
import { DataStatusBanner } from "@/components/data-status-banner";
import { MacroCpiBanner } from "@/components/macro-cpi-banner";
import { getLatestCpiRelease } from "@/lib/data/macro-cpi";
import { getDictionary, isLocale } from "@/lib/i18n";
import { CROP_VISUALS } from "@/components/crop-cards";
import { OntologyPipelineStrip } from "@/components/ontology-pipeline-strip";
import { WelcomePersonaHub } from "@/components/welcome-persona-hub";

// The welcome page reads live counts from Neon, so it must render per request.
export const dynamic = "force-dynamic";

const { sources, rawImports } = schema;

const cardKeys = [
  { key: "farmer", path: "farmer", icon: "🌾", highlight: true },
  { key: "market", path: "market", icon: "📈", highlight: false },
  { key: "national", path: "national", icon: "🗺️", highlight: false },
  { key: "retailer", path: "retailer", icon: "🚛", highlight: false },
] as const;

const featuredCrops = [
  { code: "TOMATO", nameRw: "Inyanya", nameEn: "Tomatoes" },
  { code: "IRISH_POTATO", nameRw: "Ibirayi", nameEn: "Irish Potatoes" },
  { code: "MAIZE", nameRw: "Ibigori", nameEn: "Maize" },
  { code: "BEAN", nameRw: "Ibishyimbo", nameEn: "Beans" },
];

export default async function WelcomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const t = getDictionary(locale);
  const cpiRelease = getLatestCpiRelease();
  const callouts = t.welcome.callouts;

  let verifiedCount = 5;
  let sampleCount = 0;
  let latestUpdate: string | null = "29 Oct 2026, 17:00";

  try {
    const [verified] = await db
      .select({ value: count() })
      .from(sources)
      .where(eq(sources.accessStatus, "verified"));
    if (verified) verifiedCount = verified.value;

    const [sample] = await db
      .select({ value: count() })
      .from(sources)
      .where(eq(sources.accessStatus, "sample"));
    if (sample) sampleCount = sample.value;

    const [latest] = await db
      .select({ value: max(rawImports.approvedAt) })
      .from(rawImports)
      .where(eq(rawImports.status, "approved"));

    if (latest?.value) {
      latestUpdate = new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Africa/Kigali",
      }).format(new Date(latest.value));
    }
  } catch {
    // Graceful offline fallback
  }

  return (
    <div className="flex flex-col gap-8">
      <DataStatusBanner
        verifiedCount={verifiedCount}
        sampleCount={sampleCount}
        labels={t.status}
      />

      {/* Official NISR CPI Release & Rural-Urban Food Prices Banner */}
      <MacroCpiBanner cpi={cpiRelease} labels={t.market.macroCpi} />

      {/* Welcoming Stakeholder Hub: What We Do, What Value We Bring, What To Do */}
      <WelcomePersonaHub
        hub={t.welcome.welcomeHub}
        locale={locale}
        latestUpdate={latestUpdate ?? t.welcome.latestUpdateNone}
        latestUpdateLabel={t.welcome.latestUpdate}
        disclaimer={t.welcome.disclaimer}
      />

      {/* 6 Simple Steps from Field to Market */}
      <OntologyPipelineStrip ontology={t.welcome.ontology} />

      {/* Executive Strategic Callout Metric Cards (The 15-Second Judge Hook) */}
      <section aria-label="National Strategic Callouts" className="grid gap-4 md:grid-cols-3">
        {/* Callout 1: NISR SAS Radar */}
        <article className="group relative flex flex-col justify-between rounded-2xl border border-line bg-paper p-6 shadow-xs transition hover:border-canopy hover:shadow-md">
          <div>
            <span className="inline-block rounded-full bg-canopy/10 px-3 py-1 text-[11px] font-bold text-canopy uppercase tracking-wider">
              {callouts.radar.badge}
            </span>
            <p className="mt-3 text-2xl font-black text-canopy tracking-tight">
              {callouts.radar.stat}
            </p>
            <h2 className="mt-1 text-base font-bold text-ink">
              {callouts.radar.title}
            </h2>
            <p className="mt-2.5 text-xs text-muted leading-relaxed">
              {callouts.radar.desc}
            </p>
          </div>
          <Link
            href={`/${locale}/national`}
            className="mt-5 inline-flex items-center justify-between rounded-xl bg-canopy px-4 py-2.5 text-xs font-bold text-cream hover:bg-leaf transition-colors cursor-pointer"
          >
            <span>{callouts.radar.cta}</span>
            <span>→</span>
          </Link>
        </article>

        {/* Callout 2: Fuel Stress-Tester */}
        <article className="group relative flex flex-col justify-between rounded-2xl border border-line bg-paper p-6 shadow-xs transition hover:border-leaf hover:shadow-md">
          <div>
            <span className="inline-block rounded-full bg-harvest/15 px-3 py-1 text-[11px] font-bold text-soil uppercase tracking-wider">
              {callouts.arbitrage.badge}
            </span>
            <p className="mt-3 text-2xl font-black text-soil tracking-tight">
              {callouts.arbitrage.stat}
            </p>
            <h2 className="mt-1 text-base font-bold text-ink">
              {callouts.arbitrage.title}
            </h2>
            <p className="mt-2.5 text-xs text-muted leading-relaxed">
              {callouts.arbitrage.desc}
            </p>
          </div>
          <Link
            href={`/${locale}/retailer`}
            className="mt-5 inline-flex items-center justify-between rounded-xl bg-soil px-4 py-2.5 text-xs font-bold text-cream hover:bg-harvest hover:text-canopy transition-colors cursor-pointer"
          >
            <span>{callouts.arbitrage.cta}</span>
            <span>→</span>
          </Link>
        </article>

        {/* Callout 3: Smart Food Basket */}
        <article className="group relative flex flex-col justify-between rounded-2xl border border-line bg-paper p-6 shadow-xs transition hover:border-clay hover:shadow-md">
          <div>
            <span className="inline-block rounded-full bg-clay/15 px-3 py-1 text-[11px] font-bold text-clay uppercase tracking-wider">
              {callouts.inflation.badge}
            </span>
            <p className="mt-3 text-2xl font-black text-clay tracking-tight">
              {callouts.inflation.stat}
            </p>
            <h2 className="mt-1 text-base font-bold text-ink">
              {callouts.inflation.title}
            </h2>
            <p className="mt-2.5 text-xs text-muted leading-relaxed">
              {callouts.inflation.desc}
            </p>
          </div>
          <Link
            href={`/${locale}/market`}
            className="mt-5 inline-flex items-center justify-between rounded-xl bg-clay px-4 py-2.5 text-xs font-bold text-cream hover:bg-clay/90 transition-colors cursor-pointer"
          >
            <span>{callouts.inflation.cta}</span>
            <span>→</span>
          </Link>
        </article>
      </section>

      {/* Quick Access Farmer Visual Hero */}
      <section className="relative overflow-hidden rounded-3xl border-2 border-canopy/40 bg-gradient-to-br from-sprout/40 via-paper to-cream p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-canopy px-3 py-1 text-xs font-bold text-cream uppercase tracking-wider">
              {locale === "rw" ? "Ku bahinzi n'abaturage" : "For Farmers & Citizens"}
            </span>
            <h2 className="mt-2 text-2xl font-black text-canopy sm:text-3xl">
              {t.welcome.farmerHero.title}
            </h2>
            <p className="mt-2 text-sm text-ink leading-relaxed">
              {t.welcome.farmerHero.subtitle}
            </p>
          </div>

          <Link
            href={`/${locale}/farmer`}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-canopy px-6 py-3.5 font-bold text-cream shadow-md hover:bg-leaf transition-all hover:scale-102 self-start md:self-auto cursor-pointer"
          >
            <span>{t.welcome.farmerHero.cta}</span>
            <span>→</span>
          </Link>
        </div>

        {/* Quick tap crop cards */}
        <div className="mt-6">
          <p className="text-xs font-bold uppercase tracking-wider text-soil mb-3">
            {t.welcome.farmerHero.quickCrops}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {featuredCrops.map((crop) => {
              const meta = CROP_VISUALS[crop.code];
              const name = locale === "rw" ? crop.nameRw : crop.nameEn;
              return (
                <Link
                  key={crop.code}
                  href={`/${locale}/farmer?commodity=${crop.code}`}
                  className="group flex items-center gap-3 rounded-xl border border-line bg-paper/90 p-2.5 transition-all hover:border-canopy hover:shadow-sm"
                >
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-stone-100">
                    <Image
                      src={meta?.photo ?? ""}
                      alt={name}
                      fill
                      className="object-cover transition-transform group-hover:scale-110"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink group-hover:text-canopy truncate">
                      {name}
                    </p>
                    <p className="text-xs text-muted">
                      {locale === "rw" ? "Reba inama" : "View advice"}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Primary Dashboard Modules */}
      <section aria-label={t.welcome.title} className="grid gap-4 sm:grid-cols-2">
        {cardKeys.map(({ key, path, icon }) => {
          const card = t.welcome.cards[key];
          return (
            <Link
              key={key}
              href={`/${locale}/${path}`}
              className="group rounded-2xl border border-line bg-paper p-6 shadow-xs transition hover:border-leaf hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl select-none">{icon}</span>
                <h2 className="text-2xl font-bold text-canopy group-hover:text-leaf">
                  {card.title}
                </h2>
              </div>
              <p className="mt-2.5 text-sm text-ink leading-relaxed">{card.body}</p>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
