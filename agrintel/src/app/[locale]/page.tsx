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
    </div>
  );
}
