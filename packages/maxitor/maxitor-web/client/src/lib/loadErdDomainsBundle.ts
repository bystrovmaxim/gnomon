// src/lib/loadErdDomainsBundle.ts
import { getActiveBase, getActiveSource } from "@/api/client";
import { compareVersions } from "@/api/compare";
import { listDomains, listEntities, listEntityKinds } from "@/api/erd";
import { markErd, mergeErdSlices, mergeRelations, type ErdSlice } from "@/lib/erdDiff";
import type { ErdRelation } from "@/lib/buildDotSource";
import type { EntityKindRow, ErdDataSourceRow, ErdResourceRow } from "@/model/erd";
import type { DiagramSelection } from "@/model/diagramSelection";
import { allocateDomainTabKey } from "@/lib/domainTabKeys";

export type ErdViewerSelection = Extract<DiagramSelection, { kind: "erd" }>;

export type ErdDomainsBundle = {
  domains: Record<string, { entities: unknown[]; relations: unknown[] }>;
  domain_qualifiers: Record<string, string>;
  domain_qualifier_colors: Record<string, string>;
  /** ``domain_qualname`` → short label from ``list_domains`` / DuckDB ``domain.label``. */
  domain_qualifier_labels: Record<string, string>;
  /** Tab key → human domain label (for legend row text). */
  domain_tab_labels?: Record<string, string>;
  /** First domain row label for the diagram title (optional). */
  first_domain_label?: string;
  /** Every line between two tables of the whole request; the merged ERD draws these, pruned to the screen. */
  relations?: unknown[];
  /** Entity kinds of the loaded graph with their display names (``list-entity-kinds``). */
  entity_kinds?: EntityKindRow[];
  /** In Diff (spec 038): the slices are A's and B's together, every table, row and line marked. */
  diff?: boolean;
  /** Resource id → its colour, as the server gives it: one resource has one colour for everyone (spec 061). */
  resource_colors: Record<string, string>;
  /** Resource id → its name. */
  resource_labels: Record<string, string>;
  /** Resource id → the data source it shares (spec 063); a resource that names none is absent. */
  resource_data_sources: Record<string, string>;
  /** Data source id → its colour, as the server gives it. */
  data_source_colors: Record<string, string>;
  /** Data source id → its name. */
  data_source_labels: Record<string, string>;
};

export type ErdDomainSliceRequest = {
  key: string;
  qualname: string;
};

/**
 * Load all ERD domain slices for the current selection (same contract as the blob HTML builder).
 * Runs in the SPA origin so ``fetch`` matches ``api/erd`` (same origin as the Vite app).
 */
export async function loadErdDomainsBundle(
  selection: ErdViewerSelection,
  includeOneHopNeighbors: boolean,
): Promise<ErdDomainsBundle> {
  // The ERD of a data source or of a resource is the ERD of all domains, narrowed to the tables stored there (spec 065).
  if (selection.data_source || selection.resource) {
    const all = await loadErdDomainsBundle({ kind: "erd", qualifier: null }, includeOneHopNeighbors);
    return scopeErdBundle(all, selection);
  }
  if (getActiveBase()) return loadErdDiffBundle(selection, includeOneHopNeighbors);
  const listing = await listDomains();
  const domain_qualifier_colors = Object.fromEntries(
    listing.list_domains.map((r) => [r.qualname, r.color]),
  );
  const domain_qualifier_labels = Object.fromEntries(
    listing.list_domains.map((r) => [r.qualname, r.label]),
  );
  const quals: string[] =
    selection.qualifier !== null
      ? [selection.qualifier]
      : listing.list_domains.map((r) => r.qualname);

  if (!quals.length) throw new Error("No domain qualnames");

  const used = new Set<string>();
  const domains: Record<string, { entities: unknown[]; relations: unknown[] }> = {};
  const domain_qualifiers: Record<string, string> = {};
  const domain_tab_labels: Record<string, string> = {};

  const [{ domain_slices: payloads, relations, resources, data_sources }, kinds] = await Promise.all([
    listEntities(quals, includeOneHopNeighbors),
    listEntityKinds(),
  ]);
  let first_domain_label: string | undefined;
  for (const p of payloads) {
    const key = allocateDomainTabKey(used, p.domain_label);
    domains[key] = p.list_entities;
    domain_qualifiers[key] = p.domain_qualname;
    domain_tab_labels[key] = p.domain_label;
    if (first_domain_label === undefined) first_domain_label = p.domain_label;
  }

  return {
    domains,
    domain_qualifiers,
    domain_qualifier_colors,
    domain_qualifier_labels,
    domain_tab_labels,
    first_domain_label,
    relations,
    entity_kinds: kinds.list_entity_kinds,
    ...resourceMaps(resources ?? []),
    ...dataSourceMaps(data_sources ?? []),
  };
}

