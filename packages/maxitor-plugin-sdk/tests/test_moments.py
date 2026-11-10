"""The moment condition in its two forms, and what may enter it."""

import re

import pytest

from maxitor_plugin_sdk.moments import MOMENT_PATTERN, in_force, moment_text, overlaps


def test_at_a_moment_the_version_in_force_is_the_one_whose_period_holds_it() -> None:
    assert in_force("n", "$3::text::timestamptz") == (
        "n.valid_from_at <= $3::text::timestamptz AND (n.valid_to_at IS NULL OR n.valid_to_at > $3::text::timestamptz)"
    )


def test_over_a_stretch_every_version_in_force_at_some_time_in_it_is_taken() -> None:
    assert overlaps("n", "$3::text::timestamptz", "$4::text::timestamptz") == (
        "n.valid_from_at <= $4::text::timestamptz AND (n.valid_to_at IS NULL OR n.valid_to_at > $3::text::timestamptz)"
    )


@pytest.mark.parametrize(("alias", "moment"), [("n; DROP", "$3::text::timestamptz"), ("N", "$3::text::timestamptz"), ("n", "now()"), ("n", "'2026-11-08'")])
def test_nothing_but_an_alias_and_a_moment_parameter_enters_the_condition(alias, moment) -> None:
    with pytest.raises(ValueError):
        in_force(alias, moment)
    with pytest.raises(ValueError):
        overlaps(alias, moment, "$4::text::timestamptz")


def test_a_moment_is_written_in_utc_to_the_microsecond() -> None:
    assert moment_text("n.updated_at") == "to_char(n.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"')"
    assert re.match(MOMENT_PATTERN, "2026-11-08T10:15:00.123456Z")
    for other in ("2026-11-08", "2026-11-08T10:15:00Z", "2026-11-08T10:15:00.123Z", "2026-11-08T10:15:00.123456+03:00"):
        assert not re.match(MOMENT_PATTERN, other)
