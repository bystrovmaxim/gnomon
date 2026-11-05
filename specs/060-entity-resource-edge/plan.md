# Implementation Plan: An entity belongs to a resource — protocol 1.6

**Branch**: `feature/issue-45-entity-resource-edge` | **Date**: 2026-11-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/060-entity-resource-edge/spec.md`

## Summary

Protocol 1.6 is 1.5 plus one edge definition, `entity_resource` (Entity → Resource, `Aggregation`, `is_dag` `true`, no properties), with its `$id` at its address in this repository. The readers of the protocol in this repository learn the version the way they learned 1.4 and 1.5: `graph-builder` gets its byte-for-byte copy of the schema and `"1.6"` among its known versions; the graph comparison (`maxitor.graph_compare`), which Maxitor's map and comparison use, gets `"1.6"` among the versions it reads. Neither gains a rule of its own. The README of the protocol gets the 1.6 vocabulary and the rule "exactly one `entity_resource` per entity", which is the exporter's duty.

## Technical Context

**Language/Version**: JSON Schema 2020-12 for the protocol; Python 3.12 (CI also 3.14) for `graph-builder` and `graph_compare`

**Primary Dependencies**: `jsonschema-rs` and `jsonschema` (already used by `graph-builder`); none added

**Storage**: files: `packages/open-gnomon-protocol/graph/1.6.json` and its copy in `graph-builder`

**Testing**: pytest per level: `packages/maxitor/tools/graph-builder/tests`, `packages/maxitor/core/graph_compare/tests`, `tests/scripts/test_schema_copies.py`

**Target Platform**: any reader of the protocol; `graph-builder` as a CLI and GitHub Action

**Project Type**: protocol (schema files) plus a CLI checker and a library

**Performance Goals**: none new; one more `oneOf` branch in edge checking

**Constraints**: a published schema never changes (`test_a_published_version_never_changes` pins each by hash); the protocol folder holds no code (`test_the_protocol_holds_no_code`)

**Scale/Scope**: 1 new schema file (~1 720 lines, 1.5 plus one definition), its copy, 2 one-line version lists, 1 fixture, tests, README, 3 version files, 2 changelogs

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Rule | Status | How |
|---|---|---|
| II. The spec goes ahead of the code | Pass | spec 060, clarified, before any edit of a schema |
| Workflow: specify → clarify → plan → tasks → analyze → implement | Pass | this plan; `speckit-analyze` before code |
| Workflow: PR closes its issue | Pass | the PR says `Closes #45` |
| Workflow: every package has a changelog, entry names the version | Pass | protocol `CHANGELOG.md` gets `## 1.6`; Maxitor `CHANGELOG.md` gets its line under Unreleased, as for 1.4 and 1.5 |
| House rule: one phase = one commit | Pass | phases of issue #45 map to commits (see Phases) |
| House rule: a PR into `main` raises every changed level | Pass | protocol 1.5.0 → 1.6.0, `graph-builder` 1.3.1 → 1.4.0, `maxitor` 3.15.0 → 3.16.0 (for `core/graph_compare`) |
| House rule: verification is adversarial | Pass | each new test is broken once on purpose (see quickstart) |
| 68. A red PR is not merged | Pass | merge only on all checks green and `CLEAN` |
| 69–70. Assignee and Auto-fix | Pass | `--assignee bystrovmaxim`, Auto-fix on after opening |
| 71. Browser checks alongside CI | **Deviation, by the maintainer's instruction** | see Complexity Tracking |

## Project Structure

### Documentation (this feature)

```text
specs/060-entity-resource-edge/
├── spec.md
├── plan.md               # this file
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── entity-resource-edge.md
├── checklists/requirements.md
└── tasks.md              # /speckit-tasks
```

### Source Code (repository root)

```text
packages/open-gnomon-protocol/
├── graph/1.6.json                    # new: 1.5 + entity_resource, $id in gnomon
├── README.md                         # 1.6 badge, example, vocabulary, rule, version table
├── CHANGELOG.md                      # ## 1.6
└── version.toml                      # 1.6.0

packages/maxitor/
├── tools/graph-builder/
│   ├── maxitor/graph_builder/schemas/1.6.json      # copy of the protocol's file
│   ├── maxitor/graph_builder/schemas/__init__.py   # SCHEMA_VERSIONS + "1.6"
│   ├── tests/fixtures/graph-1.6.json               # 1.5 fixture + the edge
│   ├── tests/test_schemas.py                       # 1.6 words pass, 1.5 does not know them
│   ├── tests/test_cli.py                           # known versions in the refusal text
│   └── version.toml                                # 1.4.0
├── core/graph_compare/
│   ├── maxitor/graph_compare/compare.py            # KNOWN_VERSIONS + "1.6"
│   ├── README.md                                   # the refused versions named by the list
│   └── tests/                                      # a 1.6 pair compares
├── pyproject.toml                                  # 3.16.0
└── CHANGELOG.md                                    # one line under Unreleased / Added

tests/scripts/test_schema_copies.py                 # 1.6 copy, hash, $id in gnomon
```

**Structure Decision**: the same files the 1.5 change touched (commit `9f846429` of aoa's history), less the AOA side, which is bystrovmaxim/aoa#469.

## Phases (one commit each, as in issue #45)

1. `graph/1.6.json` — the protocol file; `test_schema_copies.py` knows it (no code in the protocol folder, the hash, the gnomon `$id`).
2. Readers know 1.6 — `graph-builder` (copy, version list, fixture, tests) and `graph_compare` (version list, test, README).
3. Raise the versions of the three levels.
4. The closing check run, taken to zero (CI on the pull request).
5. Documentation — the protocol's README.
6. Changelog — protocol `## 1.6`, Maxitor's line.

## Complexity Tracking

| Deviation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Rule 71: the browser check of the three engines is emulated, not run | The maintainer's instruction for this task: nothing the browsers draw changes. `graph_compare` only widens the list of versions it accepts; the web part and its client are untouched | Running it spends a full browser run to prove a list constant; the required status `Local check run` is set by hand on each pushed commit with a description naming the emulation, so the merge rule still sees one status per commit |
