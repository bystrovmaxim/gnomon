# packages/maxitor/maxitor-core/tests/fakes.py
"""
The core's backend in tests: storage in memory, a country chosen by the test, letters kept in a list, providers
that answer what the test says, and a logger that keeps every line and its event.
"""

from __future__ import annotations

import tempfile
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, cast

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from fastapi.testclient import TestClient
from maxitor.core.gateways.geoip import GeoIpGateway
from maxitor.core.gateways.letters import Letter
from maxitor.core.gateways.mail import MailGateway
from maxitor.core.gateways.providers import GATEWAYS, ProviderPerson, ProviderRefusedError
from maxitor.core.server import create_app
from maxitor.core.settings import CoreSettings
from maxitor.core.storage.core_storage import VERSIONED, CoreStorage, UniqueRowError
from maxitor.core.tokens import SESSION_COOKIE

from aoa.action_machine.graph.node_graph_coordinator_factory import create_node_graph_coordinator
from aoa.action_machine.intents.meta import meta
from aoa.action_machine.logging.base_logger import BaseLogger
from aoa.action_machine.logging.log_coordinator import LogCoordinator
from aoa.action_machine.runtime.action_product_machine import ActionProductMachine

SECRET = "a-test-secret-that-is-long-enough-for-hs256"


@meta(description="The core's storage in memory, for tests")
class MemoryCoreStorage(CoreStorage):
    """Every table a list of rows; versions kept as the real storage keeps them."""

    def __init__(self) -> None:
        super().__init__(connection_params="postgresql://unused")
        self.tables: dict[str, list[dict[str, Any]]] = {
            t: []
            for t in [
                "account",
                "account_place",
                "sign_in",
                "sign_in_code",
                "sign_in_attempt",
                "organization",
                '"user"',
                "invitation",
                "invitation_letter",
                "boundary",
                "boundary_user",
            ]
        }
        self.versions: dict[str, list[dict[str, Any]]] = {v: [] for v, _k in VERSIONED.values()}
        self.clock = datetime(2026, 11, 10, 12, 0, tzinfo=UTC)
        #: Codes another registration holds but has not committed yet: the check sees them free, the insert does not.
        self.uncommitted_codes: set[str] = set()

    async def open(self) -> None:
        return None

    async def close(self) -> None:
        return None

    async def in_transaction(self, work: Any) -> Any:
        return await work()

    async def lock(self, key: str, versions: Any) -> datetime:
        self.clock += timedelta(microseconds=1)
        return max(self.clock, datetime.now(UTC))

    async def insert(self, table: str, row: Any, changed_at: datetime, author: str | None, operation: str) -> None:
        if table == "organization" and any(o["code"] == row["code"] for o in self.tables["organization"]):
            raise UniqueRowError("organization_code_unique")
        if table == '"user"' and any(
            u["organization_id"] == row["organization_id"] and u["account_id"] == row["account_id"] and u["status"] != "removed"
            for u in self.tables['"user"']
        ):
            raise UniqueRowError("user_once_among_not_removed")
        if table == "invitation" and any(
            i["organization_id"] == row["organization_id"] and i["email"] == row["email"] and i["status"] == "sent"
            for i in self.tables["invitation"]
        ):
            raise UniqueRowError("invitation_one_sent")
        self.tables[table].append(dict(row))
        self._version(table, dict(row), changed_at, author, operation)

    async def update(
        self, table: str, key: Any, changes: Any, changed_at: datetime, author: str | None, operation: str
    ) -> None:
        for row in self.tables[table]:
            if all(row[k] == v for k, v in key.items()):
                row.update(changes)
                self._version(table, row, changed_at, author, operation)

    async def delete(self, table: str, key: Any, changed_at: datetime, author: str | None, operation: str) -> None:
        self.tables[table] = [r for r in self.tables[table] if not all(r[k] == v for k, v in key.items())]

    def _version(self, table: str, row: dict[str, Any], changed_at: datetime, author: str | None, operation: str) -> None:
        versions, _keys = VERSIONED[table]
        kept = {k: v for k, v in row.items() if not (table == "sign_in" and k in {"password_hash", "last_used_at"})}
        self.versions[versions].append({**kept, "valid_from_at": changed_at, "author_id": author, "operation": operation})

    async def sign_in_of(self, provider: str, subject: str) -> dict[str, Any] | None:
        for r in self.tables["sign_in"]:
            if r["provider"] == provider and r["provider_subject"] == subject:
                return {
                    "id": r["id"],
                    "account_id": r["account_id"],
                    "password_hash": r["password_hash"],
                    "password_changed_at": r["password_changed_at"],
                }
        return None

    async def account(self, account_id: str) -> dict[str, Any] | None:
        return next(
            (
                {k: r[k] for k in ("id", "name", "email", "policy_version")}
                for r in self.tables["account"]
                if r["id"] == account_id
            ),
            None,
        )

    async def sign_ins(self, account_id: str) -> list[dict[str, Any]]:
        return [
            {k: r[k] for k in ("id", "provider", "provider_subject", "email", "added_country", "added_at")}
            for r in self.tables["sign_in"]
            if r["account_id"] == account_id
        ]

    async def password_changed_at(self, account_id: str) -> datetime | None:
        times = [
            r["password_changed_at"]
            for r in self.tables["sign_in"]
            if r["account_id"] == account_id and r["provider"] == "email" and r["password_changed_at"]
        ]
        return max(times) if times else None

    async def touch_sign_in(self, sign_in_id: str, at: datetime) -> None:
        for r in self.tables["sign_in"]:
            if r["id"] == sign_in_id:
                r["last_used_at"] = at

    async def last_place(self, account_id: str) -> str | None:
        return next((r["address"] for r in self.tables["account_place"] if r["account_id"] == account_id), None)

    async def keep_place(self, account_id: str, address: str, at: datetime) -> None:
        for r in self.tables["account_place"]:
            if r["account_id"] == account_id:
                r.update(address=address, changed_at=at)
                return
        self.tables["account_place"].append({"account_id": account_id, "address": address, "changed_at": at})

    async def code_counts(self, email: str, ip: str, minute_ago: datetime, hour_ago: datetime) -> tuple[int, int, int]:
        rows = self.tables["sign_in_code"]
        return (
            sum(1 for r in rows if r["email"] == email and r["created_at"] > minute_ago),
            sum(1 for r in rows if r["email"] == email and r["created_at"] > hour_ago),
            sum(1 for r in rows if r["requested_ip"] == ip and r["created_at"] > hour_ago),
        )

    async def new_code(self, row: dict[str, Any]) -> None:
        for r in self.tables["sign_in_code"]:
            if r["email"] == row["email"] and r["purpose"] == row["purpose"] and r["used_at"] is None:
                r["used_at"] = row["created_at"]
        self.tables["sign_in_code"].append(dict(row))

    async def working_code(self, email: str, purpose: str) -> dict[str, Any] | None:
        return next(
            (
                r
                for r in self.tables["sign_in_code"]
                if r["email"] == email and r["purpose"] == purpose and r["used_at"] is None
            ),
            None,
        )

    async def code_by_id(self, code_id: str) -> dict[str, Any] | None:
        return next((r for r in self.tables["sign_in_code"] if r["id"] == code_id), None)

    async def wrong_code(self, code_id: str, at: datetime) -> int:
        row = await self.code_by_id(code_id)
        assert row is not None
        row["wrong_tries"] += 1
        if row["wrong_tries"] >= 5:
            row["used_at"] = at
        return max(0, 5 - row["wrong_tries"])

    async def end_code(self, code_id: str, at: datetime) -> None:
        row = await self.code_by_id(code_id)
        if row is not None and row["used_at"] is None:
            row["used_at"] = at

    async def prune(self, now: datetime, hour_ago: datetime, window_start: datetime) -> None:
        self.tables["sign_in_attempt"] = [r for r in self.tables["sign_in_attempt"] if r["at"] >= window_start]

    async def attempt_counts(self, email: str, ip: str, since: datetime) -> tuple[int, int, datetime | None]:
        rows = [r for r in self.tables["sign_in_attempt"] if r["at"] > since]
        mine = [r["at"] for r in rows if r["email"] == email]
        return len(mine), sum(1 for r in rows if r["ip"] == ip), (min(mine) if mine else None)

    async def wrong_password(self, attempt_id: str, email: str, ip: str, at: datetime) -> None:
        self.tables["sign_in_attempt"].append({"id": attempt_id, "email": email, "ip": ip, "at": at})

    async def organizations_of(self, account_id: str) -> list[dict[str, Any]]:
        out = []
        for u in self.tables['"user"']:
            if u["account_id"] == account_id and u["status"] == "active":
                o = next(o for o in self.tables["organization"] if o["id"] == u["organization_id"])
                out.append({"code": o["code"], "name": o["name"], "is_admin": u["is_admin"], "user_name": u["name"]})
        return sorted(out, key=lambda o: (o["name"], o["code"]))

    async def watermark(self, organization_id: str) -> str | None:
        """The organization's last change: its latest version opened, as the database's function reads it."""
        moments = [v["valid_from_at"] for rows in self.versions.values() for v in rows
                   if str(v.get("organization_id", v.get("id"))) == organization_id]
        latest = max(moments, default=None)
        return None if latest is None else latest.strftime("%Y-%m-%dT%H:%M:%S.%fZ")

    async def organization_for(self, code: str, account_id: str) -> dict[str, Any] | None:
        for o in self.tables["organization"]:
            if o["code"] == code:
                for u in self.tables['"user"']:
                    if u["organization_id"] == o["id"] and u["account_id"] == account_id and u["status"] == "active":
                        return {
                            "id": o["id"],
                            "code": o["code"],
                            "name": o["name"],
                            "who_may_invite": o["who_may_invite"],
                            "user_id": u["id"],
                            "user_name": u["name"],
                            "is_admin": u["is_admin"],
                        }
        return None

    async def organization(self, organization_id: str) -> dict[str, Any] | None:
        return next(
            (
                {k: o[k] for k in ("id", "code", "name", "who_may_invite")}
                for o in self.tables["organization"]
                if o["id"] == organization_id
            ),
            None,
        )

    async def code_taken(self, code: str) -> bool:
        if code in self.uncommitted_codes:
            return False
        return any(o["code"] == code for o in self.tables["organization"])

    async def organizations_created(self, account_id: str) -> int:
        return sum(1 for o in self.tables["organization"] if o["created_by"] == account_id)

    # ── users, as the real storage joins them ─────────────────────────────────

    def _account_of(self, account_id: str) -> dict[str, Any]:
        return next(a for a in self.tables["account"] if a["id"] == account_id)

    def _user_row(self, u: dict[str, Any]) -> dict[str, Any]:
        account = self._account_of(u["account_id"])
        used = [s["last_used_at"] for s in self.tables["sign_in"] if s["account_id"] == u["account_id"] and s["last_used_at"]]
        invitation = next(
            (i for i in self.tables["invitation"] if i["organization_id"] == u["organization_id"] and i["accepted_user_id"] == u["id"]),
            None,
        )
        inviter = self._user_by_id(u["organization_id"], invitation["invited_by"]) if invitation else None
        versions = [v for v in self.versions["user_versions"] if v["organization_id"] == u["organization_id"] and v["id"] == u["id"]]
        author = versions[-1].get("author_id") if versions else None
        changer = next(
            (c for c in self.tables['"user"'] if c["organization_id"] == u["organization_id"] and c["account_id"] == author and c["status"] != "removed"),
            None,
        )
        return {
            **{k: u[k] for k in ("organization_id", "id", "account_id", "name", "is_admin", "status", "created_at", "updated_at")},
            "email": account["email"],
            "last_sign_in_at": max(used) if used else None,
            "invited_by": inviter["id"] if inviter else None,
            "invited_by_name": inviter["name"] if inviter else None,
            "changed_by": changer["id"] if changer else None,
            "changed_by_name": changer["name"] if changer else None,
        }

    def _user_by_id(self, organization_id: str, user_id: str) -> dict[str, Any] | None:
        return next((u for u in self.tables['"user"'] if u["organization_id"] == organization_id and u["id"] == user_id), None)

    async def user(self, organization_id: str, user_id: str) -> dict[str, Any] | None:
        found = self._user_by_id(organization_id, user_id)
        return None if found is None else self._user_row(found)

    async def users_of_organization(self, organization_id: str) -> list[dict[str, Any]]:
        rows = [self._user_row(u) for u in self.tables['"user"'] if u["organization_id"] == organization_id]
        return sorted(rows, key=lambda r: (r["status"] == "removed", r["name"], r["id"]))

    async def user_of_account(self, organization_id: str, account_id: str) -> dict[str, Any] | None:
        return next(
            (
                {k: u[k] for k in ("id", "name", "is_admin", "status")}
                for u in self.tables['"user"']
                if u["organization_id"] == organization_id and u["account_id"] == account_id and u["status"] != "removed"
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
            if u["organization_id"] == organization_id and u["status"] != "removed" and email in self._emails_of(u["account_id"]):
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


@meta(description="A country chosen by the test")
class ChosenCountryGateway(GeoIpGateway):
    """Answers the country the test sets; ``None`` means unknown."""

    def __init__(self) -> None:
        super().__init__(None)
        self.country: str | None = None

    async def country_of(self, ip: str | None) -> str | None:
        return self.country


@meta(description="Letters kept in a list, for tests")
class KeptMailGateway(MailGateway):
    """Keeps every letter; ``fail`` makes the next send fail."""

    def __init__(self) -> None:
        super().__init__("Maxitor <no-reply@maxitor.aoa.run>")
        self.letters: list[Letter] = []
        self.fail = False

    async def _send(self, letter: Letter) -> None:
        from maxitor.core.gateways.mail import MailNotDeliveredError  # pylint: disable=import-outside-toplevel

        if self.fail:
            raise MailNotDeliveredError("Postbox answered 500")
        self.letters.append(letter)

    def last_code(self) -> str:
        subject = self.letters[-1].subject
        return subject.split(" — ")[0].replace(" ", "")


async def _answered_person(self: Any, code: str, verifier: str) -> ProviderPerson:
    """The provider's person is what the test put in ``person_answer``; the code ``refused`` is refused."""
    _ = verifier
    if code == "refused" or self.person_answer is None:
        raise ProviderRefusedError("refused")
    return cast(ProviderPerson, self.person_answer)


#: One answering class per provider: the graph keeps each class by its own name.
ANSWERING: dict[str, type] = {
    name: meta(description=f"{name} as the test answers")(
        type(
            f"Answering{base.__name__}",
            (base,),
            {
                "__module__": __name__,
                "__qualname__": f"Answering{base.__name__}",
                "person_answer": None,
                "person": _answered_person,
            },
        )
    )
    for name, base in GATEWAYS.items()
}


def provider_double(name: str) -> Any:
    """A provider gateway whose person the test sets."""
    return ANSWERING[name]("client-id", "client-secret", f"http://localhost:3000/api/v1/sign-in/{name}/callback")


class KeptLogger(BaseLogger):
    """Keeps every line: its message and its event."""

    def __init__(self) -> None:
        super().__init__()
        self.lines: list[tuple[str, Any]] = []

    async def write(self, scope: Any, message: str, var: Any, ctx: Any, state: Any, params: Any, indent: int) -> None:
        self.lines.append((message, var))

    def events(self) -> list[str]:
        return [type(var).__name__ for _m, var in self.lines]


class World:
    """The backend with its doubles."""

    def __init__(self, wheel_max_bytes: int = 50 * 1024 * 1024) -> None:
        self.storage = MemoryCoreStorage()
        self.geo = ChosenCountryGateway()
        self.mail = KeptMailGateway()
        self.providers = {name: provider_double(name) for name in GATEWAYS}
        self.logger = KeptLogger()
        machine = ActionProductMachine(
            graph_coordinator=create_node_graph_coordinator(), log_coordinator=LogCoordinator(loggers=[self.logger])
        )
        from tests.plugin_fakes import MemoryPluginsStorage  # pylint: disable=import-outside-toplevel

        self.plugins = MemoryPluginsStorage(self.storage)
        self.wheels = Path(tempfile.mkdtemp(prefix="wheels-"))
        self.gateway_key = Ed25519PrivateKey.generate()
        key_file = Path(tempfile.mkdtemp(prefix="gateway-")) / "gateway-key.pem"
        key_file.write_bytes(
            self.gateway_key.private_bytes(
                serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()
            )
        )
        app = create_app(
            CoreSettings(
                session_secret=SECRET, wheel_store=self.wheels, wheel_max_bytes=wheel_max_bytes, gateway_key_file=key_file
            ),
            resources={"core": self.storage, "plugins": self.plugins, "geoip": self.geo, "mail": self.mail, **self.providers},
            machine=machine,
        )
        self.client = TestClient(app)

    def signed(self, token: str) -> None:
        self.client.cookies.set(SESSION_COOKIE, token)

    def sign_up(self, email: str = "anna@example.com", password: str = "CorrectHorse!42", name: str = "Anna") -> str:
        """Create an account by email and answer its session token."""
        assert self.client.post("/api/v1/sign-up", json={"email": email, "password": password}).status_code == 200
        consent = self.client.post(
            "/api/v1/sign-up/confirm", json={"email": email, "code": self.mail.last_code()}
        ).json()["consent_token"]
        return str(
            self.client.post("/api/v1/account", json={"consent_token": consent, "name": name, "accepted": True}).json()[
                "session_token"
            ]
        )
