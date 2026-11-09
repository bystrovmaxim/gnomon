# packages/maxitor-plugin-sdk/tests/test_compat.py
"""Each refusal of the compatibility decision names every side; a set that fits passes."""

from __future__ import annotations

from maxitor_plugin_sdk.compat import Change, CorePassport, Dependency, PluginPassport, decide, decide_change

CORE = CorePassport(version="4.0.0", reads={"plugin-passport": [1], "navigation": [1], "foreign-keys": [1]}, sdk=1)


def plugin(
    plugin_id: str = "io.github.acme.tags",
    version: str = "2.1.0",
    *,
    needs: tuple[Dependency, ...] = (),
    maxitor: str = ">=4.0,<5",
    sdk: int | None = 1,
    navigation: int = 1,
) -> PluginPassport:
    return PluginPassport(
        id=plugin_id,
        version=version,
        maxitor=maxitor,
        sdk=sdk,
        formats={"plugin-passport": 1, "navigation": navigation},
        dependencies=needs,
    )


TAGS = plugin()
PEOPLE = plugin("io.github.acme.people", "1.4.0")
NOTES = plugin("io.github.acme.notes", "0.3.0", needs=(Dependency("io.github.acme.tags", ">=2.0,<3"),))


def test_a_set_that_fits_passes() -> None:
    assert decide(CORE, [TAGS, PEOPLE, NOTES]) == []


def test_a_format_the_core_does_not_read() -> None:
    [refusal] = decide(CORE, [plugin(navigation=2)])
    assert refusal.kind == "format"
    assert refusal.sides == ("io.github.acme.tags 2.1.0", "maxitor 4.0.0")
    assert "navigation in format 2" in refusal.message and "reads navigation in format 1" in refusal.message


def test_a_core_outside_the_plugin_range() -> None:
    [refusal] = decide(CORE, [plugin(maxitor=">=5.0,<6")])
    assert refusal.kind == "core_range"
    assert refusal.message == "io.github.acme.tags 2.1.0 needs maxitor >=5.0,<6; this core is maxitor 4.0.0"


def test_two_versions_of_one_plugin() -> None:
    [refusal] = decide(CORE, [TAGS, plugin(version="2.2.0")])
    assert refusal.kind == "two_versions"
    assert refusal.sides == ("io.github.acme.tags 2.1.0", "io.github.acme.tags 2.2.0")


def test_installing_a_second_version_beside_the_first() -> None:
    [refusal] = decide_change(CORE, [TAGS], Change("install", plugin(version="2.2.0")))
    assert refusal.kind == "two_versions" and "upgrade it instead" in refusal.message


def test_a_cycle() -> None:
    a = plugin("io.github.acme.a", "1.0.0", needs=(Dependency("io.github.acme.b", ">=1,<2"),))
    b = plugin("io.github.acme.b", "1.0.0", needs=(Dependency("io.github.acme.a", ">=1,<2"),))
    [refusal] = decide(CORE, [a, b])
    assert refusal.kind == "cycle"
    assert refusal.sides == ("io.github.acme.a", "io.github.acme.b")
    assert refusal.message.endswith("io.github.acme.a → io.github.acme.b → io.github.acme.a")


def test_a_foreign_sdk_major() -> None:
    [refusal] = decide(CORE, [plugin(sdk=2)])
    assert refusal.kind == "sdk_major"
    assert refusal.message == "io.github.acme.tags 2.1.0 is built with SDK 2; maxitor 4.0.0 is built with SDK 1"


def test_a_plugin_that_names_no_sdk_major() -> None:
    [refusal] = decide(CORE, [plugin(sdk=None)])
    assert refusal.kind == "sdk_major" and "no SDK major" in refusal.message


def test_a_missing_dependency() -> None:
    [refusal] = decide(CORE, [NOTES])
    assert refusal.kind == "dependency"
    assert refusal.sides == ("io.github.acme.notes 0.3.0", "io.github.acme.tags")


def test_an_upgrade_that_breaks_a_dependent() -> None:
    [refusal] = decide_change(CORE, [TAGS, NOTES], Change("upgrade", plugin(version="3.0.0")))
    assert refusal.kind == "dependency"
    assert refusal.sides == (
        "io.github.acme.notes 0.3.0",
        "io.github.acme.tags 3.0.0",
        "upgrading io.github.acme.tags 2.1.0 to 3.0.0",
    )
    assert refusal.message.startswith(
        "upgrading io.github.acme.tags 2.1.0 to 3.0.0 breaks a dependent: io.github.acme.notes 0.3.0 needs io.github.acme.tags >=2.0,<3"
    )


def test_a_removal_that_breaks_a_dependent() -> None:
    [refusal] = decide_change(CORE, [TAGS, NOTES], Change("remove", removed="io.github.acme.tags"))
    assert refusal.kind == "dependency"
    assert refusal.sides[-1] == "removing io.github.acme.tags 2.1.0"
    assert (
        "io.github.acme.notes 0.3.0 needs io.github.acme.tags >=2.0,<3, and io.github.acme.tags is not installed"
        in refusal.message
    )


def test_an_upgrade_and_a_removal_nobody_depends_on_pass() -> None:
    assert decide_change(CORE, [TAGS, PEOPLE, NOTES], Change("upgrade", plugin(version="2.9.0"))) == []
    assert decide_change(CORE, [TAGS, PEOPLE, NOTES], Change("remove", removed="io.github.acme.people")) == []


def test_a_core_upgrade_is_decided_against_every_plugin() -> None:
    newer = CorePassport(version="5.0.0", reads=CORE.reads, sdk=1)
    refusals = decide(newer, [TAGS, PEOPLE])
    assert [r.kind for r in refusals] == ["core_range", "core_range"]
