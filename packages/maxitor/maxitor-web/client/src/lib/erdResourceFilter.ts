// src/lib/erdResourceFilter.ts
/**
 * The Resources section of the physical view (spec 061, spec 070): a row per resource of the graph, and which of them
 * has a table on screen. A table no resource keeps lies in "Not stored", which no row hides.
 */
import type { ErdEntity } from "@/lib/buildDotSource";

/** The resources that keep a table of ``entities``, by id. */
export function resourcesOnDiagram(entities: readonly ErdEntity[]): string[] {
  return [...new Set(entities.flatMap((entity) => entity.resource_ids ?? []))].sort();
}
