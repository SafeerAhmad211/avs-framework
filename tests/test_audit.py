"""Tests for Pillar 1: adverse impact analysis."""

import json
from dataclasses import asdict

import pandas as pd
import pytest

from avs_framework import AVSAdverseImpactAudit


def _two_group_data(n_a: int, sel_a: int, n_b: int, sel_b: int) -> pd.DataFrame:
    """Applicant flow with two groups at explicit selection counts."""
    rows = [
        {"applicant_id": i, "race": "GroupA", "selected": int(i < sel_a)}
        for i in range(n_a)
    ]
    rows += [
        {"applicant_id": n_a + i, "race": "GroupB", "selected": int(i < sel_b)}
        for i in range(n_b)
    ]
    return pd.DataFrame(rows)


def test_four_fifths_rule_flags_confirmed_adverse_impact():
    # GroupA selected at 50%, GroupB at 20% -> impact ratio 0.40, highly significant.
    audit = AVSAdverseImpactAudit(_two_group_data(100, 50, 100, 20), demographic_cols=["race"])
    findings = audit.run_audit("race")

    assert len(findings) == 1
    finding = findings[0]
    assert finding.group == "GroupB"
    assert finding.reference_group == "GroupA"
    assert finding.impact_ratio == 0.40
    assert finding.four_fifths_pass is False
    assert finding.statistically_significant is True
    assert finding.severity == "CONFIRMED"


def test_no_adverse_impact_when_rates_equal():
    audit = AVSAdverseImpactAudit(_two_group_data(100, 50, 100, 50), demographic_cols=["race"])
    findings = audit.run_audit("race")

    assert findings[0].impact_ratio == 1.0
    assert findings[0].four_fifths_pass is True
    assert findings[0].severity == "NONE"


def test_ratio_below_threshold_without_significance_is_indicated():
    # Small samples: 5/10 vs 2/10 -> ratio 0.40 but not significant at alpha=.05.
    audit = AVSAdverseImpactAudit(_two_group_data(10, 5, 10, 2), demographic_cols=["race"])
    finding = audit.run_audit("race")[0]

    assert finding.four_fifths_pass is False
    assert finding.statistically_significant is False
    assert finding.severity == "INDICATED"


def test_significant_but_passing_ratio_is_monitor():
    # 1000 applicants each: 50% vs 43% -> ratio 0.86 (passes 4/5) but significant.
    audit = AVSAdverseImpactAudit(_two_group_data(1000, 500, 1000, 430), demographic_cols=["race"])
    finding = audit.run_audit("race")[0]

    assert finding.four_fifths_pass is True
    assert finding.statistically_significant is True
    assert finding.severity == "MONITOR"


def test_reference_group_is_highest_selection_rate():
    """Per 29 C.F.R. 1607.4D the comparison baseline is the highest-selected group."""
    audit = AVSAdverseImpactAudit(_two_group_data(100, 20, 100, 80), demographic_cols=["race"])
    finding = audit.run_audit("race")[0]

    assert finding.reference_group == "GroupB"
    assert finding.group == "GroupA"
    assert finding.reference_rate == 0.80


def test_selection_rates_are_computed_per_group():
    audit = AVSAdverseImpactAudit(_two_group_data(200, 60, 100, 10), demographic_cols=["race"])
    rates = audit.calculate_selection_rates("race").set_index("race")

    assert rates.loc["GroupA", "n_applicants"] == 200
    assert rates.loc["GroupA", "selection_rate"] == pytest.approx(0.30)
    assert rates.loc["GroupB", "selection_rate"] == pytest.approx(0.10)


class TestMinExpectedCellCount:
    """The gate that decides between the Z-test and Fisher's exact test."""

    def test_uses_pooled_proportion_across_all_four_cells(self):
        # Pooled p = 60/200 = 0.30 -> cells are 30, 70, 30, 70; minimum is 30.
        min_cell = AVSAdverseImpactAudit.min_expected_cell_count(100, 50, 100, 10)
        assert min_cell == pytest.approx(30.0)

    def test_detects_small_cell_in_the_reference_group(self):
        # A large comparison group cannot mask a tiny reference group.
        assert AVSAdverseImpactAudit.min_expected_cell_count(100, 47, 8, 4) < 5

    def test_returns_zero_for_empty_table(self):
        assert AVSAdverseImpactAudit.min_expected_cell_count(0, 0, 0, 0) == 0.0


def test_fishers_exact_used_for_small_samples():
    """With expected cells under 5 the reported p-value must match Fisher's exact."""
    data = _two_group_data(8, 6, 7, 1)
    audit = AVSAdverseImpactAudit(data, demographic_cols=["race"])
    finding = audit.run_audit("race")[0]

    assert finding.p_value == audit.fishers_exact(7, 1, 8, 6)


def test_z_test_matches_hand_computed_value():
    audit = AVSAdverseImpactAudit(_two_group_data(100, 50, 100, 20), demographic_cols=["race"])
    z, p_val = audit.z_test_proportions(100, 20, 100, 50)

    assert z == pytest.approx(-4.44, abs=0.01)
    assert p_val < 0.0001


def test_z_test_handles_degenerate_inputs():
    audit = AVSAdverseImpactAudit(_two_group_data(10, 5, 10, 5), demographic_cols=["race"])

    assert audit.z_test_proportions(0, 0, 10, 5) == (0.0, 1.0)
    assert audit.z_test_proportions(10, 0, 10, 0) == (0.0, 1.0)
    assert audit.z_test_proportions(10, 10, 10, 10) == (0.0, 1.0)


def test_run_full_audit_covers_every_present_demographic_column():
    data = _two_group_data(100, 50, 100, 20)
    data["sex"] = ["Male", "Female"] * 100

    audit = AVSAdverseImpactAudit(data, demographic_cols=["race", "sex", "absent_column"])
    results = audit.run_full_audit()

    assert set(results) == {"race", "sex"}


def test_generate_report_renders_all_accumulated_findings():
    audit = AVSAdverseImpactAudit(_two_group_data(100, 50, 100, 20), demographic_cols=["race"])
    audit.run_audit("race")
    report = audit.generate_report()

    assert len(report) == 1
    assert report.iloc[0]["4/5 Pass"] == "FAIL"
    assert report.iloc[0]["Selection Rate"] == "20.0%"
    assert report.iloc[0]["Severity"] == "CONFIRMED"


def test_findings_are_json_serializable():
    """Findings become compliance exhibits, so they must not leak numpy scalars."""
    audit = AVSAdverseImpactAudit(_two_group_data(100, 50, 100, 20), demographic_cols=["race"])
    finding = audit.run_audit("race")[0]

    payload = json.loads(json.dumps(asdict(finding)))

    assert payload["statistically_significant"] is True
    assert payload["four_fifths_pass"] is False
    assert isinstance(payload["reference_rate"], float)
    assert isinstance(payload["group"], str)


def test_input_dataframe_is_not_mutated():
    data = _two_group_data(100, 50, 100, 20)
    before = data.copy()

    AVSAdverseImpactAudit(data, demographic_cols=["race"]).run_audit("race")

    pd.testing.assert_frame_equal(data, before)
