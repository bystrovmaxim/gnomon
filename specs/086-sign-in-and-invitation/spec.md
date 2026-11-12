# Feature Specification: Maxitor core — sign-in and invitation: an organization is entered by an invitation, and its administrators manage its users

**Feature Branch**: `feature/issue-13-sign-in-and-invitation`

**Created**: 2026-11-12

**Status**: Draft

**Input**: Issue bystrovmaxim/gnomon#13, "11 · Foundation 3/4: Sign-in and invitation". The issue's body is the source of truth. It builds on the core of bystrovmaxim/gnomon#73 — accounts, signing in by email and password or a provider, the consent step, registering an organization, the organization's users and their lifecycle, the organization's lock — and on the frame of bystrovmaxim/gnomon#74 with the entered Settings of bystrovmaxim/gnomon#122 and the top row of bystrovmaxim/gnomon#98. The design is the mockup `specs/072-maxitor-core/mockup/index.html`, screens 8.1–8.14, 9.1–9.12, 10.1–10.6, 11.1 and M13–M15, accepted by the maintainer before any code.

## What this is

Today an organization has one user: the administrator who registered it. Nobody else can get in, and nobody can be let in.

This step makes Maxitor an organization's own: a person reaches an organization only by an **invitation**, and the organization's **administrators** manage its users — see who is there, block, unblock and remove them, appoint other administrators and withdraw invitations. The organization decides **who may invite**: any of its users, or administrators only. The invitation is a thing of its own, with a life of its own: sent, then accepted, declined, withdrawn or expired. The letter it sends holds no link; the invited person signs in to Maxitor with the invited email and accepts on the screen of their organizations. And from now on, after signing in, Maxitor opens where the person stopped.

Words used below:

