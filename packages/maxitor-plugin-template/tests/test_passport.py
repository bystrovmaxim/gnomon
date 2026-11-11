# packages/maxitor-plugin-template/tests/test_passport.py
"""The passport: the template's passes; a wrong name, an unknown field, a loose version, an unpinned wheel do not."""

from pathlib import Path

import pytest
from maxitor_plugin_sdk.checks import check_plugin


def test_the_template_passes_every_check() -> None:
    assert check_plugin(Path(__file__).resolve().parents[1]) == []


@pytest.mark.parametrize("name", ["Notes", "pg_notes", "core", "public", "n", "notes-app", "a" * 32])
def test_a_name_that_cannot_be_a_schema_or_is_taken_is_refused(plugin, edit, name) -> None:
    edit("maxitor-plugin.yaml", lambda doc: doc.update(name=name))
    assert any("maxitor-plugin.yaml: name:" in problem for problem in check_plugin(plugin))


def test_an_unknown_field_is_refused(plugin, edit) -> None:
    edit("maxitor-plugin.yaml", lambda doc: doc.update(menu=[{"title": "Notes"}]))
    assert any("'menu' was unexpected" in problem for problem in check_plugin(plugin))


@pytest.mark.parametrize("version", ["1.0", "1.0.0-rc.1", "01.0.0", "v1.0.0"])
def test_a_version_other_than_x_y_z_is_refused(plugin, edit, version) -> None:
    edit("maxitor-plugin.yaml", lambda doc: doc.update(version=version))
    assert any("maxitor-plugin.yaml: version:" in problem for problem in check_plugin(plugin))


def test_a_version_other_than_the_package_version_is_refused(plugin, edit) -> None:
    edit("maxitor-plugin.yaml", lambda doc: doc.update(version="9.9.9"))
    assert check_plugin(plugin) == ["maxitor-plugin.yaml: version 9.9.9 differs from pyproject.toml's 0.6.0"]


def test_a_wheel_without_its_sha256_is_refused(plugin, edit) -> None:
    dependency = {
        "id": "io.github.acme.people",
        "version": ">=1.4,<2",
        "source": {"wheel": "https://github.com/acme/people/releases/download/v1.4.0/people-1.4.0-py3-none-any.whl"},
    }
    edit("maxitor-plugin.yaml", lambda doc: doc.update(dependencies=[dependency]))
    assert any("dependencies/0/source" in problem for problem in check_plugin(plugin))


def test_a_pinned_wheel_and_a_pip_package_pass(plugin, edit) -> None:
    dependencies = [
        {"id": "io.github.acme.tags", "version": ">=2.1,<3", "source": {"pip": "acme-maxitor-tags"}},
        {
            "id": "io.github.acme.people",
            "version": ">=1.4,<2",
            "source": {
                "wheel": "https://github.com/acme/people/releases/download/v1.4.0/people-1.4.0-py3-none-any.whl",
                "sha256": "0" * 64,
            },
        },
    ]
    edit("maxitor-plugin.yaml", lambda doc: doc.update(dependencies=dependencies))
    assert check_plugin(plugin) == []


def test_a_path_that_climbs_out_of_the_package_is_refused(plugin, edit) -> None:
    edit("maxitor-plugin.yaml", lambda doc: doc["frontend"].update(navigation="../../etc/navigation.yaml"))
    assert any("frontend/navigation" in problem for problem in check_plugin(plugin))
