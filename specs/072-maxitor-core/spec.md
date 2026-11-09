# Feature Specification: Maxitor core — signing in, registering an organization, the empty frame and one compatibility check for plugins

**Feature Branch**: `feature/issue-73-maxitor-core`

**Created**: 2026-11-09

**Status**: Draft

**Input**: Issue bystrovmaxim/gnomon#73, "Maxitor core: its own database, registering an organization, the empty frame, and one compatibility check for plugins". The issue's body is the source of truth; the screens are drawn exactly in [`mockup/index.html`](mockup/index.html).

## What this is

Maxitor gets its first people. Someone opens Maxitor, signs up with their email and a password — the email confirmed by a code — or with a service they already use, agrees to the privacy policy, registers an organization and enters it — an empty screen of that organization, with their own icon and a way out. Under that, Maxitor gets a database of its own in which organizations live side by side, every part of Maxitor writes its log only as typed events, and the core gets an identity and a version so that plugins can depend on it.

Words used below:

- **Account** — one person in Maxitor: a name and an email; its password, when it has one, belongs to its email sign-in.
- **Sign-in** — one way an account gets in: an email and password, or one provider's account.
- **Provider** — a service a person signs in with: Yandex ID, Mail.ru ID, Google, GitHub or Facebook.
- **Region** — whether a request comes from Russia or from abroad, by the country of its IP address.
- **Code** — the six-digit one-time code Maxitor sends to an email to confirm it or to reset its password.
- **Consent step** — the screen where a new person accepts the privacy policy before their account exists.
- **Organization** — a tenant of Maxitor: its people and its work, at the address `/w/<address code>`.
- **Address code** — the organization's segment of every address, chosen at registration.
- **User** — an account's place in one organization: its name there and whether it administers it.
- **Empty frame** — the organization's screen with nothing in it yet: the left tree and the dotted field, both empty.
- **Event** — one typed line of Maxitor's log, of a kind its domain declares.
- **Core passport** — the file that names the core's version and the formats of a plugin's files it reads.

## Clarifications

### Session 2026-11-09

Decided with the maintainer while the issue was written.

- Q: Which ways in does Maxitor offer? → A: Email and password, Yandex ID, Mail.ru ID, Google, GitHub and Facebook. No single sign-on.
- Q: Which ways in work where? → A: Email and password, Yandex ID and Mail.ru ID work in every country; Google, GitHub and Facebook only outside Russia, because Russian law lets a person in Russia sign in only by a Russian service or the site's own means.
- Q: How is the region told? → A: By the IP address alone, read from a country database kept on Maxitor's server; no IP leaves the server. An address the database does not know counts as Russia.
- Q: Is a foreign provider refused only when an account is created, or at every sign-in? → A: At every sign-in. From Russia, Google, GitHub and Facebook are neither shown nor accepted, even for an account that has them; a traveller keeps access by linking an email and password, Yandex ID or Mail.ru ID beforehand.
- Q: What does a signed-in person see at an organization they are not in? → A: "No such organization" (404), the same as for an address that does not exist.
- Q: What does a person without a session see at an organization's address? → A: The sign-in page, which names only the address that was opened and brings them back to it after signing in.
- Q: Is consent to the privacy policy asked of every way in? → A: Yes. No account exists until a new person ticks the consent box and presses "Create account", whichever way they came.
- Q: Are cookies consented to? → A: Yes. A banner on the first visit names the one cookie Maxitor sets; signing in waits until it is accepted.
- Q: How does signing in by email work? → A: The email is the login and the person sets a password when creating the account; the email is confirmed by a six-digit code before the account exists. A forgotten password is reset by a code sent to the email, and a letter says the password was changed.
- Q: Where does the session live, given constitution rule 55 asks for the `Authorization: Bearer` header? → A: In the `HttpOnly` cookie `__Host-maxitor_session`; rule 55 is amended to allow it for Maxitor's web sign-in.
- Q: How does constitution rule 56 apply without single sign-on? → A: Email sign-in checks the password against its hash, as rule 56 says; a provider's answer is checked by its `state` and PKCE verifier.
- Q: Which mailbox answers privacy and deletion requests? → A: `privacy@aoa.run`.
- Q: Why can't the reader choose Domains on the paint switch in the ERD's physical view? → A: The physical view's default, resources, is told apart from the reader's choice by comparing it with "domains", so choosing Domains falls back to Resources. This work keeps "no choice yet" apart from a chosen section.
- Q: Through what does Maxitor reach the outside world? → A: Every step is an action of AOA, every endpoint is declared by the adapter's fluent interface, and every outside service — each provider, the country database, the mail — is a typed gateway an action receives per call.