- **Account** — one person in Maxitor, with a name, an email and ways to sign in (bystrovmaxim/gnomon#73).
- **User** — an account's place in one organization: its name there, whether it administers the organization, and its state — **Active**, **Blocked** or **Removed**.
- **Administrator** — a user with the administrator mark: invites anyone, appoints administrators, blocks, unblocks and removes users, withdraws invitations and changes the organization's settings.
- **Ordinary user** — an active user without the mark.
- **Invitation** — the organization's offer to one email: who sent it, whether it makes an administrator, when it was sent, and its state — **Sent**, **Accepted**, **Declined**, **Withdrawn** or **Expired**.
- **Inviter** — the user who sent an invitation.
- **Who may invite** — the organization's setting: **any user** or **administrators only**.
- **Confirmed email** — an email confirmed by its code (bystrovmaxim/gnomon#73) or given by a provider as verified. Emails are compared in lower case.
- **The organization's lock** — the lock every change of an organization's data takes (bystrovmaxim/gnomon#73), so two people's changes of one organization go one after the other.
- **The last place** — where the person stopped: the organization and the page the account had open last, in the present — without the moment or the comparison of the time scale.

## Clarifications

### Session 2026-11-12

The issue fixes the rules; these are the points it leaves to the way, resolved here as the reading this specification is held to, and settled on the mockup before any code.

- Q: Where does an ordinary user invite from, having no Settings? → A: From the menu under their icon in the top row: "Invite to <organization>", shown to every active user when the setting is **any user** and to administrators always (mockup 10.5, 10.6). The form it opens has no administrator mark, and under it the user sees the invitations they sent, with "Send again" on those still Sent (mockup 8.3, 9.12). Withdrawing is the administrator's.
- Q: Where does an administrator invite and manage? → A: In Settings → Users, a page of the core's own next to Plugins, for administrators only: the organization's users and its invitations in two tabs, "Invite" at the head, a user's or an invitation's card on the right (mockup 9.1–9.11). The setting **Who may invite** lives in Settings → Organization, a page of the core's own too (mockup 10.1–10.4).
- Q: How does an invitation expire? → A: By its time alone: an invitation is Expired once `MAXITOR_INVITATION_DAYS` days have passed since its letter was first sent. No letter goes about it. The organization writes the state Expired when it next reads or touches the invitation past that time; nothing runs in the background for it.
- Q: Does a withdrawn or expired invitation tell the invited person? → A: No. The invitation simply stops working: an account that signs in with that email sees nothing of it, as it sees nothing of an invitation that was never sent.
- Q: What name does the new user get on acceptance? → A: The account's name, as the consent step set it (bystrovmaxim/gnomon#73); the person changes it later as any user's name is changed. The invitation form asks for the email alone.
- Q: Does a second letter of the same invitation count against the limits? → A: Yes, as a letter: one email gets at most one letter of invitation a minute and ten an hour, whoever sends it and whichever invitation it belongs to. The inviter's and the organization's limits count invitations sent, not letters.
- Q: What is the user's last place (issue 1.4)? → A: The last address of Maxitor the account had open — the organization and the page, with the entered levels the address carries — kept with the account, not in the browser. After signing in Maxitor opens it; the screen of choosing an organization is shown only when there is no last place, when the last place can no longer be opened and the account has several organizations, or when an invitation waits. A last place the account can no longer open — the user is blocked or removed, the page is gone — falls back to the organization's root, and from there to choosing an organization. This rule goes into the issue before its phase starts, as the issue asks.
- Q: When do a block, a removal or a change of the administrator mark reach a person who is signed in and working, on a plugin's page through the gateway included? → A: From the next request. The core and the gateway read the user's state and role on every request to the organization: a blocked or removed user gets the answer for someone else's organization at once, and the gateway's next token for a plugin — they live a minute — carries the new role. The account's session is not ended: its other organizations keep working.
- Q: What does the last place hold — the whole address with the moment and the comparison of the time scale, or the page in the present? → A: The page in the present: the organization, the page's owner and path with the page's own parameters, without `at`, `mode` and `from`. After signing in the page opens at Now; nobody wakes up in a past month.
- Q: What is the default of `MAXITOR_INVITATION_DAYS`? → A: 14 days, as the mockup draws it: two weeks cover a holiday and do not keep old invitations open for months.
- Q: Does accepting an invitation need the invited person to be at a particular address? → A: No. The invitations stand on the screen of choosing an organization, `/w`, which an account with none or several organizations sees after signing in; an account with one organization and a waiting invitation is brought there too, instead of straight into its organization (mockup 8.10, 8.14).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - An administrator invites a person, who accepts and becomes a user (Priority: P1)

Anna, an administrator of Severny Veter, opens Settings → Users and invites dmitry.krotov@partner-stroy.ru. Dmitry gets a letter that names Anna and Severny Veter and asks him to sign in to Maxitor with this email; it holds no link. He signs in — or first creates an account with this email — accepts the privacy policy if it changed, sees the invitation on the screen of his organizations, accepts it and is in Severny Veter as an active user. Had Anna switched the administrator mark on, he would be an administrator from the first moment.

**Why this priority**: It is the whole point of the step: a second person in an organization.

**Independent Test**: On the local stand, invite an email from Settings → Users; read the letter in the stand's mailbox; sign in with that email; accept; the organization opens and the person is listed as an active user; repeat with the administrator mark on and see the administrator badge.

**Acceptance Scenarios**:

1. **Given** an administrator on Settings → Users, **When** they press "Invite", enter an email and send, **Then** an invitation in the state Sent is created with the email, the inviter, the mark and the time, and a letter is sent to the email; the invitations tab shows the new row and its card.
2. **Given** the invitation form opened by an administrator, **When** it opens, **Then** the mark "Organization administrator" is off; **When** the administrator switches it on and sends, **Then** the invitation makes an administrator.
3. **Given** the letter, **When** it is read, **Then** it comes from `no-reply@maxitor.aoa.run`, names the organization and the inviter, says to sign in to Maxitor with this email, says until when the invitation waits, and holds no link.
4. **Given** an account whose confirmed email equals the invitation's email in lower case, **When** it signs in, **Then** the screen of choosing an organization shows the invitation with Accept and Decline, above the account's organizations if it has any.
5. **Given** an account that has not accepted the current privacy policy, **When** it signs in with a waiting invitation, **Then** it accepts the policy first, as at any sign-in, and sees the invitation after.
6. **Given** a waiting invitation, **When** the account accepts it, **Then** an active user of that account is created in the organization — an administrator when the invitation says so — the invitation becomes Accepted, and the organization opens.
7. **Given** a waiting invitation, **When** the account declines it, **Then** the invitation becomes Declined, the account has no user in the organization, and the screen says so.
8. **Given** an account whose confirmed emails do not include the invitation's, **When** it signs in, **Then** it sees nothing of the invitation.
9. **Given** an invitation that was accepted, declined, withdrawn or expired, **When** the same email is invited again, **Then** a new invitation is sent as usual.

---

### User Story 2 - An ordinary user invites, within what the organization allows (Priority: P1)

With **Who may invite** at **any user**, Oleg, an ordinary user, chooses "Invite to Severny Veter" in the menu under his icon and invites a colleague; the form has no administrator mark, and under it he sees the invitations he sent. With the setting at **administrators only** the item is gone, and a call that comes from elsewhere is refused.

**Why this priority**: An organization that lets its people bring colleagues grows by itself; the setting keeps that in the organization's hands.

**Independent Test**: As an ordinary user, invite from the menu and see the invitation Sent under the form; switch the setting to administrators only as an administrator; as the ordinary user the item is gone, and a request to invite sent by hand is refused with the setting named.

**Acceptance Scenarios**:

1. **Given** the setting at **any user** and an active ordinary user, **When** they open the menu under their icon, **Then** it holds "Invite to <organization>", which opens the invitation form without the administrator mark.
2. **Given** an ordinary user's invitation form, **When** they send, **Then** the invitation makes an ordinary user; a request from them that carries the administrator mark is refused, wherever it comes from.
3. **Given** an ordinary user's invitation form, **When** it is open, **Then** under it stand the invitations they sent, each with its state, and "Send again" on those still Sent.
4. **Given** the setting at **administrators only**, **When** an ordinary user opens the menu, **Then** it holds no "Invite"; **When** an invitation from them reaches the organization anyway, **Then** it is refused with the setting named.
5. **Given** the setting at **any user**, **When** an administrator invites, **Then** the mark is offered to them as always.

---

### User Story 3 - Who may invite, and what switching it withdraws (Priority: P1)

Anna opens Settings → Organization and switches **Who may invite** to **administrators only**. Before switching, Maxitor names the invitations ordinary users sent that are not yet accepted: they are withdrawn at that moment and cannot be accepted any more. Invitations administrators sent stay, and users who already accepted stay as they are.

**Why this priority**: The setting is the organization's gate; a switch that left old invitations open would leave the gate ajar.

**Independent Test**: With one Sent invitation from an ordinary user and one from an administrator, switch to administrators only: the first is Withdrawn with the moment and the reason, the second stays Sent; the invited person of the first signs in and sees nothing; switch back: nothing is restored.

**Acceptance Scenarios**:

1. **Given** a new organization, **When** it is registered, **Then** **Who may invite** is **any user**.
2. **Given** Settings → Organization, **When** an administrator opens it, **Then** the current value is shown with both choices and what each means; an ordinary user has no such page.
3. **Given** the setting at **any user** and invitations Sent by ordinary users, **When** an administrator chooses **administrators only**, **Then** Maxitor names those invitations before the switch; **When** the administrator confirms, **Then** the setting changes and every such invitation becomes Withdrawn at that moment, with the moment and "by the setting" recorded.
4. **Given** the switch, **When** it is done, **Then** invitations sent by administrators stay Sent and users who already accepted stay unchanged.
5. **Given** any change of the setting, **When** it is requested by a user who is not an administrator, **Then** it is refused.
6. **Given** the setting, **When** an invitation is sent, **Then** the organization checks the setting at that moment, whether the request comes from the screen or not.

---

### User Story 4 - An invitation is refused when it should be (Priority: P1)

Anna invites an email that already works in Severny Veter: refused, the user named. She invites a blocked person: refused — a blocked user is unblocked, not invited, and the refusal leads to that user's card. She invites an email with an invitation still Sent: refused; only its letter may go again. She sends her thirty-first invitation within an hour: refused with the limit named, and a security event written.

**Why this priority**: Every refusal is a rule of the organization; a form that let them through would make the rules decoration.

**Independent Test**: Try each refusal from the form and by a request sent by hand; each answers with its reason and creates nothing; the limit refusals write an event of the security channel.

**Acceptance Scenarios**:

1. **Given** an email whose account is an active user of the organization, **When** it is invited, **Then** the invitation is refused and the refusal names that the person already works here.
2. **Given** an email whose account is a blocked user, **When** it is invited, **Then** the invitation is refused with the reason that a blocked user is unblocked, not invited; an administrator is led to the user's card.
3. **Given** an email with an invitation still Sent, **When** it is invited again, **Then** the invitation is refused, and the person is offered to send that invitation's letter again.
4. **Given** an email whose account is a removed user, **When** it is invited, **Then** the invitation is sent; accepting makes a new user, and the removed user stays in the history.
5. **Given** the limits — one email: one letter a minute and ten an hour; one inviter: thirty invitations an hour; one organization: a hundred invitations a day — **When** a limit is reached, **Then** the invitation or the letter is refused with a message that names the limit and when the next one can go, and an event of the security channel is written.
6. **Given** a Sent invitation, **When** its inviter or an administrator sends its letter again, **Then** the same letter goes to the same email within the limits, and the invitation stays Sent with its first time and its expiry unchanged.

---

### User Story 5 - An administrator manages the users (Priority: P1)

Anna opens Settings → Users: every user of Severny Veter with their state, role, how they appeared and their last sign-in; removed users below, kept in the history. She opens a card and blocks, unblocks or removes a user, or switches the administrator mark. The organization always keeps at least one active administrator: the last one cannot be blocked, removed or lose the mark, even when two administrators act at the same moment. A blocked or removed user cannot enter the organization.

**Why this priority**: An organization nobody can tidy is an organization nobody can trust with a second person.

**Independent Test**: Block, unblock and remove users from their cards and see their state and the moment; appoint and dismiss an administrator; try to dismiss the last one: refused; have two administrators step down at the same moment in a test: exactly one is refused; sign in as a blocked and as a removed user: the organization answers as someone else's.

**Acceptance Scenarios**:

1. **Given** Settings → Users, **When** an administrator opens it, **Then** it lists every user with name, email, state, role, how they appeared — registered the organization, or invited by whom and when — and their last sign-in; removed users stand apart; the second tab lists every invitation with its email, state, role, inviter, time and what happened to it.
2. **Given** a user's card, **When** the administrator blocks, unblocks or removes, **Then** the user's state changes by its lifecycle — Active ↔ Blocked, either → Removed, Removed final — with who and when, under the organization's lock, as a version of the user.
3. **Given** a user's card, **When** the administrator switches the administrator mark, **Then** the user becomes or stops being an administrator; the mark cannot change while the user is blocked or removed.
4. **Given** the last active administrator, **When** anyone tries to block, remove or dismiss them, **Then** it is refused and the card says why; a removal of a user is confirmed before it is done.
5. **Given** two administrators who both step down at the same moment, **When** both requests arrive, **Then** one goes first under the organization's lock and the other is refused as the last active administrator's.
6. **Given** a blocked or removed user, **When** their account opens the organization's address, **Then** the answer is the one for someone else's organization (bystrovmaxim/gnomon#73); the organization is not among the account's organizations.
10. **Given** a user who is signed in and working, **When** they are blocked, removed or lose or gain the administrator mark, **Then** their next request to the organization — a plugin's page through the gateway included — answers by the new state and role, while the account stays signed in to its other organizations.
7. **Given** a Sent invitation's row or card, **When** an administrator withdraws it, **Then** it becomes Withdrawn with who and when, and cannot be accepted.
8. **Given** an invitation that was accepted, **When** its row or card is read, **Then** it names the user it made.
9. **Given** Settings → Users or Settings → Organization, **When** anyone who is not an administrator opens their address, **Then** the answer is "No such page", as for Plugins.

---

### User Story 6 - Signing in again opens where the person stopped (Priority: P2)

Dmitry signs in a second time and lands on the page he had open when he left, in the organization he was in, instead of the screen of choosing an organization.

**Why this priority**: A person with one organization should not be asked which one; a person on a page should not be sent to the root.

**Independent Test**: Open a page inside Settings, sign out, sign in: the same page opens; have the user blocked meanwhile: the organization's root is refused as someone else's and the screen of organizations opens.

**Acceptance Scenarios**:

1. **Given** an account that has a last place, **When** it signs in, **Then** Maxitor opens that organization and page at Now, with the page's own parameters and without the moment or the comparison it had on the time scale.
2. **Given** an account with no last place, **When** it signs in, **Then** it is treated as today: one organization opens, several are chosen between, none leads to registering one.
3. **Given** a last place the account can no longer open, **When** it signs in, **Then** Maxitor falls back to that organization's root, and from there to choosing an organization.
4. **Given** a waiting invitation, **When** the account signs in, **Then** the screen of choosing an organization is shown with the invitation, whatever the last place.

---

### User Story 7 - The same on a phone (Priority: P2)

On a phone the invitation form is a sheet from the bottom, the invitations on the screen of organizations wrap into rows with full-width Accept and Decline, and the users' table becomes rows one under another.

**Why this priority**: The invited person most often opens the letter on a phone and signs in from it.

**Independent Test**: At 375 px walk the invited person's path and an administrator's invitation; nothing scrolls sideways and every button can be pressed.

**Acceptance Scenarios**:

1. **Given** a phone, **When** the screen of choosing an organization shows an invitation, **Then** its row wraps: the organization and the inviter above, Accept and Decline in a full row below (mockup M13).
2. **Given** a phone, **When** the invitation form opens, **Then** it is a sheet from the bottom with the buttons in full rows (mockup M14); **When** Settings → Users opens, **Then** the table is rows one under another and a card takes the whole screen (mockup M15).

---

### Edge Cases

- An invitation's email is written in another case than the account's: they are compared in lower case and match.
- A person has two accounts with the same email as different ways in: an invitation is seen by any account whose confirmed email matches; accepting from one makes a user of that account only, and the other then sees the invitation as Accepted no more.
- An account accepts an invitation while the inviter is being blocked: both go under the organization's lock; the invitation is accepted as it stands, since only withdrawing, declining and expiry close it.
- The setting is switched to administrators only while an ordinary user has the form open: their send is refused with the setting named.
- An invitation makes an administrator, and its inviter loses the mark before it is accepted: the invitation stands as sent; the mark was checked when it was sent.
- The last active administrator is also the only user: they cannot step down, be blocked or removed; registering an organization made them so.
- A removed user is invited again, accepts, and later is removed again: two removed users of one account stay in the history; only users not removed are unique for an organization and an account.
- A letter cannot be sent: the invitation is not created, the refusal says the letter did not go, and a critical event is written, as for the codes of bystrovmaxim/gnomon#73.
- The organization's hundredth invitation of the day is a letter sent again: it counts as a letter, not as an invitation, so it goes if the email's own limits allow.
- The last place names an organization the account is no longer a user of: the fallback goes to choosing an organization, never to that organization's root.

## Requirements *(mandatory)*

### Functional Requirements

#### Who may invite

- **FR-001**: An organization MUST carry the setting **Who may invite** with the values **any user** and **administrators only**, kept as the organization's own field and versioned with the organization; registering an organization MUST set it to **any user**.
- **FR-002**: Only an administrator MUST be able to change the setting, in Settings → Organization; a change by anyone else MUST be refused.
- **FR-003**: Every invitation MUST be checked against the setting at the moment it is sent, whether or not the request comes from the screen: with **administrators only** an invitation from a user who is not an administrator MUST be refused with the setting named.
- **FR-004**: Switching the setting to **administrators only** MUST, in the same change and under the organization's lock, make every invitation still Sent whose inviter is not an administrator Withdrawn, recording the moment and that the setting did it; invitations sent by administrators and users who already accepted MUST stay as they are. Before the switch the screen MUST name the invitations it will withdraw.

#### The invitation

- **FR-005**: An invitation MUST be an entity of its own of the organization, versioned as the organization's other entities are, with the email it is sent to, the inviter, whether it makes an administrator, its state and when its letter was first sent; its states MUST be Sent, Accepted, Declined, Withdrawn and Expired, Sent the only state it is created in and the only one it can leave.
- **FR-006**: No user MUST exist for an invitation until it is accepted; a user's states MUST stay Active, Blocked and Removed.
- **FR-007**: The administrator mark of the invitation form MUST be off when the form opens, shown only to an administrator, and accepted only from an administrator; a request from anyone else that carries it MUST be refused, wherever it comes from.
- **FR-008**: The letter of an invitation MUST come from `no-reply@maxitor.aoa.run`, name the organization and the inviter, say to sign in to Maxitor with this email and until when the invitation waits, and MUST hold no link, as no letter of Maxitor does.
- **FR-009**: An account MUST see an invitation only if one of its confirmed emails equals the invitation's email in lower case; it MUST see it on the screen of choosing an organization after signing in, after the privacy policy has been accepted when the policy requires it, and an account with one organization and a waiting invitation MUST be brought to that screen too.
- **FR-010**: Accepting MUST create an active user of the account in the organization — an administrator when the invitation says so — with the account's name, make the invitation Accepted, and open the organization; declining MUST make it Declined; both MUST go under the organization's lock.
- **FR-011**: An invitation not accepted within `MAXITOR_INVITATION_DAYS` days of its first letter — 14 by default — MUST be Expired: the organization MUST treat it so from that moment and write the state when it next reads or touches it; no letter MUST be sent about it.
- **FR-012**: The inviter or an administrator MUST be able to send a Sent invitation's letter again, within the limits; the invitation MUST keep its first time and its expiry.
- **FR-013**: The limits MUST hold: one email gets at most one letter of invitation a minute and ten an hour, counting letters sent again; one inviter sends at most thirty invitations an hour; one organization at most a hundred a day. Past a limit the invitation or the letter MUST be refused with a message that names the limit and when the next one can go, and an event of the security channel MUST be written.
- **FR-014**: An invitation to an email whose account is an active or a blocked user of the organization MUST be refused with that reason — a blocked user is unblocked, not invited — and an invitation to an email with an invitation still Sent MUST be refused, with the offer to send that invitation's letter again. A removed user MAY be invited again; accepting MUST make a new user, and a user MUST be unique for an organization and an account among the users not removed.
- **FR-015**: An ordinary user MUST be able to invite from the menu under their icon when the setting allows, with a form without the administrator mark, and MUST see under it the invitations they sent with their states and "Send again" on those still Sent; the item MUST be absent when the setting is **administrators only**.

#### Managing users

- **FR-016**: Settings → Users MUST be a page of the core's own for administrators only, next to Plugins, listing every user of the organization — name, email, state, role, how they appeared and their last sign-in, removed users apart — and every invitation — email, state, role, inviter, when sent and what happened to it, an accepted one naming its user; anyone else opening its address MUST get "No such page".
- **FR-017**: An administrator MUST be able to block, unblock and remove a user and to appoint and dismiss an administrator from the user's card, each change by the user's lifecycle with who and when, under the organization's lock and as a version of the user; a removal MUST be confirmed first; the administrator mark MUST NOT change while the user is blocked or removed. Every such change MUST take effect from the person's next request to the organization: the core and the gateway MUST read the user's state and role on every request, and the gateway's next token for a plugin MUST carry the new role; the account's session MUST NOT be ended.
- **FR-018**: An administrator MUST be able to withdraw a Sent invitation from its row or card, with who and when recorded.
- **FR-019**: The organization MUST always keep at least one active administrator: the last one MUST NOT be blocked, removed or dismissed, and the refusal MUST say so; two administrators acting at once MUST be ordered by the organization's lock, so that exactly one of two simultaneous step-downs is refused.
- **FR-020**: A blocked or removed user MUST NOT enter the organization: its address MUST answer as someone else's organization does from the next request on, a signed-in session included, and the organization MUST NOT be among the account's organizations.
- **FR-021**: Every change of the organization's users, invitations and the setting — accepting included — MUST take the organization's lock, as registering does.

#### The last place

- **FR-022**: An account MUST keep its last place — the organization, the page's owner and path with the page's own parameters it had open last, without the moment or the comparison of the time scale — with the account, not in the browser; after signing in Maxitor MUST open it at Now, and MUST fall back to the organization's root and then to choosing an organization when it can no longer be opened; a waiting invitation MUST bring the account to the screen of choosing an organization regardless.

#### The phone

- **FR-023**: On a phone the invitation's row on the screen of organizations MUST wrap with Accept and Decline in a full row, the invitation form MUST be a sheet from the bottom, and the users' and invitations' tables MUST become rows one under another, with nothing scrolling sideways (mockup M13–M15).

#### Events, tests, documentation, versions

- **FR-024**: The organization's events MUST cover at least: an invitation sent, its letter sent again, accepted, declined, withdrawn, expired; a user blocked, unblocked, removed; an administrator appointed or dismissed; the setting changed (info); an invitation refused — by the setting, by the mark, by a user already there, by a Sent invitation, by a limit — and the last administrator's protection (warning); a letter that could not be sent (critical); each with the organization, the user acting when there is one, and an email only masked.
- **FR-025**: The tests MUST prove each refusal and each state change of an invitation, the setting's check and its withdrawal, the limits, the uniqueness among the users not removed, the last administrator's rule with two administrators at once, a blocked and a removed user's refusal, and the last place; a browser check MUST walk an administrator's invitation and the invited person's path on a desktop and at 375 px.
- **FR-026**: The core's README and `docs/how-to/run-the-core-locally.md` MUST describe inviting a second person and the setting; the tutorial's chapter 1 MUST set up the local stand with a second person of the same organization; the plugin concept MUST speak of membership as built; spec 059's `terms.md` and `data-model.md` MUST say who invites and that the invitation is an entity of its own.
- **FR-027**: The core MUST raise its version, and the changelog MUST describe the work in one article.

### Key Entities

- **Organization** — gains **Who may invite**; versioned, under its own lock.
- **User** — an account's place in one organization: name, the administrator mark, the state by its lifecycle, who invited them and when; unique for an organization and an account among the users not removed; versioned.
- **Invitation** — the organization's offer to one email: the email, the inviter, whether it makes an administrator, the state, when the letter was first sent, when and by what it was accepted, declined, withdrawn or expired; versioned.
- **Account** — unchanged in its fields; gains its last place.
- **Last place** — the organization and the page an account had open last, with the page's own parameters and without the time scale's moment or comparison.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An invited person goes from the letter to being an active user in at most 4 screens — sign in (or create an account and consent), the policy when it changed, the organizations, the organization — and in 100% of tries lands in the organization after Accept.
- **SC-002**: An account whose confirmed emails do not include the invitation's sees the invitation in 0% of tries, and nothing in the letter or on any page lets anyone in without signing in with the invited email.
- **SC-003**: Every refusal of issue 1.2 — the setting, the mark, a user already there, a blocked user, a Sent invitation, each limit — answers with its reason in 100% of tries from the screen and from a request sent by hand, and creates nothing.
- **SC-004**: Switching to administrators only withdraws 100% of the Sent invitations of ordinary users at that moment and 0 of the administrators' or accepted ones.
- **SC-005**: Over 100 runs of two administrators stepping down at the same moment, the organization is left with at least one active administrator every time and exactly one request is refused.
- **SC-006**: A blocked or removed user opens their organization in 0% of tries; a removed person invited again becomes a new active user in 100% of tries.
- **SC-007**: An invitation older than `MAXITOR_INVITATION_DAYS` days is accepted in 0% of tries.
- **SC-008**: An account that signs in again lands at its last place in 100% of tries where it can still be opened, and on the organizations' screen when an invitation waits.

## Assumptions

- The core of bystrovmaxim/gnomon#73 is in place: accounts with confirmed emails, the consent step and the policy's version, the organization's lock and the versioning of its tables, the user's lifecycle with Active, Blocked and Removed and the last-administrator rule modelled, the letters' gateway and the limits of the codes, whose shape the invitation's limits follow.
- The frame is the one of bystrovmaxim/gnomon#74 with Settings entered (bystrovmaxim/gnomon#122) and the top row of bystrovmaxim/gnomon#98; Settings → Users and Settings → Organization are two new nodes of the core's own tree next to Plugins, for administrators only, and the pages of the core's own in the panel, as Plugins is.
- The mockup lives in the mockup of spec 072 — screens 8.1–8.14, 9.1–9.12, 10.1–10.6, 11.1 and M13–M15 of `specs/072-maxitor-core/mockup/index.html` — because the frame and the screens of signing in are that spec's; it is accepted by the maintainer before any code, and the issue's phases are to name it first.
- The privacy policy does not change for this work: the invitation keeps only what the organization already keeps of a person — an email and who entered it.
- The screen of choosing an organization is the only place an invitation is accepted or declined; a letter holds nothing that accepts it.
- The last place is a rule of this specification until it is written into the issue, as the issue asks; the issue's phase 4 follows the issue's wording when it differs.
- `MAXITOR_INVITATION_DAYS` defaults to 14; the letter, the documentation and the tests of the lifetime use that number unless the setting says otherwise.
- The browser checks run locally on the stand, as CI cannot run them.
