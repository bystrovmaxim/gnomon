// src/lib/erdResourceFilter.ts
/**
 * The Resources section of the ERD (spec 061): which resources store a table of the diagram, and the diagram without
 * the tables of the resources switched off. A table of a graph older than protocol 1.6 has no resource: no row
 * stands for it, and no row hides it.
 */
import type { ErdEntity, ErdGraphPayload } from "@/lib/buildDotSource";
import { pruneGraphToEntities } from "@/lib/erdKindFilter";

/** The resources that store a table of ``entities``, by id — the section's rows, taken from the diagram's base. */
export function resourcesOnDiagram(entities: readonly ErdEntity[]): string[] {
  return [...new Set(entities.flatMap((entity) => (entity.resource_id ? [entity.resource_id] : [])))].sort();
}

/** Hide the tables of the resources switched off, as a domain or a kind switched off hides its tables. */
export function filterGraphByResources(data: ErdGraphPayload, off: ReadonlySet<string>): ErdGraphPayload {
  if (off.size === 0) return data;
  return pruneGraphToEntities(data, (entity) => !entity.resource_id || !off.has(entity.resource_id));
}
