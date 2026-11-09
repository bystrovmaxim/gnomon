# packages/maxitor/maxitor-core/maxitor/core/gateways/geoip.py
"""
GeoIpGateway — the country of an IP address, from a country database kept on the server.

No IP address leaves the server to ask anyone: the database is a local ``mmdb`` file (MaxMind GeoLite2 Country or
any database of the same format). With no database, or an address the database does not know, the answer is
``None``, which the region rule counts as Russia.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from aoa.action_machine.intents.meta import meta
from aoa.action_machine.resources import BaseGateway

#: Connection key under which actions receive the gateway.
GEOIP_CONNECTION_KEY = "geoip"


@meta(description="The country of an IP address, from a country database kept on the server")
class GeoIpGateway(BaseGateway):
    """
    AI-CORE-BEGIN
    ROLE: Answer the country of an IP address.
    CONTRACT: ``country_of`` answers an ISO 3166-1 alpha-2 code, or ``None`` with no database or an unknown address.
    INVARIANTS: Reads a local file only; no address leaves the server.
    AI-CORE-END
    """

    def __init__(self, database: Path | None = None, reader: Any | None = None) -> None:
        self._database = database
        self._reader = reader

    def _open(self) -> Any | None:
        if self._reader is None and self._database is not None and self._database.exists():
            import geoip2.database  # pylint: disable=import-outside-toplevel

            self._reader = geoip2.database.Reader(str(self._database))
        return self._reader

    async def country_of(self, ip: str | None) -> str | None:
        """The country of ``ip``, or ``None``."""
        reader = self._open()
        if reader is None or not ip:
            return None
        try:
            code = reader.country(ip).country.iso_code
        except Exception:  # an address the database does not know, or not an address at all
            return None
        return str(code) if code else None
