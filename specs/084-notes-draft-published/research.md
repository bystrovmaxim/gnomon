# Research: a draft of my own over everyone's published notes

## Where a draft lives

**Decision**: A new versioned table `note_change`, one row per (person, note) of an item, holding the state, the text, the base text and the base revision.

**Rationale**: The published notes must stop changing on an edit, so an edit has to be written somewhere else. A row per change keeps one thing to read, one thing to revert and one thing to publish. Versioned storage gives the past of the draft for free: the row's versions are the draft at earlier moments, and the read at a moment is the same `in_force` query as the notes'.

**Alternatives considered**: deriving a draft from per-person note versions (a second note table per person) — the base of a change would be lost, and a publication would still have to rewrite the person's rows; keeping a single draft of the item — the issue's whole point is that nobody sees another's.

## How a conflict is found

**Decision**: By value. At publishing, the published note now is compared with the change's base: a different text, or a deletion, is a conflict; the same text is not. A change whose own text has come to equal the published text leaves the draft.

**Rationale**: The member is asked to overwrite a value they can see; a version counter would ask about a difference that no longer exists, and would make a note changed and changed back a conflict forever. The spec records this in Clarifications.

**Alternatives considered**: a version identity per note (a conflict whenever the open version moved) — refused as above; a per-revision base — a revision that touches other notes would conflict with every change.

## The publish protocol

**Decision**: `PublishNotesAction` serves both calls: without choices it refuses with the conflict list (409, `conflicts`); with a choice per conflict it publishes. The list is recomputed at the second call, so a conflict that appeared meanwhile is answered again, not overwritten silently.

**Rationale**: One action keeps the lock and the transaction in one place; the client never needs a second way to ask. It follows the template's existing refusals (`changed_since` carries who and when).

**Alternatives considered**: a separate "preview conflicts" read — two places computing the same comparison, and a race between them; publishing one note at a time — the issue publishes the whole draft as one revision.

## The marking's library

**Decision**: `diff` (jsdiff), `diffWords`.

**Rationale**: It is the issue's first candidate: Myers over words, punctuation as words of its own, BSD licence, the most used text diff on npm. Its parts carry `added`/`removed` flags in order, which is all the marking needs to be lossless; the component renders every part.

**Alternatives considered**: `diff-match-patch` — character based, with a semantic cleanup that would need its own rules to read as words; refused for now, as the first candidate is enough.

## The pages

**Decision**: Two routes: Draft at `/items/{item_id}`, Published notes at `/items/{item_id}/published`. Published reads the draft as well and marks the notes waiting there. Edit on Published opens Draft with `?edit=<note_id>`; nothing is written until the editor is saved, so a cancel leaves the draft untouched.

**Rationale**: Removing the Notes node leaves the item's first page to Draft, as the issue says. Reading the draft on Published is one more read the page already has a helper for; a new action for marks would be a second source of truth. Opening Draft with the editor avoids a placeholder change that would have to be cleaned up.

**Alternatives considered**: a `draft` block inside the published answer — the action would have to know the person and merge two entities; writing a placeholder change on Edit — the spec forbids a change that leaves the note as published.

## The past

**Decision**: Draft and Published read at any moment from the version tables; a page at a moment other than now has no actions. The core's scale and comparisons are not part of this work.

**Rationale**: The version tables already answer at a moment, and the shell hides actions in the past (`actionsShown`). The scale and comparing are bystrovmaxim/gnomon#98 and bystrovmaxim/gnomon#100.

## Tests

**Decision**: The storage and the actions are tested with the recording database as the rest of the template (statements, parameters, refusals); the conflict resolution is a pure function over two maps, tested without a database; the pages' rules are tested by `node --test`; the browser check walks 1.6 on the stand.

**Rationale**: The repository has no live database in its unit run; the recording style is how every storage test is written. The pure function keeps the important rule — value, not version — checkable without SQL.
