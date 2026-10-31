import sys
from datetime import date
from pathlib import Path

import pandas as pd
import pytest

PIPELINE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PIPELINE_DIR))

from forecast_core import (  # noqa: E402
    MIN_ERRORS_FOR_SIGMA,
    accuracy_metrics,
    backtest,
    drift_forecast,
    forecast_with_interval,
)
from run_price_forecast import add_months, month_bounds, monthly_series  # noqa: E402


def test_drift_forecast_extends_a_straight_line_exactly():
    history = [100.0, 110.0, 120.0, 130.0, 140.0, 150.0]  # slope +10 per month
    assert drift_forecast(history, 3) == pytest.approx([160.0, 170.0, 180.0])


def test_drift_forecast_uses_only_the_last_window_values():
    # Old values far away must not affect the forecast
    history = [1000.0, 900.0, 800.0] + [100.0, 110.0, 120.0, 130.0, 140.0, 150.0]
    assert drift_forecast(history, 1) == pytest.approx([160.0])


def test_drift_forecast_needs_two_points():
    with pytest.raises(ValueError):
        drift_forecast([100.0], 1)


def test_backtest_never_trains_on_future_values():
    # A perfectly linear series is predicted exactly, so every error must be zero.
    history = [float(100 + 5 * i) for i in range(12)]
    bt = backtest(history, horizon=3)
    assert bt.count > 0
    assert all(abs(e) < 1e-9 for errs in bt.errors.values() for e in errs)


def test_backtest_counts_follow_origins_and_horizon():
    history = [float(i) for i in range(1, 13)]  # 12 points, min_train 6
    bt = backtest(history, horizon=2)
    # origins 6..11: horizon 1 has 6 errors, horizon 2 has 5 (last origin cannot reach step 2)
    assert len(bt.errors[1]) == 6
    assert len(bt.errors[2]) == 5


def test_accuracy_metrics_are_zero_for_perfect_predictions():
    history = [float(100 + 5 * i) for i in range(12)]
    metrics = accuracy_metrics(backtest(history, horizon=3))
    assert metrics["mae"] == pytest.approx(0.0, abs=1e-9)
    assert metrics["rmse"] == pytest.approx(0.0, abs=1e-9)


def test_interval_is_published_and_brackets_the_point():
    # A noisy but trending series gives real errors, so an interval can be produced
    history = [300.0, 320.0, 305.0, 330.0, 325.0, 350.0, 340.0, 365.0, 355.0, 380.0, 370.0, 395.0]
    points, bt = forecast_with_interval(history, horizon=3)
    assert len(points) == 3
    for p in points:
        assert p.low <= p.point <= p.high
        assert p.low >= 0


def test_no_interval_when_backtest_has_too_few_errors():
    # 7 points gives only one origin (6), so there are fewer than MIN_ERRORS_FOR_SIGMA errors
    history = [100.0, 102.0, 101.0, 105.0, 104.0, 108.0, 107.0]
    points, bt = forecast_with_interval(history, horizon=6)
    assert bt.count < MIN_ERRORS_FOR_SIGMA
    assert points == []


def test_interval_lower_bound_never_negative():
    history = [5.0, 90.0, 4.0, 95.0, 6.0, 92.0, 3.0, 96.0, 5.0, 91.0, 4.0, 94.0]
    points, _ = forecast_with_interval(history, horizon=2)
    assert all(p.low >= 0 for p in points)


def test_add_months_rolls_over_the_year():
    assert add_months(2026, 11, 3) == (2027, 2)
    assert add_months(2026, 10, 1) == (2026, 11)
    assert add_months(2026, 12, 1) == (2027, 1)


def test_month_bounds_handles_leap_february():
    assert month_bounds(2028, 2) == (date(2028, 2, 1), date(2028, 2, 29))
    assert month_bounds(2026, 2) == (date(2026, 2, 1), date(2026, 2, 28))


def test_monthly_series_averages_markets_and_flags_sample():
    df = pd.DataFrame(
        [
            {"commodity_code": "TOMATO", "period_start": "2026-01-01", "value": 400.0, "data_status": "observed", "import_id": 1},
            {"commodity_code": "TOMATO", "period_start": "2026-01-01", "value": 420.0, "data_status": "observed", "import_id": 1},
            {"commodity_code": "TOMATO", "period_start": "2026-02-01", "value": 430.0, "data_status": "sample", "import_id": 2},
        ]
    )
    monthly, lineage = monthly_series(df, "TOMATO")
    assert monthly["value"].tolist() == [410.0, 430.0]
    assert lineage["import_ids"] == [1, 2]
    assert lineage["based_on_sample"] is True
    assert lineage["observation_counts"] == {1: 2, 2: 1}
