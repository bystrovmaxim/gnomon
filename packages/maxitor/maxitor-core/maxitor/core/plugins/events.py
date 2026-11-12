# packages/maxitor/maxitor-core/maxitor/core/plugins/events.py
"""
The typed events of the domain plugins: every line its actions may write, in the core's web process and in the
installer alike. No event carries a password, a connection string or the content of a wheel.
"""

from __future__ import annotations

from pydantic import Field

from aoa.action_machine.model.base_event import BaseEvent

# ════════════════════════════════════════════════════════════════════════════
# info
# ════════════════════════════════════════════════════════════════════════════


class VersionAddedEvent(BaseEvent):
    """An operator added a public plugin's version to the marketplace, waiting for its check (info)."""

    version_id: str = Field(description="The version row added")
    purl: str = Field(description="The version's source as a Package URL")
    sha256: str = Field(description="The wheel's hash the operator gave")


class PrivatePluginAddedEvent(BaseEvent):
    """An administrator added a private plugin's version, by a release's address or by uploading it (info)."""

    organization_id: str = Field(description="The organization that owns the plugin")
    account_id: str = Field(description="The administrator who added it")
    version_id: str = Field(description="The version row added")
    purl: str = Field(description="The version's source as a Package URL")
    sha256: str = Field(description="The wheel's hash, given or computed")
    uploaded: bool = Field(description="True when the wheel was uploaded, false when it comes from a release")


class VersionActivatedEvent(BaseEvent):
    """A version passed its check and can be installed (info)."""

    version_id: str = Field(description="The version checked")
    passport_id: str = Field(description="The plugin's id from its passport")
    version: str = Field(description="The version, x.y.z")


class VersionDeployedEvent(BaseEvent):
    """A version's schema, database user, tables and rights were built (info)."""

    passport_id: str = Field(description="The plugin's id from its passport")
    version: str = Field(description="The version, x.y.z")
    schema_name: str = Field(description="The schema built")


class DeploySkippedEvent(BaseEvent):
    """An install found its version already deployed and built nothing (info)."""

    organization_id: str = Field(description="The organization installing it")
    passport_id: str = Field(description="The plugin's id from its passport")
    schema_name: str = Field(description="The schema already there")


class PluginInstalledEvent(BaseEvent):
    """A plugin was installed in an organization and is enabled (info)."""

    organization_id: str = Field(description="The organization")
    passport_id: str = Field(description="The plugin's id from its passport")
    version: str = Field(description="The version installed")


class PluginDisabledEvent(BaseEvent):
    """An administrator disabled a plugin; its data stays (info)."""

    organization_id: str = Field(description="The organization")
    passport_id: str = Field(description="The plugin's id from its passport")
    account_id: str = Field(description="The administrator")


class PluginEnabledEvent(BaseEvent):
    """An administrator enabled a disabled plugin again (info)."""

    organization_id: str = Field(description="The organization")
    passport_id: str = Field(description="The plugin's id from its passport")
    account_id: str = Field(description="The administrator")


class FailedInstallDroppedEvent(BaseEvent):
    """An administrator dropped a failed install; nothing of the organization had been written (info)."""

    organization_id: str = Field(description="The organization")
    passport_id: str = Field(description="The plugin's id from its passport")
    account_id: str = Field(description="The administrator")


class InstallerStartedEvent(BaseEvent):
    """The installer started and found the rows waiting for it (info)."""

    pending_versions: int = Field(description="Versions in draft")
    pending_installs: int = Field(description="Installs in installing")


class RowTakenUpEvent(BaseEvent):
    """The installer took up a row another run had left (info)."""

    kind: str = Field(description="version or install")
    row_id: str = Field(description="The row's id")


class BuilderImageBuiltEvent(BaseEvent):
    """The builder image of the running core version was built on the host (info)."""

    core_version: str = Field(description="The core version the image builds for")
    seconds: float = Field(description="How long building it took")


class FrontendBuiltEvent(BaseEvent):
    """A plugin version's frontend was built with the core's own @maxitor packages (info)."""

    passport_id: str = Field(description="The plugin's id from its passport")
    version: str = Field(description="The version, x.y.z")
    core_version: str = Field(description="The core version it was built for")
    image: str = Field(description="The frontend's image")
    seconds: float = Field(description="How long the build took")


class FrontendGenerationMovedEvent(BaseEvent):
    """The site moved to the frontend builds of a new core version, every enabled version at once (info)."""

    moved_from: str = Field(description="The core version whose builds were served")
    moved_to: str = Field(description="The core version whose builds are served now")
    versions: int = Field(description="How many enabled versions moved")


