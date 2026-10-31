"use client";
import { useId, useState } from "react";
import Link from "next/link";
import type { DistrictAuditRecord } from "@/lib/data/econometric-audit";
import { tokens } from "@/lib/design-tokens";
import { formatAssessmentReasoning } from "@/lib/format-rationale";

export type DistrictGeographicMatrixProps = {
  districts: Array<{
    code: string;
    nameEn: string;
    nameRw: string;
    province: string;
  }>;
  auditRecords: DistrictAuditRecord[];
  selectedDistrictCode?: string;
  selectedCommodity: string;
  locale: string;
  labels: {
    title: string;
    subtitle: string;
    allDistricts: string;
    leakageFilter: string;
    climateFilter: string;
    intensificationFilter: string;
    nominalFilter: string;
    viewEvidence: string;
    residualScore: string;
    yieldLabel: string;
    inputsLabel: string;
    leakageBadge: string;
    climateBadge: string;
    highBadge: string;
    nominalBadge: string;
    dispatchAuditBtn?: string;
  };
};

type ProvinceGroup = "Kigali City" | "Northern" | "Southern" | "Eastern" | "Western";
type MapMetric = "residual" | "climate" | "seeds";

// Geographic coordinates for Rwanda's 30 districts in SVG layout (x, y center, w, h)
const DISTRICT_COORDINATES: Record<string, { x: number; y: number; w: number; h: number }> = {
  // Northern Province (Top-North)
  BURERA: { x: 310, y: 55, w: 90, h: 60 },
  MUSANZE: { x: 210, y: 70, w: 90, h: 60 },
  GICUMBI: { x: 410, y: 85, w: 95, h: 65 },
  RULINDO: { x: 320, y: 125, w: 80, h: 55 },
  GAKENKE: { x: 230, y: 140, w: 80, h: 55 },

  // Western Province (Along Lake Kivu, West)
  RUBAVU: { x: 120, y: 90, w: 80, h: 55 },
  NYABIHU: { x: 140, y: 155, w: 80, h: 55 },
  RUTSIRO: { x: 110, y: 220, w: 80, h: 60 },
  NGORORERO: { x: 200, y: 205, w: 80, h: 55 },
  KARONGI: { x: 110, y: 290, w: 85, h: 60 },
  NYAMASHEKE: { x: 80, y: 360, w: 85, h: 65 },
  RUSIZI: { x: 60, y: 435, w: 90, h: 65 },

  // Kigali City (Center)
  GASABO: { x: 385, y: 190, w: 75, h: 50 },
  NYARUGENGE: { x: 330, y: 220, w: 65, h: 45 },
  KICUKIRO: { x: 380, y: 245, w: 70, h: 48 },

  // Southern Province (South-Central)
  KAMONYI: { x: 290, y: 210, w: 75, h: 50 },
  MUHANGA: { x: 235, y: 270, w: 80, h: 55 },
  RUHANGO: { x: 260, y: 335, w: 80, h: 55 },
  NYANZA: { x: 280, y: 400, w: 80, h: 55 },
  HUYE: { x: 240, y: 460, w: 75, h: 50 },
  GISAGARA: { x: 325, y: 465, w: 80, h: 55 },
  NYAMAGABE: { x: 175, y: 370, w: 80, h: 60 },
  NYARUGURU: { x: 180, y: 440, w: 80, h: 60 },

  // Eastern Province (East)
  NYAGATARE: { x: 520, y: 50, w: 100, h: 75 },
  GATSIBO: { x: 515, y: 135, w: 95, h: 65 },
  KAYONZA: { x: 510, y: 210, w: 100, h: 70 },
  RWAMAGANA: { x: 455, y: 190, w: 75, h: 55 },
  NGOMA: { x: 470, y: 285, w: 85, h: 60 },
  KIREHE: { x: 565, y: 290, w: 95, h: 75 },
  BUGESERA: { x: 395, y: 310, w: 95, h: 75 },
};

