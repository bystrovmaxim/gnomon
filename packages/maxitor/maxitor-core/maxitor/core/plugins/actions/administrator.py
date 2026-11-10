# packages/maxitor/maxitor-core/maxitor/core/plugins/actions/administrator.py
"""
What every action of the page Settings → Plugins shares: only an active administrator of the organization of the
address gets through; anyone else is refused exactly as for an organization or a page that does not exist (FR-026h).
"""

from __future__ import annotations

from importlib.metadata import version
from typing import Any, cast

from maxitor.core.plugins.storage.plugins_storage import PLUGINS_CONNECTION_KEY, PluginsStorage
from packaging.specifiers import InvalidSpecifier, SpecifierSet

from aoa.action_machine.exceptions.access_denied import AccessDenied
from aoa.action_machine.intents.access_control import FORBIDDEN_OBJECT, Allowed, Verdict
from aoa.action_machine.resources import Connections


def plugins(connections: Connections) -> PluginsStorage:
    """The schema plugins, as the core's web process reaches it."""
    return cast(PluginsStorage, connections[PLUGINS_CONNECTION_KEY])


async def administrator(connections: Connections, code: str, account_id: str) -> dict[str, Any] | None:
    """The organization ``code`` and the account's user in it, when that user is an active administrator."""
    found = await plugins(connections).organization_for(code, account_id)
    return found if found is not None and found["is_admin"] else None


async def administrator_verdict(connections: Connections, code: str, account_id: str) -> Verdict:
    """``Allowed`` for an active administrator; the same refusal as for a made-up address otherwise."""
    return Allowed() if await administrator(connections, code, account_id) is not None else FORBIDDEN_OBJECT


async def administered(connections: Connections, code: str, account_id: str) -> dict[str, Any]:
    """The organization, read again in the main step: the role may end between the decision and here."""
    found = await administrator(connections, code, account_id)
    if found is None:
        raise AccessDenied(FORBIDDEN_OBJECT)
    return found


def fits_core(core_range: str | None) -> bool:
    """Whether the running core is inside ``core_range``."""
    if not core_range:
        return False
    try:
        return SpecifierSet(core_range).contains(version("maxitor"), prereleases=True)
    except InvalidSpecifier:
        return False
