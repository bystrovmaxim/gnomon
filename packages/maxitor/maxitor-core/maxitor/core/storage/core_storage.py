# packages/maxitor/maxitor-core/maxitor/core/storage/core_storage.py
"""
CoreStorage — the core's database: the schemas platform and organization, written as the role maxitor_core.

═══════════════════════════════════════════════════════════════════════════════
VERSIONED STORAGE
═══════════════════════════════════════════════════════════════════════════════
A change is one transaction: a lock, one change time, the current row and its version. The schema platform
locks by the account (``account:<id>``), the schema organization by the organization (``organization:<id>``).
The change time is the clock, or one microsecond after the last version opened or closed under the same lock,
whichever is later, so the versions of one lock never share a moment. Opening a version copies the row's
columns except those ``_UNVERSIONED`` names (the password's hash is never kept in history).

No SQL names a schema: the role's search_path is organization, platform, extensions.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import Any, ClassVar

import asyncpg
from maxitor.core.entities import (
    AccountCoreEntity,
    BoundaryCoreEntity,
    InvitationCoreEntity,
    OrganizationCoreEntity,
    SignInAttemptCoreEntity,
    SignInCodeCoreEntity,
    SignInCodePurposeEnumEntity,
    SignInCoreEntity,
    SignInProviderEnumEntity,
    UserCoreEntity,
    WhoMayInviteEnumEntity,
)

from aoa.action_machine.exceptions.handle_error import HandleError
from aoa.action_machine.intents.entities import entities
from aoa.action_machine.intents.meta import meta
from aoa.action_machine.resources.postgres import PostgresStorage

#: Connection key under which actions receive the storage.
CORE_CONNECTION_KEY = "core"


class UniqueRowError(Exception):
    """An insert met a row with the same unique value; ``constraint`` names the database's rule."""

    def __init__(self, constraint: str) -> None:
        super().__init__(constraint)
        self.constraint = constraint


#: Columns a table keeps that its version table does not.
_UNVERSIONED: Mapping[str, frozenset[str]] = {"sign_in": frozenset({"password_hash", "last_used_at"})}

#: The version table of each versioned table, and the columns that name one row of it.
VERSIONED: Mapping[str, tuple[str, tuple[str, ...]]] = {
    "account": ("account_versions", ("id",)),
    "sign_in": ("sign_in_versions", ("id",)),
    "organization": ("organization_versions", ("organization_id",)),
    '"user"': ("user_versions", ("organization_id", "id")),
    "invitation": ("invitation_versions", ("organization_id", "id")),
    "boundary": ("boundary_versions", ("organization_id", "id")),
    "boundary_user": ("boundary_user_versions", ("organization_id", "boundary_id", "user_id")),
}

#: How a current table's key columns are named in it, when they differ from its version table's.
_ROW_KEY: Mapping[str, tuple[str, ...]] = {"organization": ("id",)}


def _placeholders(start: int, count: int) -> str:
    return ", ".join(f"${i}" for i in range(start, start + count))


