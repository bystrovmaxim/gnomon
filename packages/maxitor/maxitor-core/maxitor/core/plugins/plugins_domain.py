# packages/maxitor/maxitor-core/maxitor/core/plugins/plugins_domain.py
"""PluginsDomain — the marketplace, the plugins of each organization, checking, deploying and running versions."""

from __future__ import annotations

from maxitor.core.plugins.events import (
    DeployFailedEvent,
    DeploySkippedEvent,
    EnvironmentFailedEvent,
    DisableRefusedEvent,
    DownloadTimedOutEvent,
    FailedInstallDroppedEvent,
    InstallerConnectionRefusedEvent,
    InstallerStartedEvent,
    InstallRefusedEvent,
    PluginDisabledEvent,
    PluginEnabledEvent,
    PluginInstalledEvent,
    PrivatePluginAddedEvent,
    PrivatePluginRefusedEvent,
    ProcessExitedEvent,
    ProcessStartedEvent,
    ProcessStoppedEvent,
    RowTakenUpEvent,
    RunnerStartedEvent,
    VersionActivatedEvent,
    VersionAddedEvent,
    VersionDeployedEvent,
    VersionRejectedEvent,
)

from aoa.action_machine.domain import BaseDomain


class PluginsDomain(BaseDomain):
    """The core's domain of plugins: the marketplace outside any organization and the plugins inside each."""

    name = "plugins"
    description = "The marketplace of plugins and their versions, the plugins of each organization, the installer and the runner"
    events = (
        VersionAddedEvent,
        PrivatePluginAddedEvent,
        VersionActivatedEvent,
        VersionDeployedEvent,
        DeploySkippedEvent,
        PluginInstalledEvent,
        PluginDisabledEvent,
        PluginEnabledEvent,
        FailedInstallDroppedEvent,
        InstallerStartedEvent,
        RowTakenUpEvent,
        VersionRejectedEvent,
        DownloadTimedOutEvent,
        InstallRefusedEvent,
        DisableRefusedEvent,
        PrivatePluginRefusedEvent,
        DeployFailedEvent,
        InstallerConnectionRefusedEvent,
        RunnerStartedEvent,
        ProcessStartedEvent,
        ProcessStoppedEvent,
        ProcessExitedEvent,
        EnvironmentFailedEvent,
    )
