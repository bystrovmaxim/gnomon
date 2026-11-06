# Implementation Plan: The logical data model — protocol 1.8

**Branch**: `feature/issue-59-protocol-1-8` | **Date**: 2026-11-06 | **Spec**: [spec.md](spec.md)

## Summary

Protocol 1.8 is 1.7 with a new `$id` and `schema_version` const: every new rule joins several rows, so none is a schema check. The README carries the rules, the division of checks between the schema and the producer, and the 1.8 rows of its tables. The readers of this repository learn 1.8 as they learned 1.7: `graph-builder` gets its byte-for-byte copy, the version among its known ones and a fixture; `graph_compare` gets the version. No reader gains a rule.

## Technical Context

**Language/Version**: JSON Schema 2020-12; Python 3.12 (CI also 3.14)
**Primary Dependencies**: `jsonschema-rs`, `jsonschema` (already used); none added
**Testing**: pytest — `tests/scripts/test_schema_copies.py`, `packages/maxitor/tools/graph-builder/tests`, `packages/maxitor/core/graph_compare/tests`
**Constraints**: a published schema never changes; the protocol folder holds no code

## Constitution Check

| Rule | Status | How |
|---|---|---|
| The spec goes ahead of the code | Pass | spec 066 before any schema edit |
| PR closes its issue | Pass | `Closes #59` |
| Every package has a changelog | Pass | protocol `## 1.8`; Maxitor under Unreleased |
| One phase = one commit | Pass | the phases of #59 |
| A PR raises every changed level | Pass | protocol 1.7.0 → 1.8.0, `graph-builder` 1.5.0 → 1.6.0, `maxitor` 3.21.0 → 3.22.0 |
| Verification is adversarial | Pass | each new test broken once on purpose |
| Browser checks alongside CI | Not needed | no client code changes; the browser rows prove nothing new, and the status is set as for spec 062 |

## Project Structure

```text
packages/open-gnomon-protocol/
├── graph/1.8.json        # new: 1.7 with $id and schema_version 1.8
├── README.md             # 1.8 rules, the division of checks, tables
├── CHANGELOG.md          # ## 1.8
└── version.toml          # 1.8.0

packages/maxitor/
├── tools/graph-builder/
│   ├── maxitor/graph_builder/schemas/1.8.json     # copy
│   ├── maxitor/graph_builder/schemas/__init__.py  # SCHEMA_VERSIONS + "1.8"
│   ├── tests/fixtures/graph-1.8.json              # 1.7 fixture at 1.8, a relation across data sources
│   ├── tests/test_schemas_1_8.py                  # the fixture passes; 1.8 = 1.7 but for $id and version
│   ├── tests/test_cli.py                          # the unknown-version refusal lists 1.8
│   └── version.toml                               # 1.6.0
├── core/graph_compare/maxitor/graph_compare/compare.py  # KNOWN_VERSIONS + "1.8"
├── core/graph_compare/tests/test_graph_compare.py       # two 1.8 documents compared
├── core/graph_compare/README.md                         # known versions 1.0–1.8
├── pyproject.toml                                       # 3.22.0
└── CHANGELOG.md

tests/scripts/test_schema_copies.py   # the folder holds 1.8, its hash, its copy
```

## Design

- **The fixture** is `graph-1.7.json` with `schema_version` 1.8, every storing resource given a data source, and one relation between entities of resources of two data sources — the case 1.7 forbade and 1.8 allows. The schema does not see the difference; the fixture shows a graph AOA writes at 1.8.
- **The equality test** loads 1.7 and 1.8, sets 1.8's `$id` and `schema_version` const to 1.7's, and asserts the two are equal.
