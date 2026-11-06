# packages/maxitor/maxitor-web/maxitor/web/model/core/actions/left_sidebar_action.py
"""
GetLeftMenuSidebarDataAction — left menu rows for diagrams from DuckDB.

════════════════════════════════════════════════════════════════════════════════
PURPOSE
════════════════════════════════════════════════════════════════════════════════

Four-aspect pipeline that builds flat ``NodeCoreEntity`` lists (by depth / role)
from a DuckDB graph resource so the UI can render roots, per-root diagrams,
domains, and each domain's diagram rows using ``parent_id`` links only. Every row
opens a diagram: what the graph holds is reached through the diagrams (spec 041).

Aspect sequence:
  1. build_level1    — hardcoded root bucket nodes
  2. build_level2_diagrams — hardcoded rows of the whole application
  3. build_level2_nodes   — the domains from DuckDB; with a data source, the Data sources root and its nodes
  4. build_level3_diagrams — per-domain ERD and use-case rows, one row per lifecycle, and the ERD of each
     data source and of each resource
  5. build_result (summary) — assemble Result from accumulated state

**Level-1 order matches** ``_ROOT_SECTIONS``;
clients must preserve ``Result.level1_nodes`` order. Level-3 rows use ``ordinal``
for stable sibling order; otherwise alphabetical by label, then id.
"""

from __future__ import annotations

from collections import Counter
from typing import Any, cast

from maxitor.web.model.core.entities.node_entity import NodeCoreEntity
from maxitor.web.model.diagrams.diagrams_domain import DiagramsDomain
from maxitor.web.model.diagrams.resources.duckdb_graph_resource import (
    DUCKDB_GRAPH_CONNECTION_KEY,
    DuckDBGraphResource,
)

from aoa.action_machine.auth import GuestRole
from aoa.action_machine.intents.aspects import regular_aspect, summary_aspect
from aoa.action_machine.intents.check_roles import check_roles
from aoa.action_machine.intents.checkers import result_instance
from aoa.action_machine.intents.connection import connection
from aoa.action_machine.intents.meta import meta
from aoa.action_machine.model import BaseAction, BaseResult, BaseState, ParamsStub
from aoa.action_machine.resources import Connections
from aoa.action_machine.runtime.tools_box import ToolsBox

_ROOT_SECTIONS: tuple[tuple[str, str, str], ...] = (
    ("applications_root", "Applications", "Application"),
    ("domains_root", "Domains", "Domain"),
)

#: The third root, after Domains, stood only by a graph that has a data source (protocol 1.7, spec 065).
DATA_SOURCES_ROOT = NodeCoreEntity(id="data_sources_root", parent_id=None, label="Data sources", type="DataSources")
#: The node under it that holds the resources naming no data source.
NO_DATA_SOURCE_ID = "no_data_source"