### Session 2026-11-10

- Q: In what language does a person see the screens, the letters and the public pages? → A: English only, as the mockup and today's Maxitor; Russian comes in a later issue.
- Q: How long does a session live, and what does a password reset do to sessions already open? → A: A session token lives 8 hours and is renewed while the person is active, up to 30 days from signing in; a renewal is refused once the account's password changed after the token was issued, so an old session ends within 8 hours of a reset.
- Q: Does an organization's administrator manage users in this work? → A: No. In this work an organization has one user, its administrator who registered it; listing, blocking, removing users and appointing administrators come with invitations in bystrovmaxim/gnomon#13.
- Q: How many organizations may one account register? → A: At most 10; the eleventh is refused with a message that says so.
- Q: Where do the events of signing in go, and for how long? → A: This work writes them by the project's rules — typed events through each method's box; the log coordinator that delivers and keeps them is not switched on in this work, so where they are kept and for how long is decided when it is.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A new person creates an account by email and password (Priority: P1)

A person who has never been in Maxitor enters their email and a password, confirms the email by a code, agrees to the privacy policy and has an account; later they sign in with the same email and password.

**Why this priority**: Email and password is the one way in that works in every country and for everyone; without it no one gets in.

**Independent Test**: From an IP in Russia and from one abroad, a new address with a valid password receives a letter with a code, the code opens the consent step, and pressing "Create account" with the box ticked creates exactly one account; the same email and password then sign in; without the tick nothing is created.

**Acceptance Scenarios** (mockup 1.1–1.7, 1.9, 1.11, 1.13–1.16):

1. **Given** "Create an account", **When** a person enters an email and a password of at least 10 characters that is neither the email nor a common password, **Then** a letter from `no-reply@maxitor.aoa.run` arrives whose subject begins with a six-digit code, and the page asks for it.
2. **Given** a password that breaks a rule, **Then** the page names the rule and sends nothing.
3. **Given** a code was sent, **When** the right code is entered within ten minutes, **Then** the person goes to the consent step.
4. **Given** the consent step, **When** the box is not ticked, **Then** "Create account" does nothing and nothing about the person is stored.
5. **Given** the consent step, **When** the box is ticked and "Create account" pressed, **Then** the account is created with the email and the password's hash as its first sign-in, the version of the policy accepted, and the time and IP of the acceptance.
6. **Given** a code, **When** a wrong code is entered, **Then** the page says how many of the five tries remain; after the fifth wrong try the code no longer works, even if right; a code older than ten minutes is refused as expired.
7. **Given** an address that asked for ten codes in the last hour, **When** it asks again, **Then** the page says when the next code can be sent and sends none.
8. **Given** an address that already has an account, **When** someone creates an account with it, **Then** the page answers the same as for a new address, and the letter offers to sign in or reset the password.
9. **Given** an account, **When** its email and password are entered on the sign-in page, **Then** it is signed in; **When** either is wrong, **Then** the page says only "Wrong email or password".
10. **Given** ten wrong passwords for one address in fifteen minutes, **Then** signing in by password for it waits until the time the page names, and resetting the password stays open.

---

### User Story 1a - A person resets a forgotten password (Priority: P1)

A person who forgot their password gets a code by email, sets a new password and signs in with it.

**Why this priority**: Without a reset, a forgotten password locks a person out for good.

**Independent Test**: An account asks for a reset, receives the letter, enters the code and a new password, and signs in with the new password; the old one is refused; a letter says the password was changed.

**Acceptance Scenarios** (mockup 7.1–7.4):

1. **Given** "Forgot password?", **When** an address is entered, **Then** the page answers the same whether the address has an account or not, and an account with a password receives a letter whose subject begins with the code.
2. **Given** the code and a new password that keeps the rules, **Then** the new password's hash replaces the old one, the old password no longer works, and a letter tells the address its password was changed, with the time and country.
3. **Given** a wrong, used up or expired code, **Then** the password stays as it was, under the same limits as every code.

