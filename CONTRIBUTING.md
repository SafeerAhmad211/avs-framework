# Contributing to the AVS Framework

Thanks for your interest. This project sits at the intersection of statistics,
employment law, and machine learning security, so contributions are welcome
from any of those directions — including from people who don't write Python.

## Ways to contribute

**Methodological review.** If you are an I-O psychologist, statistician, or
employment attorney and you believe a test is misapplied, misinterpreted, or
misaligned with the Uniform Guidelines, open an issue. Methodological
corrections are the most valuable contributions this project can receive, and
they do not require a pull request — a citation and an explanation is enough.

**Regulatory coverage.** State and municipal AI hiring laws are proliferating.
Issues that document a new jurisdiction's requirements, with a link to the
statute or rule text, help prioritize what gets built next.

**Code.** Bug fixes, new statistical tests, and ATS export adapters.

## Development setup

```bash
git clone https://github.com/SafeerAhmad211/avs-framework.git
cd avs-framework
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
```

## Before opening a pull request

```bash
ruff check .                                    # lint
pytest --cov=avs_framework --cov-report=term-missing
python examples/quickstart.py                   # example must still run
```

CI runs this same sequence on Python 3.10 through 3.13 and enforces a minimum
of 80% coverage. Pull requests that drop coverage below that threshold will
fail automatically.

## Standards for statistical changes

Any change to a statistical method must include:

1. **A citation** to the authority it implements — a regulation, a peer-reviewed
   source, or a professional standard (SIOP Principles, AERA/APA/NCME *Standards
   for Educational and Psychological Testing*).
2. **A test that fails without the change**, ideally with a hand-computed
   expected value or a result cross-checked against an independent
   implementation.
3. **A note in `CHANGELOG.md`** if the change alters numerical output. Downstream
   users may have filed compliance reports based on prior behavior, so changes
   to reported values are treated as breaking.

## Data policy

Never commit real applicant data, and never commit anything derived from it.
All tests and examples must use synthetic or randomly generated data. Pull
requests containing anything that could be applicant PII will be closed
without review.

## Scope

This repository implements the **Audit** and **Security** pillars. The
Validation and Governance pillars — job analysis protocols, validation study
design, and governance maturity scoring — are part of the broader AVS
methodology and are out of scope here.

## License

Contributions are accepted under the [MIT License](LICENSE).
