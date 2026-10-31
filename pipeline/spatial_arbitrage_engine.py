"""
Diesel-Adjusted Spatial Arbitrage Solver & Fuel Policy Stress-Test Engine.

Evaluates inter-district spatial trade margins between agricultural production
origins (farm-gate prices P_O from TangaBid/E-Soko) and destination consumer
terminals (retail prices P_D from WFP/NISR), incorporating distance-dependent
round-trip diesel freight impedance and commodity perishability shrinkage.

Stress-tests margins against Rwanda's fuel subsidy policy regimes:
  - Regulated Regime: Rwf 2,927 / L
  - Unsubsidized Landing Cost Counterfactual: Rwf 3,600 / L (Rwf 673/L subsidy removed)

Equations:
  Freight_Cost_{O->D}(P_{diesel}) = (2 * d_{O,D} * \\gamma * P_{diesel}) / Q_{truck} + C_{handling}
  Net_Margin_{O->D, c}(P_{diesel}) = P_{D,c} * (1 - \\delta_c * d_{O,D}/100) - P_{O,c} - Freight_Cost
  \\Delta Margin_{\\%} = (Margin_{reg} - Margin_{unsub}) / |Margin_{reg}| * 100
"""

from __future__ import annotations

from dataclasses import dataclass, asdict
from pathlib import Path
import pandas as pd
import numpy as np

BASE_DIR = Path(__file__).resolve().parent.parent
CLEAN_DIR = BASE_DIR / "data" / "clean"

# Empirical freight and logistics constants
DEFAULT_TRUCK_PAYLOAD_KG = 5000.0   # 5-tonne medium distribution truck
DEFAULT_FUEL_BURN_L_PER_KM = 0.32   # Round-trip fuel consumption rate (L/km)
HANDLING_COST_PER_KG = 12.0         # Loading, offloading, and market fee per kg (Rwf)

REGULATED_DIESEL_PRICE = 2927.0     # Official subsidized pump price (Rwf/L)
UNSUBSIDIZED_DIESEL_PRICE = 3600.0  # Counterfactual unsubsidized landing cost (Rwf/L)

# Commodity perishability shrinkage factor delta_c (% loss per 100km transit)
COMMODITY_SPOILAGE = {
    "TOMATO": 0.080,         # High perishability: 8% per 100km without cold-chain
    "BANANA": 0.030,         # Moderate perishability: 3% per 100km
    "IRISH_POTATO": 0.015,   # Low perishability: 1.5% per 100km
    "SWEET_POTATO": 0.020,   # Low perishability: 2.0% per 100km
    "MAIZE": 0.005,          # Dry grain: 0.5% per 100km handling loss
    "BEAN": 0.005,           # Dry legume: 0.5% per 100km handling loss
    "RICE": 0.005,           # Dry grain: 0.5% per 100km handling loss
    "CASSAVA": 0.040,        # Fresh root tuber: 4% post-harvest physiological deterioration
}

DISPATCH_PROFITABLE_THRESHOLD = 40.0   # Rwf/kg margin to warrant surplus dispatch
DISPATCH_BREAKEVEN_THRESHOLD = 10.0    # Rwf/kg margin minimum threshold


@dataclass
class CorridorArbitrageRecord:
    origin_district_code: str
    destination_code: str
    destination_name: str
    commodity_code: str
    distance_km: float
    farmgate_price_origin: float
    retail_price_dest: float
    gross_spread_rwf_per_kg: float
    spoilage_loss_pct: float
    effective_dest_price: float
    freight_cost_regulated: float
    freight_cost_unsubsidized: float
    net_margin_regulated: float
    net_margin_unsubsidized: float
    margin_compression_pct: float
    breakeven_diesel_price: float
    recommendation_regulated: str
    recommendation_unsubsidized: str
    is_fuel_stress_sensitive: bool
    corridor_summary: str


def compute_freight_cost(
    distance_km: float, 
    diesel_price: float, 
    payload_kg: float = DEFAULT_TRUCK_PAYLOAD_KG,
    fuel_burn: float = DEFAULT_FUEL_BURN_L_PER_KM,
    handling: float = HANDLING_COST_PER_KG
) -> float:
    """
    Computes round-trip freight cost per kg:
    (2 * distance_km * fuel_burn * diesel_price) / payload_kg + handling
    """
    if distance_km <= 0:
        return handling
    fuel_cost = (2.0 * distance_km * fuel_burn * diesel_price) / payload_kg
    return float(fuel_cost + handling)


