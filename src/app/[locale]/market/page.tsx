import Link from "next/link";
import { notFound } from "next/navigation";
import { DataStatusBanner } from "@/components/data-status-banner";
import { MacroCpiBanner } from "@/components/macro-cpi-banner";
import { PriceChart, type ChartPoint } from "@/components/price-chart";
import { SmartFoodBasket } from "@/components/smart-basket";
import { getDictionary, isLocale, type Locale } from "@/lib/i18n";
import { getLatestCpiRelease } from "@/lib/data/macro-cpi";
import { calculateTrend, monthlyAverages } from "@/lib/trend";
import {
  getApprovedPriceObservations,
  getCropOptions,
  getCurrentNationalPriceForecasts,
  getLatestCommodityPrices,
  getSourceCounts,
} from "@/lib/data/prices";

// Reads approved data from Neon on each request, so it must render per request.
export const dynamic = "force-dynamic";

const dateFormatter = (locale: Locale) =>
  new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });

function monthLabel(period: string, locale: Locale) {
  // "YYYY-MM" -> a readable month. Kinyarwanda month names are not in Intl yet,
  // so the draft uses English month abbreviations until a translator supplies them.
  return dateFormatter(locale).format(new Date(`${period}-01T00:00:00Z`));
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(value);
}

function formatChange(changePct: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "percent",
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  }).format(changePct);
}

