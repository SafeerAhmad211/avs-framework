"""AVS Framework - Pillar 1: Adverse Impact Analysis Engine.

Implements the four-fifths rule, two-proportion Z-test, and Fisher's exact
test for employment adverse impact analysis, consistent with:
  - Uniform Guidelines on Employee Selection Procedures (29 C.F.R. 1607)
  - EEOC Technical Assistance on AI (May 2023)
  - NYC Local Law 144

MIT License | Nauta Research Labs | nautaresearchlabs.com
"""

from dataclasses import dataclass
from typing import Dict, List, Optional

import numpy as np
import pandas as pd
from scipy import stats


@dataclass
class AuditFinding:
    group: str
    reference_group: str
    selection_rate: float
    reference_rate: float
    impact_ratio: float
    z_score: float
    p_value: float
    four_fifths_pass: bool
    statistically_significant: bool
    n_applicants: int
    n_selected: int
    severity: str  # "NONE", "MONITOR", "INDICATED", "CONFIRMED"


class AVSAdverseImpactAudit:
    """Runs Pillar 1 (Audit) of the AVS Framework on applicant flow data."""

    FOUR_FIFTHS_THRESHOLD = 0.80
    ALPHA = 0.05

    def __init__(
        self,
        data: pd.DataFrame,
        applicant_col: str = "applicant_id",
        selected_col: str = "selected",
        demographic_cols: Optional[List[str]] = None,
    ):
        """
        Args:
            data: one row per applicant.
            applicant_col: column identifying each applicant.
            selected_col: binary column (1 = selected, 0 = not selected).
            demographic_cols: protected-category columns to audit
                (defaults to race, sex, age_group, disability_status).
        """
        self.data = data.copy()
        self.applicant_col = applicant_col
        self.selected_col = selected_col
        self.demographic_cols = demographic_cols or [
            "race",
            "sex",
            "age_group",
            "disability_status",
        ]
        self.findings: List[AuditFinding] = []

    def calculate_selection_rates(self, group_col: str) -> pd.DataFrame:
        """Selection rate per group: n_selected / n_applicants."""
        rates = self.data.groupby(group_col).agg(
            n_applicants=(self.selected_col, "count"),
            n_selected=(self.selected_col, "sum"),
        ).reset_index()
        rates["selection_rate"] = rates["n_selected"] / rates["n_applicants"]
        return rates

    def four_fifths_rule(self, rates: pd.DataFrame) -> pd.DataFrame:
        """Apply the 4/5 (80%) rule per 29 C.F.R. 1607.4D."""
        ref_idx = rates["selection_rate"].idxmax()
        max_rate = rates.loc[ref_idx, "selection_rate"]
        rates = rates.copy()
        rates["reference_rate"] = max_rate
        rates["impact_ratio"] = rates["selection_rate"] / max_rate
        rates["four_fifths_pass"] = rates["impact_ratio"] >= self.FOUR_FIFTHS_THRESHOLD
        return rates

    def z_test_proportions(self, n1: int, x1: int, n2: int, x2: int) -> tuple:
        """Pooled two-proportion Z-test. Returns (z_score, p_value)."""
        if n1 == 0 or n2 == 0:
            return (0.0, 1.0)
        p1, p2 = x1 / n1, x2 / n2
        p_pool = (x1 + x2) / (n1 + n2)
        if p_pool in (0, 1):
            return (0.0, 1.0)
        se = np.sqrt(p_pool * (1 - p_pool) * (1 / n1 + 1 / n2))
        z = (p1 - p2) / se
        p_val = 2 * (1 - stats.norm.cdf(abs(z)))
        return (round(z, 4), round(p_val, 6))

    def fishers_exact(self, n1: int, x1: int, n2: int, x2: int) -> float:
        """Fisher's exact test for small samples (expected cell count < 5)."""
        table = np.array([[x1, n1 - x1], [x2, n2 - x2]])
        _, p_val = stats.fisher_exact(table, alternative="two-sided")
        return round(p_val, 6)

    def run_audit(self, group_col: str) -> List[AuditFinding]:
        """Run the full adverse impact analysis for one demographic category."""
        rates = self.four_fifths_rule(self.calculate_selection_rates(group_col))
        ref_idx = rates["selection_rate"].idxmax()
        ref = rates.loc[ref_idx]

        findings = []
        for idx, row in rates.iterrows():
            if idx == ref_idx:
                continue

            z, p_val = self.z_test_proportions(
                int(row["n_applicants"]), int(row["n_selected"]),
                int(ref["n_applicants"]), int(ref["n_selected"]),
            )

            min_expected = min(
                row["n_applicants"] * ref["selection_rate"],
                row["n_applicants"] * (1 - ref["selection_rate"]),
            )
            if min_expected < 5:
                p_val = self.fishers_exact(
                    int(row["n_applicants"]), int(row["n_selected"]),
                    int(ref["n_applicants"]), int(ref["n_selected"]),
                )

            sig = p_val < self.ALPHA
            passes = bool(row["four_fifths_pass"])

            if not passes and sig:
                severity = "CONFIRMED"
            elif not passes and not sig:
                severity = "INDICATED"
            elif passes and sig:
                severity = "MONITOR"
            else:
                severity = "NONE"

            findings.append(
                AuditFinding(
                    group=row[group_col],
                    reference_group=ref[group_col],
                    selection_rate=round(row["selection_rate"], 4),
                    reference_rate=round(ref["selection_rate"], 4),
                    impact_ratio=round(row["impact_ratio"], 4),
                    z_score=z,
                    p_value=p_val,
                    four_fifths_pass=passes,
                    statistically_significant=sig,
                    n_applicants=int(row["n_applicants"]),
                    n_selected=int(row["n_selected"]),
                    severity=severity,
                )
            )

        self.findings.extend(findings)
        return findings

    def run_full_audit(self) -> Dict[str, List[AuditFinding]]:
        """Run the audit across every configured demographic category."""
        return {
            col: self.run_audit(col)
            for col in self.demographic_cols
            if col in self.data.columns
        }

    def generate_report(self) -> pd.DataFrame:
        """Render accumulated findings as a formatted report DataFrame."""
        rows = [
            {
                "Group": f.group,
                "Reference": f.reference_group,
                "N Applicants": f.n_applicants,
                "N Selected": f.n_selected,
                "Selection Rate": f"{f.selection_rate:.1%}",
                "Reference Rate": f"{f.reference_rate:.1%}",
                "Impact Ratio": f"{f.impact_ratio:.3f}",
                "4/5 Pass": "PASS" if f.four_fifths_pass else "FAIL",
                "Z-Score": f.z_score,
                "p-value": f.p_value,
                "Stat Sig": "YES" if f.statistically_significant else "no",
                "Severity": f.severity,
            }
            for f in self.findings
        ]
        return pd.DataFrame(rows)
