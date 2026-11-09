# packages/maxitor/maxitor-core/maxitor/core/actions/passport.py
"""
CorePassportAction — the core's identity: its version and the formats of a plugin's files it reads.

::

    GET /api/v1/core/passport   {passport, id, version, reads, sdk}

The file ``maxitor-core.yaml`` beside the package names the formats; the version is the installed ``maxitor``
package's, so the two never disagree.
"""

from __future__ import annotations

from functools import cache
from importlib.metadata import version
from pathlib import Path
from typing import Any

import yaml
from maxitor.core.domains import PlatformDomain
from pydantic import Field

from aoa.action_machine.auth import GuestRole
from aoa.action_machine.intents.aspects import summary_aspect
from aoa.action_machine.intents.check_roles import check_roles
from aoa.action_machine.intents.meta import meta
from aoa.action_machine.model import BaseAction, BaseParams, BaseResult, BaseState
from aoa.action_machine.resources import Connections
from aoa.action_machine.runtime.tools_box import ToolsBox

#: The passport file, shipped inside the package.
PASSPORT_FILE = Path(__file__).resolve().parent.parent / "maxitor-core.yaml"


@cache
def core_passport() -> dict[str, Any]:
    """The passport as the file names it, with the package's version."""
    document = yaml.safe_load(PASSPORT_FILE.read_text(encoding="utf-8"))
    return {**document, "version": version("maxitor")}


class PassportParams(BaseParams):
    """Nothing: the passport is the core's own."""


class CorePassportResult(BaseResult):
    """The core's passport."""

    passport: int = Field(description="The format of the passport")
    id: str = Field(description="The core's identity: maxitor")
    version: str = Field(description="The core's version: the version of the maxitor package")
    reads: dict[str, list[int]] = Field(description="Each kind of a plugin's file and the formats of it the core reads")
    sdk: int = Field(description="The major version of maxitor-plugin-sdk the core is built with")


@meta(
    description="Answer the core's passport: its version and the formats of a plugin's files it reads",
    domain=PlatformDomain,
)
@check_roles(GuestRole)
class CorePassportAction(BaseAction[PassportParams, CorePassportResult]):
    """
    AI-CORE-BEGIN
    ROLE: Tell a plugin's installer and its author which core this is.
    CONTRACT: Open to everyone; the answer is the passport file with the package's version.
    AI-CORE-END
    """

    @summary_aspect("Read the passport")
    async def passport_summary(
        self, params: PassportParams, state: BaseState, box: ToolsBox, connections: Connections
    ) -> CorePassportResult:
        """The file and the version, read once per process."""
        _ = (params, state, box, connections)
        return CorePassportResult(**core_passport())
