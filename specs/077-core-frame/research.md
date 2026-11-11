# Research: Maxitor core — the frame

Decisions taken for spec 077, each with why and what else was weighed.

## R1. Where `@maxitor/tokens` and `@maxitor/panel` live

- **Decision**: two npm packages of this repository, `packages/maxitor-tokens` and `packages/maxitor-panel`, each a level with `version.toml` (`kind = "package"`, `driver = "node"`, its version in `package.json`) and a `CHANGELOG.md`. They ship their TypeScript and CSS sources; the core's application and the template's frontend depend on them by path (`file:`) and let Next.js compile them (`transpilePackages`).
- **Why**: the core and the template are built from one checkout; a path dependency is the package as this repository releases it, with no registry in between. Publishing to npm is the maintainer's tag (spec, Assumptions).
- **Alternatives**: an npm workspace at the root — it would pull maxitor-web's Vite client into one lock file; a built `dist/` — a build step and a second copy of every file for no gain while both users are Next.js.

## R2. What the tokens are

- **Decision**: `@maxitor/tokens` is one CSS file of custom properties (`--mx-*`): colours, the named palette (`--mx-palette-<name>`), radii, shadows, blur, type sizes, spacing — the values of maxitor-web's `src/index.css` and `theme.ts` — and a TypeScript module that names the palette for code (`PALETTE`, the names a control's `colour` may take). A check script (`check-tokens.mjs` in the core's application) reads the frame's, the controls' and `@maxitor/panel`'s CSS and TSX and refuses a colour code (`#…`, `rgb(`, `hsl(`) or a `px`/`rem` number outside `var(--mx-…)`.
- **Why**: CSS variables reach both the core's frame and a plugin's page without JavaScript; the palette's names are the contract of `colour:` in `navigation.yaml`.
- **Alternatives**: a TS object injected as inline styles — every component would need it; Tailwind — a framework the project does not use.

## R3. How the tree is kept

- **Decision**: a version's whole navigation is read once, when the version is checked (`CheckVersionAction`), into a versioned table `plugins.plugin_node` replacing `plugin_section`: one row per node with its full name, the full name of its parent (`root`, `core:<id>`, `<dependency>:<id>` or the owner's own node), `order`, `title`, `icon`, `page`, `each_source`, `each_key`, `roles`, `controls` and `room` as JSON, and the scope of parameters it adds. The organization's tree is the core's nodes and the nodes of the versions enabled in it, joined by those full names.
- **Why**: what a tree holds depends only on which versions are enabled; resolving every node once per version and joining by full names at read time is exactly "the built tree", with no copy per organization to keep in step.
- **Alternatives**: a table `platform.navigation_tree` per organization, rewritten at each install — the same data copied once per organization; reading YAML at run time — refused by the concept.

## R4. When the tree builder runs and what it refuses

- **Decision**: one pure function, `build_tree(core, plugins)` in `maxitor/core/plugins/tree_builder.py`, takes the core's nodes and the enabled versions' nodes in dependency order and gives the joined tree or raises `TreeRefusedError(reason)`. It runs:
  1. in `CheckVersionAction`, on the version alone: the file's schema and the rules of one file (the SDK's `navigation_problems`, extended), `attach` only to `root`, `core:<id>` that exists, or a direct dependency named in the passport, and every `source`/`counts` naming an action the wheel carries (`<package>/actions/<source>_action.py`);
  2. in installing and enabling, on the organization's enabled set with the new version: every `attach` to a dependency's node finds that node, every parameter of the scope is defined at the place, no two list nodes with one key stand one under the other; a refusal cancels the operation with the reason `navigation`;
  3. at the core's start, on the core's own `navigation.yaml`.
- **Why**: the one-file rules are known when the wheel is checked, so a broken file never reaches an organization; the cross-plugin rules need the organization's set. Checking `source` against the actions the wheel carries finds the same fault as asking the running backend, earlier and without a process. Disabling and removing only take nodes away, and a dependent plugin already blocks disabling its dependency, so they cannot break the tree. A rename of a core node is a major version of the core, which every plugin's `requires.maxitor` already catches.
- **Alternatives**: checking the sources on the running backend — a running process for a question the wheel answers.

## R5. The address in the core's application

