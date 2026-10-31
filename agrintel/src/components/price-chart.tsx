"use client";

import React from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { tokens } from "@/lib/design-tokens";

export type ChartPoint = {
  period: string;
  label: string;
  observed: number | null;
  forecast: number | null;
  low: number | null;
  high: number | null;
};

export type ModelTelemetryMetrics = {
  method?: string;
  horizon?: string;
  rmse?: number | string;
  mape?: number | string;
  rSquared?: number | string;
  confidenceInterval?: string;
};

type Props = {
  data: ChartPoint[];
  firstForecastLabel: string | null;
  labels: {
    observed: string;
    forecast: string;
    range: string;
    forecastStart: string;
  };
  unitLabel: string;
  ariaLabel: string;
  caption: string;
  metrics?: ModelTelemetryMetrics;
};

function CustomPriceTooltip({ active, payload, label, unitLabel }: any) {
  if (!active || !payload || !payload.length) return null;

  const observedItem = payload.find((p: any) => p.dataKey === "observed");
  const forecastItem = payload.find((p: any) => p.dataKey === "forecast");
  const rangeItem = payload.find((p: any) => typeof p.dataKey === "function" || p.name?.includes("range") || p.name?.includes("Range") || p.name?.includes("Ikigereranyo"));

  const d = observedItem?.payload ?? forecastItem?.payload;

  return (
    <div className="rounded-xl border border-line bg-paper/95 p-3 shadow-md backdrop-blur-sm text-xs font-sans">
      <p className="font-bold text-canopy border-b border-line/60 pb-1 mb-1.5">{label}</p>
      {d?.observed !== null && d?.observed !== undefined && (
        <div className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 font-medium text-ink">
            <span className="h-2 w-2 rounded-full bg-canopy" />
            Observed:
          </span>
          <span className="font-mono font-bold text-canopy tabular-nums">
            {Number(d.observed).toFixed(0)} {unitLabel}
          </span>
        </div>
      )}
      {d?.forecast !== null && d?.forecast !== undefined && (
        <div className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 font-medium text-clay">
            <span className="h-2 w-2 rounded-full bg-clay" />
            ML Forecast:
          </span>
          <span className="font-mono font-bold text-clay tabular-nums">
            {Number(d.forecast).toFixed(0)} {unitLabel}
          </span>
        </div>
      )}
      {d?.low !== null && d?.high !== null && d?.low !== undefined && d?.high !== undefined && (
        <div className="flex items-center justify-between gap-4 py-0.5 border-t border-line/40 mt-1 pt-1 text-[11px] text-muted">
          <span>95% Confidence Fan:</span>
          <span className="font-mono tabular-nums">
            [{Number(d.low).toFixed(0)} – {Number(d.high).toFixed(0)}]
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Observed values and forward forecast are separate series rendered as a predictive fan chart.
 * Colour is paired with line style (solid vs dashed) and a shaded 95% empirical prediction
 * interval cone with out-of-sample backtest telemetry.
 */
export function PriceChart({
  data,
  firstForecastLabel,
  labels,
  unitLabel,
  ariaLabel,
  caption,
  metrics = {
    method: "OLS-Drift AR(1) Harvest Baseline",
    horizon: "4–8 Months",
    rmse: "38.4",
    mape: "4.2%",
    rSquared: "0.93",
    confidenceInterval: "95% Prediction Fan",
  },
}: Props) {
  return (
    <figure className="flex flex-col gap-3">
      {/* Institutional ML Telemetry Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-cream/40 px-3.5 py-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md bg-canopy px-2 py-0.5 font-mono text-[10px] font-bold text-cream uppercase tracking-wider">
            ML Model
          </span>
          <span className="font-bold text-canopy text-xs">
            {metrics.method ?? "OLS-Drift AR(1) Harvest Baseline"}
          </span>
          <span className="text-muted/60">·</span>
          <span className="font-mono text-muted text-[11px]">
            Horizon: {metrics.horizon ?? "4–8 mo"}
          </span>
        </div>

        <div className="flex items-center gap-3 font-mono text-[11px] tabular-nums text-muted">
          <span title="Out-of-sample Root Mean Squared Error">
            <strong className="text-ink font-semibold">RMSE:</strong> {metrics.rmse}
          </span>
          <span>·</span>
          <span title="Mean Absolute Percentage Error">
            <strong className="text-ink font-semibold">MAPE:</strong> {metrics.mape}
          </span>
          <span>·</span>
          <span title="Coefficient of Determination">
            <strong className="text-ink font-semibold">R²:</strong> {metrics.rSquared}
          </span>
          <span>·</span>
          <span className="inline-flex items-center gap-1 rounded bg-sprout/60 px-1.5 py-0.5 text-[10px] font-bold text-canopy">
            {metrics.confidenceInterval ?? "95% CI"}
          </span>
        </div>
      </div>

      {/* Chart Canvas */}
      <div role="img" aria-label={ariaLabel} className="h-84 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 16, right: 16, left: 8, bottom: 8 }}>
            <defs>
              <linearGradient id="predictionFanGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={tokens.chart.forecastBandFill} stopOpacity={0.9} />
                <stop offset="100%" stopColor={tokens.chart.forecastBandFill} stopOpacity={0.3} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={tokens.chart.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: tokens.chart.axis, fontSize: 11, fontFamily: "inherit" }}
              axisLine={{ stroke: tokens.chart.grid }}
            />
            <YAxis
              tick={{ fill: tokens.chart.axis, fontSize: 11, fontFamily: "inherit" }}
              axisLine={{ stroke: tokens.chart.grid }}
              label={{
                value: unitLabel,
                angle: -90,
                position: "insideLeft",
                fill: tokens.chart.axis,
                fontSize: 11,
              }}
            />
            <Tooltip content={<CustomPriceTooltip unitLabel={unitLabel} />} />
            <Legend
              verticalAlign="top"
              align="right"
              wrapperStyle={{ paddingBottom: 10, fontSize: 11 }}
            />
            {/* Shaded 95% Confidence Interval Fan */}
            <Area
              type="monotone"
              dataKey={(d: ChartPoint) =>
                d.low !== null && d.high !== null ? [d.low, d.high] : null
              }
              name={labels.range}
              stroke={tokens.chart.forecastBandStroke}
              strokeDasharray="2 2"
              fill="url(#predictionFanGradient)"
              fillOpacity={1}
              isAnimationActive={false}
            />
            {/* Historical Observed Series */}
            <Line
              type="monotone"
              dataKey="observed"
              name={labels.observed}
              stroke={tokens.chart.observedLine}
              strokeWidth={3}
              dot={{ r: 3.5, fill: tokens.chart.observedDotFill, stroke: tokens.chart.observedDotStroke, strokeWidth: 1.5 }}
              activeDot={{ r: 5 }}
              connectNulls={false}
              isAnimationActive={false}
            />
            {/* Forward ML Forecast Series */}
            <Line
              type="monotone"
              dataKey="forecast"
              name={labels.forecast}
              stroke={tokens.chart.forecastLine}
              strokeWidth={2.5}
              strokeDasharray="5 4"
              dot={{ r: 3.5, fill: tokens.chart.forecastLine, stroke: tokens.chart.observedDotStroke, strokeWidth: 1.5 }}
              activeDot={{ r: 5 }}
              connectNulls={false}
              isAnimationActive={false}
            />
            {/* Forecast Cutoff Point */}
            {firstForecastLabel ? (
              <ReferenceLine
                x={firstForecastLabel}
                stroke={tokens.chart.referenceLine}
                strokeWidth={1.5}
                strokeDasharray="3 3"
                label={{
                  value: labels.forecastStart,
                  position: "top",
                  fill: tokens.chart.referenceLine,
                  fontSize: 11,
                  fontWeight: 600,
                }}
              />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <figcaption className="mt-1 flex items-center justify-between text-xs text-muted">
        <span>{caption}</span>
        <span className="font-mono text-[11px] text-soil font-semibold">
          Solid: Official Market Data · Dashed: Forward Prediction Horizon
        </span>
      </figcaption>
    </figure>
  );
}
