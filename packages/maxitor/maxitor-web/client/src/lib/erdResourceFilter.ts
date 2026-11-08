// src/lib/erdResourceFilter.ts
/**
 * The Resources section of the physical view (spec 061, spec 070): which resources it lists and frames, and which of
 * them has a table on screen. A table no resource keeps lies in "Not stored", which no row hides.
 */
import type { ErdEntity } from "@/lib/buildDotSource";

/** The resources that keep a table of ``entities``, by id. */
export function resourcesOnDiagram(entities: readonly ErdEntity[]): string[] {
  return [...new Set(entities.flatMap((entity) => entity.resource_ids ?? []))].sort();
}

/**
 * The resources a diagram frames and lists (#78): on the ERD of all domains, every resource of the model, an empty one
 * too, so nothing is hidden; on the ERD of one domain, only those that keep one of its tables — its own and its 1-hop
 * neighbours — since a resource that keeps none has nothing to do with it. The model's order is kept.
 */
export function resourcesOfDiagram(all: readonly string[], entities: readonly ErdEntity[], wholeModel: boolean): string[] {
  if (wholeModel) return [...all];
  const kept = new Set(resourcesOnDiagram(entities));
  return all.filter((resource) => kept.has(resource));
}
