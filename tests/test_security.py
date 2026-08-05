"""Tests for Pillar 3: name-swap bias testing."""

import pytest

from avs_framework import AVSNameSwapTest

TEMPLATE = "Applicant: {NAME}\nExperience: 8 years in operations management."


def test_generates_one_resume_per_name_across_all_pools():
    test = AVSNameSwapTest(TEMPLATE)
    resumes = test.generate_test_resumes()

    expected = sum(len(names) for names in AVSNameSwapTest.NAME_POOLS.values())
    assert len(resumes) == expected
    assert len({r["name"] for r in resumes}) == expected


def test_name_placeholder_is_substituted_in_every_resume():
    resumes = AVSNameSwapTest(TEMPLATE).generate_test_resumes()

    for resume in resumes:
        assert "{NAME}" not in resume["resume_text"]
        assert resume["name"] in resume["resume_text"]


def test_resumes_differ_only_by_name():
    """The core validity requirement: name is the sole varying attribute."""
    resumes = AVSNameSwapTest(TEMPLATE).generate_test_resumes()

    stripped = {r["resume_text"].replace(r["name"], "<NAME>") for r in resumes}
    assert len(stripped) == 1


def test_race_and_sex_are_derived_from_the_pool_key():
    resumes = AVSNameSwapTest(TEMPLATE).generate_test_resumes()
    by_group = {r["group"]: r for r in resumes}

    assert by_group["black_female"]["race"] == "black"
    assert by_group["black_female"]["sex"] == "female"
    assert by_group["white_male"]["race"] == "white"
    assert by_group["white_male"]["sex"] == "male"


def test_run_test_leaves_scores_unset_without_a_scoring_function():
    results = AVSNameSwapTest(TEMPLATE).run_test()

    assert results["score"].isna().all()


def test_run_test_applies_the_scoring_function():
    results = AVSNameSwapTest(TEMPLATE, scoring_function=lambda _text: 0.75).run_test()

    assert (results["score"] == 0.75).all()


def test_analyze_returns_empty_before_the_test_is_run():
    assert AVSNameSwapTest(TEMPLATE).analyze() == {}


def test_analyze_detects_no_bias_for_a_name_blind_scorer():
    test = AVSNameSwapTest(TEMPLATE, scoring_function=lambda _text: 0.5)
    test.run_test()
    analysis = test.analyze()

    assert analysis["max_score_difference"] == 0.0
    assert analysis["severity"] == "LOW"


def test_analyze_quantifies_a_biased_scorer():
    """A scorer that penalizes specific names must surface as a score gap."""
    penalized = set(AVSNameSwapTest.NAME_POOLS["black_male"]) | set(
        AVSNameSwapTest.NAME_POOLS["black_female"]
    )

    def biased_scorer(text: str) -> float:
        return 0.4 if any(name in text for name in penalized) else 0.8

    test = AVSNameSwapTest(TEMPLATE, scoring_function=biased_scorer)
    test.run_test()
    analysis = test.analyze()

    assert analysis["max_score_difference"] == pytest.approx(0.4)
    assert analysis["severity"] == "CRITICAL"
    assert analysis["group_means"]["mean_score"]["black"] == pytest.approx(0.4)
    assert analysis["group_means"]["mean_score"]["white"] == pytest.approx(0.8)


@pytest.mark.parametrize(
    ("max_diff", "expected"),
    [
        (0.25, "CRITICAL"),
        (0.21, "CRITICAL"),
        (0.20, "HIGH"),
        (0.15, "HIGH"),
        (0.10, "MEDIUM"),
        (0.06, "MEDIUM"),
        (0.05, "LOW"),
        (0.00, "LOW"),
    ],
)
def test_severity_thresholds_are_exclusive_at_the_boundary(max_diff, expected):
    assert AVSNameSwapTest._rate_severity(max_diff) == expected


def test_no_real_applicant_data_is_required():
    """Privacy guarantee: the test is fully synthetic."""
    test = AVSNameSwapTest(TEMPLATE)
    results = test.run_test()

    assert set(results.columns) == {"name", "group", "race", "sex", "resume_text", "score"}
    assert len(results) == 24
