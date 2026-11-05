# Research: An entity belongs to a resource — Maxitor shows the model of a resource

## R1. How `NodeCoreEntity` declares its resource

**Decision**: `@entity(description=..., resource=DuckDBGraphResource)`; the `domain=` argument goes.

**Rationale**: At `537c61d4` (bystrovmaxim/aoa#474) `entity()` takes `description` and `resource` only. The domain is read from the resource's `@meta(domain=...)`; `DuckDBGraphResource` already declares `DiagramsDomain`, so the entity stays in `DiagramsDomain`. `duckdb_graph_resource.py` does not import `node_entity.py`, so the new import makes no cycle.

**The rest of the move**: `00b174e2..537c61d4` holds 29 commits, merged as bystrovmaxim/aoa#466 (Maxitor and the protocol leave aoa), #468, #471, #473 and #474; `aoa-action-machine` goes from 1.0.1a19 to 1.1.0b1. Nothing in this repository outside `external/` points into the parts #466 removes (`git grep "external/aoa/packages/(maxitor|open-gnomon-protocol)"` finds nothing); `mypy_path` names only `aoa-action-machine` and `aoa-fastapi-adapter`.

**DuckDB moves with the entity**: from the second commit of Phase 1 Maxitor's own graph is 1.6, and every test that loads it into DuckDB (`test_own_graph_json.py`, `test_left_sidebar_action.py`, …) would stop on the unknown edge type. So the edge table (R2) lands in Phase 1, and Phase 2 starts from the listing.

**Alternatives considered**: a resource of its own for the sidebar rows — rejected: `DuckDBGraphResource` is what builds them, as the issue says.

## R2. Where the edge lives in DuckDB

**Decision**: a table `entity_resource_edges` with the four base columns, filled by `_fill_simple_edge_tables` (`"entity_resource": "entity_resource_edges"`), listed in `_EDGE_TABLE_NAMES` and the graph union view, and known to `_assert_no_unknown_graph_types`.

**When**: Phase 1, with the entity (R1).

**Rationale**: The edge has no properties, the same shape as `domain_edges`. Today a 1.6 graph does not open at all: `_assert_no_unknown_graph_types` raises `KeyError` on the unknown edge type. Graphs of 1.0–1.5 leave the table empty.

**Alternatives considered**: a column `resource_id` on the `entity` table — rejected: every other edge of the protocol is a table of its own, and the union view and edge counts read the tables.

## R3. What the entity listing returns

**Decision**: the summary aspect of `ListEntitiesAction` reads the resources in its own body (constitution, rule 43); every entity row gains `resource_id` and `resource_label` (both `null` when the entity has no edge); the listing gains `resources`: one row per resource that stores an entity of the graph — `id`, `label`, `color` — sorted by id.

**Rationale**: The ERD bundle already reads the listing; the client needs, per table, its resource (filter, contour, card), and per resource its name and colour.

**Alternatives considered**: a separate `ListResourcesAction` — rejected for now: one more round trip for a list the listing reads in the same query; it can be extracted when a second page needs it (rule 46).

## R4. One colour for everyone

**Decision**: the server assigns each resource its colour from the palette `ListDomainsAction` uses, by its place in the list of all resources of the graph that store an entity, sorted by id. In Diff the newer graph's colours win; a resource only the older graph has takes its colour from the older listing — the rule domain colours follow today (`readErdDiffBundle`).

**Rationale**: The colour depends on the graph alone, never on filters, 1-hop, the domain opened or the browser; everyone in a room reads the same pair of versions, so everyone sees the same colours. Client-side assignment by what is on screen would differ between "ERD all domains" and one domain's ERD.

**Alternatives considered**: a hash of the id into the palette — rejected: two resources may share a colour even when the palette has room; the domain rule is already known to readers.

## R5. The Resources section and the filter rules

**Decision**: a section `resources` in `ErdFilterPanel`, rows from the diagram's base (spec 038), shown when the base has one resource or more; a page setting `disabled_resources` (address parameter `off_resources`) lists the resources switched off. Hiding prunes through `pruneGraphToEntities`, like the kinds; 1-hop applies over it. A table without a resource is never hidden by this section.

**Rationale**: Same rules as the domain, kind and change sections: a filter never adds or removes another section's rows; a resource that appears later starts on (an "off" list, as `disabled_kinds`).

## R6. Painting by resource

**Decision**: a fourth `PaintSection`, `resources`, with its own point on the gear shift; `setErdPaint` gets `"resource"`; a card's band takes its resource's colour, a table without a resource stays grey. The point exists only while the Resources section exists. The default paint does not change.

**Rationale**: The gear shift already gives each painting section a point (spec 040); the paint is a page setting (`paint` / `paint_diff`), so a room shares it.

## R7. The Boundary switch

**Decision**: a page setting `boundary` on the ERD page (the address parameter `boundary` already exists), default on, shown while the diagram has a resource. On, `buildDotSource` wraps the tables of each resource in `subgraph "cluster_resource_<n>"` with a rounded style and the resource's name as its label; specialization clusters nest inside it. Tables without a resource stay outside every cluster.

**Rationale**: The use-case diagram draws its boundary the same way. A specialization group never spans two resources, because AOA refuses relations between resources, so nesting is always possible. A member is declared inside its innermost cluster only (the rule at `buildDotSource.ts:450`).

**Alternatives considered**: drawing the contour as an SVG overlay after layout — rejected: Graphviz then does not keep a resource's tables together.

## R8. Rooms

**Decision**: nothing new in the rooms code: `off_resources`, `boundary` and `paint` are read and set through `usePageSetting`, which sends "set to" values to the room and seeds a new room; `viewUrl.ts` gains `disabled_resources → off_resources`.

**Rationale**: `pageSettings.ts` shares every page setting in a room; a setting that skips `usePageSetting` would stay on one screen.

## R9. Viewing and comparing older versions of the graph

**Decision**:
- A version of 1.0–1.5 opens as before: no Resources section, no Boundary switch, no Resources point, no resource line on a card.
- Diff and Side by side read each side's listing. In the merged slice a table takes the newer side's resource, or the older side's when it is gone from the newer.
- A table is marked "changed" by its resource only when **both** versions give it a resource and the two differ (an `entity_resource` edge of it removed and another added). An edge only added — the older version had no resource, as every 1.5 graph — marks nothing.

**Rationale**: `markErd` marks a table "changed" when its `domain` edge changed (`movedTables`, spec 043). The same rule over `entity_resource` would paint every table of a 1.5 → 1.6 comparison as changed, though only the protocol moved: the real changes would be lost among false ones. Ignoring the edge altogether would hide a real move from one database to another.

**Alternatives considered**: comparing only graphs of one protocol version — rejected: graph history mixes versions, and `graph_compare` already reads 1.0–1.6.

## R9a. One-hop never crosses a resource

**Decision**: no case for a table of another resource brought in by 1-hop.

**Rationale**: AOA's `entity_resource_validator` keeps every link inside one resource: associations, aggregations, compositions, dictionaries, inverses, specializations, generalizations, and the state types of lifecycles. An entity's domain is its resource's, and a resource has one domain, so a relation never crosses a domain either. 1-hop brings back only tables of a resource already on the diagram. A hand-written graph with a cross-resource line draws the line across the contours; Maxitor does not check it.

## R10. The element card

**Decision**: a table's card shows `Resource: <name>` in its `detail` line (today empty for a table); in Diff, a table moved between resources shows `Resource: <old> → <new>`. No resource, no line.

**Rationale**: The card is built from what the diagram holds (`erdSubject`), so no server read is added.

## R11. Graph files and versions

**Decision**: rebuild `packages/maxitor/maxitor-web/graph.json` (becomes 1.6, one `entity_resource` edge) and `packages/maxitor/tools/repo-graph-port/graph.json` (1.6, no entities); `specs/059-maxitor-concept/model/graph.json` is a spec's frozen model and stays. Raise `maxitor-web` and `maxitor` (and `repo-graph-port` if its graph file changes), per version-gate.
