"""
Refreshes national monthly price forecasts in Neon.

Reads approved observations only, runs the documented baseline in forecast_core.py,
and writes to the tables defined in src/db/schema.ts:
  - forecasts               (new current rows; previous current rows are superseded)
  - forecast_evaluations    (real backtest accuracy, never invented)
  - forecast_inputs         (which imports fed each forecast)
  - audit_log               (what changed and when)

Everything for one run happens in a single transaction: either the whole refresh
lands, or nothing does.

Usage (from the project root):
  python pipeline/run_price_forecast.py            # writes to the database in DATABASE_URL
  python pipeline/run_price_forecast.py --dry-run  # prints results, writes nothing
"""

from __future__ import annotations

import argparse
import calendar
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
from forecast_core import (  # noqa: E402
    METHOD,
    METHOD_VERSION,
    MIN_TRAIN,
    accuracy_metrics,
    forecast_with_interval,
)

PRICE_METRIC = "price_rwf_per_kg"
PRICE_UNIT = "RWF/kg"
HORIZON_MONTHS = 6
MIN_MONTHS_TO_FORECAST = MIN_TRAIN  # below this the pipeline publishes nothing


def add_months(year: int, month: int, offset: int) -> tuple[int, int]:
    """Shift a (year, month) pair forward by `offset` months."""
    total = year * 12 + (month - 1) + offset
    return total // 12, total % 12 + 1


def month_bounds(year: int, month: int) -> tuple[date, date]:
    last_day = calendar.monthrange(year, month)[1]
    return date(year, month, 1), date(year, month, last_day)