@meta(description="The core's database: the schemas platform and organization, written as the role maxitor_core")
@entities(
    AccountCoreEntity,
    SignInCoreEntity,
    SignInProviderEnumEntity,
    SignInCodePurposeEnumEntity,
    SignInCodeCoreEntity,
    SignInAttemptCoreEntity,
    OrganizationCoreEntity,
    WhoMayInviteEnumEntity,
    UserCoreEntity,
    InvitationCoreEntity,
    BoundaryCoreEntity,
)
class CoreStorage(PostgresStorage):
    """
    AI-CORE-BEGIN
    ROLE: The one storage of the core; every read and write of accounts, sign-ins, codes, organizations and users.
    CONTRACT: ``lock`` takes a lock for the rest of the transaction and answers the change time; ``insert``,
        ``update`` and ``delete`` change one row of a versioned table and its version together; the readers and
        writers of the actions build on them.
    INVARIANTS: Names no schema in SQL; a versioned row never changes without its version; public stays empty.
    AI-CORE-END
    """

    #: The version table of each table this storage writes, and the columns that name one row of it.
    versioned: ClassVar[Mapping[str, tuple[str, tuple[str, ...]]]] = VERSIONED

    async def lock(self, key: str, versions: Sequence[tuple[str, str, Any]]) -> datetime:
        """
        Lock ``key`` until the transaction ends and answer its change time.

        ``versions`` names, for each version table the lock guards, the column and value that select its rows;
        the change time is after every version opened or closed there.
        """
        await self._fetchval("SELECT pg_advisory_xact_lock(hashtext($1))", (key,))
        parts: list[str] = []
        params: list[Any] = []
        for table, column, value in versions:
            params.append(value)
            n = len(params)
            parts.append(f"SELECT max(valid_from_at) AS t FROM {table} WHERE {column} = ${n}")
            parts.append(f"SELECT max(valid_to_at) FROM {table} WHERE {column} = ${n}")
        if not parts:
            value = await self._fetchval("SELECT clock_timestamp()")
            return value  # type: ignore[no-any-return]
        query = (
            "SELECT greatest(clock_timestamp(), coalesce(max(t), '-infinity'::timestamptz) + interval '1 microsecond')"
            f" FROM ({' UNION ALL '.join(parts)}) AS last_changes"
        )
        value = await self._fetchval(query, tuple(params))
        return value  # type: ignore[no-any-return]

    async def insert(
        self, table: str, row: Mapping[str, Any], changed_at: datetime, author: str | None, operation: str
    ) -> None:
        """
        Insert ``row`` into ``table`` and open its first version at ``changed_at``.

        A unique rule of the database that refuses the row is raised as ``UniqueRowError`` with the rule's name.
        """
        columns = list(row)
        try:
            await self._execute(
                f"INSERT INTO {table} ({', '.join(columns)}) VALUES ({_placeholders(1, len(columns))})",
                tuple(row.values()),
            )
        except HandleError as error:
            if isinstance(error.__cause__, asyncpg.UniqueViolationError):
                raise UniqueRowError(str(error.__cause__.constraint_name)) from error
            raise
        await self._open_version(table, row, changed_at, author, operation)

    async def update(
        self,
        table: str,
        key: Mapping[str, Any],
        changes: Mapping[str, Any],
        changed_at: datetime,
        author: str | None,
        operation: str,
    ) -> None:
        """Change the row of ``table`` that ``key`` names: close its version, update it, open the next version."""
        await self._close_version(table, key, changed_at, author, operation)
        sets = ", ".join(f"{column} = ${i}" for i, column in enumerate(changes, start=1))
        where = " AND ".join(f"{column} = ${i}" for i, column in enumerate(key, start=len(changes) + 1))
        await self._execute(f"UPDATE {table} SET {sets} WHERE {where}", (*changes.values(), *key.values()))
        row = await self._fetchrow(
            f"SELECT * FROM {table} WHERE {' AND '.join(f'{c} = ${i}' for i, c in enumerate(key, start=1))}",
            tuple(key.values()),
        )
        await self._open_version(table, dict(row), changed_at, author, operation)

    async def delete(
        self, table: str, key: Mapping[str, Any], changed_at: datetime, author: str | None, operation: str
    ) -> None:
        """Close the version of the row ``key`` names and delete the row; its history stays."""
        await self._close_version(table, key, changed_at, author, operation)
        where = " AND ".join(f"{column} = ${i}" for i, column in enumerate(key, start=1))
        await self._execute(f"DELETE FROM {table} WHERE {where}", tuple(key.values()))

    async def _open_version(
        self, table: str, row: Mapping[str, Any], changed_at: datetime, author: str | None, operation: str
    ) -> None:
        versions, version_key = self.versioned[table]
        row_key = _ROW_KEY.get(table, version_key)
        skip = _UNVERSIONED.get(table, frozenset())
        data = {c: v for c, v in row.items() if c not in skip and c not in row_key}
        keys = dict(zip(version_key, (row[c] for c in row_key), strict=True))
        columns = [*keys, "valid_from_at", "valid_to_at", "author_id", "operation", *data]
        values = [*keys.values(), changed_at, None, author, operation, *data.values()]
        await self._execute(
            f"INSERT INTO {versions} ({', '.join(columns)}) VALUES ({_placeholders(1, len(columns))})",
            tuple(values),
        )

    async def _close_version(
        self, table: str, key: Mapping[str, Any], changed_at: datetime, author: str | None, operation: str
    ) -> None:
        versions, version_key = self.versioned[table]
        row_key = _ROW_KEY.get(table, version_key)
        mapped = dict(zip(version_key, (key[c] for c in row_key), strict=True))
        where = " AND ".join(f"{column} = ${i}" for i, column in enumerate(mapped, start=4))
        await self._execute(
            f"UPDATE {versions} SET valid_to_at = $1, closed_by = $2, closed_operation = $3"
            f" WHERE {where} AND valid_to_at IS NULL",
            (changed_at, author, operation, *mapped.values()),
        )

    # ── transactions ──────────────────────────────────────────────────────────

    async def in_transaction(self, work: Any) -> Any:
        """Run ``work()`` inside one transaction: commit on success, roll back on any failure."""
        await self.begin()
        try:
            result = await work()
            await self.commit()
        except BaseException:
            await self.rollback()
            raise
        return result

    async def account_lock(self, account_id: str) -> datetime:
        """The lock and change time of one account's rows in the schema platform."""
        return await self.lock(
            f"account:{account_id}",
            [("account_versions", "id", account_id), ("sign_in_versions", "account_id", account_id)],
        )

    async def organization_lock(self, organization_id: str) -> datetime:
        """The lock and change time of one organization's rows in the schema organization."""
        return await self.lock(
            f"organization:{organization_id}",
            [
                ("organization_versions", "organization_id", organization_id),
                ("user_versions", "organization_id", organization_id),
                ("invitation_versions", "organization_id", organization_id),
                ("boundary_versions", "organization_id", organization_id),
                ("boundary_user_versions", "organization_id", organization_id),
            ],
        )

    # ── accounts and sign-ins ─────────────────────────────────────────────────

    async def sign_in_of(self, provider: str, subject: str) -> dict[str, Any] | None:
        """The sign-in ``provider`` and ``subject`` name, with its account's id, or ``None``."""
        row = await self._fetchrow(
            "SELECT id::text AS id, account_id::text AS account_id, password_hash, password_changed_at"
            " FROM sign_in WHERE provider = $1 AND provider_subject = $2",
            (provider, subject),
        )
        return None if row is None else dict(row)

    async def account(self, account_id: str) -> dict[str, Any] | None:
        """The account ``account_id``, or ``None``."""
        row = await self._fetchrow(
            "SELECT id::text AS id, name, email, policy_version FROM account WHERE id = $1::text::uuid", (account_id,)
        )
        return None if row is None else dict(row)

    async def sign_ins(self, account_id: str) -> list[dict[str, Any]]:
        """The ways in of ``account_id``, oldest first; never a password hash."""
        rows = await self._fetch(
            "SELECT id::text AS id, provider, provider_subject, email, added_country, added_at"
            " FROM sign_in WHERE account_id = $1::text::uuid ORDER BY added_at, id",
            (account_id,),
        )
        return [dict(row) for row in rows]

    async def password_changed_at(self, account_id: str) -> datetime | None:
        """When the account's password was last set, or ``None`` without one."""
        value = await self._fetchval(
            "SELECT max(password_changed_at) FROM sign_in WHERE account_id = $1::text::uuid AND provider = 'email'",
            (account_id,),
        )
        return value  # type: ignore[no-any-return]

    async def last_place(self, account_id: str) -> str | None:
        """The address the account had open last, or ``None``."""
        value = await self._fetchval("SELECT address FROM account_place WHERE account_id = $1::text::uuid", (account_id,))
        return None if value is None else str(value)

    async def keep_place(self, account_id: str, address: str, at: datetime) -> None:
        """Remember where the account is now; not versioned."""
        await self._execute(
            "INSERT INTO account_place (account_id, address, changed_at) VALUES ($1::text::uuid, $2, $3)"
            " ON CONFLICT (account_id) DO UPDATE SET address = EXCLUDED.address, changed_at = EXCLUDED.changed_at",
            (account_id, address, at),
        )

    async def touch_sign_in(self, sign_in_id: str, at: datetime) -> None:
        """Record when a sign-in last signed its account in; not versioned."""
        await self._execute("UPDATE sign_in SET last_used_at = $1 WHERE id = $2::text::uuid", (at, sign_in_id))

    # ── one-time codes and wrong passwords ────────────────────────────────────

    async def code_counts(self, email: str, ip: str, minute_ago: datetime, hour_ago: datetime) -> tuple[int, int, int]:
        """Codes sent to ``email`` in the last minute and hour, and to anyone from ``ip`` in the last hour."""
        row = await self._fetchrow(
            "SELECT count(*) FILTER (WHERE email = $1 AND created_at > $3) AS address_minute,"
            " count(*) FILTER (WHERE email = $1 AND created_at > $4) AS address_hour,"
            " count(*) FILTER (WHERE requested_ip = $2::text::inet AND created_at > $4) AS ip_hour"
            " FROM sign_in_code WHERE created_at > $4",
            (email, ip, minute_ago, hour_ago),
        )
        return int(row["address_minute"]), int(row["address_hour"]), int(row["ip_hour"])

    async def new_code(self, row: dict[str, Any]) -> None:
        """End the working code of the same address and purpose, then store ``row``."""
        await self._execute(
            "UPDATE sign_in_code SET used_at = $3 WHERE email = $1 AND purpose = $2 AND used_at IS NULL",
            (row["email"], row["purpose"], row["created_at"]),
        )
        columns = list(row)
        await self._execute(
            f"INSERT INTO sign_in_code ({', '.join(columns)}) VALUES ({_placeholders(1, len(columns))})",
            tuple(row.values()),
        )

    async def working_code(self, email: str, purpose: str) -> dict[str, Any] | None:
        """The code of ``email`` and ``purpose`` that has not ended, or ``None``."""
        row = await self._fetchrow(
            "SELECT id::text AS id, code_hash, password_hash, wrong_tries, expires_at"
            " FROM sign_in_code WHERE email = $1 AND purpose = $2 AND used_at IS NULL",
            (email, purpose),
        )
        return None if row is None else dict(row)

    async def code_by_id(self, code_id: str) -> dict[str, Any] | None:
        """A confirmed sign-up's code row by its id, used or not."""
        row = await self._fetchrow(
            "SELECT id::text AS id, email, password_hash, purpose, used_at FROM sign_in_code WHERE id = $1::text::uuid",
            (code_id,),
        )
        return None if row is None else dict(row)

    async def wrong_code(self, code_id: str, at: datetime) -> int:
        """Count one wrong try; the fifth ends the code. Answer the tries left."""
        tries = await self._fetchval(
            "UPDATE sign_in_code SET wrong_tries = wrong_tries + 1,"
            " used_at = CASE WHEN wrong_tries + 1 >= 5 THEN $2 ELSE used_at END"
            " WHERE id = $1::text::uuid RETURNING wrong_tries",
            (code_id, at),
        )
        return max(0, 5 - int(tries))

    async def end_code(self, code_id: str, at: datetime) -> None:
        """Mark a code used."""
        await self._execute(
            "UPDATE sign_in_code SET used_at = $2 WHERE id = $1::text::uuid AND used_at IS NULL", (code_id, at)
        )

    async def prune(self, now: datetime, hour_ago: datetime, window_start: datetime) -> None:
        """Delete codes ended more than an hour ago and attempts older than the window."""
        await self._execute(
            "DELETE FROM sign_in_code WHERE created_at < $2 AND (used_at IS NOT NULL OR expires_at < $1)",
            (now, hour_ago),
        )
        await self._execute("DELETE FROM sign_in_attempt WHERE at < $1", (window_start,))

    async def attempt_counts(self, email: str, ip: str, since: datetime) -> tuple[int, int, datetime | None]:
        """Wrong passwords for ``email`` and from ``ip`` since ``since``, and the oldest of the address's."""
        row = await self._fetchrow(
            "SELECT count(*) FILTER (WHERE email = $1) AS address, count(*) FILTER (WHERE ip = $2::text::inet) AS ip,"
            " min(at) FILTER (WHERE email = $1) AS oldest FROM sign_in_attempt WHERE at > $3",
            (email, ip, since),
        )
        return int(row["address"]), int(row["ip"]), row["oldest"]

    async def wrong_password(self, attempt_id: str, email: str, ip: str, at: datetime) -> None:
        """Record one wrong email or password."""
        await self._execute(
            "INSERT INTO sign_in_attempt (id, email, ip, at) VALUES ($1::text::uuid, $2, $3::text::inet, $4)",
            (attempt_id, email, ip, at),
        )

    # ── organizations ─────────────────────────────────────────────────────────

    async def organizations_of(self, account_id: str) -> list[dict[str, Any]]:
        """The organizations ``account_id`` has an active user in, by name."""
        rows = await self._fetch(
            'SELECT o.code, o.name, u.is_admin, u.name AS user_name FROM organization o JOIN "user" u ON u.organization_id = o.id'
            " WHERE u.account_id = $1::text::uuid AND u.status = 'active' ORDER BY o.name, o.code",
            (account_id,),
        )
        return [dict(row) for row in rows]

    async def organization_for(self, code: str, account_id: str) -> dict[str, Any] | None:
        """The organization ``code`` if ``account_id`` has an active user in it, else ``None``."""
        row = await self._fetchrow(
            "SELECT o.id::text AS id, o.code, o.name, o.who_may_invite, u.id::text AS user_id, u.name AS user_name,"
            " u.is_admin"
            ' FROM organization o JOIN "user" u ON u.organization_id = o.id'
            " WHERE o.code = $1 AND u.account_id = $2::text::uuid AND u.status = 'active'",
            (code, account_id),
        )
        return None if row is None else dict(row)

    async def organization(self, organization_id: str) -> dict[str, Any] | None:
        """The organization ``organization_id`` with its setting, or ``None``."""
        row = await self._fetchrow(
            "SELECT id::text AS id, code, name, who_may_invite FROM organization WHERE id = $1::text::uuid",
            (organization_id,),
        )
        return None if row is None else dict(row)

    # ── users ─────────────────────────────────────────────────────────────────

    _USER_SELECT = (
        "SELECT u.organization_id::text AS organization_id, u.id::text AS id, u.account_id::text AS account_id,"
        " u.name, a.email, u.is_admin, u.status, u.created_at, u.updated_at,"
        " (SELECT max(s.last_used_at) FROM sign_in s WHERE s.account_id = u.account_id) AS last_sign_in_at,"
        " i.invited_by::text AS invited_by, ib.name AS invited_by_name,"
        " cb.id::text AS changed_by, cb.name AS changed_by_name"
        ' FROM "user" u JOIN account a ON a.id = u.account_id'
        " LEFT JOIN invitation i ON i.organization_id = u.organization_id AND i.accepted_user_id = u.id"
        ' LEFT JOIN "user" ib ON ib.organization_id = i.organization_id AND ib.id = i.invited_by'
        " LEFT JOIN user_versions uv ON uv.organization_id = u.organization_id AND uv.id = u.id AND uv.valid_to_at IS NULL"
        ' LEFT JOIN "user" cb ON cb.organization_id = u.organization_id AND cb.account_id = uv.author_id'
        " AND cb.status <> 'removed'"
    )

    async def user(self, organization_id: str, user_id: str) -> dict[str, Any] | None:
        """One user of the organization with the account's email, who invited them and who changed them last."""
        row = await self._fetchrow(
            f"{self._USER_SELECT} WHERE u.organization_id = $1::text::uuid AND u.id = $2::text::uuid",
            (organization_id, user_id),
        )
        return None if row is None else dict(row)

    async def users_of_organization(self, organization_id: str) -> list[dict[str, Any]]:
        """Every user of the organization, the ones not removed first, each by name."""
        rows = await self._fetch(
            f"{self._USER_SELECT} WHERE u.organization_id = $1::text::uuid"
            " ORDER BY (u.status = 'removed'), u.name, u.id",
            (organization_id,),
        )
        return [dict(row) for row in rows]

    async def user_of_account(self, organization_id: str, account_id: str) -> dict[str, Any] | None:
        """The account's user in the organization that is not removed, or ``None``."""
        row = await self._fetchrow(
            'SELECT id::text AS id, name, is_admin, status FROM "user"'
            " WHERE organization_id = $1::text::uuid AND account_id = $2::text::uuid AND status <> 'removed'",
            (organization_id, account_id),
        )
        return None if row is None else dict(row)

    async def user_by_email(self, organization_id: str, email: str) -> dict[str, Any] | None:
        """The organization's user not removed whose account has ``email`` confirmed, or ``None``."""
        row = await self._fetchrow(
            'SELECT u.id::text AS id, u.name, u.is_admin, u.status FROM "user" u JOIN account a ON a.id = u.account_id'
            " WHERE u.organization_id = $1::text::uuid AND u.status <> 'removed'"
            " AND (a.email = $2 OR EXISTS (SELECT 1 FROM sign_in s WHERE s.account_id = a.id AND lower(s.email) = $2))",
            (organization_id, email),
        )
        return None if row is None else dict(row)

    async def active_administrators(self, organization_id: str) -> int:
        """How many active administrators the organization has now."""
        return int(
            await self._fetchval(
                'SELECT count(*) FROM "user" WHERE organization_id = $1::text::uuid AND is_admin AND status = \'active\'',
                (organization_id,),
            )
        )

    async def confirmed_emails(self, account_id: str) -> list[str]:
        """The account's confirmed emails in lower case: its own and those of its ways in."""
        rows = await self._fetch(
            "SELECT lower(email) AS email FROM account WHERE id = $1::text::uuid"
            " UNION SELECT lower(email) FROM sign_in WHERE account_id = $1::text::uuid AND email IS NOT NULL",
            (account_id,),
        )
        return sorted({str(row["email"]) for row in rows})

    # ── invitations ───────────────────────────────────────────────────────────

    _INVITATION_SELECT = (
        "SELECT i.organization_id::text AS organization_id, o.code AS organization_code, o.name AS organization_name,"
        " i.id::text AS id, i.email, i.invited_by::text AS invited_by, ib.name AS invited_by_name, i.is_admin,"
        " i.status, i.sent_at, i.letter_sent_at, i.expires_at, i.decided_at, i.decided_by::text AS decided_by,"
        " db.name AS decided_by_name, i.by_setting, i.accepted_user_id::text AS accepted_user_id,"
        " au.name AS accepted_user_name"
        " FROM invitation i JOIN organization o ON o.id = i.organization_id"
        ' JOIN "user" ib ON ib.organization_id = i.organization_id AND ib.id = i.invited_by'
        ' LEFT JOIN "user" db ON db.organization_id = i.organization_id AND db.id = i.decided_by'
        ' LEFT JOIN "user" au ON au.organization_id = i.organization_id AND au.id = i.accepted_user_id'
    )

    async def invitation(self, invitation_id: str) -> dict[str, Any] | None:
        """The invitation ``invitation_id`` with its organization and the people around it, or ``None``."""
        row = await self._fetchrow(f"{self._INVITATION_SELECT} WHERE i.id = $1::text::uuid", (invitation_id,))
        return None if row is None else dict(row)

    async def sent_invitation(self, organization_id: str, email: str) -> dict[str, Any] | None:
        """The organization's invitation still sent to ``email``, or ``None``."""
        row = await self._fetchrow(
            f"{self._INVITATION_SELECT} WHERE i.organization_id = $1::text::uuid AND i.email = $2 AND i.status = 'sent'",
            (organization_id, email),
        )
        return None if row is None else dict(row)

    async def invitations_of_organization(self, organization_id: str) -> list[dict[str, Any]]:
        """Every invitation of the organization, newest first."""
        rows = await self._fetch(
            f"{self._INVITATION_SELECT} WHERE i.organization_id = $1::text::uuid ORDER BY i.sent_at DESC, i.id",
            (organization_id,),
        )
        return [dict(row) for row in rows]

    async def invitations_by(self, organization_id: str, user_id: str) -> list[dict[str, Any]]:
        """The invitations one user sent, newest first."""
        rows = await self._fetch(
            f"{self._INVITATION_SELECT} WHERE i.organization_id = $1::text::uuid AND i.invited_by = $2::text::uuid"
            " ORDER BY i.sent_at DESC, i.id",
            (organization_id, user_id),
        )
        return [dict(row) for row in rows]

    async def invitations_for_emails(self, emails: Sequence[str]) -> list[dict[str, Any]]:
        """The invitations still sent to any of ``emails``, oldest first."""
        rows = await self._fetch(
            f"{self._INVITATION_SELECT} WHERE i.status = 'sent' AND i.email = ANY($1::text[]) ORDER BY i.sent_at, i.id",
            (list(emails),),
        )
        return [dict(row) for row in rows]

    async def invitation_counts(
        self, organization_id: str, user_id: str, hour_ago: datetime, day_ago: datetime
    ) -> tuple[int, int]:
        """Invitations ``user_id`` sent in the last hour, and the organization sent in the last day."""
        row = await self._fetchrow(
            "SELECT count(*) FILTER (WHERE invited_by = $2::text::uuid AND sent_at > $3) AS inviter_hour,"
            " count(*) FILTER (WHERE sent_at > $4) AS organization_day"
            " FROM invitation WHERE organization_id = $1::text::uuid AND sent_at > $4",
            (organization_id, user_id, hour_ago, day_ago),
        )
        return int(row["inviter_hour"]), int(row["organization_day"])

    async def letter_counts(self, email: str, minute_ago: datetime, hour_ago: datetime) -> tuple[int, int]:
        """Letters of invitation to ``email`` in the last minute and hour."""
        row = await self._fetchrow(
            "SELECT count(*) FILTER (WHERE sent_at > $2) AS minute, count(*) AS hour"
            " FROM invitation_letter WHERE email = $1 AND sent_at > $3",
            (email, minute_ago, hour_ago),
        )
        return int(row["minute"]), int(row["hour"])

    async def new_letter(self, row: Mapping[str, Any]) -> None:
        """Record one letter of invitation handed to the mail."""
        columns = list(row)
        await self._execute(
            f"INSERT INTO invitation_letter ({', '.join(columns)}) VALUES ({_placeholders(1, len(columns))})",
            tuple(row.values()),
        )

    async def prune_letters(self, hour_ago: datetime) -> None:
        """Delete the letters the hourly limit no longer counts."""
        await self._execute("DELETE FROM invitation_letter WHERE sent_at < $1", (hour_ago,))

    async def watermark(self, organization_id: str) -> str | None:
        """The organization's watermark to the microsecond, in UTC; ``None`` when it never changed."""
        value = await self._fetchval(
            "SELECT to_char(watermark($1::text::uuid) AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"')",
            (organization_id,),
        )
        return None if value is None else str(value)

    async def code_taken(self, code: str) -> bool:
        """Whether an organization has the address code ``code``."""
        return bool(await self._fetchval("SELECT EXISTS (SELECT 1 FROM organization WHERE code = $1)", (code,)))

    async def organizations_created(self, account_id: str) -> int:
        """How many organizations ``account_id`` registered."""
        return int(
            await self._fetchval("SELECT count(*) FROM organization WHERE created_by = $1::text::uuid", (account_id,))
        )
