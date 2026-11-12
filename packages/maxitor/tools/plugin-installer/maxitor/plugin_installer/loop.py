# packages/maxitor/tools/plugin-installer/maxitor/plugin_installer/loop.py
"""
The installer's loop: on start and then every period, take up the queue and finish each row in a call of its own.

::

    TakeUpPendingAction ──► for each version: CheckVersionAction
                        └─► for each install: BuildFrontendAction, then DeployAndInstallAction
    the database refuses the connection ──► ReportConnectionRefusedAction, and the next round tries again

Every step is an action of the domain plugins run by the machine with the installer's own context; there is no
route. A row another installer holds is left to it; a failed row records its reason and the loop goes on.
"""

from __future__ import annotations

import asyncio
from collections.abc import Mapping
from typing import Any

from maxitor.core.plugins.actions.build_frontend_action import BuildFrontendAction, BuildParams
from maxitor.core.plugins.actions.check_version_action import CheckParams, CheckVersionAction
from maxitor.core.plugins.actions.deploy_and_install_action import DeployAndInstallAction, DeployParams
from maxitor.core.plugins.actions.report_connection_refused_action import RefusedParams, ReportConnectionRefusedAction
from maxitor.core.plugins.actions.take_up_pending_action import TakeUpParams, TakeUpPendingAction
from maxitor.core.plugins.installer_role import InstallerRole

from aoa.action_machine.context.context import Context
from aoa.action_machine.context.user_info import UserInfo
from aoa.action_machine.exceptions.handle_error import HandleError
from aoa.action_machine.resources.connection_scope import connection_scope
from aoa.action_machine.runtime.action_product_machine import ActionProductMachine

#: The context every installer action runs in: the installer, never a person.
INSTALLER = Context(user=UserInfo(user_id="plugin-installer", roles=(InstallerRole,)))


def declared(action: type[Any], connections: Mapping[str, Any]) -> dict[str, Any]:
    """The connections an action declares, out of all the installer has."""
    return {info.key: connections[info.key] for info in getattr(action, "_connection_info", [])}


async def run_action(machine: ActionProductMachine, connections: Mapping[str, Any], action: Any, params: Any) -> Any:
    """Run one action with the connections it declares, each opened for this call and closed after it."""
    async with connection_scope(declared(type(action), connections)) as resolved:
        return await machine.run(INSTALLER, action, params, resolved)


async def one_round(machine: ActionProductMachine, connections: Mapping[str, Any], *, started: bool) -> int:
    """Take up the queue once and finish every row; answer how many rows were worked on."""
    queue = await run_action(machine, connections, TakeUpPendingAction(), TakeUpParams(started=started))
    for version_id in queue.versions:
        await run_action(machine, connections, CheckVersionAction(), CheckParams(version_id=version_id))
    for install in queue.installs:
        # The frontend first and with no lock held: the deployment takes a version only once it is built.
        await run_action(machine, connections, BuildFrontendAction(), BuildParams(version_id=install.version_id))
        await run_action(
            machine,
            connections,
            DeployAndInstallAction(),
            DeployParams(organization_id=install.organization_id, row_id=install.row_id),
        )
    return len(queue.versions) + len(queue.installs)


async def run_forever(machine: ActionProductMachine, connections: Mapping[str, Any], period_seconds: float) -> None:
    """Round after round, ``period_seconds`` apart, until the process is stopped."""
    started = True
    while True:
        try:
            await one_round(machine, connections, started=started)
            started = False
        except HandleError as error:
            # The storage could not be opened: nothing was taken up, and the next round tries again, still as a start.
            await run_action(machine, connections, ReportConnectionRefusedAction(), RefusedParams(reason=str(error)[:500]))
        await asyncio.sleep(period_seconds)
