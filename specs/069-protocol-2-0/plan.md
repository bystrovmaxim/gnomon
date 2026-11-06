# Implementation Plan: Protocol 2.0 — a resource names its entities, and there is no data source

**Branch**: `feature/issue-66-protocol-2-0` | **Date**: 2026-11-06 | **Spec**: [spec.md](spec.md)

## Summary

Protocol 2.0 is 1.8 without `DataSource` and `resource_data_source`, with `entity_resource` (entity → resource) replaced by `resource_entity` (resource → entity) of the same shape. The README describes it and states, in one table, what the schema checks and what the producer holds. `graph-builder` and `graph_compare` learn the version as they learned 1.8. Maxitor's DuckDB store keeps one table of links from resource to entity, filled from either direction, and no data source; its actions keep their fields and answer with no data source. The constitution's data-model rules follow the root issue.

## Technical Context

**Language/Version**: JSON Schema 2020-12; Python 3.12 (CI also 3.14)
**Primary Dependencies**: `jsonschema-rs`, `jsonschema`, `duckdb` (already used); none added
**Testing**: pytest — `tests/scripts/test_schema_copies.py`, `packages/maxitor/tools/graph-builder/tests`, `packages/maxitor/core/graph_compare/tests`, `packages/maxitor/maxitor-web/tests`
**Constraints**: a published schema never changes; the protocol folder holds no code; every test file keeps Radon MI grade A

## Constitution Check

| Rule | Status | How |
|---|---|---|
| The spec goes ahead of the code | Pass | spec 069 before any schema edit |
| PR closes its issue | Pass | `Closes #66` |
| Every package has a changelog | Pass | protocol `## 2.0`; Maxitor under Unreleased |
| One phase = one commit | Pass | the nine phases of #66 |
| A PR raises every changed level | Pass | protocol 1.8.0 → 2.0.0, `graph-builder` 1.6.0 → 1.7.0, `maxitor-web` 1.16.0 → 1.17.0, `maxitor` 3.24.0 → 3.25.0 |
| Verification is adversarial | Pass | each new test broken once on purpose |
| Rules 13, 15, 24–26, 53 | Rewritten | phase 5, at the maintainer's issue #66 (1.3) |
| Browser checks alongside CI | Run | the store changes what the ERD and the sidebar get for a 1.7–1.8 graph |

## Project Structure

```text
packages/open-gnomon-protocol/
├── graph/2.0.json        # new
├── README.md             # 2.0, the table of checks
├── CHANGELOG.md          # ## 2.0
└── version.toml          # 2.0.0

packages/maxitor/
├── tools/graph-builder/
│   ├── maxitor/graph_builder/schemas/2.0.json     # copy
│   ├── maxitor/graph_builder/schemas/__init__.py  # SCHEMA_VERSIONS + "2.0"
│   ├── tests/fixtures/graph-2.0.json              # 1.8 fixture rewritten at 2.0
│   ├── tests/test_schemas_2_0.py                  # passes; refuses DataSource and entity_resource
│   ├── tests/test_cli.py                          # the unknown-version refusal lists 2.0
│   └── version.toml                               # 1.7.0
├── core/graph_compare/maxitor/graph_compare/compare.py  # KNOWN_VERSIONS + "2.0"
├── core/graph_compare/tests/test_graph_compare.py       # two 2.0 documents compared
├── maxitor-web/maxitor/web/model/diagrams/resources/duckdb_graph_resource.py  # resource_entity_edges; no data source
├── maxitor-web/maxitor/web/model/diagrams/actions/list_entities_action.py     # reads resource_entity_edges; no data source
├── maxitor-web/maxitor/web/model/core/actions/left_sidebar_action.py          # the same
├── maxitor-web/maxitor/web/model/diagrams/actions/list_node_types_action.py   # no data_source table
├── maxitor-web/tests/                                   # 1.8 and 2.0 graphs fill the same links
└── pyproject.toml, CHANGELOG.md

tests/scripts/test_schema_copies.py   # the folder holds 2.0; 2.0 = 1.8 but for the named shapes
.specify/memory/constitution.md       # rules 24–26, 53; version 2.0.0
```

## Design

- **The schema** is built from 1.8 by a script run once: drop `$defs.data_source` and its `vertex` entry, drop `$defs.resource_data_source` and its `link` entry, rename `$defs.entity_resource` to `resource_entity` with its `type` const, keep the order of every other key. The equality test does the same transformation on 1.8 and compares.
- **The fixture** is `graph-1.8.json` at 2.0: its data sources and their edges removed, every `entity_resource` edge turned into `resource_entity` from the resource, every `domain` edge of a resource removed, and one entity kept by a second resource.
- **The store**: `resource_entity_edges` has the four base columns, `source_id` the resource. The loader maps `resource_entity` straight and `entity_resource` reversed into it; it drops `DataSource` nodes, `resource_data_source` edges and `application` edges from a `DataSource`. The tables `data_source` and `resource_data_source_edges` and their places in the `nodes`/`edges` views go. The actions read `resource_entity_edges` with the ends swapped and give `data_source_id` null and no `data_sources`; the sidebar's Data sources section, which stands only for a graph that has a data source, no longer stands.
- **The constitution** is MINOR (1.5.0), as the amendments of rules 1.3.0 and 1.4.0 were: rule 24 "A resource names its entities", rule 25 "A resource has no domain", rule 26 without the data source, rule 53 without its data-source sentence.
