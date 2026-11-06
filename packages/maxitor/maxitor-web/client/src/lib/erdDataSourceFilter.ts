// src/lib/erdDataSourceFilter.ts
/**
 * The Data sources section of the ERD (spec 063): which data sources the diagram's resources share, one row for the
 * resources that name none, and the diagram without the tables of the data sources switched off. The section stands
 * only when the diagram has a data source; a graph older than protocol 1.7 has none.
 */
import type { ErdEntity, ErdGraphPayload } from "@/lib/buildDotSource";
import { pruneGraphToEntities } from "@/lib/erdKindFilter";

/** The key of the row that stands for every resource naming no data source. */
export const NO_DATA_SOURCE = "";

/** The data source of a table's resource, or ``NO_DATA_SOURCE``; ``null`` for a table that has no resource at all. */
export function dataSourceOfEntity(entity: ErdEntity, resourceDataSources: Readonly<Record<string, string>>): string | null {
  if (!entity.resource_id) return null;
  return resourceDataSources[entity.resource_id] ?? NO_DATA_SOURCE;
}

/** The section's rows: the data sources of the diagram's tables, by id, then ``NO_DATA_SOURCE`` when some resource names none — or none at all without a data source. */
export function dataSourcesOnDiagram(entities: readonly ErdEntity[], resourceDataSources: Readonly<Record<string, string>>): string[] {
  const keys = new Set(entities.flatMap((entity) => {
    const key = dataSourceOfEntity(entity, resourceDataSources);
    return key === null ? [] : [key];
  }));
  const named = [...keys].filter((key) => key !== NO_DATA_SOURCE).sort();
  if (named.length === 0) return [];
  return keys.has(NO_DATA_SOURCE) ? [...named, NO_DATA_SOURCE] : named;
}

/** Hide the tables of the data sources switched off — ``NO_DATA_SOURCE`` hides the tables of resources that name none. */
export function filterGraphByDataSources(
  data: ErdGraphPayload,
  off: ReadonlySet<string>,
  resourceDataSources: Readonly<Record<string, string>>,
): ErdGraphPayload {
  if (off.size === 0) return data;
  return pruneGraphToEntities(data, (entity) => {
    const key = dataSourceOfEntity(entity, resourceDataSources);
    return key === null || !off.has(key);
  });
}