---

### User Story 2 - A person signs in with a provider their region allows (Priority: P1)

A person signs in with Yandex ID or Mail.ru ID from anywhere, or with Google, GitHub or Facebook from outside Russia, and a new person goes through the same consent step.

**Why this priority**: Most people would rather press one button than wait for a letter; the region rule is a legal requirement for the owner.

**Independent Test**: From an IP in Russia the page offers exactly the email field, Yandex ID and Mail.ru ID; from an IP abroad, the email field and all five providers; a Google address opened from Russia is refused even for an account that has Google.

**Acceptance Scenarios** (mockup 1.1, 1.2, 1.8, 1.11):

1. **Given** a request from Russia, **When** the sign-in page opens, **Then** it shows the email field, Yandex ID and Mail.ru ID, and no Google, GitHub or Facebook — not even behind a link.
2. **Given** a request from abroad, **When** the sign-in page opens, **Then** it shows the email field and all five providers as one row of icon buttons.
3. **Given** a request from Russia, **When** a Google, GitHub or Facebook sign-in is started or finished by any address, **Then** it is refused on a page that says why and offers the code by email first, then Yandex ID and Mail.ru ID.
4. **Given** a provider's answer, **When** it belongs to a known sign-in, **Then** that account is signed in; **When** it does not, **Then** the person goes to the consent step with the name the provider gave, editable.
5. **Given** a provider's answer whose `state` does not match the one Maxitor sent, **Then** nothing is signed in and the refusal is logged.

---

### User Story 3 - A new account registers an organization and enters its empty frame (Priority: P1)

A person with an account and no organization names their organization, gets a free address for it, and lands on its empty screen as its administrator.

**Why this priority**: An organization is what everything else in Maxitor belongs to; without it a signed-in person has nowhere to go.

**Independent Test**: A new account registers "Severny Veter", the address `severny-veter` is suggested and free, and after pressing "Register and enter" the person is at `/w/severny-veter` with the empty frame, their icon and a way out.

**Acceptance Scenarios** (mockup 2.1–2.4, 4.1–4.3):

1. **Given** an account with no organization, **When** it is signed in, **Then** it lands on registering an organization: the organization's name and its address code.
2. **Given** the registration form, **When** a name is typed, **Then** an address code is suggested from it and the page says at once whether it is free, taken or not allowed.
3. **Given** a taken code, **Then** the page suggests two free codes made from the name.
4. **Given** a code with characters that are not allowed, **Then** the page names them.
5. **Given** two people registering the same free code at once, **Then** one gets it and the other is told it was taken a moment ago, with nothing of theirs created.
6. **Given** a successful registration, **Then** the organization and its first user, its administrator, are created in one change, and the person lands at `/w/<code>`.
7. **Given** the empty frame, **Then** it shows the organization's name, an empty left tree, an empty dotted field and the person's icon, with name and email on hover.

---

### User Story 4 - A person moves between organizations and is kept out of others' (Priority: P2)

A person in several organizations chooses one and switches between them; nobody learns anything from an organization they are not in.

**Why this priority**: An account may belong to several organizations from the start; keeping tenants apart is a promise of the whole platform.

**Independent Test**: An account in two organizations chooses one after signing in and switches from the header; the same account opening a third organization's address gets the same 404 as for a made-up address; without a session the address leads to the sign-in page and back.

**Acceptance Scenarios** (mockup 1.10, 3, 4.3–4.5):

1. **Given** an account in one organization, **When** it signs in, **Then** it goes straight to that organization.
2. **Given** an account in several, **When** it signs in, **Then** it chooses one, and later switches from the organization's name in the header or from the icon's menu.
3. **Given** an account with no active user in an organization, **When** it opens that organization's address, **Then** it sees "No such organization", the same as for an address that does not exist, and the header shows no organization.
4. **Given** no session, **When** an organization's address is opened, **Then** the sign-in page says only "Sign in to open <address>" and, after signing in by any way, brings the person to that address.
5. **Given** a sign-in link whose return address is not a path of Maxitor itself, **Then** the return address is dropped.
6. **Given** a signed-in account, **When** it registers another organization from the icon's menu, **Then** no second account appears, only a user in the new organization.
7. **Given** an account that registered 10 organizations, **When** it registers another, **Then** it is refused with a message that names the limit and nothing is created.

