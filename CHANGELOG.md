# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Because compliance reports may be filed on the basis of this tool's output,
**any change that alters a reported numerical value is treated as breaking**,
regardless of how small.

## [0.1.1] - 2026-08-05

Packaging and infrastructure only. **No functional or numerical change** — every
statistical method produces byte-identical output to 0.1.0.

### Added

- `.zenodo.json`, so the Zenodo archive record carries curated title, authorship,
  description, and keywords rather than values inferred from the repository.

### Fixed

- **License metadata rendered as the full MIT license text.** `license = { file =
  "LICENSE" }` embedded the entire license body into the distribution's `License`
  field, which PyPI displayed verbatim. Replaced with the PEP 639 SPDX expression
  `license = "MIT"` plus `license-files`, producing `License-Expression: MIT` under
  metadata version 2.4. The now-redundant `License :: OSI Approved :: MIT License`
  classifier is removed, as PEP 639 disallows pairing the two.

### Changed

- GitHub Actions bumped off Node 20, which is deprecated and was being force-run on
  Node 24: `checkout` v4 → v7, `setup-python` v5 → v7, `upload-artifact` v4 → v7,
  `download-artifact` v4 → v8.
- Build backend pinned to `hatchling>=1.27` for PEP 639 support.

## [0.1.0] - 2026-08-05

First packaged release.

### Added

- `avs_framework.AVSAdverseImpactAudit` — adverse impact analysis implementing
  the four-fifths rule (29 C.F.R. 1607.4D), the pooled two-proportion Z-test,
  and Fisher's exact test, with four-level severity classification.
- `avs_framework.AVSNameSwapTest` — black-box name-swap bias test for resume
  scoring models, using fully synthetic resumes.
- `avs_framework.AVSDriftDetector` — chi-square demographic composition drift,
  Kolmogorov-Smirnov score distribution drift, and per-group selection rate
  drift.
- `AVSAdverseImpactAudit.min_expected_cell_count` — public helper exposing the
  expected-cell-count gate that selects between the normal approximation and
  Fisher's exact test.
- Distribution on PyPI as `avs-framework`; installable with `pip install avs-framework`.
- Test suite with 100% statement coverage, run against Python 3.10–3.13 in CI.
- `CITATION.cff` for machine-readable citation metadata.

### Fixed

- **Fisher's exact test selection gate.** The gate previously evaluated expected
  cell counts using the *reference group's* selection rate and examined only the
  comparison group's two cells. It now uses the pooled selection proportion
  across all four cells of the 2×2 table, which is the conventional criterion.
  This means small reference groups are no longer masked by large comparison
  groups, and some analyses on small samples will now correctly report Fisher's
  exact p-values where they previously reported normal-approximation p-values.

- **NumPy scalars leaked through the public API.** `AuditFinding` fields and the
  dictionaries returned by `AVSDriftDetector` contained `numpy.bool_` and
  `numpy.float64` rather than Python natives, which made results fail to
  serialize with `json.dumps` and caused identity comparisons such as
  `result is True` to return `False`. All public return values are now Python
  scalars.

- **Division by zero in demographic drift detection.** A category present in the
  current period but absent from the baseline produced an expected count of zero
  and emitted a `RuntimeWarning` from the chi-square computation. The appearance
  of a new category is now reported directly as significant drift, and empty
  periods return a well-defined non-drift result.

### Changed

- Package restructured to an installable `src/avs_framework/` layout. Imports
  change from `from src.avs_audit import ...` to `from avs_framework import ...`.
- Modules renamed within the package: `avs_audit` → `audit`, `avs_security` →
  `security`, `avs_drift` → `drift`.
- Minimum supported Python raised to 3.10.

[0.1.1]: https://github.com/SafeerAhmad211/avs-framework/releases/tag/v0.1.1
[0.1.0]: https://github.com/SafeerAhmad211/avs-framework/releases/tag/v0.1.0
