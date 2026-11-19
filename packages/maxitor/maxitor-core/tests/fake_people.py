# packages/maxitor/maxitor-core/tests/fake_people.py
"""
The users and the invitations of the core's storage in memory, joined as the real storage joins them: a part of
``MemoryCoreStorage`` kept in a module of its own.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from maxitor.core.storage.core_storage import UniqueRowError


class MemoryPeople:
    """Reads of users and invitations over the tables and versions of ``MemoryCoreStorage``."""

    tables: dict[str, list[dict[str, Any]]]
    versions: dict[str, list[dict[str, Any]]]

    def _check_people_unique(self, table: str, row: Any) -> None:
        """The unique keys of users and invitations, as the database keeps them."""
        if table == '"user"' and any(
            u["organization_id"] == row["organization_id"] and u["account_id"] == row["account_id"]
            for u in self.tables['"user"']
        ):
            raise UniqueRowError("user_once_per_account")
        if table == "invitation" and any(
            i["organization_id"] == row["organization_id"] and i["email"] == row["email"] and i["status"] == "sent"
            for i in self.tables["invitation"]
        ):
            raise UniqueRowError("invitation_one_sent")

    # ── the account's last place and the organization ──────────────────────────

    async def last_place(self, account_id: str) -> str | None:
        return next((r["address"] for r in self.tables["account_place"] if r["account_id"] == account_id), None)

    async def keep_place(self, account_id: str, address: str, at: datetime) -> None:
        for r in self.tables["account_place"]:
            if r["account_id"] == account_id:
                r.update(address=address, changed_at=at)
                return
        self.tables["account_place"].append({"account_id": account_id, "address": address, "changed_at": at})

    async def organization(self, organization_id: str) -> dict[str, Any] | None:
        return next(
            (
                {k: o[k] for k in ("id", "code", "name", "who_may_invite")}
                for o in self.tables["organization"]
                if o["id"] == organization_id
            ),
            None,
        )

    # ── users, as the real storage joins them ─────────────────────────────────

    def _account_of(self, account_id: str) -> dict[str, Any]:
        return next(a for a in self.tables["account"] if a["id"] == account_id)

    def _user_row(self, u: dict[str, Any]) -> dict[str, Any]:
        used = [s["last_used_at"] for s in self.tables["sign_in"] if s["account_id"] == u["account_id"] and s["last_used_at"]]
        inviter, changer = self._inviter_of(u), self._changer_of(u)
        return {
            **{k: u[k] for k in ("organization_id", "id", "account_id", "name", "is_admin", "status", "created_at", "updated_at")},
            "email": self._account_of(u["account_id"])["email"],
            "job_title": u.get("job_title"),
            "last_sign_in_at": max(used) if used else None,
            "invited_by": inviter["id"] if inviter else None,
            "invited_by_name": inviter["name"] if inviter else None,
            "changed_by": changer["id"] if changer else None,
            "changed_by_name": changer["name"] if changer else None,
        }

    def _inviter_of(self, u: dict[str, Any]) -> dict[str, Any] | None:
        invitation = next(
            (i for i in self.tables["invitation"] if i["organization_id"] == u["organization_id"] and i["accepted_user_id"] == u["id"]),
            None,
        )
        return self._user_by_id(u["organization_id"], invitation["invited_by"]) if invitation else None

    def _changer_of(self, u: dict[str, Any]) -> dict[str, Any] | None:
        versions = [v for v in self.versions["user_versions"] if v["organization_id"] == u["organization_id"] and v["id"] == u["id"]]
        author = versions[-1].get("author_id") if versions else None
        return next(
            (c for c in self.tables['"user"'] if c["organization_id"] == u["organization_id"] and c["account_id"] == author),
            None,
        )

    def _user_by_id(self, organization_id: str, user_id: str) -> dict[str, Any] | None:
        return next((u for u in self.tables['"user"'] if u["organization_id"] == organization_id and u["id"] == user_id), None)

    async def user(self, organization_id: str, user_id: str) -> dict[str, Any] | None:
        found = self._user_by_id(organization_id, user_id)
        return None if found is None else self._user_row(found)

    async def users_of_organization(self, organization_id: str) -> list[dict[str, Any]]:
        rows = [self._user_row(u) for u in self.tables['"user"'] if u["organization_id"] == organization_id]
        return sorted(rows, key=lambda r: (r["name"], r["id"]))

    async def user_of_account(self, organization_id: str, account_id: str) -> dict[str, Any] | None:
        return next(
            (
                {k: u[k] for k in ("id", "name", "is_admin", "status")}
                for u in self.tables['"user"']
                if u["organization_id"] == organization_id and u["account_id"] == account_id
            ),
            None,
        )

    def _emails_of(self, account_id: str) -> set[str]:
        account = self._account_of(account_id)
        emails = {account["email"].lower()}
        emails.update(s["email"].lower() for s in self.tables["sign_in"] if s["account_id"] == account_id and s["email"])
        return emails

    async def user_by_email(self, organization_id: str, email: str) -> dict[str, Any] | None:
        for u in self.tables['"user"']:
            if u["organization_id"] == organization_id and email in self._emails_of(u["account_id"]):
                return {k: u[k] for k in ("id", "name", "is_admin", "status")}
        return None

    async def active_administrators(self, organization_id: str) -> int:
        return sum(
            1 for u in self.tables['"user"'] if u["organization_id"] == organization_id and u["is_admin"] and u["status"] == "active"
        )

    async def confirmed_emails(self, account_id: str) -> list[str]:
        return sorted(self._emails_of(account_id))

    # ── invitations, as the real storage joins them ───────────────────────────

    def _invitation_row(self, i: dict[str, Any]) -> dict[str, Any]:
        organization = next(o for o in self.tables["organization"] if o["id"] == i["organization_id"])
        inviter = self._user_by_id(i["organization_id"], i["invited_by"])
        decider = self._user_by_id(i["organization_id"], i["decided_by"]) if i["decided_by"] else None
        accepted = self._user_by_id(i["organization_id"], i["accepted_user_id"]) if i["accepted_user_id"] else None
        return {
            **i,
            "organization_code": organization["code"],
            "organization_name": organization["name"],
            "invited_by_name": inviter["name"] if inviter else "",
            "decided_by_name": decider["name"] if decider else None,
            "accepted_user_name": accepted["name"] if accepted else None,
        }

    async def invitation(self, invitation_id: str) -> dict[str, Any] | None:
        found = next((i for i in self.tables["invitation"] if i["id"] == invitation_id), None)
        return None if found is None else self._invitation_row(found)

    async def sent_invitation(self, organization_id: str, email: str) -> dict[str, Any] | None:
        found = next(
            (i for i in self.tables["invitation"] if i["organization_id"] == organization_id and i["email"] == email and i["status"] == "sent"),
            None,
        )
        return None if found is None else self._invitation_row(found)

    def _newest_first(self, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return [self._invitation_row(i) for i in sorted(rows, key=lambda i: (i["sent_at"], i["id"]), reverse=True)]

    async def invitations_of_organization(self, organization_id: str) -> list[dict[str, Any]]:
        return self._newest_first([i for i in self.tables["invitation"] if i["organization_id"] == organization_id])

    async def invitations_by(self, organization_id: str, user_id: str) -> list[dict[str, Any]]:
        return self._newest_first(
            [i for i in self.tables["invitation"] if i["organization_id"] == organization_id and i["invited_by"] == user_id]
        )

    async def invitations_for_emails(self, emails: Any) -> list[dict[str, Any]]:
        wanted = set(emails)
        rows = [i for i in self.tables["invitation"] if i["status"] == "sent" and i["email"] in wanted]
        return [self._invitation_row(i) for i in sorted(rows, key=lambda i: (i["sent_at"], i["id"]))]

    async def invitation_counts(self, organization_id: str, user_id: str, hour_ago: datetime, day_ago: datetime) -> tuple[int, int]:
        rows = [i for i in self.tables["invitation"] if i["organization_id"] == organization_id and i["sent_at"] > day_ago]
        return sum(1 for i in rows if i["invited_by"] == user_id and i["sent_at"] > hour_ago), len(rows)

    async def letter_counts(self, email: str, minute_ago: datetime, hour_ago: datetime) -> tuple[int, int]:
        rows = [r for r in self.tables["invitation_letter"] if r["email"] == email and r["sent_at"] > hour_ago]
        return sum(1 for r in rows if r["sent_at"] > minute_ago), len(rows)

    async def new_letter(self, row: Any) -> None:
        self.tables["invitation_letter"].append(dict(row))

    async def prune_letters(self, hour_ago: datetime) -> None:
        self.tables["invitation_letter"] = [r for r in self.tables["invitation_letter"] if r["sent_at"] >= hour_ago]
