# packages/maxitor/maxitor-core/maxitor/core/errors.py
"""
The refusals the core's actions raise, each with the HTTP answer it becomes.

A refusal never says whether an address has an account: a wrong email and a wrong password are one
``SignInRefusedError``; an organization the account is not in and one that does not exist are one
``OrganizationNotFoundError``.
"""

from __future__ import annotations

from datetime import datetime


class CoreRefusalError(Exception):
    """A refusal the page shows; ``status`` is its HTTP status, ``body`` its JSON."""

    status = 400

    def __init__(self, reason: str, **details: object) -> None:
        super().__init__(reason)
        self.reason = reason
        self.details = details

    @property
    def body(self) -> dict[str, object]:
        return {
            "error": self.reason,
            **{k: (v.isoformat() if isinstance(v, datetime) else v) for k, v in self.details.items()},
        }


class RegionRefusedError(CoreRefusalError):
    """A provider not allowed in the request's region."""

    status = 403


class SignInRefusedError(CoreRefusalError):
    """A wrong email or password, or a sign-in that cannot be proven."""

    status = 401


class LimitReachedError(CoreRefusalError):
    """Too many codes or wrong passwords; ``until`` says when the next one is possible."""

    status = 429


class CodeRefusedError(CoreRefusalError):
    """A code that is wrong, used up or expired."""

    status = 400


class PasswordRuleError(CoreRefusalError):
    """A new password that breaks a rule."""

    status = 422


class ConflictError(CoreRefusalError):
    """A sign-in that belongs to another account, the last sign-in, a taken address code, the limit of organizations."""

    status = 409


class OrganizationNotFoundError(CoreRefusalError):
    """No such organization for this account."""

    status = 404


class MailNotSentError(CoreRefusalError):
    """The mail could not be sent; try again."""

    status = 503


class PluginNotRunningError(CoreRefusalError):
    """A plugin enabled in the organization whose process does not accept now; the gateway answers 502."""

    status = 502
