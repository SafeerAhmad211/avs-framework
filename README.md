# AVS Framework

**Audit • Validation • Security** — open-source statistical engine for auditing
AI-driven employment decision systems.

[![CI](https://github.com/SafeerAhmad211/avs-framework/actions/workflows/ci.yml/badge.svg)](https://github.com/SafeerAhmad211/avs-framework/actions/workflows/ci.yml)
[![PyPI](https://img.shields.io/pypi/v/avs-framework.svg)](https://pypi.org/project/avs-framework/)
[![Python 3.10+](https://img.shields.io/pypi/pyversions/avs-framework.svg)](https://pypi.org/project/avs-framework/)
[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.21806797.svg)](https://doi.org/10.5281/zenodo.21806797)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Developed by **Safeer Ahmad, M.S., SHRM-CP, MLSecOps** — founder and Principal,
[Nauta Research Labs](https://nautaresearchlabs.com)

> **Versioning note.** This repository is the reference implementation of two of the
> four AVS Framework pillars, and its version number tracks the **software package
> only** — currently `0.1.x` under semantic versioning, reflecting the age and API
> stability of the package rather than the maturity of the methodology it implements.
> The AVS Framework methodology is developed and versioned separately, in its own
> published record. Cite the software by its Zenodo DOI; cite the methodology by its
> own record.

---

## What this is

Automated screening is effectively universal in large-employer hiring: 99% of
Fortune 500 companies use an applicant tracking system, and 88% of employers
surveyed acknowledge that their system filters out qualified candidates whose
resumes do not match exact job-description criteria.[^hbs]

Independent verification has not kept pace. When Cornell researchers audited
compliance with New York City Local Law 144 — the first law anywhere to mandate
bias audits for automated employment decision tools — they found that of 391
employers surveyed, only 18 had posted an audit report, and only 11 posted both
an audit report and a transparency notice meeting the law's requirements.[^cornell]

The **AVS Framework** is a governance methodology that evaluates AI employment
tools across four pillars:

| Pillar | Question it answers | Standard |
|---|---|---|
| **Audit** | Does the tool produce discriminatory outcomes across protected groups? | Uniform Guidelines (29 C.F.R. 1607), NYC LL144, EEOC |
| **Validation** | Does the tool actually measure job-relevant characteristics? | Uniform Guidelines, SIOP Principles, *Griggs v. Duke Power* |
| **Security** | Can the tool be manipulated, poisoned, or exploited? | NIST AI RMF 1.0 / AI 600-1, OWASP ML Top 10 |
| **Governance** | Does the organization have oversight to sustain compliance over time? | NIST AI RMF GOVERN, OFCCP guidance |

This repository contains the **complete, MIT-licensed implementation of the Audit
and Security pillars** — the statistical and testing engine. It is free to run,
modify, redistribute, and deploy commercially, with no registration, key, quota,
or licensing restriction of any kind. It runs against exports from any ATS
(Workday, Greenhouse, iCIMS, Lever, BambooHR) without vendor source code or API
access to the underlying model, which means an employer can audit a system whose
vendor will not cooperate.

The Validation and Governance pillars require job analysis, validity study design,
and organizational assessment — work performed with a client rather than
distributed as software. Those are delivered as professional services through
[Nauta Research Labs](https://nautaresearchlabs.com), the research and consulting
venture founded by the author. Nothing in this repository is time-limited,
feature-limited, or contingent on that engagement.

## Install

```bash
pip install avs-framework
```

## Quickstart

```python
import pandas as pd
from avs_framework import AVSAdverseImpactAudit

data = pd.read_csv("applicant_flow.csv")  # applicant_id, race, sex, selected, ...

audit = AVSAdverseImpactAudit(data, demographic_cols=["race", "sex"])
audit.run_full_audit()
print(audit.generate_report())
```

Sample output on a screening tool with confirmed adverse impact
(reproduce with `python examples/quickstart.py`):

```
   Group Reference  N Applicants  N Selected Selection Rate Reference Rate Impact Ratio 4/5 Pass  Z-Score  p-value Stat Sig  Severity
   Asian     White           891         100          11.2%          14.6%        0.768     FAIL  -2.5590 0.010496      YES CONFIRMED
   Black     White          1241          99           8.0%          14.6%        0.546     FAIL  -5.8779 0.000000      YES CONFIRMED
Hispanic     White          1523         213          14.0%          14.6%        0.957     PASS  -0.5620 0.574095       no      NONE
```

An impact ratio below 0.80 with a statistically significant p-value (< 0.05) is
a **confirmed adverse impact** finding under the Uniform Guidelines — it triggers
a root-cause and validation-study obligation to defend continued use of the tool
on business-necessity grounds.

## What's included

### `AVSAdverseImpactAudit` — adverse impact analysis

Four-fifths rule per 29 C.F.R. 1607.4D, comparing each group against the
highest-selected group, combined with a pooled two-proportion Z-test. Where the
smallest expected cell count in the 2×2 table falls below 5 under the pooled
null, the framework automatically substitutes Fisher's exact test rather than
relying on the normal approximation.

Findings are classified on four severity levels, because practical and
statistical significance diverge in opposite directions at different sample
sizes:

| Severity | 4/5 rule | Statistically significant | Interpretation |
|---|---|---|---|
| `CONFIRMED` | Fails | Yes | Adverse impact indicated on both criteria |
| `INDICATED` | Fails | No | Practical disparity; sample too small to confirm |
| `MONITOR` | Passes | Yes | Statistically detectable but below the practical threshold |
| `NONE` | Passes | No | No indication of adverse impact |

The `INDICATED` and `MONITOR` cases are the ones single-criterion audits miss.

### `AVSNameSwapTest` — name-swap bias testing

Black-box test for name-based bias in resume screening. Submits resumes that are
byte-identical except for the applicant name and measures score variance across
name-associated demographic groups. Methodology follows Wilson & Caliskan
(University of Washington, 2024). Uses synthetic resumes only — no real
applicant data is required or accepted.

### `AVSDriftDetector` — drift detection

Chi-square test for demographic composition shift, two-sample
Kolmogorov-Smirnov test for score distribution shift, and per-group
selection-rate drift between a baseline and a current period. A model that
passed its audit at deployment can fail silently as the applicant pool or the
model changes; a single-point-in-time audit will not catch that.

## Privacy

The framework operates on **de-identified, aggregate data only**: anonymized
applicant ID, protected-category codes, AI score or decision, and hiring
outcome. It never requires names, SSNs, or other PII. It makes no network
requests. The security tests use synthetic resumes rather than real applicant
data — so there is nothing to leak and no vendor system to reverse-engineer.

Audit findings and drift results are plain JSON-serializable Python values,
suitable for direct inclusion in a compliance report:

```python
import json
from dataclasses import asdict

findings = audit.run_audit("race")
print(json.dumps([asdict(f) for f in findings], indent=2))
```

## Development

```bash
git clone https://github.com/SafeerAhmad211/avs-framework.git
cd avs-framework
pip install -e ".[dev]"

ruff check .
pytest --cov=avs_framework --cov-report=term-missing
```

CI runs against Python 3.10–3.13 and fails the build below 80% line coverage
(`--cov-fail-under=80`).

Contributions are welcome, particularly methodological review from I-O
psychologists, statisticians, and employment attorneys — see
[CONTRIBUTING.md](CONTRIBUTING.md). You do not need to write code to correct a
statistical method.

## Citation

Each release is archived to Zenodo with a DOI. Cite it via the repository's
**Cite this repository** button, or directly:

```bibtex
@software{ahmad_avs_framework_2026,
  author    = {Ahmad, Safeer},
  title     = {{AVS Framework: Audit, Validation, Security for AI Employment
               Decision Systems}},
  year      = {2026},
  publisher = {Zenodo},
  version   = {0.1.1},
  doi       = {10.5281/zenodo.21806797},
  url       = {https://doi.org/10.5281/zenodo.21806797}
}
```

`10.5281/zenodo.21806797` is the **concept DOI** — it always resolves to the most
recent version, which is what you want in a citation unless you are pinning to
specific numerical behavior. To cite exactly the version you ran, use the
version DOI shown on that release's Zenodo record; v0.1.1 is
[`10.5281/zenodo.21806798`](https://doi.org/10.5281/zenodo.21806798).

To cite the **methodology** rather than this software, cite the AVS Framework
methodology record directly — its version is independent of this package's
(see the versioning note at the top).

## Limitations

- Adverse impact analysis identifies *disparities*, not *causes*. A confirmed
  finding is the start of a root-cause investigation, not a conclusion about
  intent or legal liability.
- The four-fifths rule is a rule of thumb from 29 C.F.R. 1607.4D, not a legal
  safe harbor. Courts and the EEOC also consider statistical significance,
  practical significance, and sample size.
- This library implements the Audit and Security pillars only. A defensible
  compliance posture also requires validation evidence that the tool measures
  job-relevant characteristics — the Validation pillar, which is out of scope
  here.
- Nothing in this repository is legal advice.

## License

Code in this repository is released under the [MIT License](LICENSE) —
permissive, OSI-approved, and free for commercial use without attribution
obligations beyond the license notice.

The consulting deliverables built on top of it (job analysis protocols,
validation study design, governance maturity scoring, engagement reports) are
commercial products of Nauta Research Labs, the venture founded by the author.
This is a standard open-core structure: the measurement engine is a public good,
the professional judgment applied with a client is a service.

[^hbs]: Fuller, J. B., Raman, M., et al. (2021). *Hidden Workers: Untapped Talent*.
    Harvard Business School Project on Managing the Future of Work and Accenture.
    Survey of 8,000 workers and 2,250 executives across the U.S., U.K., and Germany.
    <https://www.hbs.edu/managing-the-future-of-work/research/Pages/hidden-workers-untapped-talent.aspx>

[^cornell]: Wright, L., et al. (2024). *Null Compliance: NYC Local Law 144 and the
    Challenges of Algorithm Accountability*. Proceedings of the 2024 ACM Conference
    on Fairness, Accountability, and Transparency (FAccT '24).
    <https://doi.org/10.1145/3630106.3658998>