export function DistrictGeographicMatrix({
  districts,
  auditRecords,
  selectedDistrictCode,
  selectedCommodity,
  locale,
  labels,
}: DistrictGeographicMatrixProps) {
  const [viewMode, setViewMode] = useState<"choropleth" | "deck">("choropleth");
  const [activeMetric, setActiveMetric] = useState<MapMetric>("residual");
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("all");

  // Map latest audit record by district
  const auditByDistrict = new Map<string, DistrictAuditRecord>();
  for (const rec of auditRecords) {
    if (!auditByDistrict.has(rec.district_code)) {
      auditByDistrict.set(rec.district_code, rec);
    }
  }

  // Tally classifications
  const tallies = {
    all: districts.length,
    leakage: 0,
    climate: 0,
    high: 0,
    nominal: 0,
  };

  for (const d of districts) {
    const rec = auditByDistrict.get(d.code);
    if (!rec) {
      tallies.nominal += 1;
      continue;
    }
    if (rec.classification === "LEAKAGE_OR_SEED_QUALITY_RISK") tallies.leakage += 1;
    else if (rec.classification === "CLIMATIC_OR_WATER_STRESS") tallies.climate += 1;
    else if (rec.classification === "HIGH_PERFORMING_INTENSIFICATION") tallies.high += 1;
    else tallies.nominal += 1;
  }

  // Active hover record
  const hoveredRecord = hoveredCode ? auditByDistrict.get(hoveredCode) : null;
  const hoveredDistrict = hoveredCode ? districts.find((d) => d.code === hoveredCode) : null;

  // Determine district fill color based on active metric
  const getDistrictColor = (code: string) => {
    const rec = auditByDistrict.get(code);
    if (!rec) return tokens.risk.unavailable;

    if (activeMetric === "residual") {
      if (rec.residual_z_score < -1.75) return tokens.risk.high; // Red: Leakage / Anomaly
      if (rec.residual_z_score < 0) return tokens.risk.moderate; // Harvest: Moderate Underperformance
      if (rec.residual_z_score > 1.25) return tokens.brand.canopy; // Dark Canopy: High Performing
      return tokens.risk.low; // Leaf: Nominal Expected
    }

    if (activeMetric === "climate") {
      const r = rec.rainfall_anomaly_ratio;
      if (r < 0.75) return tokens.risk.high; // Severe drought shock
      if (r < 0.90) return tokens.risk.moderate; // Moderate deficit
      if (r < 1.15) return tokens.risk.low; // Normal rainfall
      return tokens.brand.canopy; // Plentiful rain
    }

    if (activeMetric === "seeds") {
      const s = rec.improved_seed_pct;
      if (s < 20) return tokens.neutral.line; // Very low adoption
      if (s < 40) return tokens.brand.sprout; // Moderate
      if (s < 60) return tokens.risk.low; // Good adoption
      return tokens.brand.canopy; // High uptake (>60%)
    }

    return tokens.risk.low;
  };

  const provinces: ProvinceGroup[] = [
    "Kigali City",
    "Northern",
    "Southern",
    "Eastern",
    "Western",
  ];

  return (
    <section
      aria-labelledby="matrix-title"
      className="@container rounded-3xl border border-line bg-paper p-5 sm:p-7 shadow-sm"
    >
      {/* Top Header & View Mode Switcher */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-line/60 pb-4 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-canopy/10 px-3 py-0.5 text-xs font-bold text-canopy uppercase tracking-wider font-mono">
              30 Districts Spatial Intelligence
            </span>
            <span className="text-xs text-muted">· NISR SAS + CHIRPS Climate</span>
          </div>
          <h2 id="matrix-title" className="mt-1 text-2xl font-extrabold text-canopy">
            {labels.title}
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-muted">
            {labels.subtitle}
          </p>
        </div>

        {/* View Mode Switcher (Choropleth vs Deck) */}
        <div className="flex items-center gap-2 self-start md:self-auto bg-cream/60 p-1.5 rounded-2xl border border-line/80">
          <button
            type="button"
            onClick={() => setViewMode("choropleth")}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
              viewMode === "choropleth"
                ? "bg-canopy text-cream shadow-xs"
                : "text-muted hover:text-ink"
            }`}
          >
            <span>🗺️</span>
            <span>{locale === "rw" ? "Ikarita y'u Rwanda" : "Spatial Choropleth Map"}</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("deck")}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
              viewMode === "deck"
                ? "bg-canopy text-cream shadow-xs"
                : "text-muted hover:text-ink"
            }`}
          >
            <span>📋</span>
            <span>{locale === "rw" ? "Amakarita y'Intara" : "Province Deck"}</span>
          </button>
        </div>
      </div>

      {viewMode === "choropleth" ? (
        /* ==================== 1. INTERACTIVE SPATIAL CHOROPLETH MAP ==================== */
        <div className="flex flex-col gap-5">
          {/* Layer Toggle & Color Legend Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-line/80 bg-cream/30 p-3.5 text-xs">
            {/* Metric Layers Switcher */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-canopy uppercase tracking-wider text-[11px] font-mono mr-1">
                Active Layer:
              </span>
              <button
                type="button"
                onClick={() => setActiveMetric("residual")}
                className={`rounded-full px-3 py-1 font-bold transition-all cursor-pointer ${
                  activeMetric === "residual"
                    ? "bg-canopy text-cream shadow-2xs"
                    : "border border-line bg-paper text-ink hover:border-canopy"
                }`}
              >
                1. Harvest Performance Rating
              </button>
              <button
                type="button"
                onClick={() => setActiveMetric("climate")}
                className={`rounded-full px-3 py-1 font-bold transition-all cursor-pointer ${
                  activeMetric === "climate"
                    ? "bg-soil text-cream shadow-2xs"
                    : "border border-line bg-paper text-ink hover:border-soil"
                }`}
              >
                2. Rainfall &amp; Water Level
              </button>
              <button
                type="button"
                onClick={() => setActiveMetric("seeds")}
                className={`rounded-full px-3 py-1 font-bold transition-all cursor-pointer ${
                  activeMetric === "seeds"
                    ? "bg-leaf text-cream shadow-2xs"
                    : "border border-line bg-paper text-ink hover:border-leaf"
                }`}
              >
                3. Quality Seed Adoption %
              </button>
            </div>

            {/* Dynamic Swatch Legend */}
            <div className="flex items-center gap-2 font-mono text-[11px] tabular-nums text-muted self-end sm:self-auto">
              {activeMetric === "residual" && (
                <>
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-clay" /> Shortfall (Needs Check)</span>
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-harvest" /> Dry Spells</span>
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-canopy" /> Good / High Harvest</span>
                </>
              )}
              {activeMetric === "climate" && (
                <>
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-clay" /> &lt; 75% Drought</span>
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-harvest" /> 75–90% Dry Spell</span>
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-leaf" /> &gt; 90% Normal Rain</span>
                </>
              )}
              {activeMetric === "seeds" && (
                <>
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-stone-300" /> &lt; 20% Low</span>
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-leaf" /> 20–50% Moderate</span>
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-canopy" /> &gt; 50% High</span>
                </>
              )}
            </div>
          </div>

          {/* Choropleth SVG Canvas */}
          <div className="relative w-full overflow-hidden rounded-3xl border border-line bg-cream/20 p-4 sm:p-6 shadow-2xs">
            <svg
              viewBox="0 0 680 520"
              className="w-full h-auto select-none"
              role="img"
              aria-label="Interactive Rwanda 30-District Choropleth Map"
            >
              {/* Background Geographic Landmarks */}
              <text x="35" y="240" fill="#8a8f88" fontSize="13" fontWeight="bold" opacity="0.3" transform="rotate(-90, 35, 240)">
                LAKE KIVU (WEST)
              </text>
              <text x="590" y="200" fill="#8a8f88" fontSize="13" fontWeight="bold" opacity="0.3" transform="rotate(90, 590, 200)">
                AKAGERA / TANZANIA (EAST)
              </text>
              <text x="340" y="30" fill="#8a8f88" fontSize="12" fontWeight="bold" opacity="0.3" textAnchor="middle">
                UGANDA BORDER (NORTH)
              </text>
              <text x="340" y="510" fill="#8a8f88" fontSize="12" fontWeight="bold" opacity="0.3" textAnchor="middle">
                BURUNDI BORDER (SOUTH)
              </text>

              {/* 30 District Geographic Cells */}
              {districts.map((d) => {
                const coords = DISTRICT_COORDINATES[d.code] ?? { x: 340, y: 260, w: 75, h: 50 };
                const fill = getDistrictColor(d.code);
                const rec = auditByDistrict.get(d.code);
                const isHovered = hoveredCode === d.code;
                const isSelected = selectedDistrictCode === d.code;
                const isAnomaly = rec?.classification === "LEAKAGE_OR_SEED_QUALITY_RISK";

                return (
                  <g
                    key={d.code}
                    className="cursor-pointer transition-all duration-200"
                    onMouseEnter={() => setHoveredCode(d.code)}
                    onMouseLeave={() => setHoveredCode(null)}
                  >
                    {/* District Tile Rect with Rounded Geometry */}
                    <rect
                      x={coords.x}
                      y={coords.y}
                      width={coords.w}
                      height={coords.h}
                      rx="10"
                      ry="10"
                      fill={fill}
                      stroke={isSelected ? "#ffffff" : isHovered ? "#ffffff" : "#faf6ec"}
                      strokeWidth={isSelected ? "3" : isHovered ? "2.5" : "1.5"}
                      className="transition-all hover:opacity-90"
                    />

                    {/* Glowing Anomaly Beacon Ring for Leakage Districts */}
                    {isAnomaly && activeMetric === "residual" && (
                      <rect
                        x={coords.x - 3}
                        y={coords.y - 3}
                        width={coords.w + 6}
                        height={coords.h + 6}
                        rx="12"
                        ry="12"
                        fill="none"
                        stroke="#b5562e"
                        strokeWidth="2"
                        strokeDasharray="4 2"
                        className="animate-pulse"
                      />
                    )}

                    {/* District Name Label */}
                    <text
                      x={coords.x + coords.w / 2}
                      y={coords.y + coords.h / 2 - 4}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize={coords.w < 75 ? "9" : "10"}
                      fontWeight="bold"
                      fontFamily="sans-serif"
                      className="pointer-events-none drop-shadow-xs"
                    >
                      {d.code}
                    </text>

                    {/* Value Badge on Map */}
                    <text
                      x={coords.x + coords.w / 2}
                      y={coords.y + coords.h / 2 + 10}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="9"
                      fontFamily="monospace"
                      fontWeight="bold"
                      opacity="0.95"
                      className="pointer-events-none drop-shadow-xs tabular-nums"
                    >
                      {activeMetric === "residual" && rec
                        ? `${rec.residual_z_score > 0 ? "+" : ""}${rec.residual_z_score.toFixed(1)}σ`
                        : activeMetric === "climate" && rec
                        ? `${Math.round(rec.rainfall_anomaly_ratio * 100)}%`
                        : activeMetric === "seeds" && rec
                        ? `${rec.improved_seed_pct.toFixed(0)}%`
                        : ""}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Interactive Floating Hover Details Pill */}
            {hoveredRecord && hoveredDistrict && (
              <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-line bg-paper/95 p-4 shadow-md backdrop-blur-sm">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-extrabold text-canopy">
                      {locale === "rw" ? hoveredDistrict.nameRw : hoveredDistrict.nameEn} ({hoveredDistrict.code})
                    </span>
                    <span className="text-xs text-muted">· {hoveredDistrict.province}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        hoveredRecord.classification === "LEAKAGE_OR_SEED_QUALITY_RISK"
                          ? "bg-clay text-cream"
                          : hoveredRecord.classification === "CLIMATIC_OR_WATER_STRESS"
                          ? "bg-harvest text-soil"
                          : "bg-canopy text-cream"
                      }`}
                    >
                      {hoveredRecord.classification === "LEAKAGE_OR_SEED_QUALITY_RISK"
                        ? locale === "rw" ? "Gusuzuma Imbuto" : "Seed Quality Notice"
                        : hoveredRecord.classification === "CLIMATIC_OR_WATER_STRESS"
                        ? locale === "rw" ? "Izuba / Amapfa" : "Drought Impact"
                        : locale === "rw" ? "Umusaruro Usanzwe" : "Normal Harvest"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-ink">
                    {formatAssessmentReasoning(hoveredRecord.diagnostic_rationale, locale)}
                  </p>
                </div>

                <div className="flex items-center gap-3 font-mono text-xs tabular-nums self-end sm:self-auto">
                  <div className="text-right">
                    <span className="text-[10px] text-muted block uppercase">
                      {locale === "rw" ? "Amanota" : "Rating"}
                    </span>
                    <span className={`font-bold ${hoveredRecord.residual_z_score < -1.75 ? "text-clay" : "text-canopy"}`}>
                      {hoveredRecord.residual_z_score > 0
                        ? `+${hoveredRecord.residual_z_score.toFixed(1)}`
                        : hoveredRecord.residual_z_score.toFixed(1)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-muted block uppercase">
                      {locale === "rw" ? "Imvura" : "Rainfall"}
                    </span>
                    <span className="font-bold text-ink">
                      {(hoveredRecord.rainfall_anomaly_ratio * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-muted block uppercase">
                      {locale === "rw" ? "Imbuto" : "Seeds"}
                    </span>
                    <span className="font-bold text-ink">
                      {hoveredRecord.improved_seed_pct.toFixed(1)}%
                    </span>
                  </div>
                  {hoveredRecord.leakage_risk_flag && (
                    <Link
                      href={`/${locale}/alerts?district=${hoveredDistrict.code}&commodity=${selectedCommodity}`}
                      className="rounded-xl bg-clay px-3 py-1.5 text-xs font-bold text-cream hover:bg-clay/90 transition-colors shadow-xs"
                    >
                      Dispatch Audit →
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ==================== 2. DETAILED PROVINCE DECK VIEW ==================== */
        <div className="mt-4 flex flex-col gap-6">
          {/* Filter Pills */}
          <div
            role="radiogroup"
            aria-label="Filter districts by diagnostic audit state"
            className="flex flex-wrap gap-2 text-xs font-semibold"
          >
            <button
              type="button"
              onClick={() => setActiveFilter("all")}
              className={`rounded-full px-3.5 py-1.5 transition-all cursor-pointer ${
                activeFilter === "all"
                  ? "bg-canopy text-cream shadow-xs"
                  : "border border-line bg-cream/30 text-ink hover:border-canopy"
              }`}
            >
              {labels.allDistricts} ({tallies.all})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("leakage")}
              className={`rounded-full px-3.5 py-1.5 transition-all cursor-pointer ${
                activeFilter === "leakage"
                  ? "bg-clay text-cream shadow-xs"
                  : "border border-clay/30 bg-clay/10 text-clay hover:bg-clay/20"
              }`}
            >
              {labels.leakageFilter} ({tallies.leakage})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("high")}
              className={`rounded-full px-3.5 py-1.5 transition-all cursor-pointer ${
                activeFilter === "high"
                  ? "bg-leaf text-cream shadow-xs"
                  : "border border-leaf/30 bg-sprout/30 text-leaf hover:bg-sprout/50"
              }`}
            >
              {labels.intensificationFilter} ({tallies.high})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter("nominal")}
              className={`rounded-full px-3.5 py-1.5 transition-all cursor-pointer ${
                activeFilter === "nominal"
                  ? "bg-stone-700 text-cream shadow-xs"
                  : "border border-line bg-cream/30 text-muted hover:border-canopy"
              }`}
            >
              {labels.nominalFilter} ({tallies.nominal})
            </button>
          </div>

          {provinces.map((prov) => {
            const provDistricts = districts.filter(
              (d) =>
                d.province === prov &&
                (activeFilter === "all" ||
                  (activeFilter === "leakage" && auditByDistrict.get(d.code)?.classification === "LEAKAGE_OR_SEED_QUALITY_RISK") ||
                  (activeFilter === "high" && auditByDistrict.get(d.code)?.classification === "HIGH_PERFORMING_INTENSIFICATION") ||
                  (activeFilter === "nominal" && auditByDistrict.get(d.code)?.classification === "NOMINAL_EXPECTED_RANGE"))
            );
            if (provDistricts.length === 0) return null;

            return (
              <div key={prov} className="rounded-2xl border border-line/60 bg-cream/15 p-4 sm:p-5">
                <div className="flex items-center justify-between border-b border-line/40 pb-2.5 mb-3">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-soil">
                    {prov} Province / City
                  </h3>
                  <span className="text-xs text-muted font-mono font-medium">
                    {provDistricts.length} districts
                  </span>
                </div>

                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {provDistricts.map((d) => {
                    const rec = auditByDistrict.get(d.code);
                    const isSelected = selectedDistrictCode === d.code;
                    const districtName = locale === "rw" ? d.nameRw : d.nameEn;

                    let badgeColor = "bg-cream text-muted border-line";
                    let badgeText = labels.nominalBadge;
                    let zColor = "text-ink";

                    if (rec) {
                      if (rec.classification === "LEAKAGE_OR_SEED_QUALITY_RISK") {
                        badgeColor = "bg-clay/15 text-clay border-clay/30";
                        badgeText = labels.leakageBadge;
                        zColor = "text-clay font-bold";
                      } else if (rec.classification === "CLIMATIC_OR_WATER_STRESS") {
                        badgeColor = "bg-harvest/20 text-soil border-harvest/40";
                        badgeText = labels.climateBadge;
                        zColor = "text-soil font-semibold";
                      } else if (rec.classification === "HIGH_PERFORMING_INTENSIFICATION") {
                        badgeColor = "bg-sprout/40 text-canopy border-leaf/30";
                        badgeText = labels.highBadge;
                        zColor = "text-canopy font-semibold";
                      }
                    }

                    return (
                      <article
                        key={d.code}
                        className={`rounded-xl border p-3.5 transition-all ${
                          isSelected
                            ? "border-canopy bg-paper shadow-sm ring-2 ring-canopy/20"
                            : "border-line bg-paper/90 hover:border-canopy hover:shadow-2xs"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <h4 className="text-sm font-bold text-canopy">{districtName}</h4>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badgeColor}`}
                          >
                            {badgeText}
                          </span>
                        </div>

                        {rec ? (
                          <div className="mt-2.5 flex flex-col gap-1 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-muted">{labels.residualScore}:</span>
                              <span className={`font-mono tabular-nums ${zColor}`}>
                                {rec.residual_z_score > 0 ? "+" : ""}
                                {rec.residual_z_score.toFixed(2)} σ
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted">{labels.yieldLabel}:</span>
                              <span className="font-mono text-ink tabular-nums">
                                {rec.observed_yield_kg_per_ha.toFixed(0)} kg/ha
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-muted">
                              <span>Rainfall ratio:</span>
                              <span className="font-mono tabular-nums">
                                {(rec.rainfall_anomaly_ratio * 100).toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
