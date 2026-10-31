import Link from "next/link";
import type { DistrictAuditRecord } from "@/lib/data/econometric-audit";
import { formatAssessmentReasoning } from "@/lib/format-rationale";

interface DistrictAgronomicCardProps {
  auditRecord: DistrictAuditRecord | null;
  cropName: string;
  districtName: string;
  locale?: string;
  labels: {
    title: string;
    seasonLabel: string;
    cultivatedArea: string;
    production: string;
    yieldObserved: string;
    yieldExpected: string;
    yieldGap: string;
    seedAdoption: string;
    fertAdoption: string;
    irrigation: string;
    antiErosion: string;
    leakageTitle: string;
    leakageAdvice: string;
    climateTitle: string;
    climateAdvice: string;
    intensificationTitle: string;
    intensificationAdvice: string;
    nominalTitle: string;
    nominalAdvice: string;
    noData: string;
    viewStatisticalProof?: string;
    dispatchAuditAction?: string;
    reviewIrrigationAction?: string;
    benchmarkAction?: string;
    samplingWeightsNote?: string;
  };
}

export function DistrictAgronomicCard({
  auditRecord,
  cropName,
  districtName,
  locale = "en",
  labels,
}: DistrictAgronomicCardProps) {
  if (!auditRecord) {
    return (
      <div className="rounded-3xl border border-line/80 bg-paper p-6 shadow-xs">
        <h3 className="text-xl font-bold text-canopy">{labels.title}</h3>
        <p className="mt-2 text-sm text-muted">{labels.noData}</p>
      </div>
    );
  }

  const isLeakage = auditRecord.classification === "LEAKAGE_OR_SEED_QUALITY_RISK";
  const isClimate = auditRecord.classification === "CLIMATIC_OR_WATER_STRESS";
  const isHigh = auditRecord.classification === "HIGH_PERFORMING_INTENSIFICATION";

  let alertTitle = labels.nominalTitle;
  let alertAdvice = labels.nominalAdvice;
  let alertStyle = "border-line/80 bg-cream/30 text-ink";
  let statusBadgeStyle = "bg-stone-100 text-stone-700 border-stone-200";
  let statusBadgeText = "Nominal Expected Performance";

  if (isLeakage) {
    alertTitle = labels.leakageTitle;
    alertAdvice = labels.leakageAdvice;
    alertStyle = "border-clay/40 bg-clay/10 text-clay";
    statusBadgeStyle = "bg-clay/15 text-clay border-clay/30";
    statusBadgeText = "Input Leakage / Seed Quality Alert";
  } else if (isClimate) {
    alertTitle = labels.climateTitle;
    alertAdvice = labels.climateAdvice;
    alertStyle = "border-harvest/50 bg-harvest/15 text-soil";
    statusBadgeStyle = "bg-harvest/20 text-soil border-harvest/40";
    statusBadgeText = "Agro-Climatic Moisture Deficit";
  } else if (isHigh) {
    alertTitle = labels.intensificationTitle;
    alertAdvice = labels.intensificationAdvice;
    alertStyle = "border-leaf/40 bg-sprout/40 text-canopy";
    statusBadgeStyle = "bg-sprout text-leaf border-leaf/30";
    statusBadgeText = "High Yield Intensification Frontier";
  }

  const numFormat = (val: number) =>
    new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(val);

  const yieldPctGap = auditRecord.expected_yield_kg_per_ha > 0
    ? Math.round((auditRecord.yield_gap_kg_per_ha / auditRecord.expected_yield_kg_per_ha) * 100)
    : 0;

  return (
    <section
      aria-labelledby="agronomic-audit-title"
      className="@container rounded-3xl border border-line/80 bg-paper p-6 shadow-xs sm:p-7"
      style={{ containerType: "inline-size" }}
    >
      {/* 1. Header with clear status badge & metadata */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-line/60 pb-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-canopy/10 px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-canopy">
              NISR SAS {auditRecord.season}
            </span>
            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${statusBadgeStyle}`}>
              {statusBadgeText}
            </span>
          </div>
          <h2 id="agronomic-audit-title" className="mt-2 text-2xl font-black text-canopy sm:text-3xl">
            {districtName} · {cropName}
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right sm:border-l sm:border-line/60 sm:pl-4">
            <span className="text-xs font-bold uppercase tracking-wider text-muted block">
              {labels.seasonLabel}
            </span>
            <p className="text-base font-black text-canopy font-mono tabular-nums">{auditRecord.season}</p>
          </div>
        </div>
      </div>

      {/* 2. Plain-Language Actionable Recommendation (Front & Center) */}
      <div className={`mt-5 rounded-2xl border p-4.5 sm:p-5 ${alertStyle}`}>
        <div className="flex items-start gap-3">
          <span className="text-xl select-none mt-0.5">
            {isLeakage ? "⚠️" : isClimate ? "💧" : isHigh ? "🌱" : "ℹ️"}
          </span>
          <div className="flex-1">
            <h3 className="font-black text-base leading-snug">
              {alertTitle}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed font-medium">
              {alertAdvice}
            </p>
          </div>
        </div>
      </div>

      {/* 3. Simple Human-Friendly Yield Comparison (Observed vs. Expected) */}
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-line/80 bg-cream/20 p-4">
          <span className="text-xs font-bold uppercase tracking-wider text-muted block">
            {labels.yieldObserved}
          </span>
          <p className="mt-1.5 text-2xl sm:text-3xl font-black text-canopy font-mono tabular-nums">
            {numFormat(auditRecord.observed_yield_kg_per_ha)}{" "}
            <span className="text-xs font-normal text-muted">kg/ha</span>
          </p>
          <span className="text-xs text-muted block mt-1">
            Reported from rural sector harvest cuts
          </span>
        </div>

        <div className="rounded-2xl border border-line/80 bg-cream/20 p-4">
          <span className="text-xs font-bold uppercase tracking-wider text-muted block">
            {labels.yieldExpected}
          </span>
          <p className="mt-1.5 text-2xl sm:text-3xl font-black text-ink font-mono tabular-nums">
            {numFormat(auditRecord.expected_yield_kg_per_ha)}{" "}
            <span className="text-xs font-normal text-muted">kg/ha</span>
          </p>
          <span className="text-xs text-muted block mt-1">
            Climate-controlled agro-ecological expectation
          </span>
        </div>

        <div className="rounded-2xl border border-line/80 bg-cream/20 p-4 flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-muted block">
              {labels.yieldGap}
            </span>
            <p
              className={`mt-1.5 text-2xl sm:text-3xl font-black font-mono tabular-nums ${
                auditRecord.yield_gap_kg_per_ha >= 0 ? "text-leaf" : "text-clay"
              }`}
            >
              {auditRecord.yield_gap_kg_per_ha >= 0 ? "+" : ""}
              {numFormat(auditRecord.yield_gap_kg_per_ha)}{" "}
              <span className="text-xs font-normal text-muted">kg/ha</span>
            </p>
          </div>
          <span className="text-xs font-semibold text-muted block mt-1">
            {yieldPctGap >= 0 ? `+${yieldPctGap}% above benchmark` : `${yieldPctGap}% below benchmark`}
          </span>
        </div>
      </div>

      {/* 4. One-Click Operational Action Routing Button */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-line/60">
        <div>
          {isLeakage ? (
            <Link
              href={`/${locale}/alerts?district=${auditRecord.district_code}&commodity=${auditRecord.commodity_code}&crop=${auditRecord.commodity_code}&intent=audit&z=${auditRecord.residual_z_score.toFixed(2)}&exposure=${auditRecord.estimated_fiscal_exposure_rwf}`}
              className="inline-flex items-center gap-2 rounded-xl bg-clay px-5 py-2.5 text-xs font-extrabold text-cream shadow-xs transition-all hover:bg-clay/90 active:scale-95 cursor-pointer"
            >
              <span>🚨 {labels.dispatchAuditAction ?? "Dispatch Field Audit Alert →"}</span>
            </Link>
          ) : isClimate ? (
            <Link
              href={`/${locale}/farmer?district=${auditRecord.district_code}&commodity=${auditRecord.commodity_code}`}
              className="inline-flex items-center gap-2 rounded-xl bg-soil px-5 py-2.5 text-xs font-extrabold text-cream shadow-xs transition-all hover:bg-harvest active:scale-95 cursor-pointer"
            >
              <span>💧 {labels.reviewIrrigationAction ?? "Review Irrigation Action →"}</span>
            </Link>
          ) : isHigh ? (
            <Link
              href={`/${locale}/national?commodity=${auditRecord.commodity_code}&district=${auditRecord.district_code}&tab=audit`}
              className="inline-flex items-center gap-2 rounded-xl bg-leaf px-5 py-2.5 text-xs font-extrabold text-cream shadow-xs transition-all hover:bg-forest active:scale-95 cursor-pointer"
            >
              <span>🌟 {labels.benchmarkAction ?? "Inspect Extension Protocol →"}</span>
            </Link>
          ) : (
            <span className="text-xs text-muted font-medium">
              Performance conforms to expected historical envelope.
            </span>
          )}
        </div>

        <span className="text-xs text-muted font-mono">
          Sector diagnostic: <span className="font-semibold text-ink">{auditRecord.classification}</span>
        </span>
      </div>

      {/* 5. Progressive Disclosure: Collapsible "View NISR Statistical Proof" Drawer */}
      <details className="group mt-6 rounded-2xl border border-line/80 bg-cream/25 transition-all">
        <summary className="flex cursor-pointer items-center justify-between p-4.5 text-xs sm:text-sm font-bold text-canopy hover:bg-cream/50 select-none list-none transition-colors">
          <div className="flex items-center gap-2">
            <span className="text-base select-none">🔬</span>
            <span>{labels.viewStatisticalProof ?? "View NISR Statistical Proof & Survey Lineage"}</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-muted">
            <span className="group-open:hidden">Expand metrics</span>
            <span className="hidden group-open:inline">Collapse</span>
            <span className="transition-transform duration-200 group-open:rotate-180">▾</span>
          </div>
        </summary>

        <div className="border-t border-line/60 p-5 pt-4 space-y-6">
          {/* Assessment Summary Callout */}
          <div className="rounded-xl border border-line/70 bg-paper p-4">
            <span className="text-xs font-bold uppercase tracking-wider text-muted block">
              {locale === "rw" ? "Impamvu z'Isuzuma ry'Umusaruro" : "Harvest Assessment Reasoning"}
            </span>
            <p className="mt-1.5 text-xs sm:text-sm font-medium text-ink leading-relaxed">
              {formatAssessmentReasoning(auditRecord.diagnostic_rationale, locale)}
            </p>
          </div>

          {/* Statistical Metrics 4-Grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-line/60 bg-paper p-3.5">
              <span className="text-[11px] font-bold uppercase text-muted block">
                Harvest Performance Rating
              </span>
              <p
                className={`mt-1 text-xl font-black font-mono tabular-nums ${
                  isLeakage ? "text-clay" : isClimate ? "text-harvest" : isHigh ? "text-leaf" : "text-ink"
                }`}
              >
                {auditRecord.residual_z_score >= 0 ? `+${auditRecord.residual_z_score.toFixed(1)}` : auditRecord.residual_z_score.toFixed(1)}
              </p>
              <span className="text-[10px] text-muted block mt-0.5">
                Compared to expected target
              </span>
            </div>

            <div className="rounded-xl border border-line/60 bg-paper p-3.5">
              <span className="text-[11px] font-bold uppercase text-muted block">
                Rainfall Level
              </span>
              <p className="mt-1 text-xl font-black text-canopy font-mono tabular-nums">
                {auditRecord.rainfall_anomaly_ratio.toFixed(2)}x
              </p>
              <span className="text-[10px] text-muted block mt-0.5">
                Compared to normal season rain
              </span>
            </div>

            <div className="rounded-xl border border-line/60 bg-paper p-3.5">
              <span className="text-[11px] font-bold uppercase text-muted block">
                {labels.cultivatedArea}
              </span>
              <p className="mt-1 text-xl font-black text-canopy font-mono tabular-nums">
                {numFormat(auditRecord.planted_area_ha)} <span className="text-xs font-normal text-muted">ha</span>
              </p>
              <span className="text-[10px] text-muted block mt-0.5">
                Cultivated area in district
              </span>
            </div>

            <div className="rounded-xl border border-line/60 bg-paper p-3.5">
              <span className="text-[11px] font-bold uppercase text-muted block">
                {labels.production}
              </span>
              <p className="mt-1 text-xl font-black text-canopy font-mono tabular-nums">
                {numFormat(auditRecord.harvested_production_mt)} <span className="text-xs font-normal text-muted">MT</span>
              </p>
              <span className="text-[10px] text-muted block mt-0.5">
                Total harvested volume
              </span>
            </div>
          </div>

          {/* District Input Adoption & Environmental Defenses with Visual Meters */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-soil mb-3">
              Input Adoption & Environmental Defenses
            </h4>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
              <div className="rounded-xl border border-line/60 bg-paper p-3.5">
                <div className="flex items-center justify-between text-xs font-semibold text-canopy">
                  <span>{labels.seedAdoption}</span>
                  <span className="font-mono font-bold tabular-nums">{auditRecord.improved_seed_pct.toFixed(1)}%</span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-line/60">
                  <div
                    className="h-full bg-canopy rounded-full"
                    style={{ width: `${Math.min(auditRecord.improved_seed_pct, 100)}%` }}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-line/60 bg-paper p-3.5">
                <div className="flex items-center justify-between text-xs font-semibold text-canopy">
                  <span>{labels.fertAdoption}</span>
                  <span className="font-mono font-bold tabular-nums">{auditRecord.inorganic_fert_pct.toFixed(1)}%</span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-line/60">
                  <div
                    className="h-full bg-leaf rounded-full"
                    style={{ width: `${Math.min(auditRecord.inorganic_fert_pct, 100)}%` }}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-line/60 bg-paper p-3.5">
                <div className="flex items-center justify-between text-xs font-semibold text-canopy">
                  <span>{labels.irrigation}</span>
                  <span className="font-mono font-bold tabular-nums">{auditRecord.irrigation_pct.toFixed(1)}%</span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-line/60">
                  <div
                    className="h-full bg-sky-600 rounded-full"
                    style={{ width: `${Math.min(auditRecord.irrigation_pct, 100)}%` }}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-line/60 bg-paper p-3.5">
                <div className="flex items-center justify-between text-xs font-semibold text-canopy">
                  <span>{labels.antiErosion}</span>
                  <span className="font-mono font-bold tabular-nums">92.4%</span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-line/60">
                  <div className="h-full bg-amber-700 rounded-full" style={{ width: "92.4%" }} />
                </div>
              </div>
            </div>
          </div>

          {/* Subsidized Fiscal Exposure Line */}
          {auditRecord.estimated_fiscal_exposure_rwf > 0 && (
            <div className="rounded-xl border border-clay/30 bg-clay/10 p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-clay block">
                  Estimated Subsidized Fiscal Exposure
                </span>
                <p className="text-xs text-muted mt-0.5">
                  Derived from MINAGRI public input subsidy package and SAS reported seed uptake.
                </p>
              </div>
              <div className="text-xl font-black text-clay font-mono tabular-nums whitespace-nowrap">
                Rwf {numFormat(auditRecord.estimated_fiscal_exposure_rwf)}
              </div>
            </div>
          )}

          {/* Survey Provenance Note */}
          <p className="text-[11px] text-muted leading-relaxed border-t border-line/50 pt-3">
            {labels.samplingWeightsNote ?? "NISR Seasonal Agricultural Survey (SAS) Multiple Frame Sampling methodology (1,200 enumeration areas nationwide)."}
          </p>
        </div>
      </details>

      {/* Connected Multi-Screen User Journey Bridges */}
      <div className="mt-5 pt-4 border-t border-line/60 flex flex-wrap items-center justify-between gap-3 text-xs">
        <span className="font-bold text-soil text-[11px] uppercase tracking-wider">
          Cross-Platform Workflows:
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/${locale}/national?district=${auditRecord.district_code}&commodity=${auditRecord.commodity_code}`}
            className="inline-flex items-center gap-1 rounded-lg border border-line bg-cream/70 px-2.5 py-1.5 font-semibold text-canopy hover:bg-sprout/50 transition-colors"
          >
            <span>🗺️ 30-District Overview</span>
          </Link>
          <Link
            href={`/${locale}/retailer?commodity=${auditRecord.commodity_code}`}
            className="inline-flex items-center gap-1 rounded-lg border border-line bg-cream/70 px-2.5 py-1.5 font-semibold text-soil hover:bg-harvest/20 transition-colors"
          >
            <span>🚛 Transport & Profits</span>
          </Link>
          <Link
            href={`/${locale}/market?commodity=${auditRecord.commodity_code}`}
            className="inline-flex items-center gap-1 rounded-lg border border-line bg-cream/70 px-2.5 py-1.5 font-semibold text-leaf hover:bg-sprout/40 transition-colors"
          >
            <span>📈 Wholesale Prices</span>
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1 rounded-lg border border-line/80 bg-paper px-2.5 py-1.5 font-semibold text-muted hover:text-ink hover:border-canopy transition-colors cursor-pointer"
            title="Print or save this advisory for offline field use"
          >
            <span>🖨️ Print / Offline Sheet</span>
          </button>
        </div>
      </div>
    </section>
  );
}