---

### User Story 5 - A person manages the ways they sign in (Priority: P2)

A person sees how they sign in, links an email or another provider, and unlinks one they no longer use.

**Why this priority**: The region rule can lock a traveller out; linking a way that works everywhere is their way back.

**Independent Test**: An account with Yandex ID links an email and password, the email confirmed by a code, then unlinks Yandex ID; it cannot unlink the email as its last way in; linking an email that already signs in another account is refused.

**Acceptance Scenarios** (mockup 5.1–5.5):

1. **Given** "Sign-in methods", **Then** it lists every sign-in of the account and offers only the ways allowed in the region the request comes from.
2. **Given** an email and a password to link, **When** the code sent to the email is entered, **Then** the email and password become one more way in.
3. **Given** an account with one sign-in, **Then** it cannot be unlinked.
4. **Given** a provider account or email that already signs in another account, **When** it is linked, **Then** linking is refused with a message that says so, and the two accounts stay apart.

---

### User Story 6 - A person learns what Maxitor keeps and agrees to its cookie (Priority: P2)

A visitor reads what Maxitor keeps about them and how to have it deleted, and accepts the one cookie before signing in.

**Why this priority**: The law on personal data requires it, and Google and Facebook will not publish the sign-in apps without these pages.

**Independent Test**: A first visit shows the cookie banner and greys the sign-in form until "Accept"; `/privacy` and `/data-deletion` open without signing in and are linked from the sign-in page and the letter.

**Acceptance Scenarios** (mockup 1.12, 6.1, 6.2):

1. **Given** a first visit, **Then** a banner names the one cookie, what it is for and links to the cookies section of the privacy policy, and signing in waits until it is accepted.
2. **Given** an accepted banner, **When** the policy's version changes, **Then** the banner is shown again.
3. **Given** `/privacy`, **Then** it says what Maxitor keeps, why, where, for how long, which cookies it sets, and how to have the data deleted.
4. **Given** `/data-deletion`, **Then** it says to write to `privacy@aoa.run` from the account's email and that everything is deleted within thirty days.
5. **Given** a new version of the policy, **When** an existing account signs in next, **Then** it sees the consent step again before its session begins.

---

### User Story 7 - An operator reads Maxitor's log as typed events (Priority: P3)

Whoever runs Maxitor reads every line its domains write as a typed event: what happened, at what level, with which fields — and never a code, a token or a secret.

**Why this priority**: A security log is only useful if every refusal is a known kind with known fields; it matters once people sign in.

**Independent Test**: Every domain of Maxitor — `platform`, `organization`, `core`, `diagrams`, `rooms`, `repo_graph` and the plugin template's `notes` — declares its events; a line written without an event, or with an event its method did not declare, is refused when written; the 46 lines written today are all events.

**Acceptance Scenarios**:

1. **Given** any domain of Maxitor, **Then** it declares the closed list of events its actions may write.
2. **Given** a method that writes, **When** it writes a line without an event or with one it did not declare, **Then** the line is refused.
3. **Given** the events of signing in, **Then** each carries the provider, the country and the account when there is one, an email only masked, and never a password, a code, a token or a secret.
4. **Given** a plugin whose domain declares no events, **When** it is checked, **Then** the check refuses it.

---

### User Story 8 - A plugin author checks a plugin against a core version (Priority: P3)

The author of a plugin learns, before installing it, whether it fits a given version of the core and, if not, every side of the conflict.

**Why this priority**: Plugins come after this work; the core's identity and the one compatibility rule must exist before the first plugin depends on them.

**Independent Test**: `maxitor plugin check` against a core version accepts the plugin template and refuses, with every side named, each kind of conflict: a format the core does not read, a core outside the plugin's range, two versions of one plugin, a cycle, a foreign SDK major, a dependent broken by an upgrade or a removal.

**Acceptance Scenarios**:

1. **Given** the core, **Then** its passport names its version and the formats of a plugin's files it reads, and an action answers them.
2. **Given** a plugin and a core version, **When** they fit, **Then** the check passes; **When** they do not, **Then** it refuses and names every side of the conflict.

---

### User Story 9 - The concept model speaks of boundaries and signing in by providers (Priority: P3)

