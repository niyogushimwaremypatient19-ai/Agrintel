"""
District risk signals from approved district-level market prices.

Rule "market_price_pressure" v1.0.0
  - Needs at least 6 months of approved prices for a district and crop.
  - Compares the average of the last 3 months with the 3 months before them.
  - Rise of 10% or more -> moderate. Rise of 20% or more -> high. Otherwise -> low.

This is a MARKET signal only. It does not measure weather, soil or production,
because those datasets are not yet connected. The dashboard says so.

Writes to risk_signals (one current row per district and crop). The driver is stored
as a small JSON document so the web app can explain it in English or Kinyarwanda
from the numbers, instead of storing a sentence in one language.

Usage (from the project root):
  python pipeline/risk_signals.py --dry-run
  python pipeline/risk_signals.py
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections import defaultdict
from datetime import date, datetime, timezone
from pathlib import Path

import pandas as pd
import psycopg
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).resolve().parent))
from run_price_forecast import month_bounds  # noqa: E402

RULE = "market_price_pressure"
RULE_VERSION = "1.0.0"
PRICE_METRIC = "price_rwf_per_kg"
MIN_MONTHS = 6
WINDOW_MONTHS = 9  # the rule looks at the last 9 calendar months, where reports can have gaps
MAX_MONTHS_OLD = 4  # the latest month must be no more than this many months before the run date
MODERATE_RISE = 0.10
HIGH_RISE = 0.20


def price_change(monthly_values: list[float]) -> float | None:
    """Fractional change of the last 3 months against the 3 before. None if not enough history."""
    if len(monthly_values) < MIN_MONTHS:
        return None
    recent = sum(monthly_values[-3:]) / 3
    previous = sum(monthly_values[-6:-3]) / 3
    if previous == 0:
        return None
    return (recent - previous) / previous


def classify(change: float | None) -> str:
    if change is None:
        return "unavailable"
    if change >= HIGH_RISE:
        return "high"
    if change >= MODERATE_RISE:
        return "moderate"
    return "low"


def load_approved_district_prices(conn: psycopg.Connection) -> pd.DataFrame:
    query = """
        SELECT o.district_code,
               o.commodity_code,
               o.period_start,
               o.value,
               o.data_status,
               o.import_id
        FROM observations o
        JOIN raw_imports r ON r.id = o.import_id
        WHERE o.metric_code = %s
          AND o.district_code IS NOT NULL
          AND o.commodity_code IS NOT NULL
          AND r.status = 'approved'
          AND (o.data_status <> 'sample' OR NOT EXISTS (
                SELECT 1 FROM observations x
                WHERE x.commodity_code = o.commodity_code
                  AND x.metric_code = o.metric_code
                  AND x.data_status <> 'sample'))
    """
    with conn.cursor() as cur:
        cur.execute(query, (PRICE_METRIC,))
        rows = cur.fetchall()
    return pd.DataFrame(rows, columns=["district_code", "commodity_code", "period_start", "value", "data_status", "import_id"])


def month_index(period: pd.Period) -> int:
    return period.year * 12 + period.month


def build_signals(df: pd.DataFrame, as_of: date) -> list[dict]:
    """
    One result per district and crop that has a current, unbroken history. Pure function, easy to test.
    Rule: take the last WINDOW_MONTHS calendar months ending at the latest observed month.
    Publish only if the window holds at least MIN_MONTHS observed months and the latest
    observation is no more than MAX_MONTHS_OLD months before as_of (stale data is never shown).
    The change compares the latest three observed months with the three observed months before them.
    """
    if df.empty:
        return []

    df = df.copy()
    df["period_start"] = pd.to_datetime(df["period_start"])
    df["value"] = df["value"].astype(float)
    df["month"] = df["period_start"].dt.to_period("M")

    results = []
    for (district, commodity), group in df.groupby(["district_code", "commodity_code"]):
        monthly = group.groupby("month").agg(value=("value", "mean")).sort_index()
        values = monthly["value"].tolist()
        change = price_change(values)
        if change is None:
            continue

        latest_index = month_index(monthly.index[-1])
        if (as_of.year * 12 + as_of.month) - latest_index > MAX_MONTHS_OLD:
            continue  # stale: the latest data is too old to describe the market now

        in_window = [m for m in monthly.index if latest_index - month_index(m) < WINDOW_MONTHS]
        monthly = monthly.loc[in_window]
        values = monthly["value"].tolist()
        change = price_change(values)
        if change is None:
            continue  # fewer than MIN_MONTHS observed months in the window

        last_month = monthly.index[-1]
        first_month = monthly.index[0]
        period_start, _ = month_bounds(first_month.year, first_month.month)
        _, period_end = month_bounds(last_month.year, last_month.month)

        recent_avg = sum(values[-3:]) / 3
        previous_avg = sum(values[-6:-3]) / 3
        based_on_sample = bool((group["data_status"] == "sample").any())

        driver = {
            "rule": RULE,
            "ruleVersion": RULE_VERSION,
            "changePct": round(change, 4),
            "recentAverage": round(recent_avg, 2),
            "previousAverage": round(previous_avg, 2),
            "months": int(len(values)),
            "basedOnSample": based_on_sample,
            "importIds": sorted(int(i) for i in group["import_id"].unique()),
        }

        results.append(
            {
                "district_code": district,
                "commodity_code": commodity,
                "period_start": period_start,
                "period_end": period_end,
                "category": classify(change),
                "driver_summary": json.dumps(driver),
            }
        )
    return results


def run(dry_run: bool, as_of: date) -> None:
    load_dotenv(".env.local")
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise SystemExit("DATABASE_URL is not set. Add it to .env.local.")

    with psycopg.connect(database_url) as conn:
        df = load_approved_district_prices(conn)
        signals = build_signals(df, as_of)

        if not signals:
            print("No district has enough approved price history for a signal yet. Database unchanged.")
            return

        for s in signals:
            driver = json.loads(s["driver_summary"])
            print(f"{s['district_code']:<12} {s['commodity_code']:<14} {s['category']:<9} change={driver['changePct']:+.1%}")

        if dry_run:
            print("Dry run: nothing was written.")
            return

        now = datetime.now(timezone.utc)
        with conn.transaction():
            with conn.cursor() as cur:
                # Each run replaces the whole current set, so stale signals from earlier runs stop showing
                cur.execute("UPDATE risk_signals SET is_current = false WHERE is_current = true")
                for s in signals:
                    cur.execute(
                        """
                        INSERT INTO risk_signals
                          (district_code, commodity_code, period_start, period_end,
                           category, driver_summary, is_current, created_at)
                        VALUES (%s, %s, %s, %s, %s, %s, true, %s)
                        """,
                        (
                            s["district_code"],
                            s["commodity_code"],
                            s["period_start"],
                            s["period_end"],
                            s["category"],
                            s["driver_summary"],
                            now,
                        ),
                    )

                cur.execute(
                    """
                    INSERT INTO audit_log (action, entity_type, entity_id, payload, created_at)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (
                        "risk_signals_refreshed",
                        "risk_run",
                        now.isoformat(),
                        json.dumps({"rule": RULE, "ruleVersion": RULE_VERSION, "signals": len(signals)}),
                        now,
                    ),
                )

        print(f"Committed {len(signals)} risk signal(s).")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--as-of", type=date.fromisoformat, default=date.today(),
                        help="Date the signals describe, YYYY-MM-DD. Default: today.")
    args = parser.parse_args()
    run(dry_run=args.dry_run, as_of=args.as_of)


if __name__ == "__main__":
    main()
