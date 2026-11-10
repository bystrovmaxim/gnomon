# packages/maxitor/maxitor-core/maxitor/core/server.py
"""
The core's backend: every address an action, declared by the chain of ``FastApiAdapter``.

Each action gets exactly the connections it declares, per call: the storage from one pool, the gateways and the
tokens as they were built from the settings. A refusal of the core becomes its HTTP answer.
"""

from __future__ import annotations

from collections.abc import AsyncIterator, Callable, Mapping
from contextlib import asynccontextmanager
from importlib.metadata import version
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from maxitor.core.actions.account import (
    AcceptPolicyAction,
    CreateAccountAction,
    CurrentUserAction,
    RenewSessionAction,
    SignOutAction,
)
from maxitor.core.actions.email_sign_in import ConfirmEmailAction, SignInWithPasswordAction, StartSignUpAction
from maxitor.core.actions.organizations import (
    CheckAddressCodeAction,
    OpenOrganizationAction,
    RegisterOrganizationAction,
)
from maxitor.core.actions.passport import CorePassportAction
from maxitor.core.actions.password_reset import RequestPasswordResetAction, ResetPasswordAction
from maxitor.core.actions.provider_sign_in import FinishSignInAction, StartSignInAction
from maxitor.core.actions.region import SignInOptionsAction
from maxitor.core.actions.sign_ins import LinkEmailAction, LinkSignInAction, ListSignInsAction, UnlinkSignInAction
from maxitor.core.auth_coordinator import CoreAuthCoordinator
from maxitor.core.errors import CoreRefusalError
from maxitor.core.gateways.geoip import GEOIP_CONNECTION_KEY, GeoIpGateway
from maxitor.core.gateways.mail import MAIL_CONNECTION_KEY, MailGateway, OutboxMailGateway, YandexCloudPostboxGateway
from maxitor.core.gateways.providers import GATEWAYS
from maxitor.core.plugins.actions.add_private_plugin_action import AddPrivatePluginAction
from maxitor.core.plugins.actions.disable_plugin_action import DisablePluginAction
from maxitor.core.plugins.actions.drop_failed_install_action import DropFailedInstallAction
from maxitor.core.plugins.actions.enable_plugin_action import EnablePluginAction
from maxitor.core.plugins.actions.list_plugins_action import ListPluginsAction
from maxitor.core.plugins.actions.plugin_details_action import PluginDetailsAction
from maxitor.core.plugins.actions.request_install_action import RequestInstallAction
from maxitor.core.plugins.actions.retry_install_action import RetryInstallAction
from maxitor.core.plugins.actions.upload_private_plugin_action import UploadPrivatePluginAction
from maxitor.core.plugins.storage.plugins_storage import PLUGINS_CONNECTION_KEY, PluginsStorage
from maxitor.core.plugins.storage.wheel_storage import WHEELS_CONNECTION_KEY, WheelStorage
from maxitor.core.settings import CoreSettings
from maxitor.core.storage.core_storage import CORE_CONNECTION_KEY, CoreStorage
from maxitor.core.tokens import TOKENS_CONNECTION_KEY, SessionTokensController

from aoa.action_machine.exceptions import AuthorizationError
from aoa.action_machine.exceptions.access_denied import AccessDenied
from aoa.action_machine.graph.node_graph_coordinator_factory import create_node_graph_coordinator
from aoa.action_machine.intents.access_control import Gate
from aoa.action_machine.model import BaseAction
from aoa.action_machine.resources import BaseResource, PerCallConnection
from aoa.action_machine.resources.postgres import PostgresPool
from aoa.action_machine.runtime.action_product_machine import ActionProductMachine
from aoa.fastapi import FastApiAdapter

#: The routes of the core: method, address, action.
ROUTES: list[tuple[str, str, type[BaseAction[Any, Any]]]] = [
    ("get", "/api/v1/sign-in/options", SignInOptionsAction),
    ("post", "/api/v1/sign-up", StartSignUpAction),
    ("post", "/api/v1/sign-up/confirm", ConfirmEmailAction),
    ("post", "/api/v1/sign-in/password", SignInWithPasswordAction),
    ("post", "/api/v1/password-reset", RequestPasswordResetAction),
    ("post", "/api/v1/password-reset/confirm", ResetPasswordAction),
    ("post", "/api/v1/sign-in/start", StartSignInAction),
    ("post", "/api/v1/sign-in/finish", FinishSignInAction),
    ("post", "/api/v1/account", CreateAccountAction),
    ("post", "/api/v1/session/renew", RenewSessionAction),
    ("post", "/api/v1/session/accept-policy", AcceptPolicyAction),
    ("post", "/api/v1/sign-out", SignOutAction),
    ("get", "/api/v1/me", CurrentUserAction),
    ("get", "/api/v1/sign-ins", ListSignInsAction),
    ("post", "/api/v1/sign-ins/link", LinkSignInAction),
    ("post", "/api/v1/sign-ins/email", LinkEmailAction),
    ("post", "/api/v1/sign-ins/unlink", UnlinkSignInAction),
    ("get", "/api/v1/organizations/code-check", CheckAddressCodeAction),
    ("post", "/api/v1/organizations", RegisterOrganizationAction),
    ("get", "/api/v1/organizations/{code}", OpenOrganizationAction),
    ("get", "/api/v1/core/passport", CorePassportAction),
    ("get", "/api/v1/organizations/{code}/plugins", ListPluginsAction),
    ("get", "/api/v1/organizations/{code}/plugins/{passport_id}", PluginDetailsAction),
    ("post", "/api/v1/plugins/install", RequestInstallAction),
    ("post", "/api/v1/plugins/retry", RetryInstallAction),
    ("post", "/api/v1/plugins/drop", DropFailedInstallAction),
    ("post", "/api/v1/plugins/disable", DisablePluginAction),
    ("post", "/api/v1/plugins/enable", EnablePluginAction),
    ("post", "/api/v1/plugins/private", AddPrivatePluginAction),
    ("post", "/api/v1/plugins/private/upload", UploadPrivatePluginAction),
]


