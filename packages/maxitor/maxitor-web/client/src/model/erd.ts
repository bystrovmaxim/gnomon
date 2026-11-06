// src/model/erd.ts
/** ERD API response contracts consumed by the browser-side ERD viewer. */
export type DomainInfoRow = {
  qualname: string;
  /** Interchange graph ``domain.label`` (human-readable; same idea as list-entities ``domain_label``). */
  label: string;
  color: string;
};

export type DomainQualnamesPayload = {
  list_domains: DomainInfoRow[];
};

/** One entity kind present in the loaded graph: its word and the name a reader sees. */
export type EntityKindRow = {
  entity_kind: string;
  label: string;
};

/** Matches ``ListEntityKindsAction.Result``. */
export type EntityKindsPayload = {
  list_entity_kinds: EntityKindRow[];
};

export type ErdDomainPayload = {
  domain_label: string;
  domain_qualname: string;
  list_entities: {
    entities: Array<Record<string, unknown>>;
    relations: Array<Record<string, unknown>>;
  };
};

/** Batch response from ``GET /api/v1/list-entities`` (one graph scan, multiple slices). */
export type ErdDomainsBatchPayload = {
  domain_slices: ErdDomainPayload[];
  /** Every line between two tables of the whole request (absent from older servers). */
  relations?: Array<Record<string, unknown>>;
  /** The resources of the graph that store an entity, by id, each with its colour (protocol 1.6; absent from older servers). */
  resources?: ErdResourceRow[];
  /** The data sources the listed resources name, by id, each with its colour (protocol 1.7; absent from older servers). */
  data_sources?: ErdDataSourceRow[];
};

/** One resource of the graph: the colour is the server's, the same for every reader of the graph. */
export type ErdResourceRow = { id: string; label: string; color: string; data_source_id?: string | null };

/** One data source of the graph — a store several resources share (spec 063); the colour is the server's. */
export type ErdDataSourceRow = { id: string; label: string; color: string };