def load_approved_national_series(conn: psycopg.Connection) -> pd.DataFrame:
    """
    Monthly national average per commodity, from approved observations only.
    Each row also records which imports and how many observations contributed,
    and whether any input was sample data.
    """
    query = """
        SELECT o.commodity_code,
               o.period_start,
               o.value,
               o.data_status,
               o.import_id
        FROM observations o
        JOIN raw_imports r ON r.id = o.import_id
        WHERE o.metric_code = %s
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

    columns = ["commodity_code", "period_start", "value", "data_status", "import_id"]
    return pd.DataFrame(rows, columns=columns)


def monthly_series(df: pd.DataFrame, commodity: str) -> tuple[pd.DataFrame, dict]:
    """Average across markets per month, plus lineage details for this commodity."""
    subset = df[df["commodity_code"] == commodity].copy()
    subset["period_start"] = pd.to_datetime(subset["period_start"])
    subset["value"] = subset["value"].astype(float)
    subset["month"] = subset["period_start"].dt.to_period("M")

    monthly = subset.groupby("month").agg(value=("value", "mean")).reset_index()
    monthly = monthly.sort_values("month").reset_index(drop=True)

    lineage = {
        "import_ids": sorted(int(i) for i in subset["import_id"].unique()),
        "observation_counts": {int(k): int(v) for k, v in subset.groupby("import_id").size().items()},
        "based_on_sample": bool((subset["data_status"] == "sample").any()),
    }
    return monthly, lineage


def describe_status(lineage: dict) -> str:
    return "sample data" if lineage["based_on_sample"] else "observed data"


def build_confidence_note(points, bt, lineage: dict) -> str:
    metrics = accuracy_metrics(bt)
    parts = [
        f"Baseline: straight-line trend on the last 6 months, method {METHOD} v{METHOD_VERSION}.",
        f"Range is approximately 80%, based on {bt.count} past predictions from a rolling backtest.",
    ]
    if metrics["mape"] is not None:
        parts.append(f"Average error in backtest: about {metrics['mape']:.1f}% (MAPE).")
    if lineage["based_on_sample"]:
        parts.append("Built on sample data. For demonstration only.")
    parts.append("Prices change with weather, harvests and transport. Treat as an estimate, not a guarantee.")
    return " ".join(parts)


def run(dry_run: bool) -> None:
    load_dotenv(".env.local")
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise SystemExit("DATABASE_URL is not set. Add it to .env.local.")

    with psycopg.connect(database_url) as conn:
        df = load_approved_national_series(conn)
        if df.empty:
            print("No approved price observations found. Nothing to forecast.")
            return

        commodities = sorted(df["commodity_code"].unique())
        now = datetime.now(timezone.utc)
        plan = []

        for commodity in commodities:
            monthly, lineage = monthly_series(df, commodity)
            history = monthly["value"].tolist()
            n = len(history)

            if n < MIN_MONTHS_TO_FORECAST:
                print(f"[{commodity}] skipped: {n} months of history, need {MIN_MONTHS_TO_FORECAST}.")
                continue

            points, bt = forecast_with_interval(history, HORIZON_MONTHS)
            if not points:
                print(f"[{commodity}] skipped: backtest has too few errors to publish an honest interval.")
                continue

            last_period = monthly["month"].iloc[-1]
            last_year, last_month = last_period.year, last_period.month

            forecast_rows = []
            for point in points:
                fy, fm = add_months(last_year, last_month, point.step)
                start, end = month_bounds(fy, fm)
                forecast_rows.append(
                    {
                        "commodity_code": commodity,
                        "metric_code": PRICE_METRIC,
                        "method": METHOD,
                        "method_version": METHOD_VERSION,
                        "output_status": "forecast",
                        "horizon_start": start,
                        "horizon_end": end,
                        "point_value": point.point,
                        "lower_bound": point.low,
                        "upper_bound": point.high,
                        "unit": PRICE_UNIT,
                        "based_on_sample": lineage["based_on_sample"],
                        "confidence_note": build_confidence_note(points, bt, lineage),
                    }
                )

            # Evaluation: what the same method achieved on past data
            metrics = accuracy_metrics(bt)
            first_target = monthly["month"].iloc[bt.target_indices[0]].to_timestamp().date() if bt.count else None
            last_target = monthly["month"].iloc[bt.target_indices[-1]].to_timestamp().date() if bt.count else None
            evaluation = {
                "commodity_code": commodity,
                "metric_code": PRICE_METRIC,
                "method": METHOD,
                "method_version": METHOD_VERSION,
                "holdout_start": month_bounds(first_target.year, first_target.month)[0] if first_target else None,
                "holdout_end": month_bounds(last_target.year, last_target.month)[1] if last_target else None,
                **metrics,
            }

            plan.append({"commodity": commodity, "forecasts": forecast_rows, "evaluation": evaluation, "lineage": lineage})
            print(
                f"[{commodity}] {n} months of history, {len(points)} forecast months, "
                f"{bt.count} backtest predictions, {describe_status(lineage)}."
            )

        if dry_run:
            print(json.dumps(
                [{"commodity": p["commodity"], "forecasts": p["forecasts"], "evaluation": p["evaluation"]} for p in plan],
                default=str,
                indent=2,
            ))
            print("Dry run: nothing was written.")
            return

        if not plan:
            print("No commodity met the requirements. Database unchanged.")
            return

        with conn.transaction():
            with conn.cursor() as cur:
                for item in plan:
                    commodity = item["commodity"]

                    # Supersede the previous current forecasts for this commodity
                    cur.execute(
                        """
                        UPDATE forecasts
                        SET is_current = false, superseded_at = %s
                        WHERE commodity_code = %s
                          AND metric_code = %s
                          AND district_code IS NULL
                          AND market_id IS NULL
                          AND is_current = true
                        """,
                        (now, commodity, PRICE_METRIC),
                    )

                    # Insert new forecast rows and their lineage
                    new_ids = []
                    for row in item["forecasts"]:
                        cur.execute(
                            """
                            INSERT INTO forecasts
                              (commodity_code, metric_code, method, method_version, output_status,
                               horizon_start, horizon_end, point_value, lower_bound, upper_bound,
                               unit, based_on_sample, confidence_note, is_current, generated_at)
                            VALUES
                              (%(commodity_code)s, %(metric_code)s, %(method)s, %(method_version)s,
                               %(output_status)s, %(horizon_start)s, %(horizon_end)s, %(point_value)s,
                               %(lower_bound)s, %(upper_bound)s, %(unit)s, %(based_on_sample)s,
                               %(confidence_note)s, true, %(generated_at)s)
                            RETURNING id
                            """,
                            {**row, "generated_at": now},
                        )
                        new_ids.append(cur.fetchone()[0])

                    for forecast_id in new_ids:
                        for import_id in item["lineage"]["import_ids"]:
                            cur.execute(
                                """
                                INSERT INTO forecast_inputs (forecast_id, import_id, observation_count, role)
                                VALUES (%s, %s, %s, %s)
                                """,
                                (
                                    forecast_id,
                                    import_id,
                                    item["lineage"]["observation_counts"][import_id],
                                    "national monthly average price",
                                ),
                            )

                    # Store the real backtest result
                    ev = item["evaluation"]
                    if ev["holdout_start"] is not None:
                        cur.execute(
                            """
                            INSERT INTO forecast_evaluations
                              (method, method_version, metric_code, commodity_code,
                               holdout_start, holdout_end, mae, mape, rmse, computed_at)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            """,
                            (
                                ev["method"], ev["method_version"], ev["metric_code"], ev["commodity_code"],
                                ev["holdout_start"], ev["holdout_end"], ev["mae"], ev["mape"], ev["rmse"], now,
                            ),
                        )

                cur.execute(
                    """
                    INSERT INTO audit_log (action, entity_type, entity_id, payload, created_at)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (
                        "forecast_refreshed",
                        "forecast_run",
                        now.isoformat(),
                        json.dumps({
                            "method": METHOD,
                            "method_version": METHOD_VERSION,
                            "commodities": [p["commodity"] for p in plan],
                            "horizon_months": HORIZON_MONTHS,
                        }),
                        now,
                    ),
                )

        print(f"Forecast refresh committed for: {', '.join(p['commodity'] for p in plan)}.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true", help="Print results without writing to the database.")
    args = parser.parse_args()
    run(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
