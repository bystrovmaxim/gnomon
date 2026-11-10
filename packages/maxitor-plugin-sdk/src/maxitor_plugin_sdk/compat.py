# packages/maxitor-plugin-sdk/src/maxitor_plugin_sdk/compat.py
"""
The one place that decides whether plugins fit a core and each other.

::

    decide(core, plugins)                       a set as it would stand
    decide_change(core, installed, change)      the set after installing, upgrading or removing one plugin

Each answer is a list of refusals, empty when everything fits. A refusal names its kind and every side of the
conflict, so the person reading it knows what to change. Everything here is a pure function over passports.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass, field
from typing import Any, Literal

from packaging.specifiers import InvalidSpecifier, SpecifierSet
from packaging.version import InvalidVersion, Version

from maxitor_plugin_sdk.checks import find_cycle

#: The names of the plugin files a core may read, as the core passport lists them.
FILE_KINDS = ("plugin-passport", "plugin-schema", "navigation", "foreign-keys")

Kind = Literal["format", "core_range", "two_versions", "cycle", "sdk_major", "dependency"]


@dataclass(frozen=True)
class CorePassport:
    """What a core says of itself: its version, the formats it reads, the SDK major it is built with."""

    version: str
    reads: Mapping[str, Sequence[int]]
    sdk: int

    @classmethod
    def of(cls, document: Mapping[str, Any]) -> CorePassport:
        """From the answer of the core's CorePassportAction, or its file with a version."""
        return cls(version=str(document["version"]), reads=dict(document["reads"]), sdk=int(document["sdk"]))


@dataclass(frozen=True)
class Dependency:
    """A plugin another needs, and the versions of it that will do."""

    id: str
    versions: str


@dataclass(frozen=True)
class PluginPassport:
    """What a plugin says of itself, as compatibility needs it."""

    id: str
    version: str
    maxitor: str
    sdk: int | None
    formats: Mapping[str, int] = field(default_factory=dict)
    dependencies: tuple[Dependency, ...] = ()

    @classmethod
    def of(cls, document: Mapping[str, Any]) -> PluginPassport:
        """From a passport as ``checks.read_plugin`` answers it; formats default to the passport's own."""
        return cls(
            id=str(document["id"]),
            version=str(document["version"]),
            maxitor=str(document["requires"]["maxitor"]),
            sdk=int(document["sdk"]) if document.get("sdk") is not None else None,
            formats=dict(document.get("formats") or {"plugin-passport": int(document["passport"])}),
            dependencies=tuple(Dependency(str(d["id"]), str(d["version"])) for d in document.get("dependencies") or ()),
        )

    @property
    def label(self) -> str:
        """``io.github.acme.tags 2.1.0``."""
        return f"{self.id} {self.version}"


@dataclass(frozen=True)
class Refusal:
    """One conflict: its kind, the sides it involves, and a sentence that names them."""

    kind: Kind
    sides: tuple[str, ...]
    message: str


@dataclass(frozen=True)
class Change:
    """Installing or upgrading ``plugin``, or removing the plugin ``removed``."""

    action: Literal["install", "upgrade", "remove"]
    plugin: PluginPassport | None = None
    removed: str | None = None


def decide(core: CorePassport, plugins: Iterable[PluginPassport]) -> list[Refusal]:
    """
    AI-CORE-BEGIN
    ROLE: Decide a whole set of plugins against one core.
    CONTRACT: Empty when everything fits; otherwise every refusal, each naming every side of its conflict.
    AI-CORE-END
    """
    plugins = list(plugins)
    refusals: list[Refusal] = []
    refusals += _two_versions(plugins)
    by_id = {p.id: p for p in plugins}
    for plugin in plugins:
        refusals += _formats(core, plugin)
        refusals += _core_range(core, plugin)
        refusals += _sdk_major(core, plugin)
        refusals += _dependencies(plugin, by_id)
    cycle = find_cycle({p.id: [d.id for d in p.dependencies] for p in plugins})
    if cycle is not None:
        refusals.append(
            Refusal(
                "cycle",
                tuple(dict.fromkeys(cycle)),
                f"the plugins depend on each other in a circle: {' → '.join(cycle)}",
            )
        )
    return refusals


