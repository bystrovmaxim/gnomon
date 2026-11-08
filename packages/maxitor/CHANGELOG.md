# Changelog

All notable changes to `maxitor` (until 2.3.0 published as `aoa-maxitor`) are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **Maxitor has a repository of its own**, [bystrovmaxim/gnomon](https://github.com/bystrovmaxim/gnomon), with the Open Gnomon Protocol beside it. The package, its commands and its extras are unchanged; the GitHub Action of `graph-builder` is now `bystrovmaxim/gnomon/packages/maxitor/tools/graph-builder@maxitor-v<version>`, and the setup skill installs from this repository.

### Fixed

- **A domain's ERD frames only its own resources.** In the physical view the ERD of one domain drew a frame for every resource of the model — on the AOA demo 29, almost all of them empty — though a resource that keeps none of the domain's tables has nothing to do with it. It now frames only the resources that keep the domain's tables or their 1-hop neighbours, and its Resources filter lists the same; the ERD of all domains still frames every resource, an empty one too. ([#78](https://github.com/bystrovmaxim/gnomon/issues/78))

### Added

- **The ERD has a logical view and a physical one.** A pill at the top of the ERD switches between them, each with what it frames counted beside it, and the address keeps the choice as `model=logical` or `model=physical`. The logical view shows what the business is made of: a frame per domain, its entities and the relations between them, and nothing about databases. The physical view shows where the data lies: a frame per resource of the model — one that keeps nothing too, empty — with a frame inside it for each domain whose entities it keeps. An entity kept in several databases is drawn in each, marked `×2` or more, its copies joined by a dashed line, and hovering one lights them all; a relation is drawn between every pair of copies, dashed where it crosses from one database to another, since only an action can join that data; entities kept nowhere gather under **Not stored**. A table's card names its domain and every resource that keeps it, comparing two versions marks a table whose set of resources changed, and a room shares the view. The data source is gone from every screen with **Boundary**, which the physical view replaces; an old address that still carries them opens as if it did not. A graph older than protocol 1.6 does not say where entities lie, so its Physical half is disabled and says why. Maxitor itself now runs on the AOA where a resource is a database: its graph store lists the entity it builds, and every resource is named by its kind. ([#67](https://github.com/bystrovmaxim/gnomon/issues/67))
- **Protocol 2.0: a resource names its entities.** The graph builder and the comparison read graphs of protocol 2.0, in which a resource — a database — names each entity it keeps by a `resource_entity` edge, and there is no data source; every 1.x version is read as before. Maxitor's store keeps one table of links from a resource to the entities it keeps, filled from a 2.0 graph directly and from the `entity_resource` edges of a 1.6–1.8 graph turned around, so the ERD's resources and contours look the same at any of these versions; where several resources keep one entity, the ERD draws it in the first by id. Maxitor reads no data source any more: a graph of 1.7–1.8 opens as one of 1.6 would, without the Data sources sections, the outer contours and the ERD per data source and per resource, and `list-entities` names no data source. The constitution's data-model rules say the same (version 1.5.0): a resource is a database and names its entities, a relation may join entities of any resources, and the pool is the application's choice.
- **Contours are easier to use.** The control that folds a contour stays 16 pixels on screen at any zoom, takes a click over a wider area and says "Fold" or "Unfold"; on a folded box it stands beside the box, clear of its name. Resting on a resource contour or a folded box opens a card like a table's: the icon the full graph draws — the full graph now draws a data source with an icon and colour of its own —, the name, where it lives, its description and the tables it holds, folded at first. A room shares the hover and the card of a folded box and of a line between folded boxes, and Side by side passes such a line to the other half by its two ends. Moving the diagram no longer makes the fields lag behind their tables.
- **The ERD follows the logical data model.** A graph of protocol 1.8 relates entities of any databases, and every resource that stores an entity names its data source. With Boundary on, a relation line may now leave a data source's contour for another's, so the reader sees which parts of the model live in which store and which relations join two stores — on the AOA demo, the billing warehouse's chargeback ticket points at the shop database's order, and hovering the warehouse's contour lights that line. "No data source" appears only for graphs of 1.6–1.7. Maxitor's own model follows the rules too: its graph rows live in `GraphDataSource`, the DuckDB kept in its process, and its own graph is 1.8. Maxitor builds on AOA `c879d38d`, and the constitution's rules 24, 25 and 26 say the data model is logical (version 1.4.0).
- **The ERD shows where each entity is stored.** A graph of protocol 1.6 says which resource — a database, for one — stores each entity, and AOA keeps every relation inside one resource, so the tables of a resource are the whole data model of that store. The filter panel gains a **Resources** section, shown even for one resource; switching one off hides its tables. **Boundary**, beside 1-hop, draws each resource's tables inside one rounded contour with the resource's name in its header, and a specialization block inside its contour; it starts on. The gear shift paints by resource too. A resource's colour comes from the server and depends on the graph alone, so it is the same on every diagram and for everyone in a room, and a room shares the resources switched off, Boundary and the paint; the address carries them (`off_resources`, `boundary`, `paint=resources`). A table's card reads `Resource: <name>`. In a comparison a table counts as changed by its resource only when both versions name one and they differ, so comparing a 1.5 graph with a 1.6 one marks nothing. `list-entities` gives each entity `resource_id` and `resource_label` and lists the graph's `resources` with their colours. A graph older than 1.6 looks as before. Maxitor's own entity, `NodeCoreEntity`, is stored by `DuckDBGraphResource`, and Maxitor builds on AOA `537c61d4`.
- **Data source contours read, copy, fold, and have a place of their own.** On the ERD with Boundary on, a data source's name is written once, in its contour's header, and clicking a resource's or a data source's name copies it. Every contour folds into one box with a click on the faint minus in its corner: the box names what it holds, a table still drawn keeps a line of its own for each relation to it, and the relations between two folded boxes become one line, wider with their number and plated with it (`×3`); hovering that line lists its relations, clicking it unfolds both ends. The folded contours travel in the address (`folded`) and a room shares them, as it now also shares Boundary, the resources and data sources switched off, and painting by them. The left panel gains **Data sources**, after Domains, for a graph that has one: each data source holds the ERD of the whole data source and one per resource, and **No data source** one per resource that names none; such an ERD draws exactly the tables stored there (`data_source=` / `resource=` in the address).
- **Hovering a resource contour shows what the resource links to.** On the ERD with Boundary on, resting the pointer on a resource contour's border or name lights every line from one of its tables to a table of another resource, keeps the tables at both ends bright, widens the border, and dims everything else — everything, when the resource has no such line. The hover label is the resource's full id, and a room shares the hover, so a follower sees the same lines lit.
- **The ERD shows the databases resources share.** A graph of protocol 1.7 says which resources work with one database — its data source — and AOA keeps every relation inside one data source, or inside one resource that names none. With Boundary on, the resources of one data source are drawn inside one outer dashed contour headed by the data source's name, so a relation between tables of two resources of one database stays inside it. The filter panel gains a **Data sources** section — one row per data source of the diagram and one **No data source** row — shown only when the diagram has one; a Resources row names its data source beside it. The gear shift paints by data source, in a colour the server gives from the graph alone. A table's card reads `Resource: <name> · Data source: <name>`. The data sources switched off are a page setting a room shares and the address carries (`off_data_sources`). `list-entities` gives each resource its `data_source_id` and lists the graph's `data_sources` with their colours. A graph of 1.0–1.6 looks as before. Maxitor builds on AOA `9bd61c82`, and the constitution's resource rules 24, 26 and 53 cover the data source (version 1.3.0).
- **The logical data model**: the graph builder and the comparison read graphs of protocol 1.8, in which a relation may join entities of any data sources and every resource that stores an entity names its data source, so a graph written at 1.8 is checked and compared.
- **Resources that share a store**: the graph builder and the comparison read graphs of protocol 1.7, which adds the node `DataSource` and the edge `resource_data_source` from a resource to it, so a graph written at 1.7 is checked and compared.
- **Where an entity is stored**: the graph builder and the comparison read graphs of protocol 1.6, which adds the edge `entity_resource` from an entity to its resource, so a graph written at 1.6 is checked and opens in Maxitor.
- **A cache stored entity by entity**: Maxitor reads graphs of protocol 1.5 — the `Cache` kind `entity_key` and the edge `@cache_entity_key`. The graph builder and the comparison read 1.5 as well.
- **The cache in the graph**: Maxitor reads graphs of protocol 1.4 — the `Cache` node of each cache declaration, drawn with a glyph and colour of its own, and the edges `@cache_key`, `@cache_read`, `@cache_write`, `@cache_invalidate`, `caches` and `invalidates`. The graph builder and the comparison read 1.4 as well.

### Changed

- **Loading a graph returns its text, not the DuckDB graph**: `LoadAOAServiceAction` downloads, checks and summarizes a service's graph, and its Result carries the graph's JSON text; the server builds the DuckDB graph from that text. A Result holds only values with a JSON form, and AOA's graph build now refuses one that does not. A broken graph still fails the load as before.

### Added

- **`repo-graph-port` follows a moved file**: when the folder of a graph file or a version file moves, the port asks git where the file was and reads each older version there, so the history keeps everything before the move — for a public link too. `graph_file_before` and `version_file_before` remain for a move git cannot see.
- **A history is called by what you opened**: the folder that holds its graph file, or the repository for a graph at its root, instead of the repository for every graph in it; a private history keeps its id. The name heads the version picker, titles the tab and stands in Recent; rest on it to read its full path, click it to copy the path.
- **Maxitor explores events step by step.** The Events pages open on one layer — every domain, every event, or every action that emits, as a pill at the top chooses — and you follow the graph link by link through ports, each showing what it leads to and how many. A domain tells how many events its vocabulary holds (an empty vocabulary is still one), or how many it emits without one; its actions port shows all its actions, so you see what events do not cover yet. A path passes each kind once: the second layer leads on to the kind not yet on the path, and the third joins back to what is already on the screen, so from an event you reach the actions of a domain and see which of them emit it. Filters fit what is on the screen — domains, coverage, the standing of events, kinds of method, actions with or without events — and any of them can paint it. Rest on a line to read its method, on an event to read its fields, producers and domains. A comparison of two versions paints the changes and counts them on closed ports, so none hides behind one; the address keeps what you opened.
- **Maxitor opens a graph's history** served by `repo-graph-port` and shows any version: a version button and a picker with a time axis — its handle dragged to a version in One as in Diff — of merged pull requests, direct pushes, open pull requests by review state and Live; version numbers from tags, release flags, a card per point with who made and merged it, its size and its graph change; the address bar carries the key, so copying it shares the view. `repo-graph-port` adds each version's contribution and graph change, pull requests read from merge commits, and the open pull requests.
- **`repo-graph-port`**, a service that reads a graph's history from its repository: versions with their pull requests, tags and releases, and any version's graph; read keys for private repositories through a GitHub App, links for public ones, GitHub's webhooks, and without them a fetch on read once ten minutes have passed. `pip install "maxitor[repo-graph-port]"`, command `repo-graph-port`.

### Changed — breaking

- **The GitHub Action is at `packages/maxitor/tools/graph-builder`** (was `tools/graph_builder`); the folders of Maxitor's parts are `maxitor-web`, `tools/repo-graph-port` and `tools/graph-builder`. Imports, commands and extras are unchanged.
- **The setup skill sets up versions and graphs**, either or both, and audits the project on every run; release tags are no longer required.
- **The setup skill is `aoa-graph-builder-setup`** (was `graph-builder-setup`): after its survey it asks one question at a time, with options — where each graph goes, how CI checks every graph, which check run writes them — then shows one table of what is and what will change and goes on only with the user's consent; it proposes a workflow when the project has no CI, and pins a commit until a release exists.
- **The web part is `front`**: extra `front` (was `viewer`), command `maxitor` (was `maxitor-api`), import `maxitor.front` (was `maxitor.viewer`).

## [3.0.0] – 2026-10-29

### Changed — breaking

- **One package, `maxitor`, with parts chosen by extras.** `pip install maxitor` is the `graph-builder` command alone (no AOA, no server); `maxitor[viewer]` adds the app; `maxitor[all]` both. Until 2.3.0 the app was `aoa-maxitor`, and the command was `maxitor-gnomon` 0.1.0.
- **Imports**: the app is `maxitor.viewer` (was `aoa.maxitor`), the command `maxitor.graph_builder` (was `maxitor_gnomon`).
- **The command** is `graph-builder` (was `gnomon`), its config `graph-builder.toml` with `graph_builder = "1.0"` (was `gnomon.toml` with `gnomon = "1.0"`), its skill `graph-builder-setup` (was `gnomon-setup`). Graph files are unchanged.
- **The CI step** is `uses: bystrovmaxim/aoa/packages/maxitor/tools/graph_builder@<ref>`; it no longer installs the project's environment — the steps before it do, in whatever language the project is.
- **The protocol's schemas** live in `packages/open-gnomon-protocol`, a folder with no code; their `$id` is the raw address of each file.

## [2.3.0] – 2026-10-27

### Added

- **Rooms: look at one service together.** **Open room** gives a link; whoever opens it gives a name and joins. Everyone sees the others' pointers on the same spot of the diagram at any zoom, filters and layout modes are shared per page, a click on someone's circle goes to them, and **Follow** keeps your screen where theirs is, at your own zoom and never in a circle. The link is the invitation and names are not verified; a room holds 20 people and ends two minutes after its last person leaves. Rooms run over the WebSocket route `/api/v1/rooms/{room_id}/live`; a proxy in front of Maxitor must pass WebSockets through and keep the page's `Host` (README, *Production*). ([#271](https://github.com/bystrovmaxim/aoa/issues/271))

- **Held graphs stay current.** While someone looks at a graph, Maxitor asks its service whether it changed — every 30 seconds with `ETag` or `Last-Modified`, every 2 minutes by the body's SHA-256 — rebuilds a changed one in the background and swaps it in only after a successful build; a service that is down keeps the graph. Open pages redraw in place. `GET /api/v1/graph-fingerprint` and `GET /api/meta/app-info` are new. ([#271](https://github.com/bystrovmaxim/aoa/issues/271))

- **The same layout everywhere**, proven in the check run across Chromium, Firefox and WebKit and two screen sizes; a remembered full-graph arrangement is laid out once more. ERD tables take the new style, and the left panel shows a project link and the running version. ([#271](https://github.com/bystrovmaxim/aoa/issues/271))

### Changed

- **A built graph stays until `MAXITOR_MAX_GRAPHS` is reached.** The idle removal and `MAXITOR_GRAPH_IDLE_SECONDS` are gone. `MAXITOR_ROOM_ORIGINS` lists extra browser origins allowed to join a room. Requires `aoa-fastapi-adapter` 1.3.0 or later. ([#271](https://github.com/bystrovmaxim/aoa/issues/271))

## [2.2.0] – 2026-10-27

### Added

- **Entity kinds come from the graph, and the ERD filters by them.** A graph names the kinds it holds and the name of each, and Maxitor keeps no list of its own: it shows whatever the graph says, calls an unnamed kind by its word with a capital letter, and lists an entity with no kind as unknown, so older graphs still open. `GET /api/v1/list-entity-kinds` returns the kinds of the loaded source. The ERD's one filter panel folds Domains and Kinds, one section open at a time, and each row hides or shows its tables; each table's header carries its kind's icon. ([#239](https://github.com/bystrovmaxim/aoa/issues/239))

- **Every line between two tables on screen is drawn, and every association is one line.** A line no longer goes missing when its two ends are neighbours or come from two domains shown together. A relation and its declared inverse are one line with `source_field` and `target_field`, drawn with a bar for one end, a crow's foot for many, and the field name at each side. `list-entities` also returns the request-wide relations list, and hovering a line marks the fields at both ends while clicking a table or field name copies it. ([#239](https://github.com/bystrovmaxim/aoa/issues/239))

### Changed

- **A relation field's type is the target table's name.** The `FK -> ` prefix is gone, and a dictionary field's type no longer repeats the dictionary's name after an arrow: the line says it. The eighth domain colour is orange instead of grey, which is left to entity kinds. ([#239](https://github.com/bystrovmaxim/aoa/issues/239))

## [2.0.0] – 2026-10-26

### Breaking changes

- **Every graph read names its source.** `GET /api/v1/*` and `GET /api/sidebar` require `?source=<graph-json URL>`; a read without it answers `400` naming the missing parameter, and the sidebar no longer answers an empty payload when nothing is loaded. `POST /api/load` now rebuilds the source it names instead of loading one graph for the whole process, and `GET /api/health` also reports `graphs_held`, `builds_running` and `builds_queued`. ([#214](https://github.com/bystrovmaxim/aoa/issues/214))

### Added

- **One graph per source.** The process keeps one built graph per AOA service: a cold read builds it once, repeat reads cost nothing, an unread graph is removed after an hour, at most 50 are held and at most 4 builds run at once. Deep links still open the graph they name in one step, a new "Reload from service" button rebuilds only the open source, and a busy server is retried by the page instead of being reported as a broken service. ([#214](https://github.com/bystrovmaxim/aoa/issues/214))

### Changed

- **Dictionary cards show their fields, not their values.** An entity diagram no longer draws a row for every value a dictionary declares: the card is the dictionary's name and its own fields, with the arrows that reach it and nothing in place of the values. A region catalogue of ninety-three entries stops deciding how tall a domain's drawing is. The graph export and the entity endpoint keep every value with its code, label and descriptive properties, and a saved graph renders without a rebuild. ([#265](https://github.com/bystrovmaxim/aoa/issues/265))

- **Dictionary references connect entity cards.** Graph imports carry catalogue values and field hints beside the relation to a dictionary card. Newly rebuilt complete selections use ordinary association edges; earlier exports may contain special reference edges. The current query duplicates the retained dictionary field row and synthesized FK row for the ordinary-association form; row merging has not been delivered. See the [reproduction](https://github.com/bystrovmaxim/aoa/blob/main/docs/reports/complete-relationship-verification.md#dictionary-fields-in-maxitor) before relying on one row per field. ([#256](https://github.com/bystrovmaxim/aoa/issues/256))

- **Dictionary cards emphasize human labels** — Value rows print labels and descriptive properties, while codes remain in tooltips. The inherited code and display-name fields are omitted from ordinary dictionary field rows; other entity fields are preserved. Existing reference payloads retain their codes. See the [diagram guide](https://github.com/bystrovmaxim/aoa/blob/main/docs/tutorials/step-29-maxitor.md). *The value row described here was removed by the entry above; the field-row rule stands.*

### Changed

- **Dictionary descriptions reach the diagram consistently.** Dictionary cards preserve exported properties, including formatted dates and collection values, as readable text. Specialization groups display one complete label supplied by the server, so the dictionary name no longer appears twice. Existing graph files that already contain these properties need no rebuild. ([#244](https://github.com/bystrovmaxim/aoa/issues/244))
- **Dictionaries are visible in the model.** Entity diagrams show a dictionary’s values, names and descriptive properties inside its card, and identify fields that refer to it. Specialization groups name their dictionary and keep its declared order, without a duplicated selector column on the head. ([#241](https://github.com/bystrovmaxim/aoa/issues/241))
- **The graph carries the meaning of each entity.** Maxitor now preserves the entity kind declared by the model, so graph consumers can distinguish business objects, technical connections, owned parts, specializations and reference values. Regenerate older graph exports before loading them. Automatic hiding of technical connections is not included in this change. ([#210](https://github.com/bystrovmaxim/aoa/issues/210))
- **Lifecycle diagrams use state descriptions.** States now receive human names, an optional display order and optional outline and fill colours from the model. Initial states stay first; without presentation settings, the existing ordering and palette remain. Other domain fields stay available in the full graph rather than being copied into the diagram response. ([#209](https://github.com/bystrovmaxim/aoa/issues/209))

- **A table on the entity diagram is one shape.** The band above a table's fields and the tinted rows that mark its primary and foreign keys used to keep their square corners, so every card wore small tabs where the colour ran past its rounded outline. The colour now follows the outline: the band's upper corners sit on the arcs and a tinted last row follows the lower ones, while the small gap the drawing always left between a fill and the border stays exactly as it was. Everything else about the card is what it was — the outline, the colours, the text, the arrows and the canvas — and the lifecycle and use-case diagrams are untouched. ([#226](https://github.com/bystrovmaxim/aoa/issues/226))

## [1.3.0] – 2026-10-17

### Added

- **Entity specialization in diagrams.** The entity diagram now shows which kinds of details an entity can have: for example, move details or assignment details for an event. Alternatives appear together in a frame, while the field lists their codes and the field that distinguishes them. The frame groups alternatives visually; it does not represent another entity. ([#199](https://github.com/bystrovmaxim/aoa/issues/199))

### Changed

- **The six diagram endpoints declare the one graph they share.** Maxitor keeps one coordinator graph per process — the one `POST /api/load` builds from a service URL — and every diagram endpoint reads it: the domain list, the entity list, the node types, the full graph, the lifecycle automaton and the use-case diagram. That graph is now handed to them as a single shared resource, declared once, instead of as a resource recreated for every request. The declaration and the behaviour finally agree, and a second load still replaces the graph for everyone at once. Once a graph is loaded the endpoints answer exactly what they answered before. Before one is loaded the answers are also unchanged, with a single exception worth knowing: an endpoint that never reads the graph no longer fails merely because nothing is loaded — the entity list asked without a domain filter answers an empty result rather than an error. ([#213](https://github.com/bystrovmaxim/aoa/issues/213))

## [1.1.6] – 2026-07-11

### Added

- **URL deep-linking for the Maxitor SPA.** `?source=<service-url>&view=<full-graph|domain-erd|use-case|lifecycle-fsm>[&domain=|&node=&host=]` loads the given service and lands directly on the given view — `use-case`/`lifecycle-fsm` opened without their qualifier fall back to the first matching sidebar row once it loads. Every subsequent navigation (sidebar click, loading/switching service) pushes a browser history entry and updates the URL, so Back/Forward step through visited diagrams one at a time (reloading the graph server-side if needed) and the current URL is always copy-paste shareable. ([#126](https://github.com/bystrovmaxim/aoa/issues/126))
- **Mobile-responsive layout for the Maxitor SPA.** Below the `sm` breakpoint the sidebar becomes an off-canvas overlay drawer (was a permanent panel eating 48-255px of a narrow viewport) with a menu button to open it and auto-close on diagram selection. ERD/use-case/lifecycle views (Graphviz SVG) gained touch pan and two-finger pinch-zoom — previously mouse-only despite `touchAction: "none"` silently blocking native touch with nothing replacing it; the Full Graph view (G6 canvas) already had native touch support via G6 v5 and needed no change. Zoom toolbar buttons grow from 30px to 44px on mobile to meet minimum touch-target guidance. The "Node types" / "Domains" legend panels, previously pinned open and covering most of a narrow canvas, now start collapsed to a small pill on mobile and expand on tap. ([#125](https://github.com/bystrovmaxim/aoa/issues/125))
- **Copy button on recent service URLs.** Hovering a row in the "AOA Service URL" panel's recent-history list reveals a copy-to-clipboard button (also reachable via keyboard focus), independent of the row's own click-to-load action.

## [1.1.4] – 2026-07-10

### Fixed

- **`GetLifecycleFiniteAutomatonAction` reads FSM from DuckDB instead of local class import.** Previously the action called `importlib.import_module` on the entity class qualname, which fails in standalone deployments (`pip install aoa-maxitor`) where the target service's Python packages are not installed. Rewritten as a five-aspect pipeline — parse interchange id → validate Lifecycle vertex → load states → load transitions → assemble FSM payload — querying the already-loaded DuckDB graph (`lifecycle`, `state`, `lifecycle_contains_state_edges`, `lifecycle_transition_edges` tables); no local entity classes required. Aspect-level unit tests added. ([#101](https://github.com/bystrovmaxim/aoa/issues/101))

## [1.1.3] – 2026-07-09

### Fixed

- **Frontend built with relative API paths.** Removed hardcoded `VITE_MAXITOR_API_BASE_URL=https://aoa.run/maxitor` and `--base=/maxitor/` from CI build; frontend now uses `--base=/` and relative `/api/` paths, making the package deployable at any domain or IP without rebuilding.
- **`LoadAOAServiceAction` accepts arbitrary endpoint URLs.** Previously the URL normalization always appended `/examples/model/graph-json`, making it impossible to load from services with a different path (e.g. `/api/model/graph`). Now any URL with an explicit path is used as-is; the default AOA path is appended only when a bare host URL is supplied.

## [1.1.2] – 2026-07-09

### Changed

- **Dependencies updated to current PyPI releases.** `aoa-action-machine>=1.0.1a0` (was `>=1.0.0a4`), `duckdb>=1.5,<2` (was `>=1.1,<2`), `httpx>=0.28,<1.0` (was `>=0.27,<1.0`).

## [1.1.1] – 2026-07-08

### Fixed

- **Dependency `aoa-action-machine` pinned to non-existent stable version.** Changed `==1.0.0` → `>=1.0.0a4` so the package installs correctly from PyPI where only alpha releases are available. Similarly tightened `aoa-fastapi-adapter>=1.0.0a0` → `>=1.0.0`.

## [1.1.0] – 2026-07-08

### Added

- **Bundled React SPA.** The compiled Vite frontend (`src/aoa/maxitor/static/`) is now included in the wheel via hatchling `artifacts`. `pip install aoa-maxitor` delivers both the API backend and the complete web UI — no Node.js required on the server.
- **`StaticFiles` mount.** `create_app()` now mounts the bundled SPA at `/` (after all API routes) using FastAPI `StaticFiles(html=True)`, enabling SPA client-side routing fallback. The mount is skipped gracefully if the static directory is absent (dev environment without a built frontend).
- **`uvicorn>=0.30` added to runtime dependencies.** Previously an implicit transitive dependency; now declared explicitly so `pip install aoa-maxitor` pulls a working ASGI server.

### Deployment note

The frontend is built with `--base=/maxitor/` and `VITE_MAXITOR_API_BASE_URL=https://aoa.run/maxitor`. Nginx should proxy `location /maxitor/ { proxy_pass http://127.0.0.1:8101/; }` — the prefix is stripped before reaching uvicorn.

## [1.0.1] – 2026-06-27

### Changed

- **Test suite relocated into the package (`packages/aoa-maxitor/tests/`).** Maxitor unit tests moved out of the shared root `tests/maxitor/` into the package's own `tests/` directory, so the package is self-contained: test dependencies are declared in its `[dependency-groups]` dev group and pytest is configured via its own `[tool.pytest.ini_options]` (`testpaths`, `asyncio_mode`, `pythonpath`). The skipped integration test `test_load_aoa_service_action_integration.py` lives in the package alongside the maxitor unit tests (skipped by default — it requires a running `aoa-examples` service). ([#82](https://github.com/bystrovmaxim/aoa/issues/82))

## [1.0.0] – 2026-06-24

### Added

- **`LoadAOAServiceAction` — five-aspect DuckDB loader for the AOA coordinator graph.** Accepts a bare base URL or full endpoint URL; empty/whitespace input rejected by Pydantic. Aspects in order: validate URL format → normalize to canonical `coordinator-json` endpoint → validate HTTP reachability → parse coordinator JSON structure → build `DuckDBGraphResource`. 24 unit tests cover all aspects and Pydantic validation; integration test included but skipped by default (`@pytest.mark.skip`). ([#78](https://github.com/bystrovmaxim/aoa/issues/78))
- **`POST /api/load` — on-demand graph loading endpoint.** Accepts `{"service_url": "..."}`, runs `LoadAOAServiceAction` + `GetLeftMenuSidebarDataAction`, and stores results in `app.state`. The server no longer auto-loads a graph on startup; the graph is loaded only when the user provides a URL. `GET /api/sidebar` returns an empty payload when no graph is loaded. ([#78](https://github.com/bystrovmaxim/aoa/issues/78))
- **Left sidebar: URL input with recent history.** When no graph is loaded, the sidebar shows an `AOA Service URL` text field with an inline load button. The last 10 successfully used URLs are persisted in `localStorage` and shown below the input as a quick-select list. ([#78](https://github.com/bystrovmaxim/aoa/issues/78))
- **Left sidebar: switch-service button.** When a graph is loaded, a thin-stroke swap-arrows icon button appears in the sidebar header next to the collapse toggle. Clicking it clears the loaded graph from local state and returns to the URL input screen. ([#78](https://github.com/bystrovmaxim/aoa/issues/78))

### Changed

- **`GetLeftMenuSidebarDataAction` rewritten as a four-aspect DuckDB pipeline; `networkx` dependency removed.** The action no longer depends on `networkx`. Four `@regular_aspect` methods build sidebar `NodeEntity` lists in stages — level-1 root bucket nodes → level-2 fixed diagram rows → level-2 interchange nodes from DuckDB → level-3 per-domain ERD and per-entity class/lifecycle rows — with a `@summary_aspect` assembling the final `Result`. String helpers `_diagram_view_label` and `_lifecycle_state_machine_row_title` are `@staticmethod` methods on the class; aspect-level unit tests added. Deleted files: `api/session.py`, `node_build.py`, `interchange_demo_coordinator.py`, `model/diagrams/actions/load_graph_action.py`. ([#78](https://github.com/bystrovmaxim/aoa/issues/78))

## maxitor-gnomon

`maxitor-gnomon` joined `maxitor` in 3.0.0 as its `gnomon` part. Its one release, kept here as it was written:

### [0.1.0] – 2026-10-28

#### Added

- **The Open Gnomon Protocol, versions 1.0 and 1.1** — a shared language for describing a project's model as a graph, one JSON Schema per version in `protocol/`; a published version never changes. ([#301](https://github.com/bystrovmaxim/aoa/issues/301))
- **`gnomon write` and `gnomon check`** — each service's model kept in one `graph.json`, rebuilt from the code and checked in CI; a stale file fails with its differences, matched by `id`. **`gnomon validate`** tells a graph from anything else; **`gnomon skill`** prints the setup skill. ([#301](https://github.com/bystrovmaxim/aoa/issues/301))
- **`gnomon.toml`**, the repository's list of graphs, with refusals that name the graph and the field. ([#301](https://github.com/bystrovmaxim/aoa/issues/301))
- **The `gnomon-setup` skill** — connects a project to the protocol: surveys every service, proves its export (adding an exporter where needed), asks, then writes the config, the graphs and the CI check; never commits. ([#301](https://github.com/bystrovmaxim/aoa/issues/301))
