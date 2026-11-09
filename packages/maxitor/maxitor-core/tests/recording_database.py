# packages/maxitor/maxitor-core/tests/recording_database.py
"""A database without a server: a pool of one connection that records every statement and answers from a script."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from aoa.action_machine.resources.postgres import PostgresPool

#: Answers a statement: (query, parameters) -> the driver's answer, or None.
Answer = Callable[[str, tuple[Any, ...]], Any]


class RecordingConnection:
    """Record each statement with its parameters; answer reads from ``answer``."""

    def __init__(self, answer: Answer) -> None:
        self.answer = answer
        self.statements: list[tuple[str, tuple[Any, ...]]] = []

    async def execute(self, query: str, *params: Any) -> str:
        self.statements.append((query, params))
        return "OK"

    async def fetch(self, query: str, *params: Any) -> list[Any]:
        self.statements.append((query, params))
        return list(self.answer(query, params) or [])

    async def fetchval(self, query: str, *params: Any) -> Any:
        self.statements.append((query, params))
        return self.answer(query, params)

    async def fetchrow(self, query: str, *params: Any) -> Any:
        self.statements.append((query, params))
        return self.answer(query, params)

    def queries(self) -> list[str]:
        """The statements in order, without their parameters."""
        return [query for query, _params in self.statements]


class RecordingPool:
    """A pool of one recording connection."""

    def __init__(self, answer: Answer) -> None:
        self.connection = RecordingConnection(answer)

    async def acquire(self, *, timeout: float | None = None) -> RecordingConnection:
        return self.connection

    async def release(self, connection: RecordingConnection) -> None:
        return None

    async def close(self) -> None:
        return None


def recording_pool(answer: Answer) -> tuple[PostgresPool, RecordingConnection]:
    """An AOA pool over a recording connection, and that connection."""
    pool = RecordingPool(answer)
    return PostgresPool(pool=pool), pool.connection
