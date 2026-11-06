// src/model/diagramSelection.ts
/** Sidebar-to-view contract for the currently selected diagram target. */
export type DiagramSelection =
  | { kind: "interchange_graph" }
  /**
   * An ERD of one domain (``qualifier``) or of all; narrowed to the tables stored in one data source or one resource
   * when ``data_source`` or ``resource`` is set (spec 065) — then ``qualifier`` is ``null``.
   */
  | { kind: "erd"; qualifier: string | null; data_source?: string; resource?: string }
  | { kind: "lifecycle_fsm"; lifecycle_graph_node_id: string; host_entity_interchange_id: string }
  | { kind: "use_case"; domain_qualifier: string }
  | { kind: "use_case_all" }
  | { kind: "events"; domain_qualifier: string }
  | { kind: "events_all" };
