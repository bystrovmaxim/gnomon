# Data model: The ERD's frames, folding, paint switch, filters and speed

Nothing in the graph protocol or on the server's data changes. What changes is the page's state and what the drawing carries.

## Page settings

| Setting | Address | Room | Values | Default |
|---|---|---|---|---|
| `frames` (new) | `frames` (`1`/`0`) | shared | switch | on |
| `folded_contours` | `folded` | shared | frame ids: `rc:<resource>` and, new, `dc:<domain qualname>` | none |
| `paint`, `paint_diff` | `paint`, `paint_diff` | shared | `domains`, `kinds`, `resources` (physical view), `changes` (Diff) | as today |
| `one_hop` | `one_hop` | shared | switch | on; ignored on the whole system's diagrams |

- A fold is kept while its frame is not drawn — frames off, the frame filtered out, the other view — and applies again when the frame comes back.
- The room's whitelist (`web/maxitor/web/model/rooms/pages.py`) accepts `frames` as a boolean on the ERD page and `dc:` ids in `folded_contours`.

## Frame

- **Id**: `rc:<resource>` (physical view) or `dc:<domain qualname>` (logical view); the SVG group's id.
- **Holds**: its tables, directly; no frame inside another.
- **Folded**: drawn as one box with the frame's name and the count of its tables; lines to its tables end at the box.
- **Card**: the frame's name, its tables' count and its links to other frames; shown on its border, name, empty space, and on its folded box.

## Filter rule (every diagram with a filter panel)

| Set | What it holds |
|---|---|
| Scope | the elements of the whole system, of one domain, or of one lifecycle |
| Base | the scope and the elements one relation away from it |
| Drawn | the base, without the 1-hop neighbours when 1-hop is off or not offered, without what any panel filter hides |
| Rows | one per element of the base |
| Dimmed row | its element is in the base and not drawn |

On the whole system's diagrams scope = base, and 1-hop is not offered.

## Drawing

- Each table's SVG group carries `data-domain`, `data-kind`, `data-resource` (physical view) and `data-change` (Diff); the colours are CSS custom properties on the SVG's root, one per row of the painting section.
- The layout's input holds no colour: the layout hash is the same for every paint.
- The layout cache is keyed by the engine and the layout's input text.
