# packages/maxitor/maxitor-core/maxitor/core/plugins/gateways/wheel_source_gateway.py
"""
WheelSourceGateway — downloads a plugin's wheel from the source its Package URL names.

::

    pkg:pypi/<name>@<version>                       PyPI's JSON API names the wheel; files.pythonhosted.org serves it
    pkg:github/<owner>/<repo>@<tag>?file=<wheel>    https://github.com/<owner>/<repo>/releases/download/<tag>/<wheel>
    pkg:gitlab/<path>@<tag>?file=<wheel>            https://gitlab.com/<path>/-/releases/<tag>/downloads/<wheel>
    pkg:generic/…                                   an uploaded wheel: never downloaded

Only ``https`` addresses of the allowed hosts are opened, and every redirect is checked against them, so a purl can
never point the installer at an internal address (FR-026d). A download stops at the size limit and the time limit
(FR-010a). A release that answers 401, 403 or 404 without signing in is a closed repository.
"""

from __future__ import annotations

import asyncio
from typing import Any
from urllib.parse import quote, urljoin, urlsplit

import httpx
from packageurl import PackageURL

from aoa.action_machine.intents.meta import meta
from aoa.action_machine.resources import BaseGateway

#: Connection key under which actions receive the gateway.
WHEEL_SOURCE_CONNECTION_KEY = "wheel_source"
#: The hosts a wheel may come from, redirects included.
ALLOWED_HOSTS = frozenset(
    {
        "pypi.org",
        "files.pythonhosted.org",
        "github.com",
        "objects.githubusercontent.com",
        "release-assets.githubusercontent.com",
        "gitlab.com",
    }
)
#: How many redirects one download follows.
MAX_REDIRECTS = 5


class WheelSourceError(Exception):
    """A wheel could not be had; ``reason`` is ``closed_repository``, ``too_large``, ``timeout``, ``unreachable`` or
    ``redirect`` — the first three end the check, the rest leave the version waiting."""

    def __init__(self, reason: str, detail: str) -> None:
        super().__init__(detail)
        self.reason = reason
        self.detail = detail


def release_url(purl: str) -> str | None:
    """The address of a GitHub or GitLab release's wheel; ``None`` for PyPI, whose address its API names."""
    parsed = PackageURL.from_string(purl)
    wheel = (parsed.qualifiers or {}).get("file")
    if parsed.type == "github" and wheel:
        return f"https://github.com/{quote(str(parsed.namespace))}/{quote(parsed.name)}/releases/download/{quote(str(parsed.version))}/{quote(str(wheel))}"
    if parsed.type == "gitlab" and wheel:
        path = f"{parsed.namespace}/{parsed.name}" if parsed.namespace else parsed.name
        return f"https://gitlab.com/{quote(path)}/-/releases/{quote(str(parsed.version))}/downloads/{quote(str(wheel))}"
    return None


def _allowed(url: str) -> bool:
    parts = urlsplit(url)
    return parts.scheme == "https" and (parts.hostname or "") in ALLOWED_HOSTS and parts.port in (None, 443)


@meta(description="Downloads a plugin's wheel from PyPI, a GitHub release or a GitLab release, within limits")
class WheelSourceGateway(BaseGateway):
    """
    AI-CORE-BEGIN
    ROLE: Fetch a wheel's bytes by its Package URL.
    CONTRACT: ``download`` answers the bytes or raises ``WheelSourceError`` with the reason.
    INVARIANTS: Never opens a host outside ``ALLOWED_HOSTS`` or a scheme other than https; never reads past the limit.
    AI-CORE-END
    """

    def __init__(self, max_bytes: int, timeout_seconds: float, transport: httpx.AsyncBaseTransport | None = None) -> None:
        self._max_bytes = max_bytes
        self._timeout = timeout_seconds
        self._transport = transport

    async def download(self, purl: str) -> bytes:
        """The wheel ``purl`` names, within the size and time limits."""
        try:
            return await asyncio.wait_for(self._download(purl), timeout=self._timeout)
        except TimeoutError:
            raise WheelSourceError("timeout", f"the download took longer than {self._timeout:g} s") from None

    async def _download(self, purl: str) -> bytes:
        async with httpx.AsyncClient(transport=self._transport, follow_redirects=False, timeout=self._timeout) as client:
            parsed = PackageURL.from_string(purl)
            if parsed.type == "pypi":
                url = await self._pypi_wheel(client, parsed)
            else:
                found = release_url(purl)
                if found is None:
                    raise WheelSourceError("unreachable", f"{parsed.type} is not a source Maxitor downloads from")
                url = found
            return await self._fetch(client, url, release=parsed.type in ("github", "gitlab"))

    async def _pypi_wheel(self, client: httpx.AsyncClient, parsed: PackageURL) -> str:
        answer = await self._get(client, f"https://pypi.org/pypi/{quote(parsed.name)}/{quote(str(parsed.version))}/json")
        if answer.status_code != 200:
            raise WheelSourceError("unreachable", f"PyPI answered {answer.status_code} for {parsed.name} {parsed.version}")
        files: list[dict[str, Any]] = answer.json().get("urls", [])
        wheels = [f for f in files if f.get("packagetype") == "bdist_wheel" and str(f.get("filename", "")).endswith("-none-any.whl")]
        if not wheels:
            raise WheelSourceError("unreachable", f"PyPI has no pure wheel of {parsed.name} {parsed.version}")
        return str(wheels[0]["url"])

    async def _get(self, client: httpx.AsyncClient, url: str) -> httpx.Response:
        for _ in range(MAX_REDIRECTS + 1):
            if not _allowed(url):
                raise WheelSourceError("redirect", f"{urlsplit(url).hostname} is not a host wheels come from")
            try:
                answer = await client.get(url)
            except httpx.HTTPError as error:
                raise WheelSourceError("unreachable", f"{type(error).__name__}") from None
            if answer.is_redirect and "location" in answer.headers:
                url = urljoin(url, answer.headers["location"])
                continue
            return answer
        raise WheelSourceError("redirect", f"more than {MAX_REDIRECTS} redirects")

    async def _fetch(self, client: httpx.AsyncClient, url: str, *, release: bool) -> bytes:
        for _ in range(MAX_REDIRECTS + 1):
            if not _allowed(url):
                raise WheelSourceError("redirect", f"{urlsplit(url).hostname} is not a host wheels come from")
            try:
                async with client.stream("GET", url) as answer:
                    if answer.is_redirect and "location" in answer.headers:
                        url = urljoin(url, answer.headers["location"])
                        continue
                    if release and answer.status_code in (401, 403, 404):
                        raise WheelSourceError("closed_repository", f"the release answered {answer.status_code} without signing in")
                    if answer.status_code != 200:
                        raise WheelSourceError("unreachable", f"the source answered {answer.status_code}")
                    declared = int(answer.headers.get("content-length") or 0)
                    if declared > self._max_bytes:
                        raise WheelSourceError("too_large", f"the wheel is {declared} bytes, more than {self._max_bytes}")
                    chunks: list[bytes] = []
                    received = 0
                    async for chunk in answer.aiter_bytes():
                        received += len(chunk)
                        if received > self._max_bytes:
                            raise WheelSourceError("too_large", f"the wheel is larger than {self._max_bytes} bytes")
                        chunks.append(chunk)
                    return b"".join(chunks)
            except httpx.HTTPError as error:
                raise WheelSourceError("unreachable", f"{type(error).__name__}") from None
        raise WheelSourceError("redirect", f"more than {MAX_REDIRECTS} redirects")
