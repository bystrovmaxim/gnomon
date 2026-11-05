# Research: protocol 1.6

## R1. How the edge enters the schema

- **Decision**: a new definition `entity_resource` in `$defs` (a `link_row` with `type` const `entity_resource`, `relationship` const `Aggregation`, `is_dag` const `true`, empty `properties`) and a new branch of `link.oneOf`.
- **Rationale**: `domain_event` and `cache_declaration` show the pattern of an edge whose relationship and `is_dag` are fixed. The values are those of every `domain` edge in AOA's graphs today: 213 entity edges and 16 resource edges in the AOA demo, all `Aggregation`, `is_dag` `true`.
- **Alternatives considered**: adding the type to `empty_properties` — that group leaves `relationship` and `is_dag` open, so a wrong value would pass.

## R2. What a schema can and cannot refuse

- **Decision**: the schema refuses a wrong row of the edge; "exactly one per entity, from an Entity to a Resource" is a README rule kept by the exporter.
- **Rationale**: JSON Schema 2020-12 validates values, not references between them; `graph-builder validate` passes a 1.5 graph whose `domain` edge points at nodes that do not exist (`ok 1.5: 0 nodes, 1 edges`). `graph-builder` stays a schema checker (clarification of 2026-11-05).
- **Alternatives considered**: a rule in `check_graph` (rejected by the maintainer); the resource as a node property (breaks the edge model of #46 and aoa#469); a rules layer over the schema — a separate task, researched after this one.

## R3. `$id` and the copy test

- **Decision**: `graph/1.6.json` has `$id` `https://raw.githubusercontent.com/bystrovmaxim/gnomon/main/packages/open-gnomon-protocol/graph/1.6.json`. `tests/scripts/test_schema_copies.py` keeps the aoa address for 1.0–1.5 and checks the gnomon address from 1.6 on; 1.6 gets its hash in `PUBLISHED`.
- **Rationale**: a published file never changes, so 1.0–1.5 keep their `$id`; a new file names where it is served.

## R4. Which readers in this repository must know the version

- **Decision**: `graph-builder` (`SCHEMA_VERSIONS`) and `graph_compare` (`KNOWN_VERSIONS`). `repo-graph-port` reads through `graph-builder`'s `check_graph`, so it follows with no edit.
- **Rationale**: the 1.4 and 1.5 changes touched exactly these two lists. Without `"1.6"` in `KNOWN_VERSIONS`, Maxitor's map and comparison refuse a 1.6 graph as soon as AOA writes one — before #46 draws the edge. Accepting the version keeps every 1.5 reading working (User Story 3); drawing the edge is #46.
- **Alternatives considered**: leaving `graph_compare` to #46 — the gap between aoa#469 and #46 would break Maxitor on AOA's graphs.

## R5. Levels and versions

- **Decision**: protocol `1.5.0 → 1.6.0`; `graph-builder` `1.3.1 → 1.4.0` (reads a new version); `maxitor` `3.15.0 → 3.16.0` (`core/graph_compare` belongs to the `packages/maxitor` level). `maxitor-web` and `repo-graph-port` do not change. The root has `require_bump = false`; READMEs, changelogs and tests are ignored by the root policy.

## R6. Browser check

- **Decision**: emulated, by the maintainer's instruction: `Local check run` is posted by hand on each pushed commit with the description "browser check emulated: the web part did not change (#45)".
- **Rationale**: no file of `maxitor-web` changes; the constant in `graph_compare` changes no drawing.
