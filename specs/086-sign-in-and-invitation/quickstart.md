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
6. **Block and the last administrator** — in Settings → Users open the new user's card: Block; the private window's next page answers "No such organization". Open your own card: Block is dim, the mark cannot be switched off: you are the last active administrator. Unblock the other user, appoint them an administrator, then remove your own mark: allowed; the other administrator's card now refuses.
7. **A blocked person is not invited** — invite the blocked user's email: refused, the person is unblocked, not invited; the user's card has Block and Unblock, never Remove.
8. **The last place** — open Settings → Users, sign out, sign in: Settings → Users opens; with the user blocked meanwhile, the organization answers as someone else's and the screen of organizations opens.
9. **On a phone** — at 375 px the invitation's row wraps with full-width Accept and Decline, the invitation form is a sheet, the users are rows.

## Checks of the code

```bash
uv run --extra dev pytest packages/maxitor/maxitor-core/tests/test_invitations.py packages/maxitor/maxitor-core/tests/test_users.py packages/maxitor/maxitor-core/tests/test_who_may_invite.py packages/maxitor/maxitor-core/tests/test_last_place.py
npm --prefix packages/maxitor/maxitor-core/web run build
node packages/maxitor/maxitor-core/web/scripts/check-core.mjs
```

The browser check runs against the stand and walks the scenarios above in Chromium, with a second browser context for the invited person.

The terminal `removed` state is declared for AOA graph validation only. Posting to `/api/v1/organizations/users/remove` must be refused without writing a user version, for both an active and a blocked user. Sending `state` or `status` to block or unblock must return 422.

See [verification.md](verification.md) for the passing local checks and the remaining commit and CI steps. The 49-scenario browser walk includes the real PostgreSQL invitation flow and the invitation sheet at 375 px. It respects the one-letter-per-minute limit when another organization invites the same address.

### History handoff after publication

Publish from Draft and immediately open the time scale after the shell address becomes Published. The scale must retain Published's history setup, show its publication markers and offer its comparisons without reloading. A delayed cleanup of Draft must not erase a history message already received from Published. The same rule applies when returning to Draft or another page.

The open scale must also receive a publication from a second tab within five seconds, including Diff and Side by side at desktop and phone widths. B at Now follows the publication; explicit A and B dates retain their timestamps. The two-second watermark poll reserves time inside that budget for requests and rendering.
