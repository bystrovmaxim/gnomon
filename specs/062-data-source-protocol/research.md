# Research: protocol 1.7

## R1. How the node enters the schema

- **Decision**: a new definition `data_source` in `$defs` (a `row` with `type` const `DataSource` and `properties` an object with one required string `description`, no other property), and a new branch of `vertex.oneOf`.
- **Rationale**: `resource` has exactly this shape; a data source carries what a resource carries about itself and nothing about connections.
- **Alternatives considered**: a `name` property as `Domain` and `Application` have — AOA writes the class name into `label` already, and `Resource` has no `name`.

## R2. How the edge enters the schema

- **Decision**: a new definition `resource_data_source` (a `link_row` with `type` const `resource_data_source`, `relationship` const `Aggregation`, `is_dag` const `true`, empty `properties`) and a new branch at the end of `link.oneOf`.
- **Rationale**: the pattern of `entity_resource` (1.6): an edge whose relationship and `is_dag` are fixed.
- **Alternatives considered**: adding the type to `empty_properties` — that group leaves `relationship` and `is_dag` open.

## R3. The `application` edge from a data source

- **Decision**: no change. `application` is in `empty_properties`; its shape does not depend on its source, so a `DataSource → Application` row already has a valid shape.
- **Rationale**: a schema cannot see an edge's source type; "exactly one `application` edge per data source" is a README rule.

## R4. What a schema can and cannot refuse

- **Decision**: the schema refuses a wrong row of the node or the edge; every rule about counts and ends is a README rule kept by the producer, and AOA checks each one (bystrovmaxim/aoa#475).
- **Rationale**: JSON Schema 2020-12 validates values, not references between them (research R2 of spec 060). `graph-builder` stays a schema checker.

## R5. Readers in this repository

- **Decision**: `graph-builder` (`SCHEMA_VERSIONS`) and `graph_compare` (`KNOWN_VERSIONS`) get `"1.7"`. `repo-graph-port` reads through `graph-builder`'s check and follows with no edit. The web part's loader is #52.
- **Rationale**: the same two lists every version change touched.

## R6. Levels and versions

- **Decision**: protocol `1.6.0 → 1.7.0`; `graph-builder` `1.4.0 → 1.5.0`; `maxitor` `3.17.0 → 3.18.0` (`core/graph_compare` belongs to the `packages/maxitor` level). `maxitor-web` and `repo-graph-port` do not change.

## R7. Browser check

- **Decision**: emulated, as in spec 060: `Local check run` is posted by hand on each pushed commit with the description "browser check emulated: the web part did not change (#51)".
- **Rationale**: no file of `maxitor-web` changes.
