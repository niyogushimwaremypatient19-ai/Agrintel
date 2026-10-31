"""
Unit tests for the MINAGRI Climate-Controlled Input-to-Yield Residual Audit Engine.
"""

import pytest
import pandas as pd
from pipeline.econometric_audit_engine import (
    compute_climate_cushion,
    compute_input_factor,
    run_subsidy_leakage_audit,
    Z_LEAKAGE_THRESHOLD
)


def test_climate_cushion_dry_unirrigated():
    # 50% rainfall deficit with 0% irrigation -> 0.55 floor clip
    cushion = compute_climate_cushion(r_anomaly=0.50, irrigation_pct=0.0)
    assert cushion == 0.55


def test_climate_cushion_buffered_by_marshland_irrigation():
    # 60% rainfall anomaly buffered by 60% irrigation: (1 - 0.6)*0.6 + 0.6 = 0.24 + 0.60 = 0.84
    cushion = compute_climate_cushion(r_anomaly=0.60, irrigation_pct=60.0)
    assert round(cushion, 2) == 0.84


def test_input_factor_nominal():
    # Baseline inputs should yield factor close to 1.0
    factor = compute_input_factor(seed_pct=35.0, fert_pct=58.0, pest_pct=45.0, erosion_pct=90.0)
    assert round(factor, 2) == 1.0


def test_input_factor_intensified():
    # High certified seed and fertilizer should increase expected yield factor
    factor = compute_input_factor(seed_pct=65.0, fert_pct=85.0, pest_pct=60.0, erosion_pct=95.0)
    assert factor > 1.15


def test_audit_identifies_leakage_anomaly():
    sas_mock = pd.DataFrame([{
        "district_code": "MUSANZE",
        "commodity_code": "IRISH_POTATO",
        "season": "2025B",
        "season_type": "B",
        "period_start": "2025-03-01",
        "period_end": "2025-06-30",
        "observed_yield_kg_per_ha": 7500.0,  # collapsed yield
        "planted_area_ha": 3500.0,
        "harvested_production_mt": 26250.0,
        "improved_seed_pct": 20.0,
        "inorganic_fert_pct": 72.0,  # high reported fertilizer!
        "organic_fert_pct": 85.0,
        "pesticide_pct": 55.0,
        "irrigation_pct": 12.0,
        "anti_erosion_pct": 94.0,
    }, {
        "district_code": "MUSANZE",
        "commodity_code": "IRISH_POTATO",
        "season": "2024A",
        "season_type": "A",
        "period_start": "2023-09-01",
        "period_end": "2024-02-28",
        "observed_yield_kg_per_ha": 14200.0,
        "planted_area_ha": 4000.0,
        "harvested_production_mt": 56800.0,
        "improved_seed_pct": 42.0,
        "inorganic_fert_pct": 68.0,
        "organic_fert_pct": 85.0,
        "pesticide_pct": 55.0,
        "irrigation_pct": 12.0,
        "anti_erosion_pct": 94.0,
    }, {
        "district_code": "MUSANZE",
        "commodity_code": "IRISH_POTATO",
        "season": "2024B",
        "season_type": "B",
        "period_start": "2024-03-01",
        "period_end": "2024-06-30",
        "observed_yield_kg_per_ha": 14100.0,
        "planted_area_ha": 3900.0,
        "harvested_production_mt": 54990.0,
        "improved_seed_pct": 40.0,
        "inorganic_fert_pct": 66.0,
        "organic_fert_pct": 85.0,
        "pesticide_pct": 55.0,
        "irrigation_pct": 12.0,
        "anti_erosion_pct": 94.0,
    }, {
        "district_code": "MUSANZE",
        "commodity_code": "IRISH_POTATO",
        "season": "2025A",
        "season_type": "A",
        "period_start": "2024-09-01",
        "period_end": "2025-02-28",
        "observed_yield_kg_per_ha": 14350.0,
        "planted_area_ha": 4100.0,
        "harvested_production_mt": 58835.0,
        "improved_seed_pct": 41.0,
        "inorganic_fert_pct": 67.0,
        "organic_fert_pct": 85.0,
        "pesticide_pct": 55.0,
        "irrigation_pct": 12.0,
        "anti_erosion_pct": 94.0,
    }])

    climate_mock = pd.DataFrame([{
        "period_start": "2025-03-01",
        "district_code": "MUSANZE",
        "rainfall_anomaly_ratio": 1.05,
        "temp_max_c": 22.0,
        "dairy_stress_index": None
    }])

    records = run_subsidy_leakage_audit(sas_mock, climate_mock)
    leakage_records = [r for r in records if r.classification == "LEAKAGE_OR_SEED_QUALITY_RISK"]
    assert len(leakage_records) >= 1
    rec = leakage_records[0]
    assert rec.residual_z_score < Z_LEAKAGE_THRESHOLD
    assert rec.leakage_risk_flag is True
    assert rec.estimated_fiscal_exposure_rwf > 0
