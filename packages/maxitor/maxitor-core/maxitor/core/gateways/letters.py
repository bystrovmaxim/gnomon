# packages/maxitor/maxitor-core/maxitor/core/gateways/letters.py
"""
The core's letters, as the mockup draws them (screens 1.9 and 7.4): a code's subject begins with the code, the
body says how long it works and has a "did not ask for it?" note with the time and country, and no letter holds a
link.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from html import escape


@dataclass(frozen=True)
class Letter:
    """One letter: its address, subject, plain text and HTML."""

    to: str
    subject: str
    text: str
    html: str


def _spaced(code: str) -> str:
    return f"{code[:3]} {code[3:]}"


def _when(at: datetime, country: str | None) -> str:
    where = f" from {country}" if country else ""
    return f"{at.strftime('%H:%M UTC, %d %b %Y')}{where}"


_PAGE = """<!doctype html><html><body style="margin:0;background:#eef2f6;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1e293b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f6;padding:28px 0"><tr><td align="center">
<table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden">
<tr><td style="background:#0f172a;padding:20px 32px;color:#ffffff;font-weight:700;font-size:16px">
<span style="display:inline-block;width:28px;height:28px;line-height:28px;text-align:center;border-radius:8px;background:#ffffff;color:#0f172a;font-weight:800;margin-right:10px">M</span>Maxitor
<span style="float:right;font-size:11px;font-weight:500;color:#94a3b8;letter-spacing:.04em;text-transform:uppercase;line-height:28px">{tag}</span></td></tr>
<tr><td style="padding:30px 32px 8px;font-size:15px;line-height:1.65">
<h1 style="font-size:22px;line-height:1.3;margin:0 0 8px;color:#0f172a">{title}</h1>
<p style="margin:0 0 14px;color:#334155">{lead}</p>{middle}</td></tr>
<tr><td style="padding:4px 32px 28px"><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;font-size:13px;line-height:1.55;color:#475569">{note}</div></td></tr>
</table>
<p style="font-size:12px;color:#94a3b8;line-height:1.6;margin:16px 0 0;max-width:520px">You get this letter because this address was entered on maxitor.aoa.run.<br>Maxitor &middot; maxitor.aoa.run</p>
</td></tr></table></body></html>"""


def _code_block(code: str) -> str:
    cells = "".join(
        f'<td style="width:52px;height:64px;border-radius:10px;background:#f1f5f9;border:1px solid #e2e8f0;text-align:center;font-size:32px;font-weight:700;color:#0f172a">{d}</td>'
        + ('<td style="width:10px"></td>' if i == 2 else '<td style="width:8px"></td>')
        for i, d in enumerate(code)
    )
    return (
        f'<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px auto 10px"><tr>{cells}</tr></table>'
        '<p style="text-align:center;font-size:13px;color:#64748b;margin:0 0 24px">Works for <b style="color:#0f172a">10 minutes</b> and only once</p>'
    )


def email_confirmation(to: str, code: str, at: datetime, country: str | None, has_account: bool) -> Letter:
    """The letter that confirms an email at sign-up; to an address with an account, an offer to sign in instead."""
    if has_account:
        text = (
            f"Someone tried to create a Maxitor account with {to} at {_when(at, country)}, but this address already has one.\n\n"
            "Sign in with your email and password, or reset the password on the sign-in page.\n"
            "If it was not you, do nothing: your account stays as it is.\n\nMaxitor · maxitor.aoa.run\n"
        )
        html = _PAGE.format(
            tag="Your account",
            title="You already have an account",
            lead=f"Someone tried to create a Maxitor account with <b>{escape(to)}</b>, but this address already has one. Sign in with your email and password, or reset the password on the sign-in page.",
            middle="",
            note=f"<b style='color:#0f172a'>Was it not you?</b> It happened at {escape(_when(at, country))}. Do nothing: your account stays as it is.",
        )
        return Letter(to, "Your Maxitor account already exists", text, html)
    text = (
        f"Your code to confirm your email for Maxitor: {_spaced(code)}\n\n"
        "Enter it on the Maxitor page to confirm this address is yours. It works for 10 minutes and only once.\n\n"
        f"Did not ask for it? Someone entered {to} on Maxitor at {_when(at, country)}. Do nothing: without the code no account is created. "
        "Never tell this code to anyone — Maxitor will not ask for it.\n\nMaxitor · maxitor.aoa.run\n"
    )
    html = _PAGE.format(
        tag="Confirm email",
        title="Confirm your email",
        lead="Hello! Enter this code on the Maxitor page to confirm this address is yours. Then your account is one step away.",
        middle=_code_block(code),
        note=f"<b style='color:#0f172a'>Did not ask for it?</b> Someone entered {escape(to)} on Maxitor at {escape(_when(at, country))}. Do nothing: without the code no account is created. Never tell this code to anyone — Maxitor will not ask for it.",
    )
    return Letter(to, f"{_spaced(code)} — confirm your email for Maxitor", text, html)


def password_reset(to: str, code: str, at: datetime, country: str | None) -> Letter:
    """The letter with a code to set a new password."""
    text = (
        f"Your code to reset your Maxitor password: {_spaced(code)}\n\n"
        "Enter it on the Maxitor page where you asked to reset your password, then choose a new one. It works for 10 minutes and only once.\n\n"
        f"Did not ask for it? Someone asked to reset the password of {to} at {_when(at, country)}. Do nothing: without the code the password stays as it is. "
        "Never tell this code to anyone — Maxitor will not ask for it.\n\nMaxitor · maxitor.aoa.run\n"
    )
    html = _PAGE.format(
        tag="Password reset",
        title="Your code to set a new password",
        lead="Hello! Enter this code on the Maxitor page where you asked to reset your password, then choose a new one.",
        middle=_code_block(code),
        note=f"<b style='color:#0f172a'>Did not ask for it?</b> Someone asked to reset the password of {escape(to)} at {escape(_when(at, country))}. Do nothing: without the code the password stays as it is. Never tell this code to anyone — Maxitor will not ask for it.",
    )
    return Letter(to, f"{_spaced(code)} — reset your Maxitor password", text, html)


def password_changed(to: str, at: datetime, country: str | None) -> Letter:
    """The letter that says a password was changed."""
    text = (
        f"The password of your Maxitor account {to} was changed at {_when(at, country)}.\n\n"
        "If it was you, there is nothing to do. If it was not, reset the password on the sign-in page at once.\n\nMaxitor · maxitor.aoa.run\n"
    )
    html = _PAGE.format(
        tag="Password changed",
        title="Your password was changed",
        lead=f"The password of your Maxitor account <b>{escape(to)}</b> was changed at {escape(_when(at, country))}.",
        middle="",
        note="<b style='color:#0f172a'>Was it not you?</b> Reset the password on the sign-in page at once.",
    )
    return Letter(to, "Your Maxitor password was changed", text, html)
