# packages/maxitor/maxitor-core/maxitor/core/plugins/actions/deploy_and_install_action.py
"""
DeployAndInstallAction — the installer finishes one install: deploys its version if no organization has, and enables it.

::

    installing ──▶ (version not deployed? build it) ──▶ enabled
         └──────▶ any failure: nothing built, nothing of the organization changed ──▶ failed (with the reason)

Deploying and enabling are one transaction under the row's claim, the version's lock and the organization's lock;
the version's environment file is written inside it and removed if it rolls back.
"""

from __future__ import annotations

import hashlib
import secrets
from typing import Literal, cast

from maxitor.core.plugins.core_keys import CoreKeysError, core_keys
from maxitor.core.plugins.events import (
    DeployFailedEvent,
    DeploySkippedEvent,
    PluginInstalledEvent,
    VersionDeployedEvent,
)
from maxitor.core.plugins.installer_role import InstallerRole
from maxitor.core.plugins.plugins_domain import PluginsDomain
from maxitor.core.plugins.scram import scram_verifier
from maxitor.core.plugins.storage.deploy_storage import DEPLOY_CONNECTION_KEY, DeployStorage
from maxitor.core.plugins.storage.plugin_runtime_storage import RUNTIME_CONNECTION_KEY, PluginRuntimeStorage
from maxitor.core.plugins.storage.wheel_storage import WHEELS_CONNECTION_KEY, WheelStorage
from maxitor.core.plugins.wheel import WheelRefusedError, read_wheel
from maxitor_plugin_sdk.plugin_schema import PluginSchemaError, parse_plugin_schema
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

#: What may go wrong while a version is read or built; anything else is a fault of the installer itself.
DEPLOY_FAILURES = (HandleError, WheelRefusedError, PluginSchemaError, CoreKeysError, ValueError, OSError)


class DeployParams(BaseParams):
    """One install waiting for the installer."""

    organization_id: str = Field(description="The organization")
    row_id: str = Field(description="The organization's plugin row, in installing")


class DeployResult(BaseResult):
    """How the install ended."""

    state: Literal["enabled", "failed", "busy", "gone"] = Field(
        description="enabled; failed with the reason kept in the row; busy when another installer holds the row;"
        " gone when the row is no longer installing",
    )


def schema_name_of(name: str, version: str) -> str:
    """The schema of a version: the plugin's name and its numbers, ``notes_1_2_0``."""
    return f"{name}_{version.replace('.', '_')}"