def decide_change(core: CorePassport, installed: Iterable[PluginPassport], change: Change) -> list[Refusal]:
    """
    AI-CORE-BEGIN
    ROLE: Decide one installation, upgrade or removal against the plugins already installed.
    CONTRACT: The set is decided as it would stand after the change; a refusal a removal or an upgrade causes in
        a dependent names the change too, so the reader sees which plugin breaks which.
    AI-CORE-END
    """
    before = {p.id: p for p in installed}
    after = dict(before)
    if change.action == "remove":
        if change.removed is None:
            raise ValueError("a removal names the plugin it removes")
        after.pop(change.removed, None)
        cause = f"removing {before[change.removed].label}" if change.removed in before else f"removing {change.removed}"
    else:
        if change.plugin is None:
            raise ValueError("an installation or an upgrade names its plugin")
        old = before.get(change.plugin.id)
        if change.action == "install" and old is not None:
            return [
                Refusal(
                    "two_versions",
                    (old.label, change.plugin.label),
                    f"{change.plugin.id} is installed as {old.version}; installing {change.plugin.version} beside it would make two versions of one plugin — upgrade it instead",
                )
            ]
        after[change.plugin.id] = change.plugin
        cause = f"upgrading {old.label} to {change.plugin.version}" if old else f"installing {change.plugin.label}"
    refusals = decide(core, after.values())
    if change.action == "install":
        return refusals
    return [_blamed(r, cause) if r.kind == "dependency" else r for r in refusals]


def _blamed(refusal: Refusal, cause: str) -> Refusal:
    """A dependent's refusal, said as what the change does to it."""
    return Refusal(refusal.kind, (*refusal.sides, cause), f"{cause} breaks a dependent: {refusal.message}")


def _two_versions(plugins: Sequence[PluginPassport]) -> list[Refusal]:
    seen: dict[str, list[str]] = {}
    for plugin in plugins:
        seen.setdefault(plugin.id, []).append(plugin.version)
    return [
        Refusal(
            "two_versions",
            tuple(f"{plugin_id} {v}" for v in versions),
            f"{plugin_id} is there twice, as {' and '.join(versions)}: one installation holds one version of a plugin",
        )
        for plugin_id, versions in seen.items()
        if len(versions) > 1
    ]


def _formats(core: CorePassport, plugin: PluginPassport) -> list[Refusal]:
    refusals = []
    for kind, written in plugin.formats.items():
        read = list(core.reads.get(kind, ()))
        if written not in read:
            reads = ", ".join(str(f) for f in read) or "none"
            refusals.append(
                Refusal(
                    "format",
                    (plugin.label, f"maxitor {core.version}"),
                    f"{plugin.label} writes its {kind} in format {written}; maxitor {core.version} reads {kind} in format {reads}",
                )
            )
    return refusals


def _core_range(core: CorePassport, plugin: PluginPassport) -> list[Refusal]:
    if _within(core.version, plugin.maxitor):
        return []
    return [
        Refusal(
            "core_range",
            (plugin.label, f"maxitor {core.version}"),
            f"{plugin.label} needs maxitor {plugin.maxitor}; this core is maxitor {core.version}",
        )
    ]


def _sdk_major(core: CorePassport, plugin: PluginPassport) -> list[Refusal]:
    if plugin.sdk == core.sdk:
        return []
    built = f"SDK {plugin.sdk}" if plugin.sdk is not None else "no SDK major in its passport"
    return [
        Refusal(
            "sdk_major",
            (plugin.label, f"maxitor {core.version}"),
            f"{plugin.label} is built with {built}; maxitor {core.version} is built with SDK {core.sdk}",
        )
    ]


def _dependencies(plugin: PluginPassport, by_id: Mapping[str, PluginPassport]) -> list[Refusal]:
    refusals = []
    for needed in plugin.dependencies:
        if needed.id == plugin.id:
            continue
        present = by_id.get(needed.id)
        if present is None:
            refusals.append(
                Refusal(
                    "dependency",
                    (plugin.label, needed.id),
                    f"{plugin.label} needs {needed.id} {needed.versions}, and {needed.id} is not installed",
                )
            )
        elif not _within(present.version, needed.versions):
            refusals.append(
                Refusal(
                    "dependency",
                    (plugin.label, present.label),
                    f"{plugin.label} needs {needed.id} {needed.versions}, and {present.label} is installed",
                )
            )
    return refusals


def _within(version: str, versions: str) -> bool:
    """Whether ``version`` is one of ``versions``; a malformed one never is."""
    try:
        return SpecifierSet(versions).contains(Version(version), prereleases=True)
    except (InvalidSpecifier, InvalidVersion):
        return False
