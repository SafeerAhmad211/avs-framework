"""AVS Framework - Model Drift Detection.

Compares a current-period sample of applicant/decision data against a
baseline period to detect emerging bias: demographic composition shift,
AI score distribution shift, and selection-rate drift by group.

MIT License | Nauta Research Labs | nautaresearchlabs.com
"""


import pandas as pd
from scipy import stats


class AVSDriftDetector:
    """Detects distributional drift in AI hiring systems over time."""

    ALPHA = 0.05

    def __init__(
        self,
        baseline: pd.DataFrame,
        current: pd.DataFrame,
        score_col: str = "ai_score",
        demo_cols: list[str] | None = None,
    ):
        self.baseline = baseline
        self.current = current
        self.score_col = score_col
        self.demo_cols = demo_cols or ["race", "sex", "age_group"]

    def population_shift_test(self, col: str) -> dict:
        """Chi-square test for demographic composition shift in `col`."""

        base_counts = self.baseline[col].value_counts()
        curr_counts = self.current[col].value_counts()

        all_cats = sorted(set(base_counts.index) | set(curr_counts.index))
        observed = [int(curr_counts.get(c, 0)) for c in all_cats]
        base_total = int(base_counts.sum())
        curr_total = sum(observed)

        if base_total == 0 or curr_total == 0:
            return {"chi_square": 0.0, "p_value": 1.0, "significant_drift": False}

        expected = [(int(base_counts.get(c, 0)) / base_total) * curr_total for c in all_cats]

        # A category absent from the baseline has an expected count of zero, which
        # makes the chi-square term undefined. Its appearance is itself categorical
        # drift, so report it directly rather than dividing by zero.
        if any(e == 0 for e in expected):
            return {"chi_square": float("inf"), "p_value": 0.0, "significant_drift": True}

        chi2, p_val = stats.chisquare(observed, expected)
        return {
            "chi_square": round(float(chi2), 4),
            "p_value": round(float(p_val), 6),
            "significant_drift": bool(p_val < self.ALPHA),
        }

    def score_distribution_shift(self) -> dict:
        """Two-sample Kolmogorov-Smirnov test for AI score distribution drift."""
        ks_stat, p_val = stats.ks_2samp(
            self.baseline[self.score_col].dropna(),
            self.current[self.score_col].dropna(),
        )
        return {
            "ks_statistic": round(float(ks_stat), 4),
            "p_value": round(float(p_val), 6),
            "significant_drift": bool(p_val < self.ALPHA),
        }

    def selection_rate_drift(
        self, selected_col: str = "selected", group_col: str = "race"
    ) -> pd.DataFrame:
        """Compare per-group selection rates between baseline and current periods."""

        def calc_rates(df: pd.DataFrame) -> pd.Series:
            return df.groupby(group_col)[selected_col].mean()

        base_rates = calc_rates(self.baseline)
        curr_rates = calc_rates(self.current)

        comparison = pd.DataFrame(
            {
                "baseline_rate": base_rates,
                "current_rate": curr_rates,
                "change": curr_rates - base_rates,
                "pct_change": ((curr_rates - base_rates) / base_rates * 100).round(1),
            }
        )
        return comparison
