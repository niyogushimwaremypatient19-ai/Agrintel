"""
Cleans the TangaBid (E-Soko) farm-gate price export and writes monthly district averages.

Input : the raw CSV export (kept OUTSIDE the repository, see data/raw/README.txt)
Output: data/clean/tangabid_farmgate_monthly_district.csv

Rules, applied in order (every drop and flag is counted and printed):
  1. Keep only products that map to one of the crops in CROP_RULES, and only rows priced per Kg.
  2. Map each product name to a crop code. Flours, feeds, meat, fish and fresh vegetables
     that share a crop word are excluded by name.
  3. Map the region (district) to our 30 district codes. Case differences are normalised.
  4. Remove exact repeats (same date, product, location and price). These come from repeated scrapes.
  5. Where the same date, product and location have different prices, keep the price from the
     latest scrape and count the conflict.
  6. Flag daily prices outside 1/3x to 3x the median price for that crop and month across all districts.
     Flagged prices are excluded from the averages and counted.
  7. Average the remaining daily prices per crop, district and month. Publish a month only if it has
     at least MIN_DAILY_OBS daily prices. Otherwise the month is counted and dropped.

Usage:
  python pipeline/prepare_tangabid_prices.py --input data/raw/tangabid_market_prices.csv
"""

from __future__ import annotations

import argparse
import calendar
import re
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
REFERENCE = ROOT / "data" / "reference" / "districts.csv"
OUTPUT = ROOT / "data" / "clean" / "tangabid_farmgate_monthly_district.csv"

MIN_DAILY_OBS = 5
OUTLIER_LOW = 1 / 3
OUTLIER_HIGH = 3.0
METRIC = "farmgate_price_rwf_per_kg"

# Each rule: crop code -> (include pattern, exclude pattern). Patterns are matched on lower-case names.
CROP_RULES: dict[str, tuple[str, str | None]] = {
    "MAIZE": (r"^maize$", None),
    "BEAN": (r"bean", r"green bean|fresh bean|fresh peas|peas|beer|coke|soya"),
    "RICE": (r"rice", None),
    "CASSAVA": (r"^cassava$", None),
    "SWEET_POTATO": (r"sweet.?potato", None),
    "IRISH_POTATO": (r"irish", None),
    "SORGHUM": (r"^sorghum$", None),
    "WHEAT": (r"^wheat$", None),
    "SOYA": (r"^soya.?bean$", None),
    "GROUNDNUT": (r"^groundnut$", None),
    "TOMATO": (r"^tomato", None),
    "ONION": (r"onion", None),
    "BANANA": (r"banan", r"beer|flour"),
}


def map_crop(product: str) -> str | None:
    name = product.strip().lower()
    for crop, (include, exclude) in CROP_RULES.items():
        if re.search(include, name) and not (exclude and re.search(exclude, name)):
            return crop
    return None


def month_bounds(period: pd.Period) -> tuple[str, str]:
    last_day = calendar.monthrange(period.year, period.month)[1]
    return period.start_time.strftime("%Y-%m-%d"), f"{period.year:04d}-{period.month:02d}-{last_day:02d}"


def load_district_lookup() -> dict[str, str]:
    ref = pd.read_csv(REFERENCE)
    return {name.upper(): code for name, code in zip(ref["name_en"], ref["code"])}


def clean(raw_path: Path) -> pd.DataFrame:
    log: list[str] = []
    raw = pd.read_csv(raw_path, low_memory=False)
    log.append(f"Raw rows read: {len(raw):,}")

    df = raw[raw["unit"] == "Kg"].copy()
    log.append(f"Rows priced per Kg: {len(df):,} (dropped {len(raw) - len(df):,} priced per piece, litre, bottle or sack)")

    df["commodity_code"] = df["product"].map(map_crop)
    unmapped = df["commodity_code"].isna().sum()
    df = df[df["commodity_code"].notna()].copy()
    log.append(f"Dropped products outside the crop list: {unmapped:,}")

    lookup = load_district_lookup()
    df["district_code"] = df["region"].str.upper().str.strip().map(lookup)
    no_district = df["district_code"].isna().sum()
    df = df[df["district_code"].notna()].copy()
    log.append(f"Dropped rows with a region that is not one of our 30 districts: {no_district:,}")

    df["observed_date"] = pd.to_datetime(df["observed_date"])
    df["price"] = pd.to_numeric(df["price"], errors="coerce")
    df = df[df["price"].notna() & (df["price"] > 0)].copy()
    df["scraped_at"] = pd.to_datetime(df["scraped_at"], utc=True, errors="coerce")

    # 4 and 5. Repeats and conflicts
    # The key uses the product name, not the crop: two varieties of one crop at one market are separate prices.
    key = ["observed_date", "product", "location"]
    df = df.sort_values("scraped_at")
    conflicts = int(df.duplicated(key, keep=False).sum() - df.duplicated(key + ["price"], keep=False).sum())
    exact_repeats = int(df.duplicated(key + ["price"], keep="first").sum())
    df = df.drop_duplicates(key + ["price"], keep="first")
    df = df.drop_duplicates(key, keep="last")  # latest scrape wins for conflicting prices
    log.append(f"Exact repeats removed: {exact_repeats:,}")
    log.append(f"Conflicting prices on the same date and location resolved to the latest scrape: {conflicts:,} rows")

    # 6. Outliers, relative to the crop's median for that month across districts
    df["month"] = df["observed_date"].dt.to_period("M")
    monthly_median = df.groupby(["commodity_code", "month"])["price"].transform("median")
    outlier = (df["price"] > monthly_median * OUTLIER_HIGH) | (df["price"] < monthly_median * OUTLIER_LOW)
    log.append(f"Daily prices flagged as outliers and excluded: {int(outlier.sum()):,}")
    df = df[~outlier].copy()

    # 7. Monthly district averages with a minimum sample size
    grouped = df.groupby(["commodity_code", "district_code", "month"]).agg(
        value=("price", "mean"),
        n_daily_obs=("price", "size"),
        n_locations=("location", "nunique"),
    ).reset_index()
    too_few = grouped["n_daily_obs"] < MIN_DAILY_OBS
    log.append(f"Crop-district-months with fewer than {MIN_DAILY_OBS} daily prices, not published: {int(too_few.sum()):,}")
    grouped = grouped[~too_few].copy()

    bounds = grouped["month"].apply(month_bounds)
    out = pd.DataFrame(
        {
            "period_start": [b[0] for b in bounds],
            "period_end": [b[1] for b in bounds],
            "district_code": grouped["district_code"],
            "commodity_code": grouped["commodity_code"],
            "metric_code": METRIC,
            "value": grouped["value"].round(1),
            "unit": "RWF/kg",
            "n_daily_obs": grouped["n_daily_obs"],
            "n_locations": grouped["n_locations"],
            "price_channel": "farm-gate",
            "source": "E-Soko via TangaBid (permission granted)",
        }
    ).sort_values(["commodity_code", "district_code", "period_start"])

    log.append(f"Rows written: {len(out):,}")
    for crop, g in out.groupby("commodity_code"):
        log.append(f"  {crop}: {len(g):,} district-months, {g['district_code'].nunique()} districts, "
                   f"{g['period_start'].min()} to {g['period_start'].max()}")
    print("\n".join(log))
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    args = parser.parse_args()
    result = clean(args.input)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    result.to_csv(args.output, index=False)
    print(f"\nWritten: {args.output.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
