"""Tests for drift detection between a baseline and current period."""

import json

import numpy as np
import pandas as pd
import pytest

from avs_framework import AVSDriftDetector


def _period(counts: dict[str, int], score_mean: float = 0.5, seed: int = 0) -> pd.DataFrame:
    """Build a period of applicant data with a given demographic composition."""
    rng = np.random.default_rng(seed)
    rows = []
    for race, n in counts.items():
        for _ in range(n):
            rows.append(
                {
                    "race": race,
                    "ai_score": float(rng.normal(score_mean, 0.1)),
                    "selected": int(rng.random() < 0.4),
                }
            )
    return pd.DataFrame(rows)


def test_population_shift_reports_no_drift_for_stable_composition():
    composition = {"White": 500, "Black": 300, "Hispanic": 200}
    detector = AVSDriftDetector(_period(composition, seed=1), _period(composition, seed=2))

    result = detector.population_shift_test("race")

    assert result["significant_drift"] is False
    assert result["p_value"] > 0.05


def test_population_shift_detects_composition_change():
    baseline = _period({"White": 500, "Black": 300, "Hispanic": 200}, seed=1)
    current = _period({"White": 900, "Black": 50, "Hispanic": 50}, seed=2)
    detector = AVSDriftDetector(baseline, current)

    result = detector.population_shift_test("race")

    assert result["significant_drift"] is True
    assert result["p_value"] < 0.05
    assert result["chi_square"] > 0


def test_population_shift_handles_a_category_absent_from_baseline():
    baseline = _period({"White": 400, "Black": 200}, seed=1)
    current = _period({"White": 400, "Black": 200, "Asian": 150}, seed=2)
    detector = AVSDriftDetector(baseline, current)

    result = detector.population_shift_test("race")

    assert result["significant_drift"] is True


def test_score_distribution_shift_reports_no_drift_for_same_distribution():
    detector = AVSDriftDetector(
        _period({"White": 600}, score_mean=0.50, seed=1),
        _period({"White": 600}, score_mean=0.50, seed=2),
    )

    result = detector.score_distribution_shift()

    assert result["significant_drift"] is False
    assert 0.0 <= result["ks_statistic"] <= 1.0


def test_score_distribution_shift_detects_a_shifted_scorer():
    detector = AVSDriftDetector(
        _period({"White": 600}, score_mean=0.50, seed=1),
        _period({"White": 600}, score_mean=0.80, seed=2),
    )

    result = detector.score_distribution_shift()

    assert result["significant_drift"] is True
    assert result["p_value"] < 0.05


def test_score_distribution_shift_ignores_missing_scores():
    baseline = _period({"White": 300}, seed=1)
    current = _period({"White": 300}, seed=2)
    current.loc[current.index[:50], "ai_score"] = np.nan

    result = AVSDriftDetector(baseline, current).score_distribution_shift()

    assert not np.isnan(result["ks_statistic"])


def test_score_distribution_shift_respects_a_custom_score_column():
    baseline = _period({"White": 300}, seed=1).rename(columns={"ai_score": "model_output"})
    current = _period({"White": 300}, score_mean=0.9, seed=2).rename(
        columns={"ai_score": "model_output"}
    )

    detector = AVSDriftDetector(baseline, current, score_col="model_output")

    assert detector.score_distribution_shift()["significant_drift"] is True


def test_selection_rate_drift_reports_per_group_change():
    baseline = pd.DataFrame(
        {"race": ["A"] * 100 + ["B"] * 100, "selected": [1] * 50 + [0] * 50 + [1] * 40 + [0] * 60}
    )
    current = pd.DataFrame(
        {"race": ["A"] * 100 + ["B"] * 100, "selected": [1] * 60 + [0] * 40 + [1] * 20 + [0] * 80}
    )

    drift = AVSDriftDetector(baseline, current).selection_rate_drift()

    assert drift.loc["A", "baseline_rate"] == pytest.approx(0.50)
    assert drift.loc["A", "current_rate"] == pytest.approx(0.60)
    assert drift.loc["A", "change"] == pytest.approx(0.10)
    assert drift.loc["A", "pct_change"] == pytest.approx(20.0)

    # Group B degraded from 40% to 20% -- a halving that the 4/5 rule alone,
    # applied to a single period, would not surface.
    assert drift.loc["B", "change"] == pytest.approx(-0.20)
    assert drift.loc["B", "pct_change"] == pytest.approx(-50.0)


def test_selection_rate_drift_accepts_custom_column_names():
    sexes = ["M"] * 10 + ["F"] * 10
    baseline = pd.DataFrame({"sex": sexes, "hired": [1] * 5 + [0] * 5 + [1] * 5 + [0] * 5})
    current = pd.DataFrame({"sex": sexes, "hired": [1] * 8 + [0] * 2 + [1] * 2 + [0] * 8})

    drift = AVSDriftDetector(baseline, current).selection_rate_drift(
        selected_col="hired", group_col="sex"
    )

    assert drift.loc["M", "current_rate"] == pytest.approx(0.80)
    assert drift.loc["F", "current_rate"] == pytest.approx(0.20)


def test_population_shift_on_an_empty_period_reports_no_drift():
    empty = pd.DataFrame({"race": pd.Series(dtype="object")})
    populated = _period({"White": 100}, seed=1)

    assert AVSDriftDetector(empty, populated).population_shift_test("race") == {
        "chi_square": 0.0,
        "p_value": 1.0,
        "significant_drift": False,
    }
    assert AVSDriftDetector(populated, empty).population_shift_test("race") == {
        "chi_square": 0.0,
        "p_value": 1.0,
        "significant_drift": False,
    }


def test_drift_results_are_json_serializable():
    """Drift output feeds compliance reports, so it must not leak numpy scalars."""
    detector = AVSDriftDetector(_period({"White": 300}, seed=1), _period({"White": 300}, seed=2))

    json.dumps(detector.population_shift_test("race"))
    json.dumps(detector.score_distribution_shift())


def test_default_demographic_columns_are_configurable():
    frame = _period({"White": 10}, seed=1)

    assert AVSDriftDetector(frame, frame).demo_cols == ["race", "sex", "age_group"]
    assert AVSDriftDetector(frame, frame, demo_cols=["race"]).demo_cols == ["race"]