@meta(description="Deploy an install's version if it is not deployed yet, and enable the plugin", domain=PluginsDomain)
@check_roles(InstallerRole)
@connection(DeployStorage, key=DEPLOY_CONNECTION_KEY, description="The schema plugins, as maxitor_installer")
@connection(WheelStorage, key=WHEELS_CONNECTION_KEY, description="The wheels Maxitor keeps, by SHA-256")
@connection(PluginRuntimeStorage, key=RUNTIME_CONNECTION_KEY, description="The environment files of deployed versions")
class DeployAndInstallAction(BaseAction[DeployParams, DeployResult]):
    """
    AI-CORE-BEGIN
    ROLE: Finish one install, in the installer's process.
    CONTRACT: A version is built at most once for all of Maxitor; a failure leaves no schema, user, table or file and
        the row failed with the reason; a row another installer holds is left alone.
    INVARIANTS: The version user's password goes only into its environment file; the database sees its verifier.
    AI-CORE-END
    """

    @summary_aspect("Claim the row, build the version if needed, enable the plugin — or record why not")
    @emits(VersionDeployedEvent, DeploySkippedEvent, PluginInstalledEvent, DeployFailedEvent)
    async def deploy_summary(
        self, params: DeployParams, state: BaseState, box: ToolsBox, connections: Connections
    ) -> DeployResult:
        """One transaction; on failure a second one records it."""
        _ = state
        store = cast(DeployStorage, connections[DEPLOY_CONNECTION_KEY])
        runtime = cast(PluginRuntimeStorage, connections[RUNTIME_CONNECTION_KEY])
        row = await store.row(params.organization_id, params.row_id)
        if row is None or row["state"] != "installing":
            return DeployResult(state="gone")
        version = await store.version(row["version_id"])
        if version is None:
            return DeployResult(state="gone")
        schema_name = schema_name_of(version["name"], version["version"])
        user, password = f"plg_{schema_name}", secrets.token_urlsafe(32)
        service_key = secrets.token_urlsafe(32)
        operation = type(self).__name__
        wrote_env = False

        async def work() -> str:
            nonlocal wrote_env
            if not await store.try_claim(f"install:{params.row_id}"):
                return "busy"
            await store.version_lock(version["id"])
            current = await store.version(version["id"])
            built = current is not None and current["schema_name"] is None
            if built:
                wheel = cast(WheelStorage, connections[WHEELS_CONNECTION_KEY]).read(version["sha256"])
                if wheel is None:
                    raise ValueError(f"the wheel {version['sha256']} is not in the store")
                contents = read_wheel(wheel)
                database = contents.passport.get("database") or {}
                plugin_schema = parse_plugin_schema(contents.file(database.get("schema")) or "")
                keys = core_keys(contents.file(database.get("foreign_keys")), plugin_schema)
                runtime.write_env(schema_name, user, password, service_key)
                wrote_env = True
                await store.build_version(schema_name, user, scram_verifier(password), plugin_schema, keys)
                changed = await store.plugin_lock(version["plugin_id"])
                await store.update(
                    "plugin_version",
                    {"id": version["id"]},
                    {
                        "schema_name": schema_name,
                        "database_user": user,
                        "service_key_hash": hashlib.sha256(service_key.encode("utf-8")).hexdigest(),
                        "deployed_at": changed,
                        "updated_at": changed,
                    },
                    changed,
                    None,
                    operation,
                )
            changed = await store.organization_lock(params.organization_id)
            await store.update(
                "organization_plugin",
                {"organization_id": params.organization_id, "id": params.row_id},
                {"state": "enabled", "reason": None, "updated_at": changed},
                changed,
                None,
                operation,
            )
            return "built" if built else "skipped"

        try:
            outcome = await store.in_transaction(work)
        except DEPLOY_FAILURES as error:
            if wrote_env:
                runtime.remove_env(schema_name)
            reason = _reason(error)
            await self._fail(store, params, reason, operation)
            await box.critical(
                Channel.business,
                "Deploying {%var.passport_id} {%var.version} for {%var.organization_id} failed: {%var.reason}",
                DeployFailedEvent(
                    organization_id=params.organization_id,
                    passport_id=version["passport_id"],
                    version=version["version"],
                    reason=reason,
                ),
            )
            return DeployResult(state="failed")
        if outcome == "busy":
            return DeployResult(state="busy")
        if outcome == "built":
            await box.info(
                Channel.business,
                "Version {%var.passport_id} {%var.version} deployed as {%var.schema_name}",
                VersionDeployedEvent(
                    passport_id=version["passport_id"], version=version["version"], schema_name=schema_name
                ),
            )
        else:
            await box.info(
                Channel.business,
                "{%var.passport_id} already deployed as {%var.schema_name}; nothing built for {%var.organization_id}",
                DeploySkippedEvent(
                    organization_id=params.organization_id, passport_id=version["passport_id"], schema_name=schema_name
                ),
            )
        await box.info(
            Channel.business,
            "{%var.passport_id} {%var.version} installed in {%var.organization_id}",
            PluginInstalledEvent(
                organization_id=params.organization_id, passport_id=version["passport_id"], version=version["version"]
            ),
        )
        return DeployResult(state="enabled")

    @staticmethod
    async def _fail(store: DeployStorage, params: DeployParams, reason: str, operation: str) -> None:
        """Record the failure in a transaction of its own."""

        async def work() -> None:
            changed = await store.organization_lock(params.organization_id)
            await store.update(
                "organization_plugin",
                {"organization_id": params.organization_id, "id": params.row_id},
                {"state": "failed", "reason": reason, "updated_at": changed},
                changed,
                None,
                operation,
            )

        await store.in_transaction(work)


def _reason(error: Exception) -> str:
    """What failed, in a line a page can show; the database's own words when it was the database."""
    cause = error.__cause__ if isinstance(error, HandleError) and error.__cause__ is not None else error
    return f"{type(cause).__name__}: {cause}"[:500]
