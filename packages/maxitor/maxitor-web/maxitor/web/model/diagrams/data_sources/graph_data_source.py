# packages/maxitor/maxitor-web/maxitor/web/model/diagrams/data_sources/graph_data_source.py
"""
GraphDataSource — the in-process DuckDB store the graphs are loaded into.

The rows ``DuckDBGraphResource`` builds — ``NodeCoreEntity`` among them — live in DuckDB inside
Maxitor's own process, so their physical place is a store kept in memory.
"""

from aoa.action_machine.intents.meta import meta
from aoa.action_machine.resources import InMemoryDataSource


@meta(description="The in-process DuckDB store the graphs are loaded into")
class GraphDataSource(InMemoryDataSource):
    """
    AI-CORE-BEGIN
    ROLE: The physical place of the diagrams domain's rows: DuckDB kept in Maxitor's process.
    CONTRACT: Named by ``DuckDBGraphResource``; holds no connection of its own.
    AI-CORE-END
    """
