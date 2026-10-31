"""
Unit tests for the Diesel-Adjusted Spatial Arbitrage Solver & Fuel Stress-Tester.
"""

import pytest
import pandas as pd
from pipeline.spatial_arbitrage_engine import (
    compute_freight_cost,
    compute_net_arbitrage_margin,
    classify_dispatch,
    solve_spatial_arbitrage,
    REGULATED_DIESEL_PRICE,
    UNSUBSIDIZED_DIESEL_PRICE
)


def test_freight_cost_increases_with_unsubsidized_fuel():
    d_km = 100.0
    cost_reg = compute_freight_cost(d_km, REGULATED_DIESEL_PRICE)
    cost_unsub = compute_freight_cost(d_km, UNSUBSIDIZED_DIESEL_PRICE)
    
    # Cost with Rwf 3,600/L must exceed cost with Rwf 2,927/L
    assert cost_unsub > cost_reg
    # Fuel difference is (2 * 100 * 0.32 * 673) / 5000 = 8.61 Rwf/kg
    diff = cost_unsub - cost_reg
    assert round(diff, 1) == 8.6


def test_perishable_tomato_spoilage_penalty():
    # 150 km corridor for tomato (8% per 100km = 12% loss)
    p_dest = 700.0
    p_origin = 400.0
    margin, freight, spoil_pct, eff_dest = compute_net_arbitrage_margin(
        p_dest=p_dest,
        p_origin=p_origin,
        distance_km=150.0,
        commodity_code="TOMATO",
        diesel_price=REGULATED_DIESEL_PRICE
    )
    assert round(spoil_pct, 1) == 12.0
    assert eff_dest == 700.0 * 0.88


def test_dispatch_classification_thresholds():
    assert classify_dispatch(55.0) == "DISPATCH_SURPLUS"
    assert classify_dispatch(25.0) == "MODERATE_MARGIN"
    assert classify_dispatch(5.0) == "HOLD_LOCAL"
    assert classify_dispatch(-15.0) == "HOLD_LOCAL"


def test_corridor_arbitrage_solver():
    fg_mock = pd.DataFrame([{
        "district_code": "MUSANZE",
        "commodity_code": "IRISH_POTATO",
        "period_start": "2026-09-01",
        "value": 320.0
    }])
    wfp_mock = pd.DataFrame([{
        "commodity_code": "IRISH_POTATO",
        "period_start": "2026-09-01",
        "value": 460.0
    }])
    dist_mock = pd.DataFrame([{
        "origin_district_code": "MUSANZE",
        "destination_code": "KIGALI",
        "destination_name": "Kigali Central",
        "distance_km": 92.0
    }])

    results = solve_spatial_arbitrage(fg_mock, wfp_mock, dist_mock)
    assert len(results) == 1
    corridor = results[0]
    assert corridor.origin_district_code == "MUSANZE"
    assert corridor.destination_code == "KIGALI"
    assert corridor.net_margin_regulated > corridor.net_margin_unsubsidized
    assert corridor.margin_compression_pct > 0
