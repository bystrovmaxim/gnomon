# packages/maxitor/maxitor-core/maxitor/core/plugins/actions/check_version_action.py
"""
CheckVersionAction — the installer checks one draft version: active, rejected with the reason, or still draft.

::

    the wheel ──► in the store by its sha256? ── no ──► download it (limits, allowed hosts) ──► store it
        │                                                    └── timeout / unreachable ──► stays draft, with the reason
        ▼
    read it as a zip only ──► passport 2 ──► schema.yaml ──► navigation ──► keys to the core ──► the core's range
        ──► its id and name are free, or the plugin is the same owner's ──► active
    any fault ──► rejected, with its reason

A version is added under a plugin that waits for it (``pending.<version id>``): the check gives that plugin the id,
name, title and description of the passport, or moves the version under the plugin of the same owner that already has
that id. A plugin's id and name are unique across the marketplace, private plugins included (FR-011).
"""

from __future__ import annotations

import json
import uuid
from importlib.metadata import version as package_version
from pathlib import Path
from typing import Any, Literal, cast

import maxitor_plugin_sdk
import yaml
from jsonschema import Draft202012Validator
from maxitor.core.plugins.core_keys import CoreKeysError, core_keys
from maxitor.core.plugins.events import DownloadTimedOutEvent, VersionActivatedEvent, VersionRejectedEvent
from maxitor.core.plugins.gateways.wheel_source_gateway import (
    WHEEL_SOURCE_CONNECTION_KEY,
    WheelSourceError,
    WheelSourceGateway,
)
from maxitor.core.plugins.installer_role import InstallerRole
from maxitor.core.plugins.plugins_domain import PluginsDomain
from maxitor.core.plugins.storage.deploy_storage import DEPLOY_CONNECTION_KEY, DeployStorage
from maxitor.core.plugins.storage.wheel_storage import (
    WHEELS_CONNECTION_KEY,
    WheelHashError,
    WheelStorage,
    WheelTooLargeError,
)
from maxitor.core.plugins.wheel import WheelContents, WheelRefusedError, read_wheel
from maxitor_plugin_sdk.checks import node_role_problems, passport_role_problems
from maxitor_plugin_sdk.plugin_schema import PluginSchemaError, parse_plugin_schema
from packaging.specifiers import InvalidSpecifier, SpecifierSet
from pydantic import Field

from aoa.action_machine.exceptions.handle_error import HandleError
from aoa.action_machine.intents.aspects import summary_aspect
from aoa.action_machine.intents.check_roles import check_roles
from aoa.action_machine.intents.connection import connection
from aoa.action_machine.intents.emits import emits
from aoa.action_machine.intents.meta import meta
from aoa.action_machine.logging import Channel
from aoa.action_machine.model import BaseAction, BaseParams, BaseResult, BaseState
from aoa.action_machine.resources import Connections
from aoa.action_machine.runtime.tools_box import ToolsBox

SCHEMAS = Path(maxitor_plugin_sdk.__file__).parent / "schemas"
#: A waiting plugin's id starts with this; the check replaces it with the passport's.
PENDING = "pending."


class VersionRejectedError(Exception):
    """The version fails its check; ``reason`` is the code the event carries, ``detail`` what the page shows."""

    def __init__(self, reason: str, detail: str) -> None:
        super().__init__(detail)
        self.reason = reason
        self.detail = detail


class CheckParams(BaseParams):
    """One draft version."""

    version_id: str = Field(description="The version to check")


class CheckResult(BaseResult):
    """How the check ended."""

    state: Literal["active", "rejected", "draft", "gone", "busy"] = Field(
        description="active; rejected with its reason; draft when the wheel could not be had yet; gone when the"
        " version is no longer a draft; busy when another installer is checking it",
    )


def _validator(name: str) -> Draft202012Validator:
    return Draft202012Validator(json.loads((SCHEMAS / f"{name}.schema.json").read_text(encoding="utf-8")))


def _sections(contents: WheelContents) -> list[dict[str, Any]]:
    """The top level of the navigation: the nodes attached to the root, by their order."""
    text = contents.file((contents.passport.get("frontend") or {}).get("navigation"))
    if text is None:
        raise VersionRejectedError("navigation", "the passport's navigation file is not in the wheel")
    navigation = yaml.safe_load(text)
    problems = [e.message for e in _validator("navigation-1").iter_errors(navigation)]
    if problems:
        raise VersionRejectedError("navigation", problems[0])
    roles = node_role_problems(navigation)
    if roles:
        raise VersionRejectedError("navigation", roles[0])
    nodes = [n for n in navigation.get("nodes") or [] if n.get("attach") == "root"]
    nodes.sort(key=lambda n: (n.get("order", 0), n.get("id", "")))
    return [{"title": str(n["title"]), "path": str(n.get("page") or "")} for n in nodes]


