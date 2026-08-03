import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.avs_audit import AVSAdverseImpactAudit


def _sample_data() -> pd.DataFrame:
    # 100 applicants per group, reference group hired at 50%, comparison at 20%.
    rows = []
    for i in range(100):
        rows.append({"applicant_id": i, "race": "GroupA", "selected": 1 if i < 50 else 0})
    for i in range(100, 200):
        rows.append({"applicant_id": i, "race": "GroupB", "selected": 1 if i < 120 else 0})
    return pd.DataFrame(rows)


def test_four_fifths_rule_flags_adverse_impact():
    audit = AVSAdverseImpactAudit(_sample_data(), demographic_cols=["race"])
    findings = audit.run_audit("race")

    assert len(findings) == 1
    finding = findings[0]
    assert finding.group == "GroupB"
    assert finding.reference_group == "GroupA"
    assert finding.impact_ratio == 0.40
    assert finding.four_fifths_pass is False
    assert finding.severity == "CONFIRMED"


def test_no_adverse_impact_when_rates_equal():
    data = pd.DataFrame(
        {
            "applicant_id": range(200),
            "race": ["GroupA"] * 100 + ["GroupB"] * 100,
            "selected": ([1] * 50 + [0] * 50) * 2,
        }
    )
    audit = AVSAdverseImpactAudit(data, demographic_cols=["race"])
    findings = audit.run_audit("race")

    assert findings[0].four_fifths_pass is True
    assert findings[0].severity in ("NONE", "MONITOR")


if __name__ == "__main__":
    test_four_fifths_rule_flags_adverse_impact()
    test_no_adverse_impact_when_rates_equal()
    print("All tests passed.")