type ScopedRow = { id?: unknown; resource_id?: unknown; source?: unknown; target?: unknown };

/**
 * ``bundle`` narrowed to ``scope`` (spec 065): the tables stored in its data source or its resource, the lines between
 * them, and the domains left with a table. A table no resource stores is in no scope.
 */
export function scopeErdBundle(bundle: ErdDomainsBundle, scope: Pick<ErdViewerSelection, "data_source" | "resource">): ErdDomainsBundle {
  const inScope = (resource: unknown) =>
    typeof resource === "string" && (scope.resource ? resource === scope.resource : bundle.resource_data_sources[resource] === scope.data_source);
  const kept = new Set<string>();
  for (const slice of Object.values(bundle.domains)) {
    for (const entity of slice.entities as ScopedRow[]) if (inScope(entity.resource_id)) kept.add(String(entity.id));
  }
  const between = (line: ScopedRow) => kept.has(String(line.source)) && kept.has(String(line.target));
  const domains: ErdDomainsBundle["domains"] = {};
  const domain_qualifiers: Record<string, string> = {};
  const domain_tab_labels: Record<string, string> = {};
  let first_domain_label: string | undefined;
  for (const [key, slice] of Object.entries(bundle.domains)) {
    const entities = (slice.entities as ScopedRow[]).filter((entity) => kept.has(String(entity.id)));
    if (!entities.length) continue;
    domains[key] = { ...slice, entities, relations: (slice.relations as ScopedRow[]).filter(between) };
    domain_qualifiers[key] = bundle.domain_qualifiers[key]!;
    domain_tab_labels[key] = bundle.domain_tab_labels?.[key] ?? key;
    first_domain_label ??= domain_tab_labels[key];
  }
  return { ...bundle, domains, domain_qualifiers, domain_tab_labels, first_domain_label, relations: ((bundle.relations ?? []) as ScopedRow[]).filter(between) };
}

/** The colours and names of the resources, newer rows first: a resource only the older version has keeps its own. */
export function resourceMaps(
  ...listings: readonly (readonly ErdResourceRow[])[]
): Pick<ErdDomainsBundle, "resource_colors" | "resource_labels" | "resource_data_sources"> {
  const resource_colors: Record<string, string> = {};
  const resource_labels: Record<string, string> = {};
  const resource_data_sources: Record<string, string> = {};
  for (const row of listings.flat()) {
    if (row.id in resource_colors) continue;
    resource_colors[row.id] = row.color;
    resource_labels[row.id] = row.label;
    if (row.data_source_id) resource_data_sources[row.id] = row.data_source_id;
  }
  return { resource_colors, resource_labels, resource_data_sources };
}

/** The colours and names of the data sources (spec 063), newer rows first, as for resources. */
export function dataSourceMaps(...listings: readonly (readonly ErdDataSourceRow[])[]): Pick<ErdDomainsBundle, "data_source_colors" | "data_source_labels"> {
  const data_source_colors: Record<string, string> = {};
  const data_source_labels: Record<string, string> = {};
  for (const row of listings.flat()) {
    if (row.id in data_source_colors) continue;
    data_source_colors[row.id] = row.color;
    data_source_labels[row.id] = row.label;
  }
  return { data_source_colors, data_source_labels };
}

export async function loadErdDomainSlicesBundle(
  requests: ErdDomainSliceRequest[],
  includeOneHopNeighbors: boolean,
  domain_qualifier_colors: Record<string, string>,
): Promise<Pick<ErdDomainsBundle, "domains" | "domain_qualifiers" | "domain_qualifier_colors">> {
  const domains: Record<string, { entities: unknown[]; relations: unknown[] }> = {};
  const domain_qualifiers: Record<string, string> = {};

  const { domain_slices } = await listEntities(
    requests.map((r) => r.qualname),
    includeOneHopNeighbors,
  );
  const byQual = new Map(domain_slices.map((s) => [s.domain_qualname, s]));

  for (const { key, qualname } of requests) {
    const payload = byQual.get(qualname);
    if (!payload) {
      throw new Error(`missing domain slice for ${qualname}`);
    }
    domains[key] = payload.list_entities;
    domain_qualifiers[key] = payload.domain_qualname;
  }

  return { domains, domain_qualifiers, domain_qualifier_colors };
}

