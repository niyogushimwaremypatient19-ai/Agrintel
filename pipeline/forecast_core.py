"""
Transparent forecasting baseline for the early-warning platform.

Method: "drift_last6" v1.0.0
  1. Take the last 6 monthly values of the series.
  2. Fit a straight line through them (least squares).
  3. Extend that line forward for each horizon month.
  4. Build an interval from the errors that this same method made on
     past data (a rolling-origin backtest), so the band is earned, not invented.

Why this method: it is transparent enough to explain to an agronomist or a farmer, it needs
little data, and it is honest about what it cannot do. It is an empirical baseline.
Accuracy is reported from the backtest only.

This module has no database or network code, so it can be tested on its own.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

METHOD = "drift_last6"
METHOD_VERSION = "1.0.0"

WINDOW = 6  # months used to fit the line
MIN_TRAIN = 6  # shortest history the backtest will train on
MIN_ERRORS_FOR_SIGMA = 3  # fewer backtest errors than this cannot support an interval
Z_80 = 1.2816  # z-score for an approximate 80% interval under a normal error assumption


@dataclass
class HorizonPoint:
    step: int  # 1 = first month after the last observation
    point: float
    low: float
    high: float


@dataclass
class Backtest:
    # error lists keyed by horizon step, e.g. errors[1] = one-month-ahead errors
    errors: dict[int, list[float]] = field(default_factory=dict)
    actuals: list[float] = field(default_factory=list)
    predictions: list[float] = field(default_factory=list)
    target_indices: list[int] = field(default_factory=list)

    @property
    def count(self) -> int:
        return len(self.actuals)


def _fit_line(values: list[float]) -> tuple[float, float]:
    """Least-squares intercept and slope for values at x = 0..n-1."""
    x = np.arange(len(values), dtype=float)
    slope, intercept = np.polyfit(x, np.asarray(values, dtype=float), 1)
    return float(intercept), float(slope)


def drift_forecast(history: list[float], horizon: int, window: int = WINDOW) -> list[float]:
    """Point forecasts for steps 1..horizon using the last `window` values."""
    if len(history) < 2:
        raise ValueError("At least two observations are needed to fit a trend.")
    recent = history[-window:]
    intercept, slope = _fit_line(recent)
    n = len(recent)
    return [intercept + slope * (n - 1 + step) for step in range(1, horizon + 1)]


def backtest(history: list[float], horizon: int, window: int = WINDOW, min_train: int = MIN_TRAIN) -> Backtest:
    """
    Rolling-origin backtest. For each possible forecast origin, train only on the
    past, predict up to `horizon` steps ahead, and record the error against what
    actually happened. No future data leaks into the training window.
    """
    result = Backtest()
    n = len(history)

    for origin in range(min_train, n):  # origin = number of values known so far
        train = history[:origin]
        preds = drift_forecast(train, horizon, window=window)

        for step in range(1, horizon + 1):
            target_index = origin + step - 1
            if target_index >= n:
                break
            actual = history[target_index]
            predicted = preds[step - 1]
            error = actual - predicted

            result.errors.setdefault(step, []).append(error)
            result.actuals.append(actual)
            result.predictions.append(predicted)
            result.target_indices.append(target_index)

    return result


def accuracy_metrics(bt: Backtest) -> dict[str, float | None]:
    """MAE, RMSE and MAPE across all backtest predictions. None when there is nothing to score."""
    if bt.count == 0:
        return {"mae": None, "rmse": None, "mape": None}

    actual = np.asarray(bt.actuals, dtype=float)
    pred = np.asarray(bt.predictions, dtype=float)
    errors = actual - pred

    mae = float(np.mean(np.abs(errors)))
    rmse = float(np.sqrt(np.mean(errors**2)))
    nonzero = actual != 0
    mape = float(np.mean(np.abs(errors[nonzero] / actual[nonzero])) * 100) if nonzero.any() else None

    return {"mae": mae, "rmse": rmse, "mape": mape}


def _sigma_for_step(bt: Backtest, step: int) -> float | None:
    """
    Spread of errors for one horizon step. Uses that step's own errors when there are
    enough of them, otherwise falls back to all errors pooled. Returns None when even
    the pooled errors are too few, in which case no interval is published.
    """
    own = bt.errors.get(step, [])
    if len(own) >= MIN_ERRORS_FOR_SIGMA:
        return float(np.sqrt(np.mean(np.square(own))))

    pooled = [e for errs in bt.errors.values() for e in errs]
    if len(pooled) >= MIN_ERRORS_FOR_SIGMA:
        return float(np.sqrt(np.mean(np.square(pooled))))

    return None


def forecast_with_interval(history: list[float], horizon: int) -> tuple[list[HorizonPoint], Backtest]:
    """
    Full forecast for one series. Returns an empty list of points when the backtest
    cannot support an honest interval, so the caller can skip publishing.
    """
    bt = backtest(history, horizon)
    points_raw = drift_forecast(history, horizon)

    points: list[HorizonPoint] = []
    for step, point in enumerate(points_raw, start=1):
        sigma = _sigma_for_step(bt, step)
        if sigma is None:
            return [], bt
        low = max(point - Z_80 * sigma, 0.0)  # prices cannot be negative
        high = point + Z_80 * sigma
        points.append(HorizonPoint(step=step, point=round(point, 2), low=round(low, 2), high=round(high, 2)))

    return points, bt
