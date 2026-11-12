# Changelog

All notable changes to the Maxitor plugin template are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.13.0] — 2026-11-12

### Added

- **A draft of my own over everyone's published notes.** An item has two pages: Draft, the changes of the person who opens it, and Published, everyone's notes as the latest revision holds them, read only, with the Authors filter. A new note, an edit or a deletion — of any note — waits in the person's draft, one `note_change` row per person and note with its state (new, changed, deleted) and the text and revision it was made over; the published notes change only when a draft is published. A changed note marks its words inside one text (`diff`, `diffWords`); the State filter fades a state with nothing in it; each change is reverted after one question. Publish takes the whole draft as the next revision with a title, a comment and an optional release; a change whose published note now reads otherwise or is deleted is a conflict, shown on the draft before publishing and listed in the dialog with both texts, and is overwritten or given up note by note — an overwrite of a deleted note restores it. Draft and Published read at any moment. The item's Notes page and its `/draft` page are gone: Draft is at `/items/{item_id}`.

## [0.12.0] — 2026-11-12

### Added

- **Its pages now.** An item's notes lie on the canvas as cards or a table, the note written last first; "New note" writes in a dialog; a card edits its note and says a conflict in words, keeping the text; deleting asks once; a page at now reads again when "now" moves and marks a colleague's note new. Published notes shows the revision in force with its number, title, comment and release; Draft a card per change since it, and publishing from a dialog. On a phone a note's actions are a sheet behind ⋯ and the dialogs sheets. `web/tests/notes.test.ts` holds the rules the pages decide. Its pages 0.6.0. ([#102](https://github.com/bystrovmaxim/gnomon/issues/102))

## [0.11.0] — 2026-11-12

### Changed

