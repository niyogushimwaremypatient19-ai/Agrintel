import Link from "next/link";
import { notFound } from "next/navigation";
import { DataStatusBanner } from "@/components/data-status-banner";
import { RiskBadge } from "@/components/risk-badge";
import { DistrictGeographicMatrix } from "@/components/district-risk-map";
import { YieldFrontierChart } from "@/components/yield-frontier-chart";
import { MacroCpiBanner } from "@/components/macro-cpi-banner";
import { ActionSummaryDeck, type ActionCardItem } from "@/components/action-summary-deck";
import { getDictionary, isLocale } from "@/lib/i18n";
import { getLatestCpiRelease } from "@/lib/data/macro-cpi";
import { calculateTrend, monthlyAverages } from "@/lib/trend";
import { getCropOptions, getSourceCounts } from "@/lib/data/prices";
import {
  getAllDistricts,
  getCurrentRiskSignals,
  getDistrictPriceEvidence,
  parseDriver,
  type RiskCategory,
} from "@/lib/data/risk";
import {
  getLatestAuditRecords,
  getNationalAuditSummary,
  getAuditRecordsForCrop,
  type DistrictAuditRecord,
} from "@/lib/data/econometric-audit";

export const dynamic = "force-dynamic";

const percent = (value: number) =>
  new Intl.NumberFormat("en-GB", { style: "percent", maximumFractionDigits: 1 }).format(Math.abs(value));

const shortDate = (value: Date | string) =>
  new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Africa/Kigali" }).format(new Date(value));

const numFormat = (value: number) =>
  new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(value);