/** The reads of a pair under way: the two halves of Side by side ask for the same one at once (spec 044). */
const pairReads = new Map<string, Promise<ErdDomainsBundle>>();

/**
 * The ERD of two versions (spec 038, research R10): A's and B's domains, and each domain's tables, rows and lines
 * read from both and merged, then marked with what the comparison says. A domain that only one version has comes
 * from that one alone, so everything on it is added or removed.
 */
function loadErdDiffBundle(selection: ErdViewerSelection, includeOneHopNeighbors: boolean): Promise<ErdDomainsBundle> {
  const key = `${getActiveBase()?.source}|${getActiveSource()}|${selection.qualifier}|${includeOneHopNeighbors}`;
  const running = pairReads.get(key);
  if (running) return running;
  const reading = readErdDiffBundle(selection, includeOneHopNeighbors).finally(() => pairReads.delete(key));
  pairReads.set(key, reading);
  return reading;
}

async function readErdDiffBundle(selection: ErdViewerSelection, includeOneHopNeighbors: boolean): Promise<ErdDomainsBundle> {
  const base = getActiveBase()!;
  const [newerListing, olderListing, kinds, compared] = await Promise.all([listDomains(), listDomains(base), listEntityKinds(), compareVersions()]);
  const rows = [...newerListing.list_domains, ...olderListing.list_domains.filter((row) => !newerListing.list_domains.some((each) => each.qualname === row.qualname))];
  const inOlder = new Set(olderListing.list_domains.map((row) => row.qualname));
  const inNewer = new Set(newerListing.list_domains.map((row) => row.qualname));
  const quals = selection.qualifier !== null ? [selection.qualifier] : rows.map((row) => row.qualname);
  if (!quals.length) throw new Error("No domain qualnames");
  const newerQuals = quals.filter((qual) => inNewer.has(qual));
  const olderQuals = quals.filter((qual) => inOlder.has(qual));
  const empty = { domain_slices: [], relations: [] as unknown[], resources: [] as ErdResourceRow[], data_sources: [] as ErdDataSourceRow[] };
  const [newer, older] = await Promise.all([
    newerQuals.length ? listEntities(newerQuals, includeOneHopNeighbors) : empty,
    olderQuals.length ? listEntities(olderQuals, includeOneHopNeighbors, base) : empty,
  ]);
  const olderByQual = new Map(older.domain_slices.map((slice) => [slice.domain_qualname, slice]));
  const newerByQual = new Map(newer.domain_slices.map((slice) => [slice.domain_qualname, slice]));
  const used = new Set<string>();
  const domains: Record<string, { entities: unknown[]; relations: unknown[] }> = {};
  const domain_qualifiers: Record<string, string> = {};
  const domain_tab_labels: Record<string, string> = {};
  let first_domain_label: string | undefined;
  for (const qual of quals) {
    const now = newerByQual.get(qual);
    const was = olderByQual.get(qual);
    if (!now && !was) continue;
    const label = (now ?? was)!.domain_label;
    const key = allocateDomainTabKey(used, label);
    const merged = markErd(mergeErdSlices(was?.list_entities as ErdSlice | undefined, now?.list_entities as ErdSlice | undefined), compared);
    domains[key] = merged as { entities: unknown[]; relations: unknown[] };
    domain_qualifiers[key] = qual;
    domain_tab_labels[key] = label;
    if (first_domain_label === undefined) first_domain_label = label;
  }
  const relations = markErd({ relations: mergeRelations(older.relations as ErdRelation[] | undefined, newer.relations as ErdRelation[] | undefined) }, compared).relations;
  return {
    domains,
    domain_qualifiers,
    domain_qualifier_colors: Object.fromEntries(rows.map((row) => [row.qualname, row.color])),
    domain_qualifier_labels: Object.fromEntries(rows.map((row) => [row.qualname, row.label])),
    domain_tab_labels,
    first_domain_label,
    relations,
    entity_kinds: kinds.list_entity_kinds,
    diff: true,
    ...resourceMaps(newer.resources ?? [], older.resources ?? []),
    ...dataSourceMaps(newer.data_sources ?? [], older.data_sources ?? []),
  };
}
