import Link from "next/link";
import { notFound } from "next/navigation";
import { DataStatusBanner } from "@/components/data-status-banner";
import { RiskBadge } from "@/components/risk-badge";
import { CorridorArbitrageTable } from "@/components/corridor-arbitrage-table";
import { ActionSummaryDeck, type ActionCardItem } from "@/components/action-summary-deck";
import { getDictionary, isLocale } from "@/lib/i18n";
import { getCropOptions, getCurrentNationalPriceForecasts, getSourceCounts } from "@/lib/data/prices";
import { getAllDistricts, getCurrentRiskSignals, parseDriver, type RiskCategory } from "@/lib/data/risk";
import { getCorridorsForCrop, SPATIAL_ARBITRAGE_CORRIDORS, simulateCustomFuelPrice, FUEL_PRICES } from "@/lib/data/spatial-arbitrage";

export const dynamic = "force-dynamic";

const priceFormat = (value: number) => new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(value);

const monthYear = (value: Date | string) =>
  new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value));

export default async function RetailerSupplyPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ commodity?: string; tab?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const t = getDictionary(locale);
  const query = await searchParams;

  const [crops, districts, counts] = await Promise.all([getCropOptions(), getAllDistricts(), getSourceCounts()]);
  const crop = crops.find((c) => c.code === query.commodity) ?? crops[0];
  if (!crop) notFound();

  const [signals, forecasts] = await Promise.all([
    getCurrentRiskSignals(crop.code),
    getCurrentNationalPriceForecasts(crop.code),
  ]);
  const signalByDistrict = new Map(signals.map((s) => [s.districtCode, s]));

  const cropName = (c: { nameEn: string; nameRw: string }) => (locale === "rw" ? c.nameRw : c.nameEn);
  const districtName = (d: { nameEn: string; nameRw: string }) => (locale === "rw" ? d.nameRw : d.nameEn);

  // Filter corridors for selected crop or default to all
  const cropCorridors = getCorridorsForCrop(crop.code);
  const activeCorridors = cropCorridors.length > 0 ? cropCorridors : SPATIAL_ARBITRAGE_CORRIDORS.slice(0, 30);

  // Baseline district retail price table
  const rows = districts.map((d) => {
    const signal = signalByDistrict.get(d.code);
    const category: RiskCategory = (signal?.category as RiskCategory) ?? "unavailable";
    const driver = parseDriver(signal?.driverSummary ?? null);
    return { district: d, category, driver };
  });

  const comparable = rows.filter((r) => r.driver !== null).length;
  const firstForecast = forecasts[0];
  const lastForecast = forecasts[forecasts.length - 1];

  const activeTab = query.tab ?? "arbitrage";

  // Top 3 Action Decisions for Retailer Deck
  const analyzedCorridors = activeCorridors.map((c) => ({
    corridor: c,
    simRegulated: simulateCustomFuelPrice(c, FUEL_PRICES.regulated, 5000),
    simUnsubsidized: simulateCustomFuelPrice(c, FUEL_PRICES.unsubsidized, 5000),
  }));

  const sortedByMargin = [...analyzedCorridors].sort(
    (a, b) => b.simRegulated.netMargin - a.simRegulated.netMargin
  );

  const topCorridorItem = sortedByMargin[0] ?? analyzedCorridors[0];
  const lowCorridorItem = sortedByMargin[sortedByMargin.length - 1] ?? analyzedCorridors[0];

  // Vulnerable corridor: profitable at regulated (>20), but compressed or negative at unsubsidized
  const vulnerableCorridorItem =
    analyzedCorridors.find(
      (c) =>
        c.simRegulated.netMargin >= 20 &&
        (c.simUnsubsidized.netMargin < 15 || c.corridor.breakeven_diesel_price < 4000)
    ) ?? sortedByMargin[Math.floor(sortedByMargin.length / 2)] ?? analyzedCorridors[0];

  const retailerDecisionCards: ActionCardItem[] = [
    {
      id: "action-top-arbitrage",
      badge: t.retailer.decisions?.topSpreadBadge ?? "High Profit Route",
      badgeType: "success",
      title: `${topCorridorItem.corridor.origin_district_code} → ${topCorridorItem.corridor.destination_code} (${cropName(crop)})`,
      metric: `+${Math.round(topCorridorItem.simRegulated.netMargin)} Rwf/kg`,
      metricLabel: "Estimated Profit / kg",
      context: t.retailer.decisions?.topSpreadContext ?? "Profit after paying for truck fuel and spoilage is over 40 Rwf/kg. Good route to transport surplus crops to city markets.",
      ctaText: t.retailer.decisions?.shipCta ?? "Transport Crop Now →",
      ctaHref: `/${locale}/alerts?origin=${topCorridorItem.corridor.origin_district_code}&dest=${topCorridorItem.corridor.destination_code}&commodity=${crop.code}&crop=${crop.code}&margin=${Math.round(topCorridorItem.simRegulated.netMargin)}&intent=ship`,
    },
    {
      id: "action-fuel-lifeline",
      badge: t.retailer.decisions?.vulnerableFuelBadge ?? "Caution: High Fuel Cost",
      badgeType: "warning",
      title: `${vulnerableCorridorItem.corridor.origin_district_code} → ${vulnerableCorridorItem.corridor.destination_code} (${cropName(crop)})`,
      metric: `Breakeven ${priceFormat(vulnerableCorridorItem.corridor.breakeven_diesel_price)} Rwf`,
      metricLabel: "Highest Fuel Price Before Loss",
      context: t.retailer.decisions?.vulnerableFuelContext ?? "Long distance with tight profit margins. If fuel costs rise, this route may make a loss.",
      ctaText: t.retailer.decisions?.stressCta ?? "Test Fuel Costs →",
      ctaHref: `/${locale}/retailer?commodity=${crop.code}&tab=arbitrage`,
    },
    {
      id: "action-local-storage",
      badge: t.retailer.decisions?.localAbsorptionBadge ?? "Better to Sell Locally",
      badgeType: "danger",
      title: `${lowCorridorItem.corridor.origin_district_code} → ${lowCorridorItem.corridor.destination_code} (${cropName(crop)})`,
      metric: `${lowCorridorItem.simRegulated.netMargin > 0 ? "+" : ""}${lowCorridorItem.simRegulated.netMargin.toFixed(1)} Rwf/kg`,
      metricLabel: lowCorridorItem.simRegulated.netMargin > 0 ? "Slim Margin" : "Transport Loss",
      context: t.retailer.decisions?.localAbsorptionContext ?? "Transport costs to the city are too high right now. It is more profitable to sell locally or keep in cooperative storage.",
      ctaText: t.retailer.decisions?.storageCta ?? "Store Harvest Locally →",
      ctaHref: `/${locale}/alerts?origin=${lowCorridorItem.corridor.origin_district_code}&dest=${lowCorridorItem.corridor.destination_code}&commodity=${crop.code}&crop=${crop.code}&margin=${Math.round(lowCorridorItem.simRegulated.netMargin)}&intent=hold`,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <section className="max-w-3xl">
        <h1 className="text-4xl font-semibold md:text-5xl">{t.retailer.title}</h1>
        <p className="mt-4 text-lg text-ink">{t.retailer.intro}</p>
        <p className="mt-2 text-sm text-muted">{t.retailer.readOnly}</p>
      </section>

      {/* Decisions Required Today Action Header Deck */}
      <ActionSummaryDeck
        sectionTitle={t.retailer.decisions?.title ?? "Decisions Required Today"}
        sectionSubtitle={t.retailer.decisions?.subtitle ?? "Real-time dispatch optimization for cooperative logistics trucks and rural collection centers:"}
        cards={retailerDecisionCards}
      />

      {/* Commodity Selector Bar */}
      <nav aria-label={t.retailer.selectCommodity} className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-canopy">{t.retailer.selectCommodity}</span>
        <div className="flex flex-wrap gap-2">
          {crops.map((c) => {
            const active = c.code === crop.code;
            return (
              <Link
                key={c.code}
                href={`/${locale}/retailer?commodity=${c.code}&tab=${activeTab}`}
                aria-current={active ? "page" : undefined}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  active ? "bg-canopy text-cream shadow" : "border border-line bg-paper text-canopy hover:border-leaf"
                }`}
              >
                {cropName(c)}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* View Mode Tabs */}
      <div className="flex border-b border-line gap-4 text-sm font-semibold">
        <Link
          href={`/${locale}/retailer?commodity=${crop.code}&tab=arbitrage`}
          className={`pb-3 transition-colors ${
            activeTab === "arbitrage"
              ? "border-b-2 border-canopy text-canopy font-bold"
              : "text-muted hover:text-ink"
          }`}
        >
          {t.retailer.arbitrage.tabCorridors} ({activeCorridors.length})
        </Link>
        <Link
          href={`/${locale}/retailer?commodity=${crop.code}&tab=simple`}
          className={`pb-3 transition-colors ${
            activeTab === "simple"
              ? "border-b-2 border-canopy text-canopy font-bold"
              : "text-muted hover:text-ink"
          }`}
        >
          {t.retailer.arbitrage.tabSimple}
        </Link>
      </div>

      {activeTab === "arbitrage" ? (
        /* Primary View: Spatial Arbitrage Corridors & Diesel Stress Tester */
        <CorridorArbitrageTable
          initialCorridors={activeCorridors}
          commodityCode={crop.code}
          locale={locale}
          labels={t.retailer.arbitrage}
        />
      ) : (
        /* Secondary View: Baseline District Comparison Table */
        <div className="flex flex-col gap-8">
          <section aria-labelledby="outlook-title" className="rounded-2xl border border-line bg-paper p-6 shadow-sm">
            <h2 id="outlook-title" className="text-2xl font-semibold">{t.retailer.outlook.title}</h2>
            <p className="mt-2 text-sm text-muted">{t.retailer.outlook.note}</p>
            {firstForecast && lastForecast ? (
              <p className="mt-3 text-ink">
                {monthYear(firstForecast.horizonStart)} – {monthYear(lastForecast.horizonStart)}:{" "}
                <span className="font-semibold">{priceFormat(firstForecast.pointValue ?? 0)}</span> →{" "}
                <span className="font-semibold">{priceFormat(lastForecast.pointValue ?? 0)}</span> {t.market.unitLabel}
              </p>
            ) : (
              <p className="mt-3 text-ink">{t.retailer.outlook.none}</p>
            )}
          </section>

          <section aria-labelledby="table-title" className="flex flex-col gap-3">
            <h2 id="table-title" className="text-2xl font-semibold">{t.retailer.tableTitle}</h2>
            <p className="text-sm text-muted">
              {t.retailer.comparable.replace("{count}", String(comparable)).replace("{total}", String(districts.length))}
            </p>

            <div className="overflow-x-auto rounded-2xl border border-line bg-paper shadow-sm">
              <table className="w-full min-w-[46rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-line bg-cream/20 text-muted font-semibold">
                    <th scope="col" className="px-4 py-3">{t.retailer.columns.district}</th>
                    <th scope="col" className="px-4 py-3">{t.retailer.columns.price}</th>
                    <th scope="col" className="px-4 py-3">{t.retailer.columns.priceSignal}</th>
                    <th scope="col" className="px-4 py-3">{t.retailer.columns.supply}</th>
                    <th scope="col" className="px-4 py-3">{t.retailer.columns.sourcing}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line/60">
                  {rows.map(({ district, category, driver }) => (
                    <tr key={district.code} className="hover:bg-cream/30 transition-colors">
                      <th scope="row" className="px-4 py-3 font-semibold text-canopy">
                        {districtName(district)}
                        <span className="block text-xs font-normal text-muted">{district.province}</span>
                      </th>
                      <td className="px-4 py-3 text-ink">
                        {driver ? `${priceFormat(driver.recentAverage)} ${t.market.unitLabel}` : t.status.unavailableLabel}
                      </td>
                      <td className="px-4 py-3">
                        <RiskBadge category={category} label={t.national.categories[category]} />
                      </td>
                      <td className="px-4 py-3 text-muted">{t.retailer.supplyUnavailable}</td>
                      <td className="px-4 py-3 text-muted">{t.retailer.sourcingUnavailable}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-2xl border border-line bg-paper p-5 text-sm text-ink shadow-sm">
              <h3 className="font-semibold text-canopy">{t.retailer.howToRead.title}</h3>
              <p className="mt-2 text-muted leading-relaxed">{t.retailer.howToRead.body}</p>
            </div>
          </section>
        </div>
      )}

      {/* Data provenance status footer */}
      <DataStatusBanner verifiedCount={counts.verified} sampleCount={counts.sample} labels={t.status} />
    </div>
  );
}