def inspect(contents: WheelContents) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """The passport and the sections of a wheel that passes every rule a wheel alone can show; raise ``VersionRejectedError``."""
    passport = contents.passport
    if passport.get("passport") == 1:
        raise VersionRejectedError("passport", "passport 1 carries migrations; Maxitor builds tables from schema.yaml since passport 2")
    problems = [e.message for e in _validator("plugin-passport-2").iter_errors(passport)]
    if problems:
        raise VersionRejectedError("passport", problems[0])
    roles = passport_role_problems(passport)
    if roles:
        raise VersionRejectedError("passport", roles[0])
    if contents.dist_version and contents.dist_version != passport["version"]:
        raise VersionRejectedError("passport", f"the passport says {passport['version']}, the wheel {contents.dist_version}")
    try:
        schema = parse_plugin_schema(contents.file(passport["database"]["schema"]) or "")
        core_keys(contents.file(passport["database"].get("foreign_keys")), schema)
    except PluginSchemaError as error:
        raise VersionRejectedError("schema", error.problems[0]) from None
    except CoreKeysError as error:
        raise VersionRejectedError("foreign_keys", str(error)) from None
    sections = _sections(contents)
    core = package_version("maxitor")
    try:
        fits = SpecifierSet(passport["requires"]["maxitor"]).contains(core, prereleases=True)
    except InvalidSpecifier:
        fits = False
    if not fits:
        raise VersionRejectedError("core_range", f"the plugin needs core {passport['requires']['maxitor']}; this core is {core}")
    return passport, sections


