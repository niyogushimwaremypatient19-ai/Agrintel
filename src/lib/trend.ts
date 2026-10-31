/**
 * Turns observed prices into monthly averages and a plain-language trend.
 * Pure business logic kept modular, testable, and deterministic.
 */

export type MonthlyPoint = {
  /** "YYYY-MM" */
  period: string;
  average: number;
  count: number;
};

export type TrendStatus = "rising" | "stable" | "easing" | "insufficient";

export type Trend = {
  status: TrendStatus;
  /** Fractional change, e.g. 0.08 means +8%. Null when there is not enough data. */
  changePct: number | null;
};

/** Minimum months of observed prices before a trend is described. */
export const MIN_MONTHS_FOR_TREND = 6;

/** Changes within plus or minus 5% count as stable. */
export const TREND_THRESHOLD = 0.05;

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Averages daily or per-market rows into one value per calendar month. */
export function monthlyAverages(rows: { periodStart: string; value: number }[]): MonthlyPoint[] {
  const buckets = new Map<string, { sum: number; count: number }>();

  for (const row of rows) {
    const period = row.periodStart.slice(0, 7);
    const bucket = buckets.get(period) ?? { sum: 0, count: 0 };
    bucket.sum += row.value;
    bucket.count += 1;
    buckets.set(period, bucket);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, bucket]) => ({
      period,
      average: round2(bucket.sum / bucket.count),
      count: bucket.count,
    }));
}

/**
 * Compares the last 3 months with the 3 months before them.
 * Returns "insufficient" rather than guessing when there is too little history.
 */
export function calculateTrend(points: MonthlyPoint[]): Trend {
  if (points.length < MIN_MONTHS_FOR_TREND) {
    return { status: "insufficient", changePct: null };
  }

  const recent = points.slice(-3).map((p) => p.average);
  const previous = points.slice(-6, -3).map((p) => p.average);
  const previousAverage = mean(previous);

  if (previousAverage === 0) {
    return { status: "insufficient", changePct: null };
  }

  const changePct = (mean(recent) - previousAverage) / previousAverage;

  let status: TrendStatus = "stable";
  if (changePct > TREND_THRESHOLD) status = "rising";
  else if (changePct < -TREND_THRESHOLD) status = "easing";

  return { status, changePct: Math.round(changePct * 1000) / 1000 };
}
