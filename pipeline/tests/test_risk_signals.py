import json
import sys
from pathlib import Path

import pandas as pd
import pytest

PIPELINE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PIPELINE_DIR))

from datetime import date  # noqa: E402

from risk_signals import HIGH_RISE, MODERATE_RISE, build_signals, classify, price_change  # noqa: E402

AS_OF = date(2026, 6, 30)  # the test series end in June 2026


def test_price_change_needs_six_months():
    assert price_change([100.0, 110.0, 120.0, 130.0, 140.0]) is None


def test_price_change_compares_last_three_with_previous_three():
    values = [100.0, 100.0, 100.0, 110.0, 110.0, 110.0]
    assert price_change(values) == pytest.approx(0.10)


def test_classify_thresholds():
    assert classify(None) == "unavailable"
    assert classify(-0.30) == "low"
    assert classify(0.0) == "low"
    assert classify(MODERATE_RISE - 0.001) == "low"
    assert classify(MODERATE_RISE) == "moderate"
    assert classify(HIGH_RISE - 0.001) == "moderate"
    assert classify(HIGH_RISE) == "high"


def _rows(district, commodity, values, status="observed", import_id=1):
    return [
        {
            "district_code": district,
            "commodity_code": commodity,
            "period_start": f"2026-{i + 1:02d}-01",
            "value": v,
            "data_status": status,
            "import_id": import_id,
        }
        for i, v in enumerate(values)
    ]


def test_build_signals_skips_districts_without_enough_history():
    df = pd.DataFrame(_rows("GASABO", "TOMATO", [100.0, 110.0, 120.0]))
    assert build_signals(df, AS_OF) == []


def test_build_signals_produces_category_and_driver_json():
    values = [100.0, 100.0, 100.0, 125.0, 125.0, 125.0]  # +25% -> high
    df = pd.DataFrame(_rows("GASABO", "TOMATO", values, status="sample", import_id=7))
    results = build_signals(df, AS_OF)

    assert len(results) == 1
    signal = results[0]
    assert signal["category"] == "high"
    assert signal["district_code"] == "GASABO"
    assert str(signal["period_start"]) == "2026-01-01"
    assert str(signal["period_end"]) == "2026-06-30"

    driver = json.loads(signal["driver_summary"])
    assert driver["changePct"] == pytest.approx(0.25)
    assert driver["basedOnSample"] is True
    assert driver["importIds"] == [7]
    assert driver["months"] == 6


def test_build_signals_averages_markets_within_a_month():
    # Market A stays flat at 100. Market B jumps to 150. The district average rises 25%,
    # which is the signal the rule should see. Market A alone would show no change.
    market_a = _rows("GASABO", "TOMATO", [100.0] * 6)
    market_b = _rows("GASABO", "TOMATO", [100.0, 100.0, 100.0, 150.0, 150.0, 150.0])
    for row in market_b:
        row["import_id"] = 2
    df = pd.DataFrame(market_a + market_b)

    results = build_signals(df, AS_OF)
    assert len(results) == 1
    assert results[0]["category"] == "high"
    assert json.loads(results[0]["driver_summary"])["changePct"] == pytest.approx(0.25)


def test_stale_history_is_not_published():
    # Data ends in January 2026, which is far older than the 4-month limit at June 2026
    values = [100.0, 100.0, 100.0, 125.0, 125.0, 125.0]
    rows = _rows("RUHANGO", "TOMATO", values)  # months 2026-01 to 2026-06
    df = pd.DataFrame(rows)
    assert build_signals(df, date(2026, 12, 31)) == []


def test_gap_within_nine_months_still_publishes_when_six_months_observed():
    # Seven observed months in 2025 (March and July missing). Latest three observed months
    # (Jun, Aug, Sep) average 125 against 100 for the three before (Feb, Apr, May): +25%, high.
    values = {1: 100.0, 2: 100.0, 4: 100.0, 5: 100.0, 6: 125.0, 8: 125.0, 9: 125.0}
    rows = [{"district_code": "RUHANGO", "commodity_code": "TOMATO", "period_start": f"2025-{m:02d}-01",
             "value": v, "data_status": "observed", "import_id": 1} for m, v in values.items()]
    df = pd.DataFrame(rows)
    results = build_signals(df, date(2025, 10, 15))
    assert len(results) == 1
    assert results[0]["category"] == "high"


def test_too_few_observed_months_in_window_is_not_published():
    values = {1: 100.0, 2: 100.0, 6: 125.0, 9: 125.0}
    rows = [{"district_code": "RUHANGO", "commodity_code": "TOMATO", "period_start": f"2025-{m:02d}-01",
             "value": v, "data_status": "observed", "import_id": 1} for m, v in values.items()]
    df = pd.DataFrame(rows)
    assert build_signals(df, date(2025, 10, 15)) == []
