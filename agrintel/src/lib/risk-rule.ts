/**
 * Mirrors the rule in pipeline/risk_signals.py (market_price_pressure v1.0.0).
 * Keep the thresholds identical; the Python tests cover the same values.
 */

export const RISK_RULE = "market_price_pressure";
export const RISK_RULE_VERSION = "1.0.0";
export const MIN_MONTHS = 6;
export const MODERATE_RISE = 0.1;
export const HIGH_RISE = 0.2;

export type PressureCategory = "low" | "moderate" | "high" | "unavailable";

/** Last 3 months against the 3 before. Null when there is not enough history. */
export function priceChange(monthlyValues: number[]): number | null {
  if (monthlyValues.length < MIN_MONTHS) return null;
  const recent = monthlyValues.slice(-3);
  const previous = monthlyValues.slice(-6, -3);
  const previousAverage = previous.reduce((s, v) => s + v, 0) / 3;
  if (previousAverage === 0) return null;
  const recentAverage = recent.reduce((s, v) => s + v, 0) / 3;
  return (recentAverage - previousAverage) / previousAverage;
}

export function classifyChange(change: number | null): PressureCategory {
  if (change === null) return "unavailable";
  if (change >= HIGH_RISE) return "high";
  if (change >= MODERATE_RISE) return "moderate";
  return "low";
}

/** Maps a signal category to the alert severity used in the alerts table. */
export function severityFor(category: PressureCategory): "info" | "watch" | "warning" {
  if (category === "high") return "warning";
  if (category === "moderate") return "watch";
  return "info";
}
