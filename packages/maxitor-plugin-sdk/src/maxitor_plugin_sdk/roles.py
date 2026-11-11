# packages/maxitor-plugin-sdk/src/maxitor_plugin_sdk/roles.py
"""
The core's roles, as a plugin's actions check them. A plugin has no roles of its own: the token the core's gateway
issues carries the person's role in the core in the organization of the address, and the plugin works with it as it is.

::

    @check_roles(MemberRole)          every active user of the organization
    @check_roles(AdministratorRole)   the organization's administrators
    @check_roles(ServiceRole)         the plugin itself, with no person behind the call
"""

from __future__ import annotations

from aoa.action_machine.auth import ApplicationRole


class MemberRole(ApplicationRole):
    """
    AI-CORE-BEGIN
    ROLE: An active user of the organization of the address.
    CONTRACT: Granted by the claim ``roles`` of a token the core issued; never declared by a plugin.
    AI-CORE-END
    """

    name = "member"
    description = "An active user of the organization of the address"


class AdministratorRole(ApplicationRole):
    """
    AI-CORE-BEGIN
    ROLE: An administrator of the organization of the address.
    CONTRACT: Granted together with ``member`` to the organization's administrators.
    AI-CORE-END
    """

    name = "administrator"
    description = "An administrator of the organization of the address"


class ServiceRole(ApplicationRole):
    """
    AI-CORE-BEGIN
    ROLE: The plugin itself, calling with its service key and no person.
    CONTRACT: Granted only to a service token, whose subject is ``plugin:<id>``.
    AI-CORE-END
    """

    name = "service"
    description = "The plugin itself, with no person behind the call"


#: Every role a token may carry, by its name: a plugin's token coordinator maps the claim ``roles`` with it.
CORE_ROLES: dict[str, type[ApplicationRole]] = {
    MemberRole.name: MemberRole,
    AdministratorRole.name: AdministratorRole,
    ServiceRole.name: ServiceRole,
}
#: The roles a node of navigation.yaml may ask for: a person sees the tree, a service does not.
NODE_ROLES = frozenset({MemberRole.name, AdministratorRole.name})