export default async function MarketPricesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ commodity?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const t = getDictionary(locale);
  const { commodity: requestedCommodity } = await searchParams;

  const crops = await getCropOptions();
  const selected = crops.find((c) => c.code === requestedCommodity) ?? crops[0];

  const [counts, observed, forecastRows, commodityPrices] = await Promise.all([
    getSourceCounts(),
    selected ? getApprovedPriceObservations(selected.code) : Promise.resolve([]),
    selected ? getCurrentNationalPriceForecasts(selected.code) : Promise.resolve([]),
    getLatestCommodityPrices(),
  ]);

  const cropName = (crop: { nameEn: string; nameRw: string }) =>
    locale === "rw" ? crop.nameRw : crop.nameEn;

  // ----- Observed history -----
  const monthly = monthlyAverages(
    observed.map((row) => ({ periodStart: row.periodStart, value: row.value })),
  );
  const trend = calculateTrend(monthly);
  const latest = monthly.at(-1) ?? null;

  const observedHasSample = observed.some((row) => row.dataStatus === "sample");
  const sourceNames = [...new Set(observed.map((row) => row.sourceName))];
  const lastApproved = observed.reduce<Date | null>((latestDate, row) => {
    if (!row.approvedAt) return latestDate;
    const date = new Date(row.approvedAt);
    return !latestDate || date > latestDate ? date : latestDate;
  }, null);

  // ----- Forecast (only validated, current, national-level rows) -----
  const forecastPoints = forecastRows
    .filter((f) => f.pointValue !== null)
    .map((f) => ({
      period: f.horizonStart.slice(0, 7),
      value: f.pointValue as number,
      low: f.lowerBound,
      high: f.upperBound,
      basedOnSample: f.basedOnSample,
      confidenceNote: f.confidenceNote,
      horizonStart: f.horizonStart,
      horizonEnd: f.horizonEnd,
      outputStatus: f.outputStatus,
    }));
  const hasForecast = forecastPoints.length > 0;
  const forecastHasSample = forecastPoints.some((f) => f.basedOnSample);
  const anySample = observedHasSample || forecastHasSample;

  // ----- Chart data: observed and forecast kept as separate series -----
  const byPeriod = new Map<string, ChartPoint>();

  for (const point of monthly) {
    byPeriod.set(point.period, {
      period: point.period,
      label: monthLabel(point.period, locale),
      observed: point.average,
      forecast: null,
      low: null,
      high: null,
    });
  }

  for (const f of forecastPoints) {
    const existing = byPeriod.get(f.period) ?? {
      period: f.period,
      label: monthLabel(f.period, locale),
      observed: null,
      forecast: null,
      low: null,
      high: null,
    };
    existing.forecast = f.value;
    existing.low = f.low;
    existing.high = f.high;
    byPeriod.set(f.period, existing);
  }

  const chartData = [...byPeriod.values()].sort((a, b) => a.period.localeCompare(b.period));
  const firstForecastLabel = forecastPoints.length
    ? monthLabel(forecastPoints[0].period, locale)
    : null;

  const statusLabel = anySample ? t.market.statusLabels.sample : t.market.statusLabels.observed;

  return (
    <div className="flex flex-col gap-8">
      <DataStatusBanner
        verifiedCount={counts.verified}
        sampleCount={counts.sample}
        labels={t.status}
      />

      {anySample ? (
        <p role="note" className="rounded-lg border-l-4 border-clay bg-paper px-4 py-3 text-sm text-ink">
          {t.market.sampleNotice}
        </p>
      ) : null}

      <section className="max-w-3xl">
        <h1 className="text-4xl font-semibold md:text-5xl">{t.market.title}</h1>
        <p className="mt-4 text-lg text-ink">{t.market.intro}</p>
      </section>

      {/* Official NISR CPI Release & Rural-Urban Divergence Banner */}
      <MacroCpiBanner cpi={getLatestCpiRelease()} labels={t.market.macroCpi} />

      {/* Crop selector: plain links, so it works without JavaScript */}
      <nav aria-label={t.market.selectCommodity} className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-canopy">{t.market.selectCommodity}</span>
        <div className="flex flex-wrap gap-2">
          {crops.map((crop) => {
            const active = crop.code === selected?.code;
            return (
              <Link
                key={crop.code}
                href={`/${locale}/market?commodity=${crop.code}`}
                aria-current={active ? "page" : undefined}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  active
                    ? "bg-canopy text-cream"
                    : "border border-line bg-paper text-canopy hover:border-leaf"
                }`}
              >
                {cropName(crop)}
              </Link>
            );
          })}
        </div>
      </nav>

      {!selected ? (
        <p className="text-ink">{t.market.noData}</p>
      ) : monthly.length === 0 ? (
        <p className="rounded-lg border border-line bg-paper p-6 text-ink">{t.market.noData}</p>
      ) : (
        <>
          {/* Summary cards */}
          <section aria-label={cropName(selected)} className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-line bg-paper p-5">
              <p className="text-sm text-muted">{t.market.latestPrice}</p>
              <p className="mt-1 text-3xl font-semibold text-canopy">
                {latest ? formatPrice(latest.average) : "—"}{" "}
                <span className="text-base font-normal text-muted">{t.market.unitLabel}</span>
              </p>
              <p className="mt-1 text-sm text-muted">
                {latest ? monthLabel(latest.period, locale) : ""}
              </p>
            </div>

            <div className="rounded-xl border border-line bg-paper p-5">
              <p className="text-sm text-muted">{t.market.trendTitle}</p>
              <p className="mt-1 text-2xl font-semibold text-canopy">
                {t.market.trend[trend.status]}
              </p>
              {trend.changePct !== null ? (
                <p className="mt-1 text-sm text-ink">
                  {t.market.changeLabel}: {formatChange(trend.changePct)}
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted">{t.market.insufficient}</p>
              )}
              <p className="mt-2 text-xs text-muted">{t.market.trendHelp}</p>
            </div>

            <div className="rounded-xl border border-line bg-paper p-5">
              <p className="text-sm text-muted">{t.market.dataStatus}</p>
              <p className="mt-1 text-2xl font-semibold text-canopy">{statusLabel}</p>
              <p className="mt-2 text-sm text-ink">
                <span className="font-semibold">{t.market.source}:</span>{" "}
                {sourceNames.join(", ")}
              </p>
              <p className="mt-1 text-sm text-ink">
                <span className="font-semibold">{t.market.lastUpdated}:</span>{" "}
                {lastApproved
                  ? new Intl.DateTimeFormat("en-GB", {
                      dateStyle: "medium",
                      timeZone: "Africa/Kigali",
                    }).format(lastApproved)
                  : "—"}
              </p>
            </div>
          </section>

          {/* Chart with a table alternative */}
          <section aria-labelledby="price-chart-title" className="flex flex-col gap-4">
            <h2 id="price-chart-title" className="text-2xl font-semibold">
              {t.market.chartTitle}
            </h2>
            <div className="rounded-xl border border-line bg-paper p-4">
              <PriceChart
                data={chartData}
                firstForecastLabel={firstForecastLabel}
                labels={{
                  observed: t.market.legend.observed,
                  forecast: t.market.legend.forecast,
                  range: t.market.legend.range,
                  forecastStart: t.market.legend.forecastStart,
                }}
                unitLabel={t.market.unitLabel}
                ariaLabel={`${t.market.chartAria}: ${cropName(selected)}`}
                caption={t.market.chartCaption}
              />
            </div>

            <details className="rounded-xl border border-line bg-paper p-4">
              <summary className="cursor-pointer font-semibold text-canopy">
                {t.market.tableCaption}
              </summary>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[32rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-line text-muted">
                      <th scope="col" className="py-2 pr-4 font-semibold">{t.market.columns.month}</th>
                      <th scope="col" className="py-2 pr-4 font-semibold">{t.market.columns.observed}</th>
                      <th scope="col" className="py-2 pr-4 font-semibold">{t.market.columns.forecast}</th>
                      <th scope="col" className="py-2 pr-4 font-semibold">{t.market.columns.range}</th>
                      <th scope="col" className="py-2 font-semibold">{t.market.columns.status}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chartData.map((row) => {
                      const rowStatus =
                        row.observed !== null
                          ? observedHasSample
                            ? t.market.statusLabels.sample
                            : t.market.statusLabels.observed
                          : forecastHasSample
                            ? t.market.statusLabels.sample
                            : t.market.statusLabels.forecast;
                      return (
                        <tr key={row.period} className="border-b border-line/60">
                          <th scope="row" className="py-2 pr-4 font-normal text-ink">{row.label}</th>
                          <td className="py-2 pr-4">{row.observed !== null ? formatPrice(row.observed) : "—"}</td>
                          <td className="py-2 pr-4">{row.forecast !== null ? formatPrice(row.forecast) : "—"}</td>
                          <td className="py-2 pr-4">
                            {row.low !== null && row.high !== null
                              ? `${formatPrice(row.low)} – ${formatPrice(row.high)}`
                              : "—"}
                          </td>
                          <td className="py-2">{rowStatus}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </details>
          </section>

          {/* Outlook */}
          <section aria-labelledby="outlook-title" className="rounded-xl border border-line bg-paper p-6">
            <h2 id="outlook-title" className="text-2xl font-semibold">{t.market.forecastTitle}</h2>
            {hasForecast ? (
              <div className="mt-3 flex flex-col gap-2 text-ink">
                <p>
                  <span className="font-semibold">{t.market.horizon}:</span>{" "}
                  {monthLabel(forecastPoints[0].period, locale)} –{" "}
                  {monthLabel(forecastPoints[forecastPoints.length - 1].period, locale)}
                </p>
                {forecastPoints[0].confidenceNote ? (
                  <p className="text-sm text-muted">{forecastPoints[0].confidenceNote}</p>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-ink">{t.market.noForecast}</p>
            )}
            <p className="mt-4 text-sm text-muted">{t.market.uncertainty}</p>
          </section>

          {/* Smart Food Basket & Inflation Shield */}
          <SmartFoodBasket
            prices={commodityPrices}
            labels={t.market.smartBasket}
            locale={locale}
          />

          {/* Influences: only shown once linked evidence exists */}
          <section aria-labelledby="influence-title" className="rounded-xl border border-line bg-paper p-6">
            <h2 id="influence-title" className="text-xl font-semibold">{t.market.influenceTitle}</h2>
            <p className="mt-2 text-ink">{t.market.influenceNone}</p>
          </section>
        </>
      )}
    </div>
  );
}
