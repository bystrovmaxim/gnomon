# The history of a page

A reference for a plugin's author: what a page gives the core's time scale, what its actions answer, and what the core tells the page back. The [plugin concept](concept.md), section 7.9, explains why; [chapter 10](tutorial/10-history-on-the-scale.md) and [chapter 11](tutorial/11-comparing.md) of the tutorial walk the template through it. The shapes are `maxitor-plugin-sdk`'s `history-2.schema.json` and `PageHistory` of `@maxitor/panel`.

## The setup a page gives

`PanelPage`'s `history`, sent as `panel.history` when the page opens and whenever it gives a new one.

| Field | What it is | Rule |
|---|---|---|
| `read` | the page's reading action | over a stretch it answers the page's bars |
| `bars` | an action answering bars of its own | instead of `read`'s |
| `milestones` | the action answering the milestones of a stretch | |
| `card` | the action answering one milestone's card | |
| `kinds` | the page's points: `{ tone, look, lead, term, def }` each | keys `^[a-z][a-z0-9_]{0,31}$`, at most 12; tone `neutral`, `purple`, `blue`, `green`, `amber`, `red`; look `filled`, `hollow`, `dashed`; lead `solid`, `dashed`; term ≤ 40 characters, def ≤ 200 |
| `small` | the sentence the legend says of small points | its presence allows small points; ≤ 160 characters |
| `flag` | the sentence the legend says of flags | its presence allows flags; ≤ 160 characters |
| `compare` | `diff`, `side_by_side` | narrows the passport's `history.compare`, never widens it |
| `actions` | `{ on: "milestone", kinds, title, action, ask }` | `title` may hold `{ref}`; `kinds` name declared kinds; `action` one of the plugin's |

Every action named must be one of the plugin version's, in `actions/` or `history/`. What does not hold is left out and named in the browser's console; the rest is kept.

## What the actions answer

The core asks `GET /p/<plugin>/api/<organization>/history/<action>` through the gateway, with the organization's token.

| Call | Parameters | Answer |
|---|---|---|
| bars | the node's path parameters, the page's own address parameters, `from_at`, `to_at`, `width` (seconds, 60 to 2592000) | `{ bars: [{ start, added, changed, removed }] }`, only bars with a change |
| milestones | the node's path parameters, `from_at`, `to_at` | `{ milestones: [{ id, at, ref, title, kind, small?, flag?, comment?, link?, opens? }] }` |
| card | the node's path parameters, `id`, `at` when the screen is in the past | `{ blocks: [...] }` |

A page's own address parameters never include the core's: `at`, `mode`, `from` and names starting with `_`. An answer below the watermark is kept in the page's memory; the stretch holding now is asked again.

**A milestone** is dropped and named when its `kind` is not one of the page's, when it is `small` and the page gave no `small`, or carries a `flag` and the page gave no `flag`. `opens` makes a milestone that is no state at any moment: choosing it opens that page path and keeps the moment.

**A card** is blocks in the plugin's order, each drawn by the core from data:

| Block | Shape |
|---|---|
| `line` | parts: `{ badge: { icon, label, tone, outline? } }`, `{ ref }`, `{ ago: <moment> }`, `{ now: true }`, `{ time }`; icons `merge`, `commit`, `pull`, `tag`, `pencil`, `dot`, `gate`, `cross`, `flag`, `undo` |
| `title` | text |
| `text` | text |
| `fields` | `[[name, value], …]` |
| `person` | `{ id, name }`: a disk of the person's colour with their initials |
| `chips` | `{ counts: [added, removed] }`, `{ chip }`, `{ release }`, `{ text }` |
| `warn` | text |

## What the core tells the page

| Message | Fields |
|---|---|
| `panel.location` | `path`, `query`, `at`, `against`, `side`, `milestone` |
| `panel.mark`, `panel.bring` | `chain`: anchors, the deepest first, at most 8 of at most 200 characters |
| `panel.step` | `delta`: −1 or +1 |

`useMoment()` gives a page `{ at, against, side, milestone }`. One moment: `against` and `side` are null. Diff: `at` is B, `against` A. Side by side: panel A has `at` A, `against` B and `side` `a`; panel B the other way round. `milestone` is the id of the milestone `at` stands on exactly, and is what an action on a milestone needs.

## What the page tells the core

| Message | When |
|---|---|
| `panel.pointer {chain}` | the canvas sends it by itself from `data-room-anchor` |
| `panel.choose {chain}` | the canvas sends it on a click |
| `panel.shown {…}` | the canvas answers `panel.mark` and `panel.bring` by itself |
| `panel.counts` | `useCounts({ added, removed, changed })` |
| `panel.keys` | Shift and an arrow, sent by `@maxitor/panel` by itself |
| `panel.now` | `useBackToNow()`: back to now after the page's own writing in the past |
