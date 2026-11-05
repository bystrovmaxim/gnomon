# Contract: the ERD page's settings for resources

These page settings are read and set through `usePageSetting`: outside a room they are the person's, inside a room they are the room's, sent as "set to" values and seeded by the first tab (spec 028). Each is written in the page address (`viewUrl.ts`, spec 038).

| Setting | Parameter | Example | Meaning |
|---|---|---|---|
| `disabled_resources` | `off_resources` | `off_resources=shop.BillingDatabase` | the resources whose tables are hidden |
| `boundary` | `boundary` | `boundary=0` | contours of resources off (on by default) |
| `paint` | `paint` | `paint=resources` | One: the headers take their resource's colour |
| `paint_diff` | `paint_diff` | `paint_diff=resources` | Diff: the same |

An address from before this change has none of the new parameters and opens with every resource on, Boundary on, and the paint it names.

## The filter panel

- Section id `resources`, title **Resources**, one row per resource of the diagram's base: label, its colour disk, the full id on hover.
- Shown when the base has one resource or more; absent on a graph of 1.0–1.5.
- `paints: true`: it has a point on the gear shift.

## The Boundary switch

- Shown in the ERD's tool row, labelled **Boundary**, while the diagram has a resource.
- On: each resource's tables in one rounded contour headed by the resource's label; off: no contour.