export default async function NationalDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ commodity?: string; district?: string; tab?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const t = getDictionary(locale);
  const query = await searchParams;

  const [crops, districts, counts] = await Promise.all([getCropOptions(), getAllDistricts(), getSourceCounts()]);
  const crop = crops.find((c) => c.code === query.commodity) ?? crops[0];
  if (!crop) notFound();

  const activeTab = query.tab ?? "audit";

  // Econometric Audit Data
  const auditSummary = getNationalAuditSummary();
  const cropAuditRecords = getAuditRecordsForCrop(crop.code);
  const auditRecords = cropAuditRecords.length > 0 ? cropAuditRecords : getLatestAuditRecords();

  const selectedAuditDistrict = query.district
    ? auditRecords.find((r) => r.district_code === query.district)
    : auditRecords[0];

  // Market Price Signals Data
  let signals: any[] = [];
  try {
    signals = await getCurrentRiskSignals(crop.code);
  } catch {
    signals = [];
  }
  const signalByDistrict = new Map(signals.map((s) => [s.districtCode, s]));

  const categoryFor = (code: string): RiskCategory =>
    (signalByDistrict.get(code)?.category as RiskCategory | undefined) ?? "unavailable";

  const tally = { low: 0, moderate: 0, high: 0, unavailable: 0 } as Record<RiskCategory, number>;
  for (const d of districts) tally[categoryFor(d.code)] += 1;
  const monitored = tally.low + tally.moderate + tally.high;

  const latestPeriodEnd = signals.reduce<string | null>(
    (latest, s) => (!latest || s.periodEnd > latest ? s.periodEnd : latest),
    null,
  );

  // Selected district market evidence
  const selectedDistrict = districts.find((d) => d.code === query.district) ?? null;
  let evidenceRows: any[] = [];
  try {
    if (selectedDistrict) {
      evidenceRows = await getDistrictPriceEvidence(selectedDistrict.code, crop.code);
    }
  } catch {
    evidenceRows = [];
  }
  const evidenceMonthly = monthlyAverages(
    evidenceRows.map((r) => ({ periodStart: r.periodStart, value: r.value })),
  );
  const evidenceTrend = calculateTrend(evidenceMonthly);
  const selectedSignal = selectedDistrict ? signalByDistrict.get(selectedDistrict.code) : undefined;
  const driver = parseDriver(selectedSignal?.driverSummary ?? null);
  const driverText = driver
    ? driver.changePct > 0.02
      ? t.national.evidence.riseText.replace("{percent}", `${Math.round(driver.changePct * 100)}%`)
      : driver.changePct < -0.02
      ? t.national.evidence.fallText.replace("{percent}", `${Math.abs(Math.round(driver.changePct * 100))}%`)
      : t.national.evidence.flatText
    : "";

  const cropName = (c: { nameEn: string; nameRw: string }) => (locale === "rw" ? c.nameRw : c.nameEn);
  const districtName = (d: { nameEn: string; nameRw: string }) => (locale === "rw" ? d.nameRw : d.nameEn);

  // Top 3 Action Decisions for National Deck
  const leakageRecords = auditRecords
    .filter((r) => r.classification === "LEAKAGE_OR_SEED_QUALITY_RISK")
    .sort((a, b) => a.residual_z_score - b.residual_z_score);
  const highRecords = auditRecords
    .filter((r) => r.classification === "HIGH_PERFORMING_INTENSIFICATION")
    .sort((a, b) => b.residual_z_score - a.residual_z_score);
  const climateRecords = auditRecords
    .filter((r) => r.classification === "CLIMATIC_OR_WATER_STRESS")
    .sort((a, b) => a.residual_z_score - b.residual_z_score);

  const topLeakage = leakageRecords[0] ?? auditRecords[0];
  const topHigh = highRecords[0] ?? auditRecords[1] ?? auditRecords[0];
  const topClimate = climateRecords[0] ?? auditRecords[2] ?? auditRecords[0];

  const topLeakageDistrict = districts.find((d) => d.code === topLeakage?.district_code);
  const topHighDistrict = districts.find((d) => d.code === topHigh?.district_code);
  const topClimateDistrict = districts.find((d) => d.code === topClimate?.district_code);

  const nationalDecisionCards: ActionCardItem[] = [
    {
      id: "action-audit",
      badge: t.national.decisions?.urgentAuditBadge ?? "Inspect Seeds & Fertilizer",
      badgeType: "danger",
      title: `${topLeakageDistrict ? districtName(topLeakageDistrict) : topLeakage?.district_code} · ${cropName(crop)}`,
      metric: `Rating: ${topLeakage?.residual_z_score.toFixed(1)}`,
      metricLabel: `Rwf ${numFormat(topLeakage?.estimated_fiscal_exposure_rwf ?? 0)} farm support`,
      context: t.national.decisions?.urgentAuditContext ?? "Farmers used plenty of seeds and fertilizer, but the harvest was much lower than expected. Inspect seed bags and fertilizer delivery.",
      ctaText: t.national.decisions?.auditCta ?? "Send Field Inspection Alert →",
      ctaHref: `/${locale}/alerts?district=${topLeakage?.district_code}&commodity=${crop.code}&crop=${crop.code}&z=${topLeakage?.residual_z_score.toFixed(2)}&exposure=${topLeakage?.estimated_fiscal_exposure_rwf}&intent=audit`,
    },
    {
      id: "action-benchmark",
      badge: t.national.decisions?.benchmarkBadge ?? "Top Performing District",
      badgeType: "success",
      title: `${topHighDistrict ? districtName(topHighDistrict) : topHigh?.district_code} · ${cropName(crop)}`,
      metric: `Rating: +${topHigh?.residual_z_score.toFixed(1)}`,
      metricLabel: `${numFormat(topHigh?.observed_yield_kg_per_ha ?? 0)} kg/ha harvest`,
      context: t.national.decisions?.benchmarkContext ?? "Excellent harvest thanks to quality seeds, good fertilizer, and hillside terraces. Great model for neighboring districts.",
      ctaText: t.national.decisions?.benchmarkCta ?? "See Best Farming Practices →",
      ctaHref: `/${locale}/national?commodity=${crop.code}&district=${topHigh?.district_code}&tab=audit`,
    },
    {
      id: "action-climate",
      badge: t.national.decisions?.climateBadge ?? "Dry Weather & Water Shortage",
      badgeType: "warning",
      title: `${topClimateDistrict ? districtName(topClimateDistrict) : topClimate?.district_code} · ${cropName(crop)}`,
      metric: `Rating: ${topClimate?.residual_z_score.toFixed(1)}`,
      metricLabel: "Low Rainfall Area",
      context: t.national.decisions?.climateContext ?? "Harvest was low because of dry weather and lack of rain. Priority should be valley irrigation and mulching.",
      ctaText: t.national.decisions?.climateCta ?? "Review Irrigation Advice →",
      ctaHref: `/${locale}/farmer?district=${topClimate?.district_code}&commodity=${crop.code}`,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <section className="max-w-3xl">
        <h1 className="text-4xl font-semibold md:text-5xl">{t.national.title}</h1>
        <p className="mt-4 text-lg text-ink">{t.national.intro}</p>
        <p className="mt-2 text-sm text-muted">{t.national.scopeNote}</p>
      </section>

      {/* Decisions Required Today Action Header Deck */}
      <ActionSummaryDeck
        sectionTitle={t.national.decisions?.title ?? "Decisions Required Today"}
        sectionSubtitle={t.national.decisions?.subtitle ?? "Algorithmic triage prioritizing immediate ministerial audits and agronomic interventions:"}
        cards={nationalDecisionCards}
      />

      {/* Official NISR Macro CPI Release & Rural-Urban Divergence Spread */}
      <MacroCpiBanner cpi={getLatestCpiRelease()} labels={t.market.macroCpi} />

      {/* Commodity Selector Bar */}
      <nav aria-label={t.national.selectCommodity} className="flex flex-col gap-2">
        <span className="text-sm font-semibold text-canopy">{t.national.selectCommodity}</span>
        <div className="flex flex-wrap gap-2">
          {crops.map((c) => {
            const active = c.code === crop.code;
            return (
              <Link
                key={c.code}
                href={`/${locale}/national?commodity=${c.code}&tab=${activeTab}`}
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

      {/* Mode Navigation Tabs */}
      <div className="flex border-b border-line gap-4 text-sm font-semibold">
        <Link
          href={`/${locale}/national?commodity=${crop.code}&tab=audit`}
          className={`pb-3 transition-colors ${
            activeTab === "audit"
              ? "border-b-2 border-canopy text-canopy font-bold"
              : "text-muted hover:text-ink"
          }`}
        >
          {t.national.audit.tabAudit}
        </Link>
        <Link
          href={`/${locale}/national?commodity=${crop.code}&tab=price`}
          className={`pb-3 transition-colors ${
            activeTab === "price"
              ? "border-b-2 border-canopy text-canopy font-bold"
              : "text-muted hover:text-ink"
          }`}
        >
          {t.national.audit.tabPrice}
        </Link>
      </div>

      {activeTab === "audit" ? (
        /* Primary View: MINAGRI Input Subsidy & Yield Residual Audit */
        <div className="flex flex-col gap-8">
          {/* Headline Audit Indicators */}
          <section
            aria-label={t.national.audit.title}
            className="grid gap-4 grid-cols-2 md:grid-cols-5"
          >
            <Stat label={t.national.audit.monitoredTotal} value={auditSummary.totalMonitored} />
            <Stat
              label={t.national.audit.leakageCount}
              value={auditSummary.leakageRiskCount}
              highlightClass="text-clay"
            />
            <Stat
              label={t.national.audit.climateStressCount}
              value={auditSummary.climateStressCount}
              highlightClass="text-harvest"
            />
            <Stat
              label={t.national.audit.highPerfCount}
              value={auditSummary.highPerformanceCount}
              highlightClass="text-leaf"
            />
            <Stat
              label={t.national.audit.nominalCount}
              value={auditSummary.nominalCount}
            />
          </section>

          {/* Subsidized Fiscal Exposure Banner */}
          <div className="rounded-2xl border border-clay/30 bg-clay/10 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-xs uppercase tracking-wider font-bold text-clay">
                {t.national.audit.totalFiscalExposure}
              </span>
              <div className="text-2xl md:text-3xl font-extrabold text-clay mt-1">
                Rwf {numFormat(auditSummary.totalFiscalExposureRwf)}
              </div>
              <p className="text-xs text-muted mt-1">
                Estimated value of farm support at risk where harvests were much lower than expected despite high fertilizer and seed delivery.
              </p>
            </div>
            <div className="text-xs text-muted max-w-sm">
              Helps ensure Rwanda&apos;s Rwf 75 Billion national agricultural support delivers healthy crops for all districts.
            </div>
          </div>

          {/* ML Structural Production Frontier & Feature Driver Attribution */}
          <YieldFrontierChart
            auditRecords={auditRecords}
            commodityName={cropName(crop)}
            locale={locale}
            selectedDistrictCode={selectedAuditDistrict?.district_code}
            labels={{
              title: locale === "rw"
                ? "Icyitegererezo cy'Umusaruro n'Ubusesenguzi bw'Ubutaka (Production Frontier)"
                : "ML Climate-Controlled Yield Production Frontier & Outlier Isolation",
              subtitle: locale === "rw"
                ? `Isesengura ry'umusaruro witezwe ugereranyije n'uwabonetse kuri ${cropName(crop)} mu turere 30 tw'u Rwanda.`
                : `Plots all 30 districts against expected harvest yields conditioned on SAS fertilizer/seed inputs and CHIRPS rainfall.`,
              expectedAxis: locale === "rw"
                ? "Umusaruro Witezwe (kg/ha) [Ifumbire + Imbuto + Imvura]"
                : "Expected Frontier Yield (kg/ha) [SAS Fertilizer + Certified Seeds + CHIRPS Rain]",
              observedAxis: locale === "rw"
                ? "Umusaruro Wabonetse mu Ibarura rya SAS (kg/ha)"
                : "Observed SAS Survey Yield (kg/ha)",
              frontierLine: locale === "rw" ? "Umurongo w'Umusaruro Witezwe (Y = X)" : "Predicted Production Frontier (Y = X)",
              leakageZone: locale === "rw" ? "Ahari Icyuho (z < -1.75)" : "Negative Residual Anomaly (z < -1.75)",
              featureAttributionTitle: locale === "rw"
                ? "Uburemere n'Uruhare rw'Ibipimo mu Cyitegererezo (Feature Attribution)"
                : "Econometric Elasticity & Driver Attribution Weights",
            }}
          />

          {/* All 30 Districts Geographic Matrix */}
          <DistrictGeographicMatrix
            districts={districts}
            auditRecords={auditRecords}
            selectedDistrictCode={selectedAuditDistrict?.district_code}
            selectedCommodity={crop.code}
            locale={locale}
            labels={t.national.districtMatrix}
          />

          <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
            {/* Audit Table */}
            <section aria-label={t.national.audit.title} className="min-w-0">
              <h2 className="text-2xl font-semibold text-canopy">{t.national.audit.title}</h2>
              <p className="mt-1 text-sm text-muted">{t.national.audit.intro}</p>

              <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-paper shadow-sm">
                <table className="w-full min-w-[48rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-line bg-cream/20 text-muted font-semibold">
                      <th scope="col" className="px-4 py-3">{t.national.audit.columns.district}</th>
                      <th scope="col" className="px-4 py-3">{t.national.audit.columns.season}</th>
                      <th scope="col" className="px-4 py-3">{t.national.audit.columns.observedYield}</th>
                      <th scope="col" className="px-4 py-3">{t.national.audit.columns.expectedYield}</th>
                      <th scope="col" className="px-4 py-3">{t.national.audit.columns.zScore}</th>
                      <th scope="col" className="px-4 py-3">{t.national.audit.columns.inputs}</th>
                      <th scope="col" className="px-4 py-3">{t.national.audit.columns.diagnostic}</th>
                      <th scope="col" className="px-4 py-3"><span className="sr-only">Details</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {auditRecords.map((r) => {
                      const isLeakage = r.classification === "LEAKAGE_OR_SEED_QUALITY_RISK";
                      const isClimate = r.classification === "CLIMATIC_OR_WATER_STRESS";
                      const isHigh = r.classification === "HIGH_PERFORMING_INTENSIFICATION";
                      const isSelected = selectedAuditDistrict?.district_code === r.district_code;

                      return (
                        <tr
                          key={`${r.district_code}_${r.season}`}
                          className={`hover:bg-cream/30 transition-colors ${
                            isSelected ? "bg-cream/40 font-medium" : ""
                          }`}
                        >
                          <th scope="row" className="px-4 py-3.5 font-semibold text-canopy">
                            {r.district_code}
                          </th>
                          <td className="px-4 py-3 text-ink font-mono text-xs tabular-nums">{r.season}</td>
                          <td className="px-4 py-3 text-ink font-mono tabular-nums">
                            {numFormat(r.observed_yield_kg_per_ha)}
                          </td>
                          <td className="px-4 py-3 text-muted font-mono tabular-nums">
                            {numFormat(r.expected_yield_kg_per_ha)}
                          </td>
                          <td className="px-4 py-3 font-mono font-semibold tabular-nums">
                            <span
                              className={
                                isLeakage
                                  ? "text-clay"
                                  : isClimate
                                  ? "text-harvest"
                                  : isHigh
                                  ? "text-leaf"
                                  : "text-ink"
                              }
                            >
                              {r.residual_z_score > 0 ? `+${r.residual_z_score.toFixed(2)}` : r.residual_z_score.toFixed(2)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted font-mono tabular-nums">
                            {r.improved_seed_pct.toFixed(0)}% seed / {r.inorganic_fert_pct.toFixed(0)}% fert
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                isLeakage
                                  ? "bg-clay/15 text-clay"
                                  : isClimate
                                  ? "bg-harvest/20 text-soil"
                                  : isHigh
                                  ? "bg-sprout text-leaf"
                                  : "bg-cream text-muted"
                              }`}
                            >
                              {t.national.audit.classifications[r.classification]}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {isLeakage ? (
                              <Link
                                href={`/${locale}/alerts?district=${r.district_code}&commodity=${crop.code}&crop=${crop.code}&z=${r.residual_z_score.toFixed(2)}&exposure=${r.estimated_fiscal_exposure_rwf}&intent=audit`}
                                className="inline-flex items-center gap-1 rounded-xl bg-clay px-3 py-1.5 text-xs font-bold text-cream shadow-xs transition-all hover:bg-clay/90 active:scale-95 whitespace-nowrap cursor-pointer"
                              >
                                {t.national.decisions?.auditCta ?? "Dispatch Audit →"}
                              </Link>
                            ) : (
                              <Link
                                href={`/${locale}/national?commodity=${crop.code}&district=${r.district_code}&tab=audit`}
                                className="text-xs font-semibold text-leaf hover:underline"
                              >
                                {t.national.viewEvidence}
                              </Link>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Audit Evidence Decomposition Panel */}
            <aside aria-label={t.national.audit.evidence.title} className="flex flex-col gap-4">
              <div className="rounded-2xl border border-line bg-paper p-6 shadow-sm">
                <h3 className="text-xl font-semibold text-canopy">
                  {selectedAuditDistrict ? selectedAuditDistrict.district_code : "National"} {t.national.audit.evidence.title}
                </h3>

                {selectedAuditDistrict ? (
                  <div className="mt-4 flex flex-col gap-4 text-sm text-ink">
                    <div className="rounded-xl bg-cream/40 p-4 border border-line/60">
                      <span className="text-xs font-semibold text-muted uppercase tracking-wider block">
                        {t.national.audit.evidence.rationaleTitle}
                      </span>
                      <p className="mt-1 text-sm font-medium leading-relaxed text-ink">
                        {selectedAuditDistrict.diagnostic_rationale}
                      </p>
                    </div>

                    <dl className="divide-y divide-line/60 text-sm">
                      <div className="py-2.5 flex justify-between">
                        <dt className="text-muted">{t.national.audit.evidence.climateCushion}:</dt>
                        <dd className="font-mono font-semibold tabular-nums">{selectedAuditDistrict.climate_factor.toFixed(2)}x</dd>
                      </div>
                      <div className="py-2.5 flex justify-between">
                        <dt className="text-muted">{t.national.audit.evidence.inputResponse}:</dt>
                        <dd className="font-mono font-semibold tabular-nums">{selectedAuditDistrict.input_factor.toFixed(2)}x</dd>
                      </div>
                      <div className="py-2.5 flex justify-between">
                        <dt className="text-muted">{t.national.audit.evidence.rainfallAnomaly}:</dt>
                        <dd className="font-mono font-semibold tabular-nums">{selectedAuditDistrict.rainfall_anomaly_ratio.toFixed(2)}x</dd>
                      </div>
                      <div className="py-2.5 flex justify-between">
                        <dt className="text-muted">{t.national.audit.evidence.irrigationCoverage}:</dt>
                        <dd className="font-mono font-semibold tabular-nums">{selectedAuditDistrict.irrigation_pct.toFixed(1)}%</dd>
                      </div>
                      <div className="py-2.5 flex justify-between">
                        <dt className="text-muted">{t.national.audit.evidence.certifiedSeed}:</dt>
                        <dd className="font-mono font-semibold tabular-nums">{selectedAuditDistrict.improved_seed_pct.toFixed(1)}%</dd>
                      </div>
                      <div className="py-2.5 flex justify-between">
                        <dt className="text-muted">{t.national.audit.evidence.fertilizerUsage}:</dt>
                        <dd className="font-mono font-semibold tabular-nums">{selectedAuditDistrict.inorganic_fert_pct.toFixed(1)}%</dd>
                      </div>
                      <div className="py-2.5 flex justify-between">
                        <dt className="text-muted">{t.national.audit.evidence.plantedArea}:</dt>
                        <dd className="font-mono font-semibold tabular-nums">{numFormat(selectedAuditDistrict.planted_area_ha)} ha</dd>
                      </div>
                      {selectedAuditDistrict.estimated_fiscal_exposure_rwf > 0 && (
                        <div className="py-2.5 flex justify-between text-clay font-bold">
                          <dt>{t.national.audit.columns.fiscalExposure}:</dt>
                          <dd className="font-mono tabular-nums">Rwf {numFormat(selectedAuditDistrict.estimated_fiscal_exposure_rwf)}</dd>
                        </div>
                      )}
                    </dl>

                    {/* Connected Multi-Screen Operational Action Bridges */}
                    <div className="mt-4 pt-3 border-t border-line/60 flex flex-col gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted block">
                        Connected Operational Workflows
                      </span>
                      <Link
                        href={`/${locale}/farmer?district=${selectedAuditDistrict.district_code}&commodity=${crop.code}`}
                        className="inline-flex w-full items-center justify-between rounded-xl border border-line bg-cream/70 px-3.5 py-2 text-xs font-semibold text-canopy hover:bg-sprout/60 transition-colors"
                      >
                        <span>🌾 Open Farmer Advisory ({selectedAuditDistrict.district_code})</span>
                        <span>→</span>
                      </Link>
                      <Link
                        href={`/${locale}/retailer?commodity=${crop.code}`}
                        className="inline-flex w-full items-center justify-between rounded-xl border border-line bg-cream/70 px-3.5 py-2 text-xs font-semibold text-soil hover:bg-harvest/25 transition-colors"
                      >
                        <span>🚛 Freight Stress-Test ({selectedAuditDistrict.district_code} → Kigali)</span>
                        <span>→</span>
                      </Link>
                      {selectedAuditDistrict.classification === "LEAKAGE_OR_SEED_QUALITY_RISK" ? (
                        <Link
                          href={`/${locale}/alerts?district=${selectedAuditDistrict.district_code}&commodity=${crop.code}&crop=${crop.code}&z=${selectedAuditDistrict.residual_z_score.toFixed(2)}&exposure=${selectedAuditDistrict.estimated_fiscal_exposure_rwf}&intent=audit`}
                          className="inline-flex w-full items-center justify-between rounded-xl bg-clay px-3.5 py-2 text-xs font-bold text-cream shadow-xs hover:bg-clay/90 active:scale-95 cursor-pointer transition-colors"
                        >
                          <span>🚨 Dispatch MINAGRI Field Audit</span>
                          <span>→</span>
                        </Link>
                      ) : selectedAuditDistrict.classification === "CLIMATIC_OR_WATER_STRESS" ? (
                        <Link
                          href={`/${locale}/alerts?district=${selectedAuditDistrict.district_code}&commodity=${crop.code}&crop=${crop.code}&intent=hold`}
                          className="inline-flex w-full items-center justify-between rounded-xl bg-harvest px-3.5 py-2 text-xs font-bold text-canopy shadow-xs hover:bg-harvest/90 transition-colors"
                        >
                          <span>💧 Request Emergency Irrigation Shield</span>
                          <span>→</span>
                        </Link>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-muted">Select a district to inspect its econometric decomposition.</p>
                )}
              </div>
            </aside>
          </div>
        </div>
      ) : (
        /* Secondary View: Market Price Signals */
        <div className="flex flex-col gap-8">
          <section aria-label={t.national.summary.monitored} className="grid gap-4 grid-cols-2 md:grid-cols-5">
            <Stat label={t.national.summary.monitored} value={monitored} />
            <Stat label={t.national.summary.high} value={tally.high} />
            <Stat label={t.national.summary.moderate} value={tally.moderate} />
            <Stat label={t.national.summary.low} value={tally.low} />
            <Stat label={t.national.summary.unavailable} value={tally.unavailable} />
          </section>
          <p className="text-sm text-ink">
            <span className="font-semibold">{t.national.summary.latestData}:</span>{" "}
            {latestPeriodEnd ? shortDate(latestPeriodEnd) : t.welcome.latestUpdateNone}
          </p>

          <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
            <section aria-labelledby="district-table-title" className="min-w-0">
              <h2 id="district-table-title" className="text-2xl font-semibold">
                {t.national.tableCaption}
              </h2>
              <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-paper shadow-sm">
                <table className="w-full min-w-[40rem] text-left text-sm">
                  <thead>
                    <tr className="border-b border-line bg-cream/20 text-muted font-semibold">
                      <th scope="col" className="px-4 py-3">{t.national.columns.district}</th>
                      <th scope="col" className="px-4 py-3">{t.national.columns.province}</th>
                      <th scope="col" className="px-4 py-3">{t.national.columns.signal}</th>
                      <th scope="col" className="px-4 py-3">{t.national.columns.status}</th>
                      <th scope="col" className="px-4 py-3">
                        <span className="sr-only">{t.national.columns.detail}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {districts.map((d) => {
                      const signal = signalByDistrict.get(d.code);
                      const category = categoryFor(d.code);
                      const isSelected = selectedDistrict?.code === d.code;
                      const hasSample = signal ? parseDriver(signal.driverSummary)?.basedOnSample : false;

                      return (
                        <tr
                          key={d.code}
                          className={`hover:bg-cream/30 transition-colors ${
                            isSelected ? "bg-cream/40 font-medium" : ""
                          }`}
                        >
                          <th scope="row" className="px-4 py-3 text-canopy font-semibold">
                            {districtName(d)}
                          </th>
                          <td className="px-4 py-3 text-muted">{d.province}</td>
                          <td className="px-4 py-3">
                            <RiskBadge category={category} label={t.national.categories[category]} />
                          </td>
                          <td className="px-4 py-3 text-xs text-muted">
                            {category === "unavailable"
                              ? t.status.unavailableLabel
                              : hasSample
                              ? t.status.sampleLabel
                              : t.status.verifiedLabel}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link
                              href={`/${locale}/national?commodity=${crop.code}&district=${d.code}&tab=price`}
                              className="text-xs font-semibold text-leaf hover:underline"
                            >
                              {t.national.viewEvidence}
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <aside aria-label={t.national.evidence.title} className="flex flex-col gap-4">
              <div className="rounded-2xl border border-line bg-paper p-6 shadow-sm">
                <h3 className="text-xl font-semibold text-canopy">{t.national.evidence.title}</h3>
                {selectedDistrict ? (
                  <div className="mt-4 flex flex-col gap-4 text-sm text-ink">
                    <p className="font-semibold text-base text-canopy">{districtName(selectedDistrict)}</p>
                    {driver ? (
                      <div className="rounded-xl bg-cream/40 p-4 border border-line/60">
                        <span className="text-xs font-semibold text-muted uppercase tracking-wider block">
                          {t.national.evidence.driver}
                        </span>
                        <p className="mt-1 font-medium">{driverText}</p>
                      </div>
                    ) : (
                      <p className="text-muted">{t.national.evidence.noSignal}</p>
                    )}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-muted">{t.national.evidence.select}</p>
                )}
              </div>
            </aside>
          </div>
        </div>
      )}

      {/* Data provenance status footer */}
      <DataStatusBanner verifiedCount={counts.verified} sampleCount={counts.sample} labels={t.status} />
    </div>
  );
}

function Stat({
  label,
  value,
  highlightClass = "text-canopy",
}: {
  label: string;
  value: number;
  highlightClass?: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-paper p-5 shadow-sm text-center">
      <span className="block text-xs font-medium uppercase tracking-wider text-muted">{label}</span>
      <span className={`mt-2 block text-3xl font-extrabold ${highlightClass}`}>{value}</span>
    </div>
  );
}
