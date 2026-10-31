"""
Unit tests for subnational rainfall anomalies & pastoral dairy stress indices.
"""

import pytest
from pipeline.prepare_climate_anomalies import generate_subnational_climate_series


def test_subnational_climate_series_generation():
    df = generate_subnational_climate_series()
    assert len(df) > 0
    assert "rainfall_anomaly_ratio" in df.columns
    assert "dairy_stress_index" in df.columns
    assert "r1q_ratio" in df.columns
    assert "r3q_ratio" in df.columns

    # Verify pastoral district has calculated DSI
    nyagatare = df[df["district_code"] == "NYAGATARE"]
    assert not nyagatare.empty
    assert nyagatare["dairy_stress_index"].notna().any()

    # Verify non-pastoral district has null DSI (strict honesty rule)
    gasabo = df[df["district_code"] == "GASABO"]
    assert gasabo["dairy_stress_index"].isna().all()
