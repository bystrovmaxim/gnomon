# Security Requirements Checklist: the marketplace and a plugin in an organization

**Purpose**: Unit tests for the security requirements of spec 073 — whether they are complete, clear, consistent and measurable before tasks are written
**Created**: 2026-11-10
**Feature**: [spec.md](../spec.md) · [plan.md](../plan.md) · [research.md](../research.md)

`[x]` means the reviewer judged the requirement's writing sound; it says nothing about the code. `/speckit-implement` reads these marks and does not change them.

## Database roles and rights

- [ ] CHK001 - Are the rights of each of the three roles (`maxitor_core`, `maxitor_installer`, a version's user) listed exhaustively, so that anything not named is forbidden? [Completeness, Spec §FR-023, §FR-024]
- [ ] CHK002 - Is it specified which role owns the schema `plugins`, which role may write its tables, and why the installer needs write rights there? [Clarity, Gap]
- [ ] CHK003 - Is it stated what the installer's `CREATEROLE` lets it administer and what it explicitly cannot (superusers, `maxitor_core`, roles it did not create)? [Clarity, Research §R3]
- [ ] CHK004 - Is the connection limit of a version's user specified, and is it consistent between the data model and the plugin concept? [Consistency, Data-model]

## Isolation of a version's user

- [ ] CHK005 - Is "sees nothing but its own schema" defined for every object class — other schemas, `public`, the core's tables, the catalog's other roles, DDL? [Completeness, Spec §FR-024]
- [ ] CHK006 - Are the requirements about a plugin reading every organization inside its own schema stated as an accepted trust trade-off rather than left implicit? [Assumption, Spec Assumptions]
- [ ] CHK007 - Does the spec say how a plugin reaches a dependency's data, and that it is never by SQL? [Coverage, Issue §1.5]
- [ ] CHK008 - Is it specified that keys to other plugins and to the core are created only by the installer from `foreign-keys.yaml`, and never by the version's user? [Clarity, Spec §FR-022]

## Names entering SQL

- [ ] CHK009 - Is the pattern a name must match written in the requirements, including its maximum length so that derived names stay within PostgreSQL's 63 characters? [Clarity, Spec §FR-021, Research §R4]
- [ ] CHK010 - Do the requirements cover every source of a name — `schema.yaml`, `foreign-keys.yaml`, the passport's `name`, the derived schema and user names? [Coverage, Spec §FR-021]
- [ ] CHK011 - Is the refusal behaviour specified as happening before any SQL is built, with the reason named? [Measurability, Spec §FR-021, SC-006]
- [ ] CHK012 - Is the conflict between the issue's "`psycopg.sql.Identifier`" and the core's driver resolved in one place? [Conflict, Research §R4]

## `SECURITY DEFINER` functions

- [ ] CHK013 - Are the three functions' inputs, answers and the lock they take specified? [Completeness, Spec §FR-025, Research §R6]
- [ ] CHK014 - Is a fixed `search_path` required for each function, so a caller cannot redirect what it reads? [Gap, Research §R6]
- [ ] CHK015 - Is it specified who may execute them and that no other role than the versions' users' group gets `EXECUTE`? [Clarity, Research §R3]
- [ ] CHK016 - Is the behaviour of `is_member` defined for a blocked or removed user and for an organization that does not exist? [Edge Case, Gap]

## Private plugins

- [ ] CHK017 - Is "no other organization sees it" defined for every reading: the marketplace, the details, the search, the counts, an address guessed by hand? [Completeness, Spec §FR-013, Edge Cases]
- [ ] CHK018 - Is the answer to another organization's private plugin specified as indistinguishable from a plugin that does not exist? [Clarity, Edge Cases]
- [ ] CHK019 - Is it specified whether a private plugin's `name` and `id` reserve those values for the whole marketplace, and what another organization is told when it collides? [Ambiguity, Spec §FR-011]

## Secrets

- [ ] CHK020 - Is it specified where the installer's password lives, who reads it, and that the core's web process has no way to obtain it? [Completeness, Spec §FR-023]
- [ ] CHK021 - Are the places the version user's password may appear listed exhaustively (only the environment file), with its file permissions? [Clarity, Spec §FR-026, Research §R9]
- [ ] CHK022 - Is it required that the plain password never reaches the database server's statement log? [Gap, Research §R9]
- [ ] CHK023 - Do the event requirements forbid passwords, connection strings and wheel content in every event? [Consistency, Spec §FR-005b]

## Wheels: download and upload

- [ ] CHK024 - Are the size and time limits quantified and applied the same way to a download and an upload? [Consistency, Spec §FR-010a]
- [ ] CHK025 - Is it specified which hosts a release purl may resolve to, so a purl cannot point the installer at an internal address? [Gap, Research §R7]
- [ ] CHK026 - Is it specified what Maxitor reads from a wheel during the check, and that nothing in it is executed or imported? [Gap]
- [ ] CHK027 - Is a wheel's immutability in the store specified (written once by `sha256`, never replaced)? [Clarity, Data-model]
- [ ] CHK028 - Is the behaviour defined for an archive that is not a wheel, an archive with paths outside its root, and an archive that expands far beyond 50 MB? [Edge Case, Gap]

## Access to the page

- [ ] CHK029 - Is "only an administrator" defined in terms the core already has (an active user with the administrator flag), and applied to every action of the page? [Consistency, Spec §FR-027, Contracts]
- [ ] CHK030 - Is the 404 for a non-administrator required for the API as well as the page? [Coverage, Contracts]

## Notes

- Items marked `[Gap]` point at a requirement the spec or research should state before tasks are written.
