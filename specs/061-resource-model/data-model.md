# Data model: An entity belongs to a resource — Maxitor shows the model of a resource

## In the graph (protocol 1.6, read only)

| Element | Shape | Note |
|---|---|---|
| `Entity` node | as in 1.5 | keeps its `domain` edge |
| `Resource` node | as in 1.5 | keeps its `domain` edge |
| `entity_resource` edge | `id` `<entity>\|entity_resource\|<resource>`, `source_id` entity, `target_id` resource, `Aggregation`, `is_dag` true, no properties | one per entity in a graph from AOA; none in 1.0–1.5 |

## In DuckDB

**`entity_resource_edges`** — new, beside `domain_edges`:

| Column | Type | From |
|---|---|---|
| `source_id` | VARCHAR NOT NULL | the entity's id |
| `target_id` | VARCHAR NOT NULL | the resource's id |
| `relationship` | VARCHAR NOT NULL | `Aggregation` |
| `is_dag` | BOOLEAN NOT NULL | `true` |

Empty for a graph of 1.0–1.5. Counted in the edge counts and the graph union view like every edge table.

## In the entity listing (`ListEntitiesAction`)

**Entity row** — two fields added:

| Field | Type | Rule |
|---|---|---|
| `resource_id` | string \| null | the target of the entity's `entity_resource` edge; null without one |
| `resource_label` | string \| null | that resource's label; null without one |

**Resource row** — the listing gains `resources: ResourceRow[]`:

| Field | Type | Rule |
|---|---|---|
| `id` | string | the resource's id |
| `label` | string | the resource's label |
| `color` | string | the palette of `ListDomainsAction`, by the row's place in this list |

The list holds every resource of the graph that stores at least one entity, sorted by `id`, whatever domains were asked for: the colour depends on the graph alone.

## In the client

**`ErdEntity`** gains `resource_id?: string | null`, `resource_label?: string | null`, and in Diff `previous_resource_id?: string | null` (set when both sides have a resource and they differ).

**`ErdDomainsBundle`** gains `resource_colors: Record<string, string>` and `resource_labels: Record<string, string>`; in Diff the newer listing's rows first, then the older's rows the newer lacks.

**Page settings of the ERD page** (shared in a room, written in the address):

| Setting | Address parameter | Kind | Default |
|---|---|---|---|
| `disabled_resources` | `off_resources` | list | `[]` (every resource on) |
| `boundary` | `boundary` | switch | on |
| `paint` / `paint_diff` | `paint` / `paint_diff` | choice, now also `resources` | unchanged |

## States and rules

- A table without `resource_id` is never hidden by the Resources section, sits outside every contour, is grey when painted by resource, and has no resource line on its card.
- In Diff: `diff = "changed"` from the resource only when `resource_id` and `previous_resource_id` are both set and differ.
