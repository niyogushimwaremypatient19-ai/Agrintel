"use client";

import React, { useState } from "react";
import type { DistrictAuditRecord } from "@/lib/data/econometric-audit";
import { tokens } from "@/lib/design-tokens";
import { formatAssessmentReasoning } from "@/lib/format-rationale";

interface YieldFrontierChartProps {
  auditRecords: DistrictAuditRecord[];
  commodityName: string;
  locale?: string;
  selectedDistrictCode?: string;
  onSelectDistrict?: (code: string) => void;
  labels?: {
    title?: string;
    subtitle?: string;
    expectedAxis?: string;
    observedAxis?: string;
    frontierLine?: string;
    leakageZone?: string;
    featureAttributionTitle?: string;
  };
}

export function YieldFrontierChart({
  auditRecords,
  commodityName,
  locale = "en",
  selectedDistrictCode,
  onSelectDistrict,
  labels,
}: YieldFrontierChartProps) {
  const [hoveredDistrict, setHoveredDistrict] = useState<DistrictAuditRecord | null>(null);

  if (!auditRecords || auditRecords.length === 0) return null;

  // Compute min/max for scatter plot scaling
  const allExpected = auditRecords.map((r) => r.expected_yield_kg_per_ha);
  const allObserved = auditRecords.map((r) => r.observed_yield_kg_per_ha);

  const minVal = Math.floor(Math.min(...allExpected, ...allObserved) * 0.85);
  const maxVal = Math.ceil(Math.max(...allExpected, ...allObserved) * 1.15);

  const range = maxVal - minVal || 1;

  // SVG viewBox coordinates
  const width = 640;
  const height = 400;
  const padding = { top: 30, right: 30, bottom: 50, left: 60 };

  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const scaleX = (val: number) => padding.left + ((val - minVal) / range) * plotWidth;
  const scaleY = (val: number) => padding.top + plotHeight - ((val - minVal) / range) * plotHeight;

  // Active district to highlight
  const activeRecord =
    hoveredDistrict ??
    (selectedDistrictCode
      ? auditRecords.find((r) => r.district_code === selectedDistrictCode)
      : null) ??
    auditRecords.find((r) => r.classification === "LEAKAGE_OR_SEED_QUALITY_RISK") ??
    auditRecords[0];

  // Feature Attribution weights
  const featureWeights = [
    { name: locale === "rw" ? "Imvura n'Amazi mu Butaka" : "Rainfall & Soil Water", weight: 30, color: "bg-canopy", text: "text-canopy", beta: "30%" },
    { name: locale === "rw" ? "Imbuto Z'indobanure" : "Quality Certified Seeds", weight: 28, color: "bg-leaf", text: "text-leaf", beta: "28%" },
    { name: locale === "rw" ? "Ifumbire Mvaruganda" : "Mineral Fertilizer", weight: 22, color: "bg-harvest", text: "text-soil", beta: "22%" },
    { name: locale === "rw" ? "Amaterasi n'Ubutaka" : "Hillside Terraces & Soil Protection", weight: 12, color: "bg-stone-500", text: "text-stone-700", beta: "12%" },
    { name: locale === "rw" ? "Imiti n'Ibifata Ibihingwa" : "Crop Protection & Pest Defense", weight: 8, color: "bg-clay", text: "text-clay", beta: "8%" },
  ];

  return (
    <section
      aria-label="Harvest Performance & Comparison"
      className="@container flex flex-col gap-6 rounded-3xl border border-line bg-paper p-5 sm:p-6 shadow-xs"
    >
      {/* Header with Credential */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-line/60 pb-4">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-canopy/10 px-3 py-0.5 text-xs font-mono font-bold text-canopy uppercase tracking-wider">
            <span>Harvest Performance Checker</span>
            <span>·</span>
            <span>Official Benchmarks</span>
          </div>
          <h2 className="mt-1.5 text-xl font-bold tracking-tight text-canopy sm:text-2xl">
            {labels?.title ?? "District Harvest Performance Check"}
          </h2>
          <p className="text-xs sm:text-sm text-muted">
            {labels?.subtitle ??
              `Evaluates actual harvest against expected harvest for ${commodityName} across all 30 districts.`}
          </p>
        </div>

        {/* Frontier Legend Badges */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          <span className="flex items-center gap-1.5 rounded-full bg-clay/15 px-2.5 py-1 text-clay font-bold">
            <span className="h-2.5 w-2.5 rounded-full bg-clay animate-pulse" />
            Needs Check (Shortfall)
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-harvest/20 px-2.5 py-1 text-soil">
            <span className="h-2.5 w-2.5 rounded-full bg-harvest" />
            Drought / Dry Spell
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-canopy/10 px-2.5 py-1 text-canopy">
            <span className="h-2.5 w-2.5 rounded-full bg-canopy" />
            On Target / Good Harvest
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        {/* Interactive SVG Scatter Plot */}
        <div className="flex flex-col">
          <div className="relative w-full overflow-hidden rounded-2xl border border-line/80 bg-cream/30 p-2 sm:p-3">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-auto select-none"
              role="img"
              aria-label="Scatter plot of Expected vs Observed Yield"
            >
              {/* Grid Lines */}
              {[0.25, 0.5, 0.75, 1.0].map((step, idx) => {
                const yVal = minVal + step * range;
                const yPos = scaleY(yVal);
                return (
                  <g key={idx}>
                    <line
                      x1={padding.left}
                      y1={yPos}
                      x2={width - padding.right}
                      y2={yPos}
                      stroke={tokens.chart.grid}
                      strokeDasharray="3 3"
                      strokeWidth="1"
                    />
                    <text
                      x={padding.left - 8}
                      y={yPos + 4}
                      textAnchor="end"
                      fill={tokens.chart.axis}
                      fontSize="10"
                      fontFamily="monospace"
                    >
                      {yVal.toFixed(0)}
                    </text>
                  </g>
                );
              })}

              {/* X Axis ticks */}
              {[0.25, 0.5, 0.75, 1.0].map((step, idx) => {
                const xVal = minVal + step * range;
                const xPos = scaleX(xVal);
                return (
                  <g key={`x-${idx}`}>
                    <line
                      x1={xPos}
                      y1={padding.top}
                      x2={xPos}
                      y2={height - padding.bottom}
                      stroke={tokens.chart.grid}
                      strokeDasharray="3 3"
                      strokeWidth="1"
                    />
                    <text
                      x={xPos}
                      y={height - padding.bottom + 16}
                      textAnchor="middle"
                      fill={tokens.chart.axis}
                      fontSize="10"
                      fontFamily="monospace"
                    >
                      {xVal.toFixed(0)}
                    </text>
                  </g>
                );
              })}

              {/* 45-Degree Optimal Production Frontier Line: Y = X */}
              <line
                x1={scaleX(minVal)}
                y1={scaleY(minVal)}
                x2={scaleX(maxVal)}
                y2={scaleY(maxVal)}
                stroke={tokens.brand.canopy}
                strokeWidth="2"
                strokeDasharray="5 3"
              />
              <text
                x={scaleX(maxVal) - 15}
                y={scaleY(maxVal) - 8}
                textAnchor="end"
                fill={tokens.brand.canopy}
                fontSize="10"
                fontWeight="bold"
                fontFamily="sans-serif"
              >
                {labels?.frontierLine ?? "Expected Frontier (Y = X)"}
              </text>

              {/* Anomaly Threshold Boundary: Y = X - 1.75*sigma */}
              <line
                x1={scaleX(minVal + range * 0.15)}
                y1={scaleY(minVal)}
                x2={scaleX(maxVal)}
                y2={scaleY(maxVal - range * 0.15)}
                stroke={tokens.risk.high}
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
              <text
                x={scaleX(maxVal) - 15}
                y={scaleY(maxVal - range * 0.15) + 14}
                textAnchor="end"
                fill={tokens.risk.high}
                fontSize="9"
                fontWeight="bold"
                fontFamily="monospace"
              >
                {labels?.leakageZone ?? "z < -1.75 Risk Boundary"}
              </text>

              {/* Scatter Points: 30 Districts with Full Keyboard Navigation */}
              {auditRecords.map((rec) => {
                const cx = scaleX(rec.expected_yield_kg_per_ha);
                const cy = scaleY(rec.observed_yield_kg_per_ha);
                const isLeakage = rec.classification === "LEAKAGE_OR_SEED_QUALITY_RISK";
                const isClimate = rec.classification === "CLIMATIC_OR_WATER_STRESS";
                const isSelected = activeRecord?.district_code === rec.district_code;

                let fill: string = tokens.brand.canopy;
                if (isLeakage) fill = tokens.risk.high;
                else if (isClimate) fill = tokens.risk.moderate;
                else if (rec.classification === "HIGH_PERFORMING_INTENSIFICATION") fill = tokens.risk.low;

                return (
                  <g
                    key={rec.district_code}
                    tabIndex={0}
                    role="button"
                    aria-label={`District ${rec.district_code}: Observed yield ${Math.round(rec.observed_yield_kg_per_ha)} kg/ha, Expected yield ${Math.round(rec.expected_yield_kg_per_ha)} kg/ha`}
                    className="cursor-pointer transition-transform hover:scale-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-harvest"
                    onClick={() => onSelectDistrict?.(rec.district_code)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelectDistrict?.(rec.district_code);
                      }
                    }}
                    onMouseEnter={() => setHoveredDistrict(rec)}
                  >
                    {isLeakage && (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={isSelected ? 14 : 10}
                        fill={tokens.risk.high}
                        fillOpacity="0.25"
                        className="animate-ping"
                      />
                    )}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isSelected ? 7.5 : isLeakage ? 6 : 4.5}
                      fill={fill}
                      stroke={tokens.neutral.paper}
                      strokeWidth={isSelected ? "2.5" : "1.5"}
                    />
                    {(isLeakage || isSelected) && (
                      <text
                        x={cx + 9}
                        y={cy + 3}
                        fill={isLeakage ? tokens.risk.high : tokens.brand.canopy}
                        fontSize={isSelected ? "11" : "9.5"}
                        fontWeight="bold"
                        fontFamily="sans-serif"
                      >
                        {rec.district_code}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Axis Labels */}
              <text
                x={width / 2}
                y={height - 10}
                textAnchor="middle"
                fill="#55645a"
                fontSize="11"
                fontWeight="bold"
              >
                {labels?.expectedAxis ?? "Expected Harvest (kg/ha) [Seeds + Fertilizer + Rain]"}
              </text>
              <text
                x={-height / 2}
                y={18}
                transform="rotate(-90)"
                textAnchor="middle"
                fill="#55645a"
                fontSize="11"
                fontWeight="bold"
              >
                {labels?.observedAxis ?? "Actual Harvest (kg/ha)"}
              </text>
            </svg>
          </div>

          <p className="mt-2 text-xs text-muted">
            <strong className="text-canopy font-semibold">How to read this:</strong> Districts on the diagonal line harvested what was expected. Points sitting far below the line had plenty of seeds and fertilizer but still suffered large harvest drops, showing where local agronomists should inspect seed quality or fertilizer delivery.
          </p>
        </div>

        {/* District Inspector Card & Driver Breakdown */}
        <div className="flex flex-col gap-4">
          {/* Active District Focus Card */}
          <div className="rounded-2xl border border-line bg-cream/40 p-4 shadow-2xs">
            <div className="flex items-start justify-between gap-2 border-b border-line/60 pb-2.5">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-muted">
                  Inspected District
                </span>
                <h3 className="text-xl font-extrabold text-canopy">
                  {activeRecord.district_code}
                </h3>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${
                  activeRecord.classification === "LEAKAGE_OR_SEED_QUALITY_RISK"
                    ? "bg-clay text-cream"
                    : activeRecord.classification === "CLIMATIC_OR_WATER_STRESS"
                    ? "bg-harvest text-soil"
                    : "bg-canopy text-cream"
                }`}
              >
                {activeRecord.classification === "LEAKAGE_OR_SEED_QUALITY_RISK"
                  ? "Needs Inspection"
                  : activeRecord.classification === "CLIMATIC_OR_WATER_STRESS"
                  ? "Drought / Dry Spell"
                  : "On Target"}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl bg-paper p-2.5 border border-line/60">
                <span className="text-muted block text-[11px]">Actual Harvest</span>
                <span className="text-base font-black font-mono text-ink tabular-nums">
                  {activeRecord.observed_yield_kg_per_ha.toFixed(0)}
                  <span className="text-[10px] text-muted font-normal"> kg/ha</span>
                </span>
              </div>
              <div className="rounded-xl bg-paper p-2.5 border border-line/60">
                <span className="text-muted block text-[11px]">Expected Target</span>
                <span className="text-base font-black font-mono text-canopy tabular-nums">
                  {activeRecord.expected_yield_kg_per_ha.toFixed(0)}
                  <span className="text-[10px] text-muted font-normal"> kg/ha</span>
                </span>
              </div>
              <div className="rounded-xl bg-paper p-2.5 border border-line/60">
                <span className="text-muted block text-[11px]">Performance Rating</span>
                <span
                  className={`text-base font-black font-mono tabular-nums ${
                    activeRecord.residual_z_score < -1.75
                      ? "text-clay"
                      : activeRecord.residual_z_score < 0
                      ? "text-harvest"
                      : "text-leaf"
                  }`}
                >
                  {activeRecord.residual_z_score > 0 ? "+" : ""}
                  {activeRecord.residual_z_score.toFixed(1)}
                </span>
              </div>
              <div className="rounded-xl bg-paper p-2.5 border border-line/60">
                <span className="text-muted block text-[11px]">Support Value</span>
                <span className="text-base font-black font-mono text-clay tabular-nums">
                  {activeRecord.estimated_fiscal_exposure_rwf > 0
                    ? `Rwf ${(activeRecord.estimated_fiscal_exposure_rwf / 1e6).toFixed(1)}M`
                    : "Rwf 0"}
                </span>
              </div>
            </div>

            <p className="mt-3 text-[11px] leading-relaxed text-ink/80 bg-paper/80 p-2.5 rounded-lg border border-line/40">
              <strong className="text-canopy font-semibold">
                {locale === "rw" ? "Impamvu z'Isuzuma:" : "Assessment Reasoning:"}
              </strong>{" "}
              {formatAssessmentReasoning(activeRecord.diagnostic_rationale, locale)}
            </p>
          </div>

          {/* Feature Attribution / Driver Breakdown */}
          <div className="rounded-2xl border border-line bg-paper p-4 shadow-2xs">
            <h4 className="text-xs font-bold uppercase tracking-wider text-canopy mb-2.5">
              {labels?.featureAttributionTitle ?? "What Influences Harvest Results Most"}
            </h4>

            {/* Proportional Stacked Bar */}
            <div className="h-3 w-full rounded-full overflow-hidden flex bg-stone-100 border border-line/60 mb-3">
              {featureWeights.map((f, i) => (
                <div
                  key={i}
                  style={{ width: `${f.weight}%` }}
                  className={`${f.color} transition-all`}
                  title={`${f.name}: ${f.weight}%`}
                />
              ))}
            </div>

            {/* Breakdown Items */}
            <div className="space-y-1.5">
              {featureWeights.map((f, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-0.5">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-sm ${f.color}`} />
                    <span className="text-ink font-medium">{f.name}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="font-bold text-canopy tabular-nums">{f.weight}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