@meta(description="Check a draft plugin version: its wheel, passport, tables, navigation and the core's range", domain=PluginsDomain)
@check_roles(InstallerRole)
@connection(DeployStorage, key=DEPLOY_CONNECTION_KEY, description="The schema plugins, as maxitor_installer")
@connection(WheelStorage, key=WHEELS_CONNECTION_KEY, description="The wheels Maxitor keeps, by SHA-256")
@connection(WheelSourceGateway, key=WHEEL_SOURCE_CONNECTION_KEY, description="Where wheels are downloaded from")
class CheckVersionAction(BaseAction[CheckParams, CheckResult]):
    """
    AI-CORE-BEGIN
    ROLE: Decide whether a version may be installed.
    CONTRACT: active when the wheel, its passport 2, schema.yaml, navigation, keys and the core's range hold and its
        id and name are free; rejected with the reason otherwise; draft with the reason while the wheel cannot be had.
    INVARIANTS: The wheel is only read, never run; it is kept by its hash before it is read.
    AI-CORE-END
    """

    @summary_aspect("Have the wheel, read it, check every rule, then record active or rejected")
    @emits(VersionActivatedEvent, VersionRejectedEvent, DownloadTimedOutEvent)
    async def check_summary(
        self, params: CheckParams, state: BaseState, box: ToolsBox, connections: Connections
    ) -> CheckResult:
        """Held for the whole check, so two installers never check one version; the verdict in one transaction."""
        _ = state
        store = cast(DeployStorage, connections[DEPLOY_CONNECTION_KEY])
        key = f"check:{params.version_id}"
        if not await store.try_hold(key):
            return CheckResult(state="busy")
        try:
            return await self._check(params, box, connections, store)
        finally:
            await store.release(key)

    async def _check(
        self, params: CheckParams, box: ToolsBox, connections: Connections, store: DeployStorage
    ) -> CheckResult:
        """Each refusal raises ``VersionRejectedError``; the end records the verdict in one transaction."""
        found = await store.version(params.version_id)
        if found is None or found["state"] != "draft":
            return CheckResult(state="gone")
        try:
            data = await self._wheel(found, connections)
            passport, sections = inspect(read_wheel(data))
            await self._activate(store, found, passport, sections)
        except WheelSourceError as error:
            await self._record(store, found, "draft", f"{error.reason}: {error.detail}")
            await box.warning(
                Channel.business,
                "The wheel of {%var.version_id} could not be had: {%var.reason}",
                DownloadTimedOutEvent(version_id=found["id"], purl=found["purl"], reason=error.reason),
            )
            return CheckResult(state="draft")
        except (VersionRejectedError, WheelRefusedError) as error:
            await self._record(store, found, "rejected", f"{error.reason}: {error.detail}")
            await box.warning(
                Channel.business,
                "Version {%var.version_id} rejected: {%var.reason}",
                VersionRejectedEvent(version_id=found["id"], purl=found["purl"], reason=error.reason),
            )
            return CheckResult(state="rejected")
        await box.info(
            Channel.business,
            "Version {%var.passport_id} {%var.version} is active",
            VersionActivatedEvent(version_id=found["id"], passport_id=passport["id"], version=passport["version"]),
        )
        return CheckResult(state="active")

    @staticmethod
    async def _wheel(found: dict[str, Any], connections: Connections) -> bytes:
        """The wheel from the store, or downloaded and stored."""
        wheels = cast(WheelStorage, connections[WHEELS_CONNECTION_KEY])
        data = wheels.read(found["sha256"])
        if data is not None:
            return data
        if str(found["purl"]).startswith("pkg:generic/"):
            raise VersionRejectedError("not_a_wheel", "the uploaded wheel is not in the store")
        gateway = cast(WheelSourceGateway, connections[WHEEL_SOURCE_CONNECTION_KEY])
        try:
            data = await gateway.download(found["purl"])
        except WheelSourceError as error:
            if error.reason in ("closed_repository", "too_large"):
                raise VersionRejectedError(error.reason, error.detail) from None
            raise
        try:
            wheels.put(data, found["sha256"])
        except WheelHashError as error:
            raise VersionRejectedError("hash", str(error)) from None
        except WheelTooLargeError as error:
            raise VersionRejectedError("too_large", str(error)) from None
        return data

    async def _activate(
        self, store: DeployStorage, found: dict[str, Any], passport: dict[str, Any], sections: list[dict[str, Any]]
    ) -> None:
        """Give the version its plugin, dependencies and sections, and make it active — or raise ``VersionRejectedError``."""
        owner = found["owner_organization_id"]
        same_id = await store.plugin_by_passport(passport["id"])
        target = found["plugin_id"]
        if same_id is not None and same_id["id"] != found["plugin_id"]:
            if same_id["owner_organization_id"] != owner:
                raise VersionRejectedError("id_taken", f"the id {passport['id']} is already in the marketplace")
            target = same_id["id"]
        same_name = await store.plugin_by_name(passport["name"])
        if same_name is not None and same_name["passport_id"] != passport["id"]:
            raise VersionRejectedError("name_taken", f"the name {passport['name']} is already in the marketplace")
        operation = type(self).__name__

        async def work() -> None:
            current = await store.version(found["id"])
            if current is None or current["state"] != "draft":
                return
            changed = await store.plugin_lock(target)
            if target == found["plugin_id"]:
                await store.update(
                    "plugin",
                    {"id": target},
                    {
                        "passport_id": passport["id"],
                        "name": passport["name"],
                        "title": passport["title"],
                        "description": passport["description"],
                        "updated_at": changed,
                    },
                    changed,
                    None,
                    operation,
                )
            else:
                await store.update(
                    "plugin", {"id": found["plugin_id"]}, {"state": "withdrawn", "updated_at": changed}, changed, None, operation
                )
            for dependency in passport.get("dependencies") or []:
                await store.insert(
                    "plugin_dependency",
                    {
                        "id": str(uuid.uuid4()),
                        "plugin_version_id": found["id"],
                        "passport_id": dependency["id"],
                        "version_range": dependency["version"],
                        "created_at": changed,
                        "updated_at": None,
                    },
                    changed,
                    None,
                    operation,
                )
            for position, section in enumerate(sections, start=1):
                await store.insert(
                    "plugin_section",
                    {
                        "id": str(uuid.uuid4()),
                        "plugin_version_id": found["id"],
                        "position": position,
                        "title": section["title"],
                        "path": section["path"],
                        "created_at": changed,
                        "updated_at": None,
                    },
                    changed,
                    None,
                    operation,
                )
            await store.update(
                "plugin_version",
                {"id": found["id"]},
                {
                    "plugin_id": target,
                    "version": passport["version"],
                    "core_range": passport["requires"]["maxitor"],
                    "state": "active",
                    "reason": None,
                    "checked_at": changed,
                    "updated_at": changed,
                },
                changed,
                None,
                operation,
            )

        try:
            await store.in_transaction(work)
        except HandleError as error:
            raise VersionRejectedError("passport", f"the marketplace refused the version: {error.__cause__ or error}") from None

    async def _record(self, store: DeployStorage, found: dict[str, Any], state: str, reason: str) -> None:
        """Record a rejection, or why the version still waits, in a transaction of its own."""

        async def work() -> None:
            changed = await store.plugin_lock(found["plugin_id"])
            checked = {"checked_at": changed} if state == "rejected" else {}
            await store.update(
                "plugin_version",
                {"id": found["id"]},
                {"state": state, "reason": reason[:500], "updated_at": changed, **checked},
                changed,
                None,
                type(self).__name__,
            )

        await store.in_transaction(work)