def compute_net_arbitrage_margin(
    p_dest: float,
    p_origin: float,
    distance_km: float,
    commodity_code: str,
    diesel_price: float,
    payload_kg: float = DEFAULT_TRUCK_PAYLOAD_KG,
    fuel_burn: float = DEFAULT_FUEL_BURN_L_PER_KM
) -> tuple[float, float, float, float]:
    """
    Returns (net_margin, freight_cost, spoilage_loss_pct, effective_dest_price)
    """
    spoilage_rate = COMMODITY_SPOILAGE.get(commodity_code, 0.015)
    spoilage_factor = max(0.0, 1.0 - (spoilage_rate * (distance_km / 100.0)))
    effective_p_dest = p_dest * spoilage_factor
    spoilage_loss_pct = (1.0 - spoilage_factor) * 100.0

    freight = compute_freight_cost(distance_km, diesel_price, payload_kg, fuel_burn)
    margin = effective_p_dest - p_origin - freight
    return float(margin), float(freight), float(spoilage_loss_pct), float(effective_p_dest)


def classify_dispatch(margin: float) -> str:
    if margin >= DISPATCH_PROFITABLE_THRESHOLD:
        return "DISPATCH_SURPLUS"
    elif margin >= DISPATCH_BREAKEVEN_THRESHOLD:
        return "MODERATE_MARGIN"
    else:
        return "HOLD_LOCAL"


