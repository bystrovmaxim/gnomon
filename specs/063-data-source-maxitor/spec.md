# Feature Specification: The constitution and Maxitor cover data sources

**Feature Branch**: `feature/issue-52-data-source-maxitor`

**Created**: 2026-11-06

**Status**: Draft

**Input**: Issue #52, "Data source 4/4: the constitution's resource rules and Maxitor cover data sources". Protocol 1.7 (#51) adds the `DataSource` node and the `resource_data_source` edge; AOA writes them and checks every rule (bystrovmaxim/aoa#475); the AOA demo has three databases (bystrovmaxim/aoa#476).

## What this is

Resources of one database may share a data source, and their entities may relate. The constitution's resource rules say how a service declares that; Maxitor reads the new rows and draws them on the ERD. Maxitor checks no model rule: it only reads a graph the schema accepts.

## Clarifications

### Session 2026-11-06

- Q: How are the constitution's rules changed? → A: Rules 24, 26 and 53 are amended in place, so no rule number moves: rule 24 gains the boundary of relations, rule 26 the data source (one per database, a pool only in it, the transaction in the resource, the application creating it), rule 53 reads the data source as the framework's own layer. Version 1.2.0 → 1.3.0.
- Q: How does the ERD show a data source? → A: With Boundary on, the resources of one data source are drawn inside one outer dashed contour headed by its name, each resource in its own contour inside; a relation may cross a resource contour, never a data source contour. A resource with no data source keeps its single contour.
- Q: What does the listing return? → A: Each listed resource carries `data_source_id` (or null), and the answer lists `data_sources` — those the listed resources name, sorted by id, each coloured by its place, whatever domains are asked for.
- Q: The filter? → A: A Data sources section beside Resources, with one row per data source of the diagram and one "No data source" row for the resources that name none; it stands only when the diagram has a data source. Switched off rows are the page setting `disabled_data_sources`, carried by the address as `off_data_sources` and shared by a room. A Resources row names its data source beside it (`Orders · ShopDataSource`).
- Q: Painting? → A: A point "Data sources" on the gear shift; tables of resources without one take the neutral grey.
- Q: The card? → A: A table's card reads `Resource: <name> · Data source: <name>` or `· No data source` when the graph has data sources.
- Q: The graph history? → A: The comparison reads 1.7 since #51: a data source appearing, disappearing, or a resource gaining or changing its `resource_data_source` edge is reported as the added, removed or changed row it is.

## Requirements

- **FR-001**: The constitution's rules 24, 26 and 53 cover the data source; version 1.3.0.
- **FR-002**: DuckDB loads `DataSource` nodes into `data_source` and `resource_data_source` edges into `resource_data_source_edges`; a graph of 1.0–1.6 leaves both empty.
- **FR-003**: The entity listing returns each resource's data source and the data sources with their colours.
- **FR-004**: The ERD draws data source contours around their resources, offers the Data sources section with "No data source", paints by data source, and names the data source on the card and in the Resources rows; all shared in a room and carried by the address.
- **FR-005**: A graph of 1.0–1.6, or one with no data source, draws the ERD as before.
- **FR-006**: Maxitor moves to the AOA commit that merged bystrovmaxim/aoa#476, and its own graph is 1.7.
- **FR-007**: Every changed level raises its version; documentation and changelog.

## Success Criteria

- **SC-001**: The DuckDB, listing, filter, DOT and card tests pass; the browser checks pass on the AOA demo graph.
- **SC-002**: A 1.6 graph draws the ERD exactly as before.