- **Decision**: the frame is the layout `app/w/[code]/layout.tsx` (a server part reading the session, the organization and the tree; a client part, `Frame`, keeping the tree's state). The panel is the page under it: `app/w/[code]/core/**` are the core's own pages, drawn in the panel; `app/w/[code]/[owner]/[[...path]]/page.tsx` stands for every plugin page and lets `Frame` draw its `iframe`. The old `/w/<code>/settings/plugins` redirects to `/w/<code>/core/settings/plugins`.
- **Why**: a Next.js layout persists across client navigations, so the tree, its open nodes and its scroll stay while the panel changes (FR-021, SC-006); the window's history is Next.js's router.
- **Alternatives**: one client page with its own router — a second router beside Next.js's.

## R6. The panel protocol

- **Decision**: `@maxitor/panel` exports `PanelDocument` (the page's root: transparent background, the message listener, `panel.ready`), `PanelPage` (sends `panel.title`), `usePanelRouter` (`push`/`replace` send `panel.navigate` and replace the frame's own address with Next.js's `router.replace`), `usePanelQuery`, `momentFrom`, `panelOpen`. The core's `Frame` keeps the address it last told the page or heard from it; a window change that equals what the page asked is not sent back as `panel.location`. Both sides check `event.origin === location.origin` and `event.source` (the frame's `contentWindow` on the core's side, `window.parent` on the page's), and a shape check per message type.
- **Why**: this is the concept's section 7.6 as written; `router.replace` inside the frame never adds a history entry.
- **Alternatives**: `BroadcastChannel` — no window to check the source of.

## R7. The watermark

- **Decision**: a core action `ReadWatermarkAction` (`GET /api/v1/organizations/{code}/watermark`) reads the database function `watermark(organization)`; `Frame` asks it every 5 seconds while a page without `at` is open, and sends `panel.watermark` when it changed.
- **Why**: every endpoint is an action; the presence connection of bystrovmaxim/gnomon#76 can carry it later.
- **Alternatives**: a WebSocket now — it comes with presence.

## R8. List nodes and control sources from the browser

- **Decision**: `Frame` calls `/p/<owner>/api/<code>/lists/<source>?<scope>&at=…&limit=50&after=…` from the browser; the gateway turns the session cookie into the plugin's token, as for any page of the plugin. A control's `source` and `counts` are called the same way.
- **Why**: the gateway already does exactly this; the core's backend need not proxy a plugin.
- **Alternatives**: a core action that calls the plugin — a second door to the plugin beside the gateway.

## R9. The canvas

- **Decision**: `<MaxitorCanvas>` is a transformed layer (`translate` and `scale`) over a dotted field whose `background-position` and `background-size` follow the camera, made from maxitor-web's `lib/wheelGesture.ts` (wheel and two-finger swipe move, Ctrl/⌘ or a pinch zooms around the pointer), its `useSvgPanZoom` limits and its `ZoomToolbar`. Keys: `+`, `-`, `0` fits, arrows move. Zoom from 0.1 to 4. `useCanvas()` gives `fit(bounds)`, `show(point)`, `toCanvas`, `toScreen`.
- **Why**: one piece of code for every plugin; the gestures are the ones readers already know from the ERD.
- **Alternatives**: an SVG `viewBox` canvas — it limits content to SVG.

## R10. The controls

- **Decision**: the core's `Controls` reads the open node's `controls` from the tree and draws them over the `iframe` in fixed places: `ModePill` (top centre), `ViewSwitch` (top right), `FilterPanel` (left, an accordion, one section open), `Legend` (bottom left); on a phone filters fold into a button and the view into a menu. Each writes its parameter into the window's address (`push`), drops a default value, and a filter lists the options on, none when all are on; the page hears it as `panel.location`. Made from maxitor-web's `ModePill`, `ErdFilterPanel`, `DomainLegend`.
- **Why**: the concept's section 7.8; the controls are address parameters, so Back and links work for them by themselves.

## R11. The test page

- **Decision**: a page of the core's application at `/panel-test/<code>`, drawn with `@maxitor/panel`, opened by the address `/w/<code>/core/panel-test` for an administrator only: the frame lays it in the `iframe` as it does a plugin's page, with a fixed set of controls (a mode pill, a view switch, a filter, a legend) and a canvas scene. The browser check drives the protocol, the canvas and the controls on it.
- **Why**: the protocol and the controls are checked without any plugin running.

## R12. The gateway's two rules of the panel

- **Decision**: the gateway answers a document request (`Sec-Fetch-Dest: document`) to `/p/<name>/<organization>/**` with a redirect to `/w/<organization>/<name>/**`, and adds `Content-Security-Policy: frame-ancestors 'self'` to every answer of `/p/**`.
- **Why**: the concept's section 7.6; a page of a plugin is only ever seen inside the panel.

## R13. The template in step

- **Decision**: the template's frontend depends on `@maxitor/panel` and `@maxitor/tokens` by path; its notes page draws its list with `Card` and its table with `DataTable` of `@maxitor/panel`; `RoomLayer` and `room.shared` effects wait for bystrovmaxim/gnomon#76; Published notes and Draft are pages that say what they will show. Its wheel is built with the frontend (`npm run build` before `uv build`), and the local stand runs it.
- **Why**: FR-038 – FR-041.