def mail_gateway(settings: CoreSettings) -> MailGateway:
    """Postbox when its key is set, else the outbox folder."""
    if settings.postbox_key_id and settings.postbox_secret and not settings.mail_outbox:
        return YandexCloudPostboxGateway(settings.mail_from, settings.postbox_key_id, settings.postbox_secret)
    return OutboxMailGateway(settings.mail_from, settings.mail_outbox or Path(".core-stand/outbox"))


def declared_keys(action: type[BaseAction[Any, Any]]) -> list[str]:
    """The connection keys an action declares."""
    return [info.key for info in getattr(action, "_connection_info", [])]


def create_app(
    settings: CoreSettings | None = None,
    resources: Mapping[str, Any] | None = None,
    machine: ActionProductMachine | None = None,
) -> FastAPI:
    """
    AI-CORE-BEGIN
    ROLE: Build the core's backend.
    CONTRACT: ``settings`` default to the environment; ``resources`` replace any connection by its key and ``machine``
        the action machine (tests);
        without ``core`` in them the storage comes from a pool over ``settings.dsn``.
    INVARIANTS: Every route is an action of the chain; no hand-written route or middleware.
    AI-CORE-END
    """
    settings = settings or CoreSettings.from_environment()
    pools: dict[str, PostgresPool] = {}
    given = dict(resources or {})

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
        if CORE_CONNECTION_KEY in given or settings.dsn is None:
            yield
            return
        async with PostgresPool(settings.dsn, min_size=1, max_size=10) as pool:
            pools["core"] = pool
            yield

    def open_storage() -> BaseResource:
        return CoreStorage(pool=pools["core"])

    async def close_storage(storage: BaseResource) -> None:
        if isinstance(storage, CoreStorage):
            await storage.close()

    def open_plugins() -> BaseResource:
        return PluginsStorage(pool=pools["core"])

    shared: dict[str, Any] = {
        CORE_CONNECTION_KEY: PerCallConnection(factory=open_storage, finalize=close_storage),
        PLUGINS_CONNECTION_KEY: PerCallConnection(factory=open_plugins, finalize=close_storage),
        WHEELS_CONNECTION_KEY: WheelStorage(settings.wheel_store, settings.wheel_max_bytes),
        GEOIP_CONNECTION_KEY: GeoIpGateway(settings.geoip_database),
        MAIL_CONNECTION_KEY: mail_gateway(settings),
        TOKENS_CONNECTION_KEY: SessionTokensController(settings.session_secret, settings.policy_version),
    }
    for name, gateway in GATEWAYS.items():
        keys = settings.providers.get(name)
        shared[name] = gateway(
            keys.client_id if keys else None, keys.client_secret if keys else None, settings.redirect_uri(name)
        )
    shared.update(given)

    adapter = FastApiAdapter(
        machine=machine or ActionProductMachine(graph_coordinator=create_node_graph_coordinator()),
        auth_coordinator=CoreAuthCoordinator(settings.session_secret),
        title="Maxitor core",
        version=version("maxitor"),
    )
    for method, path, action in ROUTES:
        connections = {key: shared[key] for key in declared_keys(action)}
        register: Callable[..., Any] = getattr(adapter, method)
        register(path, action, connections=connections or None)
    app = adapter.build(lifespan=lifespan)

    @app.exception_handler(CoreRefusalError)
    async def refused(_request: Request, error: CoreRefusalError) -> JSONResponse:
        return JSONResponse(status_code=error.status, content=error.body)

    # A refusal by an action's own access decision is "no such organization": 404, the same as a code that does
    # not exist. The core's only role is the account, so any other refusal means "not signed in": 401.
    async def refused_access(_request: Request, error: Exception) -> JSONResponse:
        if isinstance(error, AccessDenied) and error.verdict.gate == Gate.ACCESS_DECIDE:
            return JSONResponse(status_code=404, content={"error": "not_found"})
        return JSONResponse(status_code=401, content={"error": "unauthorized"})

    app.add_exception_handler(AccessDenied, refused_access)
    app.add_exception_handler(AuthorizationError, refused_access)

    return app
