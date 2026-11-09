# Contract: what the ERD's page and drawing promise

The checks of this work read these; nothing else depends on them outside the client and the room server.

## Address

- `frames=0` draws the logical view without frames; `frames=1` or no `frames` draws them.
- `folded=` lists folded frames by id: `rc:<resource>`, `dc:<domain qualname>`. An id whose frame is not drawn is kept and ignored.
- An address written before this work opens as it did: it has no `frames`, so the frames are on.

## Room

- The ERD page's shared settings add `frames` (boolean); `folded_contours` accepts `dc:` ids.
- A repaint does not change the layout hash the room compares.

## SVG of the drawing

- A frame is `g.cluster` with `id` `rc:<resource>` or `dc:<domain qualname>`, holding one `path.erd-hit` that covers its whole outline; no element of class `erd-fold-scale` exists.
- A folded frame is one `g.node` whose id is the frame's id.
- A table's `g.node` carries `data-domain`, `data-kind`, and `data-resource` in the physical view, `data-change` in Diff.
- The SVG's root carries the layout hash (`data-layout-hash`, spec 028) as today; it is the same in Chromium, Firefox and WebKit for each view and layout.

## Filter panel

- Rows: one per element of the base. A dimmed row has the dimmed style and still switches on and off by a click; on every diagram but the full graph it carries no hidden mark.
- The paint switch is outside the panel's scrolling part: it stays at the panel's foot.
- `OneHopToggle` is rendered only on a domain's ERD, a domain's use cases and a lifecycle.