- **Its pages give their history in their code.** The notes page gives its reading action, milestones and card, the published notes their milestones and card, the draft no comparison; `navigation.yaml` is format 3, the tree only, with no room. It requires Maxitor `>=4.7,<5`. Its pages 0.5.0. ([#116](https://github.com/bystrovmaxim/gnomon/issues/116))

## [0.10.0] — 2026-11-12

### Changed

- **Its frontend travels as sources, and Maxitor builds it.** The passport is format 3 with `frontend.source: maxitor_notes/web`; the wheel carries `web/` without `node_modules`, `.next` and `.npmrc`, and no built site — `copy-build.mjs` and `_web` are gone. It requires Maxitor `>=4.5,<5`, the first core that builds frontends; `maxitor plugin build . --core 4.5.0` builds it as the installer will. Its pages 0.4.0. ([#110](https://github.com/bystrovmaxim/gnomon/issues/110))

## [0.9.1] — 2026-11-12

### Changed

- **Its pages look like the mockup.** The writers in the filter carry their initials in a disk of one palette colour each; the notes show as cards in a grid by default, or as a table; an item with no notes and the section's own page say so in an empty state instead of bare text. Its pages 0.3.1.

## [0.9.0] — 2026-11-11

### Changed

- **Its notes page draws its controls in the shell.** The page reads the item's writers itself and gives them to the shell's filters, with the choice of a list or a table in the bottom bar; `navigation.yaml` is format 2 and declares no controls, and the plugin needs Maxitor 4.4 and `maxitor-plugin-sdk` 1.5. A test checks that its pages keep the shell's boundary. Its pages 0.3.0. ([#109](https://github.com/bystrovmaxim/gnomon/issues/109))

## [0.8.0] — 2026-11-11

### Changed

- **Its pages live in Maxitor's frame.** The frontend is built with `@maxitor/panel` and `@maxitor/tokens`, and its build travels in the wheel. The notes page opens in the core's right panel and shows an item's notes as cards or a table by the view switch, of the writers the writer filter keeps, both drawn by the core from `navigation.yaml`; Published notes and Draft open there too and say what they will show. The pages draw no frame, header, background or control of their own. A list or a filter the navigation reads is one of the template's actions, as Maxitor now checks. ([#74](https://github.com/bystrovmaxim/gnomon/issues/74))

## [0.7.0] — 2026-11-11

### Added

- **Its own items.** What notes are written on is the template's own table `item`, like a folder: a title in one organization, unique among its items now, versioned like the notes. `AddItemAction` adds one and `RenameItemAction` renames it with the moment the member saw, refusing a change someone else made after it; both write typed events, "item added" and "item renamed". `ListItemsAction`, at `/lists/list_items`, lists the items at a moment by title and in parts: the source of the tree's list node. A note and a revision carry a key to their item, and are refused for an item that is not one of the organization's. ([#103](https://github.com/bystrovmaxim/gnomon/issues/103))

### Changed

- **Its own nodes in the tree.** `navigation.yaml` holds one section, "Notes", in the root of the tree; under it one node per item, and under every item its pages Notes, Published notes and Draft. Nothing hangs under a node of the core: the core has no items. No description of the template speaks of a catalog. ([#103](https://github.com/bystrovmaxim/gnomon/issues/103))

## [0.6.1] — 2026-11-11

### Changed

- **Its README** leads to the step-by-step tutorial written on this template, and says what runs now: its backend in its own container behind Maxitor's gateway. ([#99](https://github.com/bystrovmaxim/gnomon/issues/99))

## [0.6.0] — 2026-11-11

### Changed

- **The core's roles, the core's keys.** The template declares no roles: every action checks the core's `member`, which the gateway's token carries for every active user of the organization; `reader` and `editor` are gone. It checks the token by the core's JWKS (`MAXITOR_CORE_JWKS_URL`) instead of a public key file, and answers a missing role with 403 and another organization's object with 404. On the local stand Maxitor's runner starts it in a container of its own, and its API answers through the gateway at `/p/notes/api/<organization>/…`. ([#75](https://github.com/bystrovmaxim/gnomon/issues/75))

## [0.5.0] — 2026-11-11

### Added

- **Every past moment, and not the future.** Every reading action reads at the watermark or at the moment given, through the SDK's moment condition; a moment later than the watermark is refused with the watermark. A test reads the SQL of every reading method and refuses one without the condition or the organization. ([#97](https://github.com/bystrovmaxim/gnomon/issues/97))
- **Editing and deleting a note**, `EditNoteAction` and `DeleteNoteAction`, each with the moment the editor saw: a note changed by someone else after it is a conflict naming who and when, and a deleted note cannot be edited; nothing is written by a refusal. Refusals are `NotesRefusalError`, with their HTTP status. ([#97](https://github.com/bystrovmaxim/gnomon/issues/97))
- **Published revisions.** `PublishNotesAction` publishes an item's notes as its next number with a title, a comment and an optional release; the published notes and the draft are read at any moment. The table `revision` joins `schema.yaml`, and its publisher's key `foreign-keys.yaml`. ([#97](https://github.com/bystrovmaxim/gnomon/issues/97))
- **The data of the core's time scale.** The notes page's reading action answers its bars over a stretch; the folder `history/` answers the milestones — the revisions, the draft last — and a milestone's card. The passport declares the comparisons its pages can draw, and `navigation.yaml` the item's notes, published notes and draft with their history. ([#97](https://github.com/bystrovmaxim/gnomon/issues/97))

### Changed

- **The documentation moved** to the repository's `docs/plugins/`: the plugin concept and versioned storage, which now shows its pattern on the notes. ([#97](https://github.com/bystrovmaxim/gnomon/issues/97))

## [0.4.0] — 2026-11-10

### Changed

- **The template declares its table and carries no SQL.** `schema.yaml` replaces `migrations/0001_note.sql`, `migrate.py` and the ledger of migrations; the passport is format 2. Maxitor deploys it as the schema `notes_0_4_0` with the user `plg_notes_0_4_0`, which sees nothing but that schema. ([#82](https://github.com/bystrovmaxim/gnomon/issues/82))
- **It reaches the core only through the core's functions**: the change time under the organization's lock, the watermark, membership by the address and a writer's name at a moment. Its `foreign-keys.yaml` keeps one key, a note's writer to the core's user of that account. ([#82](https://github.com/bystrovmaxim/gnomon/issues/82))

## [0.3.0] — 2026-11-10

### Changed

- **The checks of a plugin's files live in `maxitor-plugin-sdk`.** The JSON schemas and `plugin_check.py` left the template's `checks/` for the SDK, which the template now depends on; its tests import them from there, and `maxitor plugin check . --core 4.0.0` decides it against a core.
- **The passport names its SDK.** `sdk: 1` is the major version of `maxitor-plugin-sdk` the plugin is built with; a core built with another refuses it.
- **The notes read the core's organizations from its own schema.** The storage reads `organization.organization`, `organization."user"` and `user_versions`, the tables of Maxitor's core.

## [0.2.0] — 2026-11-09

### Changed

- **Each action of `notes` decides access in its own `@access_decide`.** Before any of its steps runs, an action asks whether the person of the token belongs to the organization of the address. A stranger gets `FORBIDDEN_OBJECT`, which does not tell whether the organization exists; HTTP still answers `403`, and the answer now names the step that refused. The graph shows the check beside the role check, and `check_access_decide` answers the same question without running the action. The main step looks the organization's id up again, and refuses the same way if the membership ended in between.
- **The plugin concept** (`docs/plugins.md`, section 6.6) says who answers what: the role in `@check_roles`, the organization and the object in one `@access_decide`, the work in aspects. The example in section 12 follows it.

## [0.1.0] — 2026-11-09

### Added

- **The plugin `notes`**, a small plugin with every part a Maxitor plugin has: a passport, tree nodes with their controls and room behaviour, cross-plugin foreign keys declared by names alone, a migration creating `note` and `note_versions` by versioned storage, an AOA backend and Next.js pages that keep every view setting in their address.
- **The backend** writes a note and its version in one transaction under the organization's lock, reads only version tables at one moment, accepts only the core's EdDSA token issued for this plugin, takes the organization from the address and checks membership in it before touching its data.
- **The checks** Maxitor's installer makes on a plugin's own files: JSON schemas of the passport, `navigation.yaml` and `foreign-keys.yaml`, and the rules across fields — the version equals the package's, no dependency cycle, unique node ids and addresses, path parameters defined above their node, controls on parameters of their own.
- **The documentation** of the plugin concept and of versioned storage, in `docs/`.