A reader of spec 059 finds the concept model brought to the current AOA, `EnterpriseCoreEntity` named `BoundaryCoreEntity` everywhere, single sign-on gone, and signing in described as this work builds it.

**Why this priority**: The model is the plan the code is compared with; it must not contradict what is built.

**Independent Test**: No page of spec 059 or its model names `EnterpriseCoreEntity` or single sign-on, and its graph is rebuilt on the current AOA.

**Acceptance Scenarios**:

1. **Given** spec 059, **Then** every field and link of `EnterpriseCoreEntity` is named after `BoundaryCoreEntity` (bystrovmaxim/gnomon#64).
2. **Given** spec 059, **Then** no page speaks of single sign-on, and every page that speaks of signing in describes the providers of this work.

---

### User Story 10 - A reader paints the ERD's physical view by domains (Priority: P3)

An architect in the ERD's physical view moves the paint switch to Domains and sees the tables coloured by their domains.

**Why this priority**: A small fault in a shipped view; the reader cannot see which domain a table of a database belongs to.

**Independent Test**: In the physical view of this work's model graph, choosing Domains on the paint switch colours the tables by domain and keeps it after a reload; leaving the switch alone colours them by resource.

**Acceptance Scenarios**:

1. **Given** the physical view with no paint chosen yet, **Then** the tables are painted by resource.
2. **Given** the physical view, **When** the reader chooses Domains, **Then** the tables are painted by domain, the switch shows Domains, and a reload keeps it.

### Edge Cases

- An IP address the country database does not know counts as Russia: only the email, Yandex ID and Mail.ru ID are offered and accepted.
- A traveller with only Google who comes to Russia cannot sign in with it; the refusal page offers email and password, which gets them back in only if they were linked beforehand.
- A person who asks for a new code makes the old one for the same purpose stop working.
- A session opened before a password reset keeps working until its token expires, at most 8 hours, and is not renewed.
- An account made with a provider has no password; resetting it sends no code, and the page answers the same as for any address.
- A person who leaves the consent step and comes back after fifteen minutes starts again from the sign-in page; nothing of them was stored.
- A provider gives no email (a GitHub account with a private email, a Facebook account made with a phone): the account takes the email the provider gives on asking, and if there is none the sign-in is refused with a message offering email and password.
- Two accounts are never joined by a matching email; linking is the only way to put two sign-ins under one account.
- The last administrator of an organization cannot be left without a way in: the account's last sign-in cannot be unlinked.
- The letter cannot be sent (the mail service refuses or does not answer): the page says the code could not be sent and to try again, and the failure is logged as critical.
- The return address after signing in names another site: it is dropped and the person lands as after a plain sign-in.
- A request without a session to an action that needs one is answered as unauthenticated, without saying whether the organization exists.

## Requirements *(mandatory)*

### Functional Requirements

**Database and organizations**

- **FR-001**: Maxitor MUST keep every organization in one database, telling an organization's data apart by its organization in every table and every condition.
- **FR-002**: The core's data MUST live in two schemas named after its two domains — `platform` (accounts, sign-ins, codes) and `organization` (organizations and their users) — owned by a database user of the core's own that is neither a superuser nor able to create databases or roles; the core MUST NOT connect as the administrator.
- **FR-003**: The schema `public` MUST stay empty and closed to everyone; the extensions versioned storage needs MUST live in a schema `extensions` that every Maxitor user may use but not change.
- **FR-004**: No SQL of the core or of a plugin MUST name a schema in its text; every schema other than a plugin's own MUST come from the environment by its logical name.
- **FR-005**: A plugin's schema MUST carry the plugin's version in its name, so that versions live side by side.
- **FR-006**: The core MUST own the versioning mechanism — the organization's lock, the change time, writing a row with its version, reading at a moment, the watermark — and the storage document MUST say how tables that belong to no organization are versioned.

**Signing in**

- **FR-007**: Maxitor MUST offer six ways in: email and password, Yandex ID, Mail.ru ID, Google, GitHub and Facebook; it MUST NOT offer single sign-on.
- **FR-008**: Maxitor MUST decide whether a request comes from Russia in exactly one action, from the request's IP address and a country database kept on its server; an unknown address MUST count as Russia; no IP address MUST leave the server for this.
- **FR-009**: From Russia, the sign-in page MUST show only email and password, Yandex ID and Mail.ru ID; from abroad, email and password and all five providers, as one row of icon buttons.
- **FR-010**: From Russia, Maxitor MUST refuse Google, GitHub and Facebook when a sign-in starts and when the provider answers, even for an account that has that sign-in, and MUST say why on a page that offers the ways that work.
- **FR-011**: A code — to confirm an email or to reset a password — MUST be six digits, kept only as a hash, good for ten minutes and five tries, and ended by a new code for the same address and purpose or by its use.
- **FR-012**: One address MUST get at most one code a minute and ten an hour; one IP address at most thirty an hour.
- **FR-013**: The answers to creating an account, to asking for a reset and to a failed sign-in MUST be the same whether the address has an account or not.
- **FR-014**: The letters — confirming the email, resetting the password, the password changed — MUST come from `no-reply@maxitor.aoa.run`, signed for that domain; a code's letter MUST put the code at the start of its subject and say how long it works; each MUST have a note for a person who did not ask with the time and country of the request, and none MUST hold a link.
- **FR-014a**: The email MUST be the login. A password MUST be at least 10 characters, not the email and not in a list of common passwords; it MUST be kept only as an Argon2id hash and MUST NOT reach a log, an error, an event or a `repr`.
- **FR-014b**: An email sign-up MUST confirm the address by a code before the consent step; signing in MUST check the password against its hash and answer "Wrong email or password" for either fault; one address MUST get at most ten wrong passwords in fifteen minutes and one IP at most thirty, after which signing in by password waits until the time named and resetting stays open.
- **FR-014c**: A forgotten password MUST be reset by a code sent to the email and a new password under the same rules; the old password MUST stop working and a letter MUST tell the address it was changed.
- **FR-015**: A provider sign-in MUST carry a `state` and a PKCE challenge and MUST be refused when they do not match.
- **FR-016**: After signing in, the session MUST be kept in an `HttpOnly` cookie named `__Host-maxitor_session`, read by the standard JWT check as constitution rule 55 allows for Maxitor's web sign-in, and MUST end when the person signs out.
- **FR-016a**: A session token MUST live 8 hours; while the person is active it MUST be renewed with the same session id, up to 30 days from signing in; a renewal MUST be refused when the account's password changed after the token was issued, and the person then signs in again.
- **FR-017**: The session MUST be issued by the action that proves a sign-in: for email, after the password is checked against its hash (constitution rule 56); for a provider, after its answer is checked by `state` and the PKCE verifier.

**Accounts and consent**

- **FR-018**: No account MUST exist until a new person, by whichever way they came, ticks "I have read the Privacy policy and consent to the processing of my personal data" — not ticked in advance — and presses "Create account".
- **FR-019**: Until then the proven sign-in — the confirmed email with its password's hash, or the provider's answer — MUST wait only in a signed token that lives fifteen minutes; nothing of the person MUST be written to the database.
- **FR-020**: An account MUST keep the version of the policy it accepted and the time and IP address of the acceptance; when the policy's version changes, its next sign-in MUST show the consent step again before the session begins.
- **FR-021**: An account MUST be able to list its sign-ins, link an email and password (the email confirmed by a code) or a provider allowed in its region, and unlink any sign-in but its last one.
- **FR-022**: Two accounts MUST never be joined by a matching email; linking a sign-in that belongs to another account MUST be refused with a message that says so.

**Organizations**

- **FR-023**: An account with no organization MUST land on registering one: the organization's name and its address code.
- **FR-024**: An address code MUST be lower-case ASCII letters, digits and hyphens, 2–63 characters, not one of Maxitor's reserved words, and unique; the page MUST say at once whether it is free, taken or not allowed, name the characters that are not allowed, and suggest two free codes for a taken one.
- **FR-025**: The database MUST refuse a taken code even when two people register it at once, and the loser MUST be told so with nothing of theirs created.
- **FR-026**: Registering MUST create the organization and its first user as administrator in one change; a signed-in account registers more organizations without a second account, at most 10 in all; the eleventh MUST be refused with a message that names the limit.
- **FR-027**: An account with several organizations MUST choose one after signing in and MUST be able to switch from the header and from the icon's menu.
- **FR-028**: A request to an organization where the account has no active user MUST be answered "No such organization" (404), the same as for an address that does not exist; the check MUST be the action's one access decision.
- **FR-029**: A request to an organization's address without a session MUST lead to the sign-in page naming only that address and MUST bring the person back to it after signing in; a return address that is not a path of Maxitor MUST be dropped.

**Screens and public pages**

- **FR-030**: The organization's screen MUST show the organization's name (with a switch when the account has several), an empty left tree, an empty dotted field, and the person's icon with name and email on hover and a menu of organizations, registering an organization, sign-in methods and signing out.
- **FR-031**: `/privacy` MUST say what Maxitor keeps, why, where, for how long, which cookies it sets and how to have the data deleted, and MUST carry a version and a date.
- **FR-032**: `/data-deletion` MUST say to write to `privacy@aoa.run` from the account's email and that the account, its sign-ins and its users are deleted within thirty days.
- **FR-033**: Both pages MUST open without signing in and be linked from the sign-in page and the letter.
- **FR-034**: On the first visit every page MUST show a cookie banner naming the one cookie and its purpose and linking to the policy's cookies section; signing in MUST wait until it is accepted; the answer MUST be kept in the browser with the policy's version and asked again when it changes; Maxitor MUST set no analytics, advertising or third-party cookie.

**How it is built**

- **FR-035**: Every step of signing in, linking, registering and choosing MUST be an action of AOA, exposed only by the fluent chain of the HTTP adapter, with no hand-written route, middleware or authentication server.
- **FR-036**: Every outside service — each provider, the country database, the mail — MUST be reached only through a typed gateway that an action receives per call through its connections; an action MUST ask the mail gateway for "a confirmation code to this address", "a reset code" or "the password was changed", not for a letter.

**Typed events**

- **FR-037**: Every domain of Maxitor — `platform`, `organization`, `core`, `diagrams`, `rooms`, `repo_graph` and the template's `notes` — MUST declare the closed list of its events, and every method that writes MUST declare which; any other line MUST be refused when written.
- **FR-038a**: This work MUST NOT switch on a log coordinator or a log store; the events are written and checked by tests that read what a method writes.
- **FR-038**: The events of signing in MUST cover at least: an account created (with the policy's version), the policy accepted again, a sign-in linked or unlinked, signed in, signed out, a code sent, a password reset asked for, a password changed (info); a provider refused for the region, a provider's answer that does not check, a wrong code, a code's tries used up, a limit of codes reached, a wrong password, a limit of wrong passwords reached, a link refused (warning); a letter that could not be sent (critical). Each MUST carry the provider, the country and the account when there is one, an email only masked, and never a password, a code, a token or a secret.

**The core's identity and plugins**

- **FR-039**: The core MUST have the identity `maxitor` and the version of the `maxitor` package, and a passport that names its version and the formats of a plugin's files it reads, answered by an action.
- **FR-040**: A package `maxitor-plugin-sdk` MUST hold the only code that decides compatibility, refusing a format the core does not read, a core outside the plugin's range, two versions of one plugin, a cycle, a foreign SDK major and a dependent broken by an upgrade or a removal, and naming every side of the conflict.
- **FR-041**: `maxitor plugin check` MUST check a plugin against a given core version and MUST refuse a plugin whose domain declares no events.

**The ERD's physical view**

- **FR-043**: In the ERD's physical view the paint switch MUST paint by the section the reader chooses, Domains included; only while no section is chosen MUST it paint by resource.

**The concept model**

- **FR-042**: The model of spec 059 MUST run on the current AOA, name `BoundaryCoreEntity` everywhere `EnterpriseCoreEntity` stood, speak of no single sign-on, and have its graph rebuilt.

### Key Entities *(include if feature involves data)*

The entities below, their fields, the two domains with their events and the storage that keeps them are written as AOA code in [`model/core_model.py`](model/core_model.py); its graph, [`model/graph.json`](model/graph.json), is the plan the built code is compared with. Every entity becomes a table of its name in the schema of its domain.

- **Account** (`AccountCoreEntity`, domain `platform`): one person — name, email, the policy version accepted and the time and IP of the acceptance. Has one or more sign-ins and any number of users.
- **Sign-in** (`SignInCoreEntity`, domain `platform`): one way an account gets in — the provider (`email`, `google`, `github`, `facebook`, `yandex`, `mailru`), the provider's id of the person (for `email`, the address in lower case), the email given, the password's hash and when the password was last set (only for `email`), and the country, IP and time it was added. A provider and its id give at most one sign-in.
- **Sign-in code** (`SignInCodeCoreEntity`, domain `platform`): a code sent to an email — its purpose (`confirm_email` or `reset_password`), the address, the code's hash, when it expires, how many wrong tries it has had. Not versioned; deleted once used, expired or exhausted.
- **Organization** (domain `organization`): a tenant — its name and its unique address code.
- **User** (`UserCoreEntity`, domain `organization`): an account's place in exactly one organization — its name there, whether it administers it, the boundaries it works in. An organization and an account give at most one user.
- **Boundary** (`BoundaryCoreEntity`, domain `organization`): what spec 059 called an enterprise; here only renamed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new person from Russia gets from the sign-in page to their organization's empty frame by email and password in under 3 minutes, and a new person abroad by a provider in under 2 minutes, measured on the stand by stopwatch over five runs each.
- **SC-002**: 95% of letters with a code reach a Gmail, Yandex Mail or Mail.ru inbox — not spam — within 60 seconds, measured on 20 letters to each.
- **SC-003**: Over every sign-in path, 0 accounts exist without a recorded acceptance of the policy, checked by a test of each of the six ways in and a query of the database on the stand.
- **SC-004**: From an IP in Russia, 100% of attempts to start or finish a Google, GitHub or Facebook sign-in are refused, and 0 such buttons are shown, checked by a test of each and a browser check from a Russian address.
- **SC-005**: A code survives at most 5 wrong tries, an address at most 10 wrong passwords in fifteen minutes, and the answers to creating an account, asking for a reset and a failed sign-in are identical for a known and an unknown address, checked by tests.
- **SC-005b**: A token issued before a password change is refused renewal, and no session lives longer than 30 days from signing in, checked by tests with a fixed clock.
- **SC-005a**: No password appears in any log line, event, error or response, checked by a test that signs up, signs in wrongly and resets with a known password and searches every output for it.
- **SC-006**: An account outside an organization gets the same answer for that organization's address as for a made-up one, byte for byte apart from the address, checked by a test.
- **SC-007**: 100% of the lines Maxitor's domains write are typed events — today's 46 included — and a line written outside its domain's list fails, checked by a test that breaks one on purpose.
- **SC-008**: Each of the six kinds of plugin conflict is refused with every side named, and the plugin template passes, checked by one test per kind.
- **SC-009**: The sign-in page shows its form within 2 seconds of opening on the stand, measured in Chromium on the browser checks' machine.
- **SC-010**: The screens built match the mockup's 1.1–7.4, checked screen by screen in the browser.
- **SC-011**: In the ERD's physical view, choosing Domains paints 100% of the tables by domain and survives a reload, checked by a browser test.

## Assumptions

- Every screen, letter and public page of this work is in English; a Russian version is out of scope.
- In this work an organization has exactly one user, its administrator; managing users (listing, blocking, removing, appointing administrators) comes with invitations in bystrovmaxim/gnomon#13. The user's states and the last-administrator rule are modelled now so that work only adds actions.
- PostgreSQL runs only on the stand; tests run on a recording connection, and the live check is done on the stand.
- The stand's server is in Russia, so the database that keeps accounts lives in Russia.
- The sign-in apps of all five providers exist and their keys are kept outside the repository; Google's and Facebook's apps stay in test mode until `/privacy` and `/data-deletion` are on the stand (the issue's last phase).
- Yandex Cloud Postbox carries the mail; the domain `maxitor.aoa.run` is verified with DKIM, SPF and DMARC.
- Today's graph viewer stays as it is until it becomes a plugin (bystrovmaxim/gnomon#77); the frame (bystrovmaxim/gnomon#74) and the hosting of plugins (bystrovmaxim/gnomon#75) build on this work; invitations stay in bystrovmaxim/gnomon#13.
- How an organization's data moves from one plugin version to the next is not decided here.
- No log coordinator or log store is switched on here, so the privacy policy names no log of sign-ins; it gains one when the coordinator is switched on.
- Deleting an account by a button is not in this work; until it is, `/data-deletion` names the mailbox `privacy@aoa.run`, which has to exist before the pages go live.
