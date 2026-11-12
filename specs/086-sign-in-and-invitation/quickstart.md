# Quickstart: inviting and managing people on the local stand

## The local stand

```bash
./scripts/core-stand.sh up
```

As in [spec 072's quickstart](../072-maxitor-core/quickstart.md): PostgreSQL in Docker, the backend on `127.0.0.1:8020`, the application on `http://localhost:3000`, letters in `.core-stand/outbox/`.

## Scenarios

1. **Invite a person** — signed in as the administrator of your organization, Settings at the foot of the tree → Users → Invite; an email; the mark "Organization administrator" is off; Send. Expect the Invitations tab with the row Sent, waiting 14 days, and a letter in the outbox to that email that names you and the organization and holds no link.
2. **Accept it** — in a private window sign up with the invited email (the code from the outbox, the consent box). Expect the screen "You are invited" with the organization, Accept and Decline; Accept lands in the organization; Settings → Users of the administrator lists the new user as Active, invited by you.
3. **Refusals** — invite the same email again: "already works here"; invite an email with an invitation still Sent: "already sent", with "Send the letter again"; as an ordinary user try to send the mark: refused on the server.
4. **An ordinary user invites** — as the new user, the menu under the icon has "Invite to <organization>"; the form has no mark; the invitation appears under the form as Sent.
5. **Who may invite** — as the administrator, Settings → Organization → Administrators only: the dialog names the ordinary user's invitation; Switch. Expect it Withdrawn "by the setting" in the Invitations tab, and the ordinary user's menu without "Invite".
6. **Block and the last administrator** — in Settings → Users open the new user's card: Block; the private window's next page answers "No such organization". Open your own card: Block and Remove are dim, the mark cannot be removed: you are the last active administrator. Appoint the other user an administrator, then remove your own mark: allowed; the other administrator's card now refuses.
7. **A removed person invited again** — unblock and remove the user, invite the same email again, accept in the private window: a new active user; the removed one stays below in the list.
8. **The last place** — open Settings → Users, sign out, sign in: Settings → Users opens; with the user blocked meanwhile, the organization answers as someone else's and the screen of organizations opens.
9. **On a phone** — at 375 px the invitation's row wraps with full-width Accept and Decline, the invitation form is a sheet, the users are rows.

## Checks of the code

```bash
uv run --extra dev pytest packages/maxitor/maxitor-core/tests/test_invitations.py packages/maxitor/maxitor-core/tests/test_users.py packages/maxitor/maxitor-core/tests/test_who_may_invite.py packages/maxitor/maxitor-core/tests/test_last_place.py
npm --prefix packages/maxitor/maxitor-core/web run build
node packages/maxitor/maxitor-core/web/scripts/check-core.mjs
```

The browser check runs against the stand and walks the scenarios above in Chromium, with a second browser context for the invited person.
