# Documentation

How-to guides for Maxitor and its tools. Each package also has its own README: [Maxitor](../packages/maxitor/README.md), [`graph-builder`](../packages/maxitor/tools/graph-builder/README.md), [`repo-graph-port`](../packages/maxitor/tools/repo-graph-port/README.md), [Maxitor core](../packages/maxitor/maxitor-core/README.md), [`maxitor-plugin-sdk`](../packages/maxitor-plugin-sdk/README.md) and the [Open Gnomon Protocol](../packages/open-gnomon-protocol/README.md).

## Plugins

- [The plugin concept](plugins/concept.md) — what a Maxitor plugin is and how it lives in the core: the passport, compatibility, delivery, the database, one sign-in, the frame, rooms, the lifecycle, the rules, and a tutorial on the plugin template.
- [Versioned storage](plugins/versioned-storage.md) — how tables, versions and time are kept so that any past moment reads by the same actions as the present, shown on the template's notes.

## How-to guides

- [Set up versions and graphs](how-to/graph-setup.md) — the setup wizard of `graph-builder`, for a project in any language.
- [Run repo-graph-port](how-to/run-the-repo-graph-port.md) — serve a graph's history from its repository.
- [Run Maxitor core locally](how-to/run-the-core-locally.md) — sign in, register an organization and open its frame on your machine.
- [Open a graph's history](how-to/open-a-graph-history.md) — read the versions of a service's graph in Maxitor.
- [Compare two versions](how-to/compare-two-versions.md) — what changed between two versions, on every diagram.
- [Read the full graph as a map](how-to/read-the-full-graph-map.md) — the map of areas, bundles and close-ups.
- [Read a diagram without zooming](how-to/read-a-diagram-without-zooming.md) — the card every element shows under the pointer.

Learning AOA itself, including the tutorial chapter that opens an AOA service in Maxitor, lives in the [AOA documentation](https://github.com/bystrovmaxim/aoa/blob/main/docs/index.md).