def solve_spatial_arbitrage(
    farmgate_df: pd.DataFrame,
    wfp_df: pd.DataFrame,
    distances_df: pd.DataFrame
) -> list[CorridorArbitrageRecord]:
    """
    Solves spatial arbitrage across all viable production-to-consumption corridors.
    """
    # 1. Determine recent observed farmgate price per district and crop
    fg = farmgate_df.copy()
    fg["period_start"] = pd.to_datetime(fg["period_start"])
    recent_fg = (
        fg.sort_values("period_start")
        .groupby(["district_code", "commodity_code"])
        .last()
        .reset_index()
    )

    # 2. Determine recent destination market retail prices
    wfp = wfp_df.copy()
    wfp["period_start"] = pd.to_datetime(wfp["period_start"])
    recent_wfp = (
        wfp.sort_values("period_start")
        .groupby(["commodity_code"])
        .last()
        .reset_index()
    )
    # WFP benchmark prices
    wfp_price_map = {}
    for _, r in recent_wfp.iterrows():
        wfp_price_map[r["commodity_code"]] = float(r["value"])

    # Fallbacks for commodities where WFP monitors Irish potato & tomato, but TangaBid monitors maize, banana, bean
    price_fallbacks = {
        "IRISH_POTATO": 420.0,
        "TOMATO": 680.0,
        "MAIZE": 520.0,
        "BEAN": 840.0,
        "BANANA": 480.0,
        "CASSAVA": 350.0,
        "RICE": 980.0
    }

    # Map of distance records
    dist_map = {}
    for _, r in distances_df.iterrows():
        key = (r["origin_district_code"], r["destination_code"])
        dist_map[key] = (float(r["distance_km"]), str(r["destination_name"]))

    results: list[CorridorArbitrageRecord] = []

    for _, row in recent_fg.iterrows():
        origin = str(row["district_code"]).upper()
        crop = str(row["commodity_code"]).upper()
        p_origin = float(row["value"])

        p_dest_base = wfp_price_map.get(crop, price_fallbacks.get(crop, p_origin * 1.35))

        # Test corridors to destination terminals
        dest_terminals = ["KIGALI", "MUSANZE", "HUYE", "RWAMAGANA", "RUBAVU"]

        for dest_code in dest_terminals:
            dist_key = (origin, dest_code)
            if dist_key not in dist_map:
                continue
            distance_km, dest_name = dist_map[dist_key]

            # Adjust destination price slightly for regional hubs vs Kigali
            if dest_code == "KIGALI":
                p_dest = p_dest_base
            else:
                p_dest = p_dest_base * 0.94  # Regional secondary markets are slightly cheaper than capital

            gross_spread = p_dest - p_origin

            # Regulated regime
            margin_reg, freight_reg, spoil_pct, eff_dest = compute_net_arbitrage_margin(
                p_dest, p_origin, distance_km, crop, REGULATED_DIESEL_PRICE
            )

            # Unsubsidized counterfactual regime
            margin_unsub, freight_unsub, _, _ = compute_net_arbitrage_margin(
                p_dest, p_origin, distance_km, crop, UNSUBSIDIZED_DIESEL_PRICE
            )

            # Compression ratio
            if abs(margin_reg) > 0.01:
                compression_pct = ((margin_reg - margin_unsub) / abs(margin_reg)) * 100.0
            else:
                compression_pct = 0.0

            # Break-even diesel calculation
            denom = (2.0 * distance_km * DEFAULT_FUEL_BURN_L_PER_KM) / DEFAULT_TRUCK_PAYLOAD_KG
            if denom > 0:
                breakeven_diesel = (eff_dest - p_origin - HANDLING_COST_PER_KG) / denom
            else:
                breakeven_diesel = 99999.0

            rec_reg = classify_dispatch(margin_reg)
            rec_unsub = classify_dispatch(margin_unsub)
            stress_sensitive = (rec_reg != rec_unsub) or (compression_pct > 35.0)

            summary = (
                f"{origin} -> {dest_code} ({distance_km:.0f}km): Net margin Rwf {margin_reg:.0f}/kg at regulated fuel "
                f"compresses by {compression_pct:.1f}% to Rwf {margin_unsub:.0f}/kg if subsidy removed."
            )

            results.append(CorridorArbitrageRecord(
                origin_district_code=origin,
                destination_code=dest_code,
                destination_name=dest_name,
                commodity_code=crop,
                distance_km=round(distance_km, 1),
                farmgate_price_origin=round(p_origin, 1),
                retail_price_dest=round(p_dest, 1),
                gross_spread_rwf_per_kg=round(gross_spread, 1),
                spoilage_loss_pct=round(spoil_pct, 1),
                effective_dest_price=round(eff_dest, 1),
                freight_cost_regulated=round(freight_reg, 1),
                freight_cost_unsubsidized=round(freight_unsub, 1),
                net_margin_regulated=round(margin_reg, 1),
                net_margin_unsubsidized=round(margin_unsub, 1),
                margin_compression_pct=round(compression_pct, 1),
                breakeven_diesel_price=round(float(breakeven_diesel), 0),
                recommendation_regulated=rec_reg,
                recommendation_unsubsidized=rec_unsub,
                is_fuel_stress_sensitive=stress_sensitive,
                corridor_summary=summary
            ))

    return results


def main():
    CLEAN_DIR.mkdir(parents=True, exist_ok=True)
    fg_path = CLEAN_DIR / "tangabid_farmgate_monthly_district.csv"
    wfp_path = CLEAN_DIR / "wfp_prices_irish_potato_tomato_rwa.csv"
    dist_path = CLEAN_DIR / "district_market_distances.csv"

    if not dist_path.exists():
        from prepare_road_distances import main as gen_dist
        gen_dist()

    fg_df = pd.read_csv(fg_path)
    wfp_df = pd.read_csv(wfp_path)
    distances_df = pd.read_csv(dist_path)

    corridor_records = solve_spatial_arbitrage(fg_df, wfp_df, distances_df)
    corridor_df = pd.DataFrame([asdict(r) for r in corridor_records])

    out_path = CLEAN_DIR / "spatial_arbitrage_corridors.csv"
    corridor_df.to_csv(out_path, index=False)
    
    n_dispatch = (corridor_df["recommendation_regulated"] == "DISPATCH_SURPLUS").sum()
    n_sensitive = corridor_df["is_fuel_stress_sensitive"].sum()
    print(f"Spatial arbitrage solved: {len(corridor_df)} corridors evaluated.")
    print(f" -> Profitable Dispatches: {n_dispatch}")
    print(f" -> Corridors Sensitive to Fuel Subsidy Removal: {n_sensitive}")
    print(f" -> Output saved to {out_path}")


if __name__ == "__main__":
    main()
