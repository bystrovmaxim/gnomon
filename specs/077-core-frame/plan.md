# Implementation Plan: Maxitor core — the frame: the left tree, the top row, the right panel, the canvas and the controls

**Branch**: `feature/issue-74-core-frame` | **Date**: 2026-11-11 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/077-core-frame/spec.md` (issue bystrovmaxim/gnomon#74).

## Summary

The core's Next.js application becomes the frame every plugin lives in. Two new npm packages of this repository carry what plugins draw with: `@maxitor/tokens` (the CSS custom properties of colours, palette, radii, shadows, blur, type and spacing, from maxitor-web's styles) and `@maxitor/panel` (the page document, the panel router and address parameters, `<MaxitorCanvas>`, `Card`, `DataTable`). The core keeps every node of a version's `navigation.yaml` in `plugins.plugin_node`, checked by one tree builder when the version is checked, when it is installed or enabled in an organization, and at the core's start for the core's own file; `ReadOrganizationTreeAction` gives an organization's tree filtered by roles, list nodes load through the gateway at the panel's moment, and `ReadWatermarkAction` lets the frame tell a page that "now" moved. The frame is a persistent Next.js layout at `/w/<code>`: the tree, the top row and the right panel, which shows the core's own pages directly and a plugin's page in a transparent `iframe`, talking to it by the panel protocol, with the controls a node declares drawn over it. The gateway redirects a plugin page opened outside the panel and forbids framing it elsewhere. The template's frontend is built with both packages, and its notes page opens in the panel.

## Technical Context

**Language/Version**: Python 3.12 (CI also 3.14) for the core's backend and the SDK; TypeScript 5.9 with Next.js 16 and React 19 for the core's application, the template's frontend and the two packages.

**Primary Dependencies**: AOA from `external/aoa` (actions, `FastApiAdapter`, storage); `jsonschema` and `PyYAML` (already used by the version check); Playwright for the browser check (already used).

**Storage**: PostgreSQL schema `plugins`: a versioned table `plugin_node` with `plugin_node_versions` replacing `plugin_section`, in migration `plugins/0003_plugin_nodes.sql`; the database function `watermark(uuid)` of the schema `organization`, read by the core.

**Testing**: pytest — `packages/maxitor/maxitor-core/tests` (the tree builder, the version check, installing and enabling, the tree and watermark actions), `packages/maxitor-plugin-sdk/tests` (the one-file rules), `packages/maxitor-plugin-template/tests` (its navigation and pages' files); a Node check of the tokens; the browser check `check-core.mjs` on the local stand, desktop and phone.

**Target Platform**: browsers on desktop and phone; the core's hosts.

**Project Type**: web application (the core's backend and Next.js application), two npm libraries, a plugin (the template).

**Performance Goals**: moving between two pages of one plugin without reloading the frame; one action for the ordinary nodes; list nodes in parts of 50.

**Constraints**: every endpoint is an action (rules 41–46, 66); the address is the only state of the panel; no colour or size number outside `@maxitor/tokens` in the frame, the controls and `@maxitor/panel`; no change to maxitor-web.

**Scale/Scope**: two packages, one migration, two new core actions, the tree builder, the frame (tree, top row, panel, controls), the test page, the gateway's two rules, the template in step, the documentation of the tutorial's chapter 7 and of the concept's section 7.

## Constitution Check

- **I. One term, one name**: frame, tree, node, list node, tree builder, panel address, panel protocol, canvas, controls, tokens — the same in the spec, the concept, the code and the READMEs.
- **II. Spec ahead of code**: spec 077 with its clarifications; issue #74 carries the same phases.
- **III. The database does not decide**: `plugin_node` rows written by the version check with every column described; identifiers from the writer.
- **IV. Decision apart from idea**: the tree builder decides; the frame only draws what the tree action answers.
- **V. Measurement**: SC-001 – SC-010 each name a test, the tokens' check or the browser check.
- **Rules 41–46, 66 (actions, connections)**: the tree and the watermark are actions with frozen `Params`/`Result`, membership in `@access_decide`, each route declaring its connections.
- **Rule 54 (file named like the class)**: every new action, entity and error in a file of its name.
- **Rules 60, 67 (graph)**: the core's and the template's graph files rebuilt by `graph-builder write`.
- **Versioned storage**: `plugin_node` is the state of data and has its version table, like `plugin_section` had.

Post-design: no violation.

## Project Structure

### Documentation (this feature)

```text
specs/077-core-frame/
├── spec.md
├── plan.md               # this file
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── panel-protocol.md
│   └── core-actions.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
packages/maxitor-tokens/                      # new level: @maxitor/tokens
├── package.json, version.toml, CHANGELOG.md, README.md
├── tokens.css                                # --mx-* custom properties
└── index.ts                                  # PALETTE and the token names

packages/maxitor-panel/                       # new level: @maxitor/panel
├── package.json, version.toml, CHANGELOG.md, README.md
└── src/
    ├── protocol.ts                           # message types and their shape checks
    ├── PanelDocument.tsx, PanelPage.tsx, router.ts, query.ts
    ├── canvas/MaxitorCanvas.tsx, canvas/gestures.ts, canvas/ZoomBar.tsx
    └── content/Card.tsx, content/DataTable.tsx

packages/maxitor-plugin-sdk/src/maxitor_plugin_sdk/
└── checks.py                                 # one-file rules extended: reserved parameters, filter options/source, sources

packages/maxitor/maxitor-core/maxitor/core/
├── navigation.yaml                           # the core's nodes
├── plugins/tree_builder.py                   # build_tree, TreeRefusedError
├── plugins/entities.py                       # PluginNodeCoreEntity replaces PluginSectionCoreEntity
├── plugins/actions/check_version_action.py   # nodes written, one-file rules
├── plugins/actions/request_install_action.py, enable_plugin_action.py   # the organization's tree built
├── actions/organization_tree.py              # ReadOrganizationTreeAction, ReadWatermarkAction
└── migrations/plugins/0003_plugin_nodes.sql

packages/maxitor/maxitor-core/web/
├── app/w/[code]/layout.tsx                   # the frame
├── app/w/[code]/page.tsx                     # the organization's root in the panel
├── app/w/[code]/core/settings/plugins/page.tsx
├── app/w/[code]/core/panel-test/page.tsx
├── app/w/[code]/[owner]/[[...path]]/page.tsx # a plugin's page: the iframe
├── app/panel-test/[code]/page.tsx            # the test page itself
├── components/frame/{Frame,Tree,TopRow,Panel,Controls}.tsx
├── lib/address.ts, lib/tree.ts
├── proxy.ts                                  # document redirect, frame-ancestors
└── scripts/check-tokens.mjs, scripts/check-core.mjs

packages/maxitor-plugin-template/web/          # built with @maxitor/panel and @maxitor/tokens

docs/plugins/tutorial/07-a-place-in-the-tree.md, docs/plugins/concept.md (section 7),
packages/maxitor/maxitor-core/README.md, docs/how-to/run-the-core-locally.md
```

**Structure Decision**: the two packages sit beside the SDK and the template under `packages/`, each a level of its own; everything of the frame is in the core's application, everything of the tree's data in the core's `plugins` domain.

## Complexity Tracking

No violation to justify.
