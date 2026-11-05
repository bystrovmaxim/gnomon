# Implementation Plan: An entity belongs to a resource — Maxitor shows the model of a resource

**Branch**: `feature/issue-46-resource-model` | **Date**: 2026-11-06 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/061-resource-model/spec.md`

## Summary

Maxitor reads the `entity_resource` edge of protocol 1.6 and shows it on the ERD it already has. DuckDB gains a table `entity_resource_edges`. The entity listing returns each entity's resource and the resources of the graph, each with a colour the server assigns from the graph alone. On the client the ERD gets:

- a **Resources** filter section that also paints;
- a **Boundary** switch that draws one rounded contour per resource, headed by its name;
- `Resource: <name>` on a table's card.

All three settings are page settings, so a room shares them. In Diff a table is marked changed by its resource only when both versions give it one and they differ, so a 1.5 → 1.6 comparison stays quiet. `NodeCoreEntity` declares `resource=DuckDBGraphResource` on AOA `537c61d4`.

## Technical Context

**Language/Version**: Python 3.12 (CI also 3.14) for `maxitor-web`; TypeScript 5.7 / React 19 for its client

**Primary Dependencies**: AOA at `537c61d4` (submodule), DuckDB, Graphviz WASM; none added

**Storage**: DuckDB in memory, filled from the graph JSON of the version on screen

**Testing**: pytest (`packages/maxitor/maxitor-web/tests`), vitest (`client`), `scripts/check_before_pr.sh` for the three browsers and rooms

**Target Platform**: Maxitor web: server, and the SPA in Chromium, Firefox and WebKit

**Project Type**: web application (AOA actions plus a React client)

**Performance Goals**: no new round trip: resources come in the listing the ERD already reads

**Constraints**:
- graphs of 1.0–1.5 open and draw unchanged;
- every endpoint is an AOA action;
- a resource has one colour for every reader of the same graph;
- every setting is a page setting.

**Scale/Scope**:
- 1 entity declaration, 1 edge table, 1 action result and its schema;
- client: the bundle, the filter panel, the paint, the DOT builder, the card, the Diff marking, the address map;
- tests, 2 graph files, versions, the ERD pages, 1 changelog article.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Rule | Status | How |
|---|---|---|
| II. The spec goes ahead of the code | Pass | spec 061, clarified, before any edit |
| Workflow: specify → clarify → plan → tasks → analyze → implement | Pass | this plan; `speckit-analyze` before code |
| Workflow: PR closes its issue | Pass | `Closes #46` |
| Workflow: every package has a changelog | Pass | Maxitor `CHANGELOG.md`, one article under the raised version |
| 41–46. Actions | Pass | `ListEntitiesAction`'s summary aspect reads the resources in its own body (rule 43) and adds the fields; no hand-written route; a separate resources action is not extracted until a second page needs it (R3) |
| 60. The graph is built from what is loaded | Pass | the graph is rebuilt by the existing build; no list of modules added |
| House rule: one phase = one commit | Pass | the 8 phases of issue #46 (below) |
| House rule: a PR into `main` raises every changed level | Pass | `maxitor-web` 1.10.7 → 1.11.0; `maxitor` 3.16.0 → 3.17.0; `repo-graph-port` 1.4.3 → 1.4.4 if its graph file changes |
| House rule: verification is adversarial | Pass | quickstart lists one break per new test |
| 68–70. Red PR not merged, assignee, Auto-fix | Pass | `--assignee bystrovmaxim`, Auto-fix on after opening |
| 71. Browser checks alongside CI | Pass | `check_before_pr.sh` after every push, rooms included |

Post-design re-check: no new violations; nothing goes to Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/061-resource-model/
├── spec.md
├── plan.md                 # this file
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── list-entities-resources.md
│   └── erd-page-settings.md
├── checklists/requirements.md
└── tasks.md                # /speckit-tasks
```

### Source Code (repository root)

```text
external/aoa                                         # → 537c61d4, with uv.lock
packages/maxitor/maxitor-web/
├── maxitor/web/model/core/entities/node_entity.py   # @entity(resource=DuckDBGraphResource)
├── maxitor/web/model/diagrams/resources/duckdb_graph_resource.py   # entity_resource_edges
├── maxitor/web/model/diagrams/actions/list_entities_action.py      # resource per row, resources + colours
├── maxitor/web/model/diagrams/actions/list_entities_action_schema.py
├── maxitor/web/model/diagrams/actions/list_domains_action.py       # the palette, shared
├── tests/fixtures/resource_model.py                 # 1.6 shop graph, two resources
├── tests/test_duckdb_entity_resource_edges.py
├── tests/test_list_entities_resources.py
├── client/scripts/check-erd-resources.ts          # browser check, a row in scripts/check_run.py
├── graph.json                                       # rebuilt, 1.6
├── version.toml
└── client/src/
    ├── api/erd.ts                                   # the new fields
    ├── lib/loadErdDomainsBundle.ts                  # resource colours and labels, One and Diff
    ├── lib/erdDiff.ts                               # merged resource, moved-resource rule
    ├── lib/erdResourceFilter.ts                     # rows, pruning
    ├── lib/erdPaint.ts                              # the "resources" section
    ├── lib/buildDotSource.ts                        # resource clusters
    ├── lib/erdCard.ts                               # Resource: line
    ├── lib/viewUrl.ts                               # off_resources
    ├── components/ui/ErdFilterPanel/                # the Resources section
    ├── components/diagrams/ErdViewer/parts/ErdGraphvizCanvas/   # settings, Boundary switch
    └── … tests beside each
packages/maxitor/tools/repo-graph-port/graph.json    # rebuilt, 1.6
packages/maxitor/CHANGELOG.md, pyproject.toml
```

**Structure Decision**: all server work stays in the actions and the resource that serve the ERD today; the client keeps one ERD canvas for One, Diff and Side by side, so each gets the feature at once.

## Phases (one commit each, as in issue #46)

1. Move `external/aoa` to `537c61d4` with `uv.lock`, in a commit of its own (`./update-aoa.sh 537c61d4`). Then give `NodeCoreEntity` its resource (`resource=` in place of `domain=`), and teach DuckDB the `entity_resource` edge, so Maxitor's own 1.6 graph opens.
2. The listing returns each entity's resource and the graph's resources with their colours.
3. The card shows `Resource: <name>`, and `old → new` in Diff.
4. The Resources section, painting by resource, Boundary, the Diff rule, the address and room settings, and the browser check `client/scripts/check-erd-resources.ts`.
5. Rebuild the graph files; raise the versions.
6. The closing check run, taken to zero; the browser checks, rooms included.
7. Documentation: the ERD pages (`ErdViewer/README.md`, `ErdGraphvizCanvas/README.md`, `ErdFilterPanel/README.md`, `maxitor-web/README.md` §2 "ERD: Data Model From Code").
8. Changelog: one article.

Phase 1 is two commits: the submodule move alone, as `AGENTS.md` requires, then `NodeCoreEntity` and the DuckDB edge table. AOA at `537c61d4` refuses an `@entity` without `resource=`, so Maxitor does not load between the two commits, and from the second on its own graph is 1.6, which DuckDB must know. Both go in one push.

## Complexity Tracking

No deviations.
