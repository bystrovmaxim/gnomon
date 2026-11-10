# Research: the template's history on the server

## 1. How "the SDK runs a page's reading action over a stretch"

- **Decision**: the page's reading action takes, beside `at`, an optional stretch — `from_at`, `to_at` and `width` (a bar's width in seconds). With a stretch it runs the same query, the same filters, with the SDK's interval condition at every version table instead of the moment condition, gets the versions in force at some time in the stretch, and answers `bars` grouped by the SDK's `bars_of`. Without a stretch it answers as today.
- **Rationale**: one query and one set of filters for the page and its bars, so the bars count exactly what the page shows; the core asks one action of the page, the one `navigation.yaml` names as `read`. The SDK owns the condition and the grouping, so a plugin writes nothing for bars beyond accepting the stretch.
- **Alternatives considered**: a generic SDK action that introspects any reading SQL — too clever, breaks with any query the SDK did not foresee; a separate bars action per page — the duplicated filters drift from the page's.

## 2. What counts as added, changed and removed in a stretch

- **Decision**: from the versions of one entity found over (A, B]: an opening at T with no version of that entity closed at T is *added*; an opening at T where a version closed at T is *changed*; a closing at T with no opening at T is *removed*. Only times inside (A, B] count; a bar is `floor((T − A) / width)`.
- **Rationale**: it is what the version tables already say (versioned storage, section 5), with no journal.
- **Alternatives considered**: counting transactions — one deletion of many rows would be one change, which the spec rejects for the template.

## 3. A moment later than the watermark

- **Decision**: the storage resolves the moment once per read: the watermark when none is given; a given moment later than the watermark raises `NotesRefusalError` with status 422 and the watermark in its body. A stretch's `to_at` later than the watermark is cut to it.
- **Rationale**: the answer at such a moment could still change; refusing keeps "an answer never changes" true.

## 4. Conflicts and refusals as answers

- **Decision**: the template gets `NotesRefusalError` (as the core's `CoreRefusalError`): a reason, details and an HTTP status; `app.py` registers its handler. Conflict 409 with `changed_by` and `changed_at`; deleted 409 with `deleted_by` and `deleted_at`; future 422; nothing to publish 409.
- **Rationale**: the same shape as the core's refusals, so a page handles both alike.

## 5. Revisions

- **Decision**: a table `revision` (`item_id`, `number`, `title`, `comment`, `release` nullable, `publisher_id`), unique `(item_id, number)`, with versions like every table; the number is `max(number) + 1` read from the current table under the organization's lock; the revision's moment is its change time. The published notes at a moment are the notes read at the moment of the revision in force; the draft is the difference between those and the notes at the moment.
- **Rationale**: no copy of the notes is needed: versioned storage already answers any moment, so a revision only names one.
- **Alternatives considered**: copying the notes into revision rows — duplicates what versions keep.

## 6. Where the history declarations live and how old cores read them

- **Decision**: optional `history` in the passport (format 2) and per node in `navigation.yaml` (format 1), added to their JSON schemas; the SDK becomes 1.2.0. A core whose SDK is older refuses the field, and the template's `requires.maxitor` already names the cores built with SDK 1.
- **Rationale**: an optional field is a minor change of the format, as the plugin concept prescribes for growing the contract.

## 7. The shapes between the scale and a plugin

- **Decision**: `history-1.schema.json` in the SDK with `$defs` for the context, a bar, a milestone and a milestone card; the template's results are checked against it in tests.
- **Rationale**: one description both sides are checked against, before the core's side (bystrovmaxim/gnomon#98) exists.

## 8. The documentation's move

- **Decision**: `git mv` of `packages/maxitor-plugin-template/docs/plugins.md` to `docs/plugins/concept.md` and of `versioned-storage.md` to `docs/plugins/versioned-storage.md`; the Russian drafts moved beside them on disk (they never enter a commit); every live link updated; specs and changelogs keep their history.
