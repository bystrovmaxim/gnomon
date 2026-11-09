# packages/maxitor/maxitor-core/tests/fakes.py
"""
The core's backend in tests: storage in memory, a country chosen by the test, letters kept in a list, providers
that answer what the test says, and a logger that keeps every line and its event.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any, cast

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
                "sign_in",
                "sign_in_code",
                "sign_in_attempt",
                "organization",
                '"user"',
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
        self.tables[table].append(dict(row))
        self._version(table, dict(row), changed_at, operation)

    async def update(
        self, table: str, key: Any, changes: Any, changed_at: datetime, author: str | None, operation: str
    ) -> None:
        for row in self.tables[table]:
            if all(row[k] == v for k, v in key.items()):
                row.update(changes)
                self._version(table, row, changed_at, operation)

    async def delete(self, table: str, key: Any, changed_at: datetime, author: str | None, operation: str) -> None:
        self.tables[table] = [r for r in self.tables[table] if not all(r[k] == v for k, v in key.items())]

    def _version(self, table: str, row: dict[str, Any], changed_at: datetime, operation: str) -> None:
        versions, _keys = VERSIONED[table]
        kept = {k: v for k, v in row.items() if not (table == "sign_in" and k in {"password_hash", "last_used_at"})}
        self.versions[versions].append({**kept, "valid_from_at": changed_at, "operation": operation})

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

    async def organization_for(self, code: str, account_id: str) -> dict[str, Any] | None:
        for o in self.tables["organization"]:
            if o["code"] == code:
                for u in self.tables['"user"']:
                    if u["organization_id"] == o["id"] and u["account_id"] == account_id and u["status"] == "active":
                        return {
                            "id": o["id"],
                            "code": o["code"],
                            "name": o["name"],
                            "user_id": u["id"],
                            "user_name": u["name"],
                            "is_admin": u["is_admin"],
                        }
        return None

    async def code_taken(self, code: str) -> bool:
        if code in self.uncommitted_codes:
            return False
        return any(o["code"] == code for o in self.tables["organization"])

    async def organizations_created(self, account_id: str) -> int:
        return sum(1 for o in self.tables["organization"] if o["created_by"] == account_id)


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

    def __init__(self) -> None:
        self.storage = MemoryCoreStorage()
        self.geo = ChosenCountryGateway()
        self.mail = KeptMailGateway()
        self.providers = {name: provider_double(name) for name in GATEWAYS}
        self.logger = KeptLogger()
        machine = ActionProductMachine(
            graph_coordinator=create_node_graph_coordinator(), log_coordinator=LogCoordinator(loggers=[self.logger])
        )
        app = create_app(
            CoreSettings(session_secret=SECRET),
            resources={"core": self.storage, "geoip": self.geo, "mail": self.mail, **self.providers},
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