@meta(description="Build left-menu sidebar NodeCoreEntity lists from DuckDB graph.", domain=DiagramsDomain)
@check_roles(GuestRole)
@connection(
    DuckDBGraphResource,
    key=DUCKDB_GRAPH_CONNECTION_KEY,
    description="Coordinator graph in DuckDB (sidebar node/edge queries)",
)
class GetLeftMenuSidebarDataAction(BaseAction[ParamsStub, "GetLeftMenuSidebarDataAction.Result"]):
    class Result(BaseResult):
        level1_nodes: list[NodeCoreEntity]
        level2_diagrams: list[NodeCoreEntity]
        level2_nodes: list[NodeCoreEntity]
        level3_diagrams: list[NodeCoreEntity]

    # ─── String helpers ───────────────────────────────────────────────────────

    @staticmethod
    def _diagram_view_label(name: str) -> str:
        """Append ' view' to diagram display names (idempotent)."""
        base = str(name).strip()
        return base if base.endswith(" view") else f"{base} view"

    @staticmethod
    def _domains_holding(duck: DuckDBGraphResource, table: str) -> set[str]:
        """The domains with at least one member in ``table``, a fixed name of this module."""
        rows = duck.execute_fetch_dicts(f"SELECT DISTINCT de.target_id AS domain_id FROM domain_edges de JOIN {table} m ON m.id = de.source_id")
        return {str(r["domain_id"]) for r in rows}

    @staticmethod
    def _stored_resources(duck: DuckDBGraphResource) -> list[dict[str, Any]]:
        """Every resource that stores an entity, with its label and the data source it names (or ``None``), by label."""
        return duck.execute_fetch_dicts(
            """
            SELECT r.id AS id, r.label AS label, min(rds.target_id) AS data_source_id
            FROM resource r
            LEFT JOIN resource_data_source_edges rds ON rds.source_id = r.id
            WHERE EXISTS (SELECT 1 FROM entity_resource_edges rre JOIN entity e ON e.id = rre.source_id WHERE rre.target_id = r.id)
            GROUP BY r.id, r.label
            ORDER BY lower(r.label), r.id
            """
        )

    # ─── Aspect 1 ─────────────────────────────────────────────────────────────

    @result_instance("level1_nodes", list, required=True)  # type: ignore[untyped-decorator]
    @regular_aspect("Level-1 root bucket nodes (Applications, Domains).")
    async def build_level1_aspect(
        self,
        params: ParamsStub,
        state: BaseState,
        box: ToolsBox,
        connections: Connections,
    ) -> dict[str, Any]:
        _ = (state, box, connections)
        return {
            "level1_nodes": [
                NodeCoreEntity(id=root_id, parent_id=None, label=label, type=type_)
                for root_id, label, type_ in _ROOT_SECTIONS
            ],
        }

    # ─── Aspect 2 ─────────────────────────────────────────────────────────────

    @result_instance("level1_nodes", list, required=True)  # type: ignore[untyped-decorator]
    @result_instance("level2_diagrams", list, required=True)  # type: ignore[untyped-decorator]
    @regular_aspect("Level-2 fixed diagram rows of the whole application.")
    async def build_level2_diagrams_aspect(
        self,
        params: ParamsStub,
        state: BaseState,
        box: ToolsBox,
        connections: Connections,
    ) -> dict[str, Any]:
        _ = (box, connections)
        rows = sorted(
            [
                NodeCoreEntity(
                    id="application_interchange_graph",
                    parent_id="applications_root",
                    label=self._diagram_view_label("Full graph"),
                    type="graph",
                ),
                NodeCoreEntity(
                    id="application_all_erd",
                    parent_id="applications_root",
                    label=self._diagram_view_label("ERD all domains"),
                    type="erd_all",
                ),
                NodeCoreEntity(
                    id="application_all_use_cases",
                    parent_id="applications_root",
                    label=self._diagram_view_label("Use case all domains"),
                    type="use_case_all",
                ),
                NodeCoreEntity(
                    id="application_all_events",
                    parent_id="applications_root",
                    label=self._diagram_view_label("Events all domains"),
                    type="events_all",
                ),
            ],
            key=lambda n: (n.label.lower(), n.id),
        )
        return {
            "level1_nodes": cast(list[NodeCoreEntity], state["level1_nodes"]),
            "level2_diagrams": rows,
        }

    # ─── Aspect 3 ─────────────────────────────────────────────────────────────

    @result_instance("level1_nodes", list, required=True)  # type: ignore[untyped-decorator]
    @result_instance("level2_diagrams", list, required=True)  # type: ignore[untyped-decorator]
    @result_instance("level2_nodes", list, required=True)  # type: ignore[untyped-decorator]
    @regular_aspect("Level-2 domain nodes from DuckDB.")
    async def build_level2_nodes_aspect(
        self,
        params: ParamsStub,
        state: BaseState,
        box: ToolsBox,
        connections: Connections,
    ) -> dict[str, Any]:
        _ = box
        level1 = cast(list[NodeCoreEntity], state["level1_nodes"])
        duck = cast(DuckDBGraphResource, connections[DUCKDB_GRAPH_CONNECTION_KEY])
        rows = [
            NodeCoreEntity(id=str(r["id"]), parent_id="domains_root", label=str(r["label"]), type="Domain")
            for r in duck.execute_fetch_dicts("SELECT id, label FROM domain ORDER BY lower(label), id")
        ]
        # Data sources (spec 065): a root of their own after Domains, one node per data source, and one for the
        # resources that name none — only when the graph has a data source at all.
        sources = duck.execute_fetch_dicts("SELECT id, label FROM data_source ORDER BY lower(label), id")
        if sources:
            level1 = [*level1, DATA_SOURCES_ROOT]
            # The panel sorts by ordinal first: the data sources by name, then No data source last.
            rows += [NodeCoreEntity(id=str(r["id"]), parent_id=DATA_SOURCES_ROOT.id, label=str(r["label"]), type="DataSource", ordinal=0) for r in sources]
            if any(r["data_source_id"] is None for r in self._stored_resources(duck)):
                rows.append(NodeCoreEntity(id=NO_DATA_SOURCE_ID, parent_id=DATA_SOURCES_ROOT.id, label="No data source", type="NoDataSource", ordinal=1))
        return {
            "level1_nodes": level1,
            "level2_diagrams": cast(list[NodeCoreEntity], state["level2_diagrams"]),
            "level2_nodes": rows,
        }

    # ─── Aspect 4 ─────────────────────────────────────────────────────────────

    @result_instance("level1_nodes", list, required=True)  # type: ignore[untyped-decorator]
    @result_instance("level2_diagrams", list, required=True)  # type: ignore[untyped-decorator]
    @result_instance("level2_nodes", list, required=True)  # type: ignore[untyped-decorator]
    @result_instance("level3_diagrams", list, required=True)  # type: ignore[untyped-decorator]
    @regular_aspect("Level-3 per-domain ERD and use-case rows, and one row per lifecycle, from DuckDB.")
    async def build_level3_diagrams_aspect(
        self,
        params: ParamsStub,
        state: BaseState,
        box: ToolsBox,
        connections: Connections,
    ) -> dict[str, Any]:
        _ = box
        duck = cast(DuckDBGraphResource, connections[DUCKDB_GRAPH_CONNECTION_KEY])
        rows: list[NodeCoreEntity] = []

        # A diagram with nothing to draw has no row; a domain left with no rows shows dim in the panel.
        with_entities = self._domains_holding(duck, "entity")
        with_actions = self._domains_holding(duck, "action")
        for d in duck.execute_fetch_dicts("SELECT id, label FROM domain ORDER BY lower(label), id"):
            did, dlabel = str(d["id"]), str(d["label"])
            if did in with_entities:
                rows.append(NodeCoreEntity(id=f"erd_domain:{did}", parent_id=did, label=self._diagram_view_label(f"Entity domain — {dlabel}"), type="erd_domain", ordinal=0))
            if did in with_actions:
                rows.append(NodeCoreEntity(id=f"use_case_domain:{did}", parent_id=did, label=self._diagram_view_label(f"Use case — {dlabel}"), type="use_case_domain", ordinal=1))
                rows.append(NodeCoreEntity(id=f"events_domain:{did}", parent_id=did, label=self._diagram_view_label(f"Events — {dlabel}"), type="events_domain", ordinal=2))

        # One row per lifecycle, under the domain of the entity that holds it.
        lifecycles = duck.execute_fetch_dicts("""
            SELECT de.target_id AS domain_id, le.source_id AS entity_id, e.label AS entity_label, lc.id AS lifecycle_id, lc.field_name
            FROM lifecycle_edges le
            JOIN lifecycle lc ON lc.id = le.target_id
            JOIN entity e ON e.id = le.source_id
            JOIN domain_edges de ON de.source_id = le.source_id
            ORDER BY lower(e.label), lc.id
        """)
        per_entity = Counter(str(lc["entity_id"]) for lc in lifecycles)
        for lc in lifecycles:
            several = per_entity[str(lc["entity_id"])] > 1
            name = f"{lc['entity_label']} {str(lc['field_name']).replace('_', ' ')}" if several else f"{lc['entity_label']} lifecycle"
            rows.append(NodeCoreEntity(id=str(lc["lifecycle_id"]), parent_id=str(lc["domain_id"]), label=self._diagram_view_label(name), type="lifecycle_state_diagram", ordinal=2, host_id=str(lc["entity_id"])))

        # The ERD of each data source, then one per resource of it; under No data source, one per resource naming none.
        source_labels = {str(d["id"]): str(d["label"]) for d in duck.execute_fetch_dicts("SELECT id, label FROM data_source")}
        if source_labels:
            stored = self._stored_resources(duck)
            for source_id in sorted({str(r["data_source_id"]) for r in stored if r["data_source_id"] is not None}):
                label = source_labels.get(source_id, source_id)
                rows.append(NodeCoreEntity(id=f"erd_data_source:{source_id}", parent_id=source_id, label=self._diagram_view_label(f"ERD — {label}"), type="erd_data_source", ordinal=0))
            for r in stored:
                parent = NO_DATA_SOURCE_ID if r["data_source_id"] is None else str(r["data_source_id"])
                rows.append(NodeCoreEntity(id=f"erd_resource:{r['id']}", parent_id=parent, label=self._diagram_view_label(f"ERD — {r['label']}"), type="erd_resource", ordinal=1))

        rows.sort(key=lambda n: (str(n.parent_id).lower(), 10**9 if n.ordinal is None else int(n.ordinal), n.label.lower(), n.id))

        return {
            "level1_nodes": cast(list[NodeCoreEntity], state["level1_nodes"]),
            "level2_diagrams": cast(list[NodeCoreEntity], state["level2_diagrams"]),
            "level2_nodes": cast(list[NodeCoreEntity], state["level2_nodes"]),
            "level3_diagrams": rows,
        }

    # ─── Summary ──────────────────────────────────────────────────────────────

    @summary_aspect("Assemble sidebar Result from accumulated state.")
    async def build_result_summary(
        self,
        params: ParamsStub,
        state: BaseState,
        box: ToolsBox,
        connections: Connections,
    ) -> GetLeftMenuSidebarDataAction.Result:
        _ = (box, connections)
        return GetLeftMenuSidebarDataAction.Result(
            level1_nodes=cast(list[NodeCoreEntity], state["level1_nodes"]),
            level2_diagrams=cast(list[NodeCoreEntity], state["level2_diagrams"]),
            level2_nodes=cast(list[NodeCoreEntity], state["level2_nodes"]),
            level3_diagrams=cast(list[NodeCoreEntity], state["level3_diagrams"]),
        )
