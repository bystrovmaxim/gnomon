# packages/maxitor-plugin-template/src/maxitor_notes/organization_member.py
"""OrganizationMember — the person of the core's token, in the organization of the request's address."""

from __future__ import annotations

from pydantic import Field

from aoa.action_machine.context import UserInfo

#: An organization's code as it stands in an address: lower-case ASCII letters, digits and hyphens.
ORGANIZATION_CODE_PATTERN = r"^[a-z0-9][a-z0-9-]{0,63}$"


class OrganizationMember(UserInfo):
    """
    AI-CORE-BEGIN
    ROLE: Carry the organization of the address from the request to the actions.
    CONTRACT: ``organization`` is the address's organization code, which Maxitor's gateway has checked;
    actions check membership in it again before touching its data.
    INVARIANTS: Never taken from a request body.
    AI-CORE-END
    """

    organization: str = Field(pattern=ORGANIZATION_CODE_PATTERN, description="The organization of the request's address")
