# AVS Framework

**Audit • Validation • Security** — open-source statistical engine for auditing
AI-driven employment decision systems.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python 3.9+](https://img.shields.io/badge/python-3.9+-blue.svg)](https://www.python.org/)

Developed by **Safeer Ahmad, M.S., SHRM-CP, MLSecOps** — Principal,
[Nauta Research Labs](https://nautaresearchlabs.com)

---

## What this is

AI tools now participate in most U.S. hiring decisions, but the vast majority of
employers subject to bias-audit laws (NYC LL144, Colorado, Illinois) never
independently test whether those tools discriminate, measure job-relevant traits,
or resist manipulation.

The **AVS Framework** is a governance methodology that evaluates AI employment
tools across four pillars:

| Pillar | Question it answers | Standard |
|---|---|---|
| **Audit** | Does the tool produce discriminatory outcomes across protected groups? | Uniform Guidelines (29 C.F.R. 1607), NYC LL144, EEOC |
| **Validation** | Does the tool actually measure job-relevant characteristics? | Uniform Guidelines, SIOP Principles, *Griggs v. Duke Power* |
| **Security** | Can the tool be manipulated, poisoned, or exploited? | NIST AI RMF 1.0 / AI 600-1, OWASP ML Top 10 |
| **Governance** | Does the organization have oversight to sustain compliance over time? | NIST AI RMF GOVERN, OFCCP guidance |

This repository contains the **open-source (MIT) code** for the Audit and
Security pillars — the statistical and testing engine, not the full consulting
methodology. It's built to run against exports from any ATS (Workday,
Greenhouse, iCIMS, Lever, BambooHR) without needing vendor source code or API
access to the underlying model.

For the full four-pillar assessment methodology, validation study protocols, and
engagement services, see [nautaresearchlabs.com](https://nautaresearchlabs.com).

## What's included

- **`src/avs_audit.py`** — Adverse impact analysis: four-fifths rule, pooled
  two-proportion Z-test, and Fisher's exact test for small samples, per
  29 C.F.R. 1607.4D.
- **`src/avs_security.py`** — Name-swap bias test: submits synthetic,
  name-only-varied resumes to a scoring function and measures score variance
  across name-associated demographic groups (methodology per Wilson & Caliskan,
  University of Washington, 2024). Uses zero real applicant data.
- **`src/avs_drift.py`** — Drift detection: chi-square test for demographic
  composition shift, KS test for AI score distribution shift, and selection-rate
  drift tracking between a baseline and current period.

## Install

```bash
git clone https://github.com/SafeerAhmad211/avs-framework.git
cd avs-framework
pip install -r requirements.txt
```

## Quickstart

```bash
python examples/quickstart.py
```

```python
from src.avs_audit import AVSAdverseImpactAudit
import pandas as pd

data = pd.read_csv("applicant_flow.csv")  # applicant_id, race, sex, selected, ...

audit = AVSAdverseImpactAudit(data, demographic_cols=["race", "sex"])
audit.run_full_audit()
print(audit.generate_report())
```

Sample output on a screening tool with confirmed adverse impact:

```
   Group Reference  N Applicants  N Selected Selection Rate Reference Rate Impact Ratio 4/5 Pass  Z-Score  p-value Stat Sig  Severity
   Asian     White           891         100          11.2%          14.6%        0.768     FAIL  -2.559  0.010496      YES CONFIRMED
   Black     White          1241          99           8.0%          14.6%        0.546     FAIL  -5.878  0.000000      YES CONFIRMED
Hispanic     White          1523         213          14.0%          14.6%        0.957     PASS  -0.562  0.574095       no      NONE
```

An impact ratio below 0.80 with a statistically significant p-value
(< 0.05) is a **confirmed adverse impact** finding under the Uniform
Guidelines — it triggers a required root-cause and validation-study
obligation to defend continued use of the tool on business-necessity grounds.

## Privacy

The framework is designed to operate on **de-identified, aggregate data only**:
anonymized applicant ID, protected-category codes, AI score/decision, and
hiring outcome. It never requires names, SSNs, or other PII, and the security
tests use synthetic resumes rather than real applicant data — so there is
nothing to leak and no vendor system to reverse-engineer.

## Run the tests

```bash
python tests/test_avs_audit.py
```

## Citation

If you use this in research, please cite:

```
Ahmad, S. (2026). Dual-Endeavor Assurance for AI Employment Decision Tools.
Nauta Research Labs.
```

## License

Code in this repository is released under the [MIT License](LICENSE). The
broader AVS Framework methodology (job analysis protocols, validation study
design, governance maturity scoring, engagement deliverables) is proprietary
to Nauta Research Labs.
