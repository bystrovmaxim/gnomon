# Implementation Plan: A resource may work through a data source — protocol 1.7

**Branch**: `feature/issue-51-data-source-protocol` | **Date**: 2026-11-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/062-data-source-protocol/spec.md`

## Summary

Protocol 1.7 is 1.6 plus one node definition, `data_source` (`DataSource`, a required `description`, nothing else), and one edge definition, `resource_data_source` (Resource → DataSource, `Aggregation`, `is_dag` `true`, no properties), with its `$id` at its address in this repository. The `application` edge needs no change. The readers of the protocol in this repository learn the version as they learned 1.6: `graph-builder` gets its byte-for-byte copy and `"1.7"` among its known versions; `graph_compare` gets `"1.7"` among the versions it reads. Neither gains a rule. The README of the protocol gets the 1.7 vocabulary, the example rows and the rules a schema cannot check, which the producer keeps.

## Technical Context

**Language/Version**: JSON Schema 2020-12 for the protocol; Python 3.12 (CI also 3.14) for `graph-builder` and `graph_compare`

**Primary Dependencies**: `jsonschema-rs` and `jsonschema` (already used by `graph-builder`); none added

**Storage**: files: `packages/open-gnomon-protocol/graph/1.7.json` and its copy in `graph-builder`

**Testing**: pytest per level: `packages/maxitor/tools/graph-builder/tests`, `packages/maxitor/core/graph_compare/tests`, `tests/scripts/test_schema_copies.py`

**Target Platform**: any reader of the protocol; `graph-builder` as a CLI and GitHub Action

**Project Type**: protocol (schema files) plus a CLI checker and a library

**Performance Goals**: none new; one more `oneOf` branch for nodes and one for edges

**Constraints**: a published schema never changes; the protocol folder holds no code

**Scale/Scope**: 1 new schema file (1.6 plus two definitions), its copy, 2 one-line version lists, 1 fixture, tests, README, 3 version files, 2 changelogs

## Constitution Check

| Rule | Status | How |
|---|---|---|
| II. The spec goes ahead of the code | Pass | spec 062, clarified, before any edit of a schema |
| Workflow: PR closes its issue | Pass | the PR says `Closes #51` |
| Workflow: every package has a changelog, entry names the version | Pass | protocol `CHANGELOG.md` gets `## 1.7`; Maxitor's under Unreleased |
| House rule: one phase = one commit | Pass | phases of issue #51 map to commits |
| House rule: a PR into `main` raises every changed level | Pass | protocol 1.6.0 → 1.7.0, `graph-builder` 1.4.0 → 1.5.0, `maxitor` 3.17.0 → 3.18.0 |
| House rule: verification is adversarial | Pass | each new test is broken once on purpose (quickstart) |
| 68. A red PR is not merged | Pass | merge only on all checks green |
| 69–70. Assignee and Auto-fix | Pass | `--assignee bystrovmaxim` |
| 71. Browser checks alongside CI | **Deviation, as in spec 060** | see Complexity Tracking |

## Project Structure

```text
packages/open-gnomon-protocol/
├── graph/1.7.json                    # new: 1.6 + data_source + resource_data_source
├── README.md                         # 1.7 vocabulary, rows, rules, version table
├── CHANGELOG.md                      # ## 1.7
└── version.toml                      # 1.7.0

packages/maxitor/
├── tools/graph-builder/
│   ├── maxitor/graph_builder/schemas/1.7.json      # copy
│   ├── maxitor/graph_builder/schemas/__init__.py   # SCHEMA_VERSIONS + "1.7"
│   ├── tests/fixtures/graph-1.7.json               # 1.6 fixture + a data source
│   ├── tests/test_schemas.py
│   ├── tests/test_cli.py
│   └── version.toml                                # 1.5.0
├── core/graph_compare/                             # KNOWN_VERSIONS + "1.7", test, README
├── pyproject.toml                                  # 3.18.0
└── CHANGELOG.md

tests/scripts/test_schema_copies.py                 # 1.7 copy, hash, $id, equality with 1.6
```

## Phases (one commit each, as in issue #51)

1. `graph/1.7.json` and the protocol README; `test_schema_copies.py` knows it.
2. Readers know 1.7 — `graph-builder` (copy, version list, fixture, tests) and `graph_compare`.
3. Raise the versions of the three levels.
4. The closing check run, taken to zero (CI on the pull request).
5. Documentation — `graph-builder`'s and the comparison's pages that list the versions.
6. Changelog — protocol `## 1.7`, Maxitor's line.

## Complexity Tracking

| Deviation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Rule 71: the browser check is emulated, not run | Nothing the browsers draw changes: `graph_compare` only widens its list of versions; the web part is untouched | A full browser run would prove a list constant; `Local check run` is set by hand on each pushed commit, naming the emulation |
