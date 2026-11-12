# Contract: the panel protocol of the scale, the panels and the anchors

Additions to `specs/077-core-frame/contracts/panel-protocol.md`. Each side accepts a message from its own origin and the expected window only, and drops one whose shape it does not know.

## From the core to the page

| Message | Fields | Meaning |
|---|---|---|
| `panel.location` | `path`, `query`, `at`, **`against`**, **`side`**, **`milestone`** | the page's address and context: `against` the other moment of a comparison or null; `side` `a`, `b` or null; `milestone` the id `at` stands exactly on, or null |
| `panel.watermark` | `at` | unchanged |
| `panel.mark` | `chain` or null | light the deepest anchor of the chain the page holds, if it is in view; null clears |
| `panel.bring` | `chain` | bring the deepest anchor the page holds into view, keeping the zoom, and light it |
| `panel.step` | `delta` (−1 / +1) | Shift + ↑ ↓ pressed in the core's frame: step the comparison's changes |

## From the page to the core

| Message | Fields | Meaning |
|---|---|---|
| `panel.pointer` | `chain` or null | the anchor chain under the pointer, the deepest first |
| `panel.choose` | `chain` | an element chosen — a click, a selection, a step |
| `panel.shown` | `anchor`, `held`, `hidden`, `brought` | what the page did with a `panel.mark` / `panel.bring`: the anchor it showed, whether it held the deepest, whether its filters hid it, whether it moved the camera |
| `panel.counts` | `added`, `removed`, `changed` | the counts the pill shows in a comparison |
| `panel.keys` | `key` (`ArrowLeft`, `ArrowRight`, `ArrowUp`, `ArrowDown`) | Shift + an arrow pressed in the page: the core steps the moment (← →) or relays `panel.step` (↑ ↓) |

## The core's notes from `panel.shown`

| Answer | Note in that panel |
|---|---|
| held, in view | none |
| held, brought | "Brought to the centre" for 2.5 s |
| a parent held, the deepest not | "`<name>` is not in A · showing `<parent>`" |
| a parent folded | "`<name>` is inside the folded `<parent>`" |
| nothing held | "Not in A" / "Not in B" |
| hidden by the filters | "Hidden by the filters" |

## Limits

A chain holds at most 8 anchors of at most 200 characters; `panel.pointer` is sent at most once per animation frame.
