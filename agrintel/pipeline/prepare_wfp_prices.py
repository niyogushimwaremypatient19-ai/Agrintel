"""
Cleans the WFP / HDX "Rwanda - Food Prices" file for the platform.

Input : the raw CSV downloaded from HDX (kept OUTSIDE the repository, see README)
Output: data/clean/wfp_prices_irish_potato_tomato_rwa.csv
        in the column layout that the price loader expects:
        period_start, period_end, market_name, district_code,
        commodity_code, metric_code, value, unit
        plus extra columns for traceability (not used by the loader).

Rules applied, in order (each drop is counted and printed):
  1. Keep only Irish potatoes and tomatoes.
  2. Map WFP's admin2 name to our 30 district codes.
     Rows with "Administrative unit not available" are dropped.
  3. Keep one price per market per month (WFP dates are the 15th of each month).
  4. Flag refugee camp markets (name contains "Camp") instead of dropping them.
  5. Reject non-positive or missing prices.
  6. Check for duplicate market-month-commodity rows.

Usage:
  python pipeline/prepare_wfp_prices.py --input data/raw/wfp_food_prices_rwa.csv
"""

from __future__ import annotations

import argparse
import calendar
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
REFERENCE = ROOT / "data" / "reference" / "districts.csv"
OUTPUT = ROOT / "data" / "clean" / "wfp_prices_irish_potato_tomato_rwa.csv"

WFP_COMMODITIES = {
    "Potatoes (Irish)": "IRISH_POTATO",
    "Tomatoes": "TOMATO",
}
METRIC = "price_rwf_per_kg"
UNIT = "RWF/kg"


def month_bounds(date: pd.Timestamp) -> tuple[str, str]:
    last_day = calendar.monthrange(date.year, date.month)[1]
    start = date.replace(day=1).strftime("%Y-%m-%d")
    end = date.replace(day=last_day).strftime("%Y-%m-%d")
    return start, end


def load_district_lookup() -> dict[str, str]:
    ref = pd.read_csv(REFERENCE)
    return dict(zip(ref["name_en"], ref["code"]))


def clean(raw_path: Path) -> pd.DataFrame:
    log: list[str] = []
    raw = pd.read_csv(raw_path, dtype=str)
    log.append(f"Raw rows read: {len(raw):,}")

    df = raw[raw["commodity"].isin(WFP_COMMODITIES)].copy()
    log.append(f"Kept Irish potatoes and tomatoes: {len(df):,}")

    df["price"] = pd.to_numeric(df["price"], errors="coerce")
    df["date"] = pd.to_datetime(df["date"], format="%m/%d/%Y", errors="coerce")

    bad_date = df["date"].isna().sum()
    df = df[df["date"].notna()]
    log.append(f"Dropped rows with unreadable date: {bad_date}")

    bad_price = (df["price"].isna() | (df["price"] <= 0)).sum()
    df = df[df["price"].notna() & (df["price"] > 0)]
    log.append(f"Dropped rows with missing or non-positive price: {bad_price}")

    lookup = load_district_lookup()
    df["district_code"] = df["admin2"].map(lookup)
    unmatched = df["district_code"].isna().sum()
    log.append(
        f"Dropped rows whose district is not in our 30-district list "
        f"(WFP admin2 = {sorted(df.loc[df['district_code'].isna(), 'admin2'].unique().tolist())}): {unmatched}"
    )
    df = df[df["district_code"].notna()]

    df["commodity_code"] = df["commodity"].map(WFP_COMMODITIES)
    df["is_camp"] = df["market"].str.contains("Camp", case=False, na=False)

    dupes = df.duplicated(["market_id", "date", "commodity_code"]).sum()
    log.append(f"Duplicate market-month-commodity rows found: {dupes}")
    df = df.drop_duplicates(["market_id", "date", "commodity_code"])

    bounds = df["date"].apply(month_bounds)
    df["period_start"] = [b[0] for b in bounds]
    df["period_end"] = [b[1] for b in bounds]

    out = pd.DataFrame(
        {
            "period_start": df["period_start"],
            "period_end": df["period_end"],
            "market_name": df["market"],
            "district_code": df["district_code"],
            "commodity_code": df["commodity_code"],
            "metric_code": METRIC,
            "value": df["price"].round(1),
            "unit": UNIT,
            "is_camp": df["is_camp"],
            "wfp_market_id": df["market_id"],
            "latitude": df["latitude"],
            "longitude": df["longitude"],
            "admin1": df["admin1"],
            "admin2": df["admin2"],
            "source": "WFP via HDX: Rwanda - Food Prices",
        }
    ).sort_values(["commodity_code", "district_code", "market_name", "period_start"])

    log.append(f"Rows written: {len(out):,}")
    log.append(f"  of which camp markets: {int(out['is_camp'].sum()):,}")
    for commodity, group in out.groupby("commodity_code"):
        recent = group[group["period_start"] >= "2024-01-01"]
        log.append(
            f"  {commodity}: {len(group):,} rows, "
            f"{group['period_start'].min()} to {group['period_start'].max()}, "
            f"{group['district_code'].nunique()} districts overall, "
            f"{recent['district_code'].nunique()} districts since 2024"
        )

    print("\n".join(log))
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--input", type=Path, required=True, help="Path to the raw WFP CSV from HDX.")
    parser.add_argument("--output", type=Path, default=OUTPUT)
    args = parser.parse_args()

    result = clean(args.input)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    result.to_csv(args.output, index=False)
    print(f"\nWritten: {args.output.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
