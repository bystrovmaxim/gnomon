# Implementation Plan: Hovering a resource contour lights up its links to other resources

**Branch**: `feature/issue-55-resource-contour-hover` | **Date**: 2026-11-06 | **Spec**: [spec.md](spec.md)

## Summary

The ERD's DOT source gives each resource contour an id and a tooltip naming its resource. The post-pass that binds the line hover binds the contour hover too, lighting the resource's cross-resource lines with the same look and dimming. The room carries the hover as a new focus kind, `contour`, whose id is the resource id.

## Technical Context

**Language/Version**: TypeScript (client, React + Vite), Python 3.12 / 3.14 (room server)
**Primary Dependencies**: Graphviz WASM (`@hpcc-js/wasm-graphviz`), MUI `sx` styles
**Testing**: Vitest (`*.test.ts`), pytest (`maxitor-web/tests`), browser checks (`client/scripts/check-erd-*.ts`, Playwright)
**Project Type**: web application (`packages/maxitor/maxitor-web`)
**Constraints**: nothing in production for the sake of tests (constitution); the room server stays strict about what a focus may name

## Constitution Check

- The room server change is a value in an existing whitelist of an existing action's resource; no new endpoint, no route outside AOA actions.
- No Python/AOA assumption enters the client: a contour is named by whatever id the graph gives a resource.

## Design

### The drawing (`client/src/lib/buildDotSource.ts`)

`resourceContour` gives the cluster `cluster_resource_<i>`:

- `id="rc:<resource id>"` — Graphviz writes it as the cluster group's id (`<g id="rc:…" class="cluster">`), and wraps the border and the name in `<g id="a_rc:…"><a xlink:title="…">`;
- `tooltip="<resource id>"` — the hover label, the resource's full id (FR-006).

The invisible `_room` cluster and the data source contours get no id, so they never react (FR-005).

### The hover (`client/src/lib/erdPostPass.ts`)

1. `CONTOUR_PREFIX = "rc:"` and `contourResource(cluster)` — the resource a cluster group names, or `null`.
2. `addContourHitAreas(root)` — like `addEdgeHitAreas`: a transparent copy of the border, 10 px wide, catching the pointer on the stroke only (`pointer-events="stroke"`), so the inside of the contour stays the tables' (FR-005).
3. `crossLines(resource, relations, entities)` — the indices `k` of relations whose one end's table is in `resource` and the other end's table in another resource (FR-001).
4. `bindLineHover` gains the contour: on `mouseenter` of a `g.cluster` with a resource id it adds `is-hovered` to the cluster, shows the cross lines with the line look (`show`), and calls `focusTables(root, ends of those lines, those lines)`; on `mouseleave` it reverses both and calls `clearTableFocus` (FR-002–FR-004). With no cross line the two sets are empty, so every table and line dims (FR-003).
5. `erdContourHoverSx` — `g.cluster.is-hovered path:not(.erd-hit)` takes a wider stroke; the colour is untouched, so painting by resource or data source stays.

### The room (`client/src/rooms/*`, `maxitor/web/model/rooms/resources/room_registry.py`)

- `ElementRef.kind` gains `"contour"`.
- `elementRefOf`: a target inside a `g.cluster` with a resource id, and not inside a node or an edge, names `{ kind: "contour", id: <resource id> }`.
- `elementsOf`: the cluster group with id `rc:<id>`.
- `erdPortable` passes a contour through unchanged: the resource id is already the identity, so Side by side finds the same contour in the other half.
- `room_registry._FOCUS_KINDS` gains `contour`. Selection (`pages._element`) does not: a contour cannot be selected.
- `erdSubject` returns `null` for a contour, so it gets the label, not a card.

### Checks

- Vitest: `buildDotSource.test.ts` (id and tooltip on a resource contour, none on a data source contour or with Boundary off); `erdPostPass.test.ts` (lit lines and tables for a resource with cross lines, for one without, restore on leave, inside of the contour not reacting); `graphvizFocus` test for `elementRefOf`/`elementsOf` of a contour.
- pytest: a `focus` naming a contour is relayed; an unknown kind still dropped.
- Browser: `client/scripts/check-erd-contour-hover.ts` on the AOA demo graph — hover a contour of a resource with cross lines, read which tables and lines are lit; a follower in a room sees the same.

## Levels whose version is raised

`packages/maxitor/maxitor-web` (client and server), and `packages/maxitor` as the level that holds it.
