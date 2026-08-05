"""Quickstart: run an AVS adverse impact audit on sample applicant data.

Reproduces the shape of a typical Pillar 1 finding (see README "Sample
Output"): a screening tool with confirmed adverse impact against one or
more racial groups.

Run: python examples/quickstart.py
"""

import numpy as np
import pandas as pd

from avs_framework import AVSAdverseImpactAudit


def build_sample_data(seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    groups = {
        "White": (2847, 0.145),
        "Hispanic": (1523, 0.130),
        "Black": (1241, 0.086),
        "Asian": (891, 0.110),
    }

    rows = []
    applicant_id = 0
    for race, (n, rate) in groups.items():
        selected = rng.random(n) < rate
        for is_selected in selected:
            rows.append({"applicant_id": applicant_id, "race": race, "selected": int(is_selected)})
            applicant_id += 1

    return pd.DataFrame(rows)


def main() -> None:
    data = build_sample_data()

    audit = AVSAdverseImpactAudit(data, demographic_cols=["race"])
    audit.run_audit("race")

    report = audit.generate_report()
    print(report.to_string(index=False))


if __name__ == "__main__":
    main()
