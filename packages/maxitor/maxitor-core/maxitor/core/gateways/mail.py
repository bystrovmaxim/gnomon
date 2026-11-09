# packages/maxitor/maxitor-core/maxitor/core/gateways/mail.py
"""
MailGateway — the only way the core sends a letter.

An action asks for what it sends — a confirmation code, a reset code, a note that a password changed — never for a
letter: the gateway builds it (``letters.py``) and carries it. ``YandexCloudPostboxGateway`` carries it through
Postbox's SES-compatible API, signed by SigV4; ``OutboxMailGateway`` writes it as an ``.eml`` file into a folder,
for a machine without Postbox (the local stand, the browser checks).
"""

from __future__ import annotations

import json
import uuid
from abc import ABC, abstractmethod
from datetime import datetime
from email.message import EmailMessage
from pathlib import Path

import httpx
from maxitor.core.gateways.letters import Letter, email_confirmation, password_changed, password_reset

from aoa.action_machine.intents.meta import meta
from aoa.action_machine.resources import BaseGateway

#: Connection key under which actions receive the gateway.
MAIL_CONNECTION_KEY = "mail"
POSTBOX_ENDPOINT = "https://postbox.cloud.yandex.net"
POSTBOX_REGION = "ru-central1"


class MailNotDeliveredError(RuntimeError):
    """The mail service refused the letter or did not answer; ``reason`` says which, never the letter's content."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


@meta(description="The mail: what the core sends, never how")
class MailGateway(BaseGateway, ABC):
    """
    AI-CORE-BEGIN
    ROLE: Send the core's letters.
    CONTRACT: Each method builds one letter and sends it; a failure raises ``MailNotDeliveredError``.
    INVARIANTS: An action names what it sends, not who carries it.
    AI-CORE-END
    """

    def __init__(self, sender: str) -> None:
        self._sender = sender

    @classmethod
    def get_wrapper_class(cls) -> None:
        """No wrapper: a nested action uses the same gateway."""
        return None

    async def send_email_confirmation(
        self, to: str, code: str, at: datetime, country: str | None, has_account: bool
    ) -> None:
        """The letter that confirms ``to`` at sign-up, or tells it an account already exists."""
        await self._send(email_confirmation(to, code, at, country, has_account))

    async def send_password_reset(self, to: str, code: str, at: datetime, country: str | None) -> None:
        """The letter with a code to set a new password."""
        await self._send(password_reset(to, code, at, country))

    async def send_password_changed(self, to: str, at: datetime, country: str | None) -> None:
        """The letter that says the password was changed."""
        await self._send(password_changed(to, at, country))

    @abstractmethod
    async def _send(self, letter: Letter) -> None:
        """Carry one built letter."""


@meta(description="Yandex Cloud Postbox through its SES-compatible API")
class YandexCloudPostboxGateway(MailGateway):
    """
    AI-CORE-BEGIN
    ROLE: Send a letter through Yandex Cloud Postbox.
    CONTRACT: ``send_email`` posts SES v2 SendEmail signed by SigV4 and answers Postbox's message id.
    INVARIANTS: The key's secret is never in a log, an error or the ``repr``.
    AI-CORE-END
    """

    def __init__(
        self, sender: str, key_id: str, secret: str, transport: httpx.AsyncBaseTransport | None = None
    ) -> None:
        super().__init__(sender)
        self._key_id = key_id
        self._secret = secret
        self._transport = transport

    def __repr__(self) -> str:
        return f"YandexCloudPostboxGateway(sender={self._sender!r}, key_id={self._key_id!r}, secret=...)"

    async def send_email(self, letter: Letter) -> str:
        """Send ``letter``; answer the id Postbox gave it."""
        from botocore.auth import SigV4Auth  # pylint: disable=import-outside-toplevel
        from botocore.awsrequest import AWSRequest  # pylint: disable=import-outside-toplevel
        from botocore.credentials import Credentials  # pylint: disable=import-outside-toplevel

        url = f"{POSTBOX_ENDPOINT}/v2/email/outbound-emails"
        body = json.dumps(
            {
                "FromEmailAddress": self._sender,
                "Destination": {"ToAddresses": [letter.to]},
                "Content": {
                    "Simple": {
                        "Subject": {"Data": letter.subject, "Charset": "UTF-8"},
                        "Body": {
                            "Text": {"Data": letter.text, "Charset": "UTF-8"},
                            "Html": {"Data": letter.html, "Charset": "UTF-8"},
                        },
                    }
                },
            }
        )
        request = AWSRequest(method="POST", url=url, data=body, headers={"Content-Type": "application/json"})
        SigV4Auth(Credentials(self._key_id, self._secret), "ses", POSTBOX_REGION).add_auth(request)
        try:
            async with httpx.AsyncClient(transport=self._transport, timeout=15.0) as client:
                answer = await client.post(url, content=body, headers=dict(request.headers.items()))
        except httpx.HTTPError as exc:
            raise MailNotDeliveredError(f"Postbox did not answer: {type(exc).__name__}") from None
        if answer.status_code >= 300:
            raise MailNotDeliveredError(f"Postbox answered {answer.status_code}")
        return str(answer.json().get("MessageId", ""))

    async def _send(self, letter: Letter) -> None:
        await self.send_email(letter)


@meta(description="Letters written as .eml files into a folder, for a machine without Postbox")
class OutboxMailGateway(MailGateway):
    """
    AI-CORE-BEGIN
    ROLE: Keep each letter as a file instead of sending it.
    CONTRACT: Writes ``<time>-<id>.eml`` into the folder; the newest file is the last letter.
    AI-CORE-END
    """

    def __init__(self, sender: str, folder: Path) -> None:
        super().__init__(sender)
        self._folder = folder

    async def _send(self, letter: Letter) -> None:
        message = EmailMessage()
        message["From"] = self._sender
        message["To"] = letter.to
        message["Subject"] = letter.subject
        message.set_content(letter.text)
        message.add_alternative(letter.html, subtype="html")
        self._folder.mkdir(parents=True, exist_ok=True)
        name = f"{datetime.now().strftime('%Y%m%d-%H%M%S-%f')}-{uuid.uuid4().hex[:8]}.eml"
        (self._folder / name).write_bytes(bytes(message))