class RunnerStartedEvent(BaseEvent):
    """The runner started, forgot the processes a stopped runner left, and found the versions to run (info)."""

    versions: int = Field(description="Deployed versions enabled in at least one organization")


class ProcessStartedEvent(BaseEvent):
    """A version's backend or frontend accepts on its inner address (info)."""

    passport_id: str = Field(description="The plugin's id from its passport")
    version: str = Field(description="The version, x.y.z")
    kind: str = Field(description="backend or frontend")
    address: str = Field(description="The inner address, http://127.0.0.1:<port>")


class ProcessStoppedEvent(BaseEvent):
    """A version enabled in no organization any more had its processes stopped (info)."""

    passport_id: str = Field(description="The plugin's id from its passport")
    version: str = Field(description="The version, x.y.z")


# ════════════════════════════════════════════════════════════════════════════
# warning
# ════════════════════════════════════════════════════════════════════════════


class VersionRejectedEvent(BaseEvent):
    """A version failed its check and cannot be installed (warning)."""

    version_id: str = Field(description="The version checked")
    purl: str = Field(description="The version's source")
    reason: str = Field(
        description="hash, passport, schema, navigation, foreign_keys, core_range, id_taken, name_taken,"
        " closed_repository, too_large, not_a_wheel or unsafe_path",
    )


class DownloadTimedOutEvent(BaseEvent):
    """A wheel did not download in time or could not be reached; the version stays draft (warning)."""

    version_id: str = Field(description="The version")
    purl: str = Field(description="The version's source")
    reason: str = Field(description="timeout, unreachable or redirect")


class InstallRefusedEvent(BaseEvent):
    """An install was refused before anything was written (warning)."""

    organization_id: str = Field(description="The organization")
    passport_id: str = Field(description="The plugin asked for")
    account_id: str = Field(description="The administrator")
    reason: str = Field(description="core_range, missing_dependency, already_installed or not_installable")


class DisableRefusedEvent(BaseEvent):
    """A disable was refused: enabled plugins depend on this one (warning)."""

    organization_id: str = Field(description="The organization")
    passport_id: str = Field(description="The plugin asked for")
    account_id: str = Field(description="The administrator")
    dependents: list[str] = Field(description="The passport ids of the enabled plugins that need it")


class PrivatePluginRefusedEvent(BaseEvent):
    """A private plugin's address, hash or file was refused by the dialog (warning)."""

    organization_id: str = Field(description="The organization")
    account_id: str = Field(description="The administrator")
    reason: str = Field(description="pypi_is_public, no_file, not_a_purl, sha256_form, too_large or not_a_wheel")


class ProcessExitedEvent(BaseEvent):
    """A version's process exited or never came up; it is started again after a pause (warning)."""

    passport_id: str = Field(description="The plugin's id from its passport")
    version: str = Field(description="The version, x.y.z")
    kind: str = Field(description="backend or frontend")
    reason: str = Field(description="exited, not_listening or not_started, with the exit code when there is one")
    failures: int = Field(description="Failures in a row, this one included")


# ════════════════════════════════════════════════════════════════════════════
# critical
# ════════════════════════════════════════════════════════════════════════════


class DeployFailedEvent(BaseEvent):
    """Deploying a version failed; the database holds nothing of it (critical)."""

    organization_id: str = Field(description="The organization whose install asked for it")
    passport_id: str = Field(description="The plugin")
    version: str = Field(description="The version")
    reason: str = Field(description="What the database answered, without any password")


class InstallerConnectionRefusedEvent(BaseEvent):
    """The database refused the installer's connection; nothing was taken up (critical)."""

    reason: str = Field(description="What the database answered, without the connection string")


class EnvironmentFailedEvent(BaseEvent):
    """A version's images could not be built from its wheel; its containers wait (critical)."""

    passport_id: str = Field(description="The plugin's id from its passport")
    version: str = Field(description="The version, x.y.z")
    reason: str = Field(description="The last line Docker answered, without any secret")


class FrontendBuildFailedEvent(BaseEvent):
    """A plugin version's frontend could not be built; it is not deployed (critical)."""

    passport_id: str = Field(description="The plugin's id from its passport")
    version: str = Field(description="The version, x.y.z")
    core_version: str = Field(description="The core version it was built for")
    error: str = Field(description="The first error of the step that failed")
