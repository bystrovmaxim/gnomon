// src/lib/erdViews.ts
/**
 * The ERD's two views of one model (spec 070).
 *
 * The logical view draws each entity once, in its domain's frame. The physical view draws an entity once in every
 * resource that keeps it — a **copy** — and once in the "Not stored" zone when none does. A copy is an ordinary table
 * of the drawing: its id is ``<entity id>␟<resource id>`` (``␟`` appears in no qualname), and every lookup that reads a
 * drawn table's id — cards, hover, rooms, Diff marks, folds — works on copies as it works on entities. A relation is
 * drawn between every pair of copies of its ends; one between copies in two resources crosses databases.
 */

import type { ErdEntity, ErdGroup, ErdRelation } from "@/lib/buildDotSource";

/** The two views; the address carries one as ``model``. */
export type ErdModelView = "logical" | "physical";

/** The separator of a copy's id: U+241F, which no qualname contains. */
export const COPY_SEPARATOR = "␟";

/** The id of the copy of ``entity`` kept in ``resource``, or in "Not stored" when ``resource`` is ``null``. */
export function copyId(entity: string, resource: string | null): string {
  return `${entity}${COPY_SEPARATOR}${resource ?? ""}`;
}

/** The entity a drawn table stands for: its own id in the logical view, the id before ``␟`` for a copy. */
export function copyEntity(id: string): string {
  const at = id.indexOf(COPY_SEPARATOR);
  return at < 0 ? id : id.slice(0, at);
}

/** The resource of a copy, ``null`` for a copy in "Not stored" and for a table of the logical view. */
export function copyResource(id: string): string | null {
  const at = id.indexOf(COPY_SEPARATOR);
  return at < 0 || at === id.length - 1 ? null : id.slice(at + 1);
}

/** A table of the physical view: the entity's own properties, its copy's id, where the copy lies and how many there are. */
export type ErdCopy = ErdEntity & { copy_of: string; copy_resource: string | null; copies: number };

/** A line of the physical view: the relation it repeats, and whether its ends lie in two databases. */
export type ErdCopyRelation = ErdRelation & { relation: number; across: boolean };

/** What the physical view draws: the copies, the lines between them, and the "same entity" pairs to join. */
export type PhysicalDrawing = {
  entities: ErdCopy[];
  relations: ErdCopyRelation[];
  /** Each entity drawn more than once: its copies' ids, in the order of its resources. */
  same: string[][];
  /** The specialization containers, one per place that holds a copy of every one of its tables. */
  groups: ErdGroup[];
};

/**
 * The physical view of ``entities`` and ``relations``: a copy of each entity in each resource that keeps it and is not
 * turned off, one in "Not stored" when no resource keeps it, none when every resource that keeps it is off. A relation
 * becomes a line between every pair of copies of its ends; a specialization's container keeps no copy and draws no line.
 */
export function physicalDrawing(
  entities: readonly ErdEntity[],
  relations: readonly ErdRelation[],
  off: ReadonlySet<string> = new Set(),
  groups: readonly ErdGroup[] = [],
): PhysicalDrawing {
  const copiesOf = new Map<string, string[]>();
  const drawn: ErdCopy[] = [];
  for (const entity of entities) {
    const kept = entity.resource_ids ?? [];
    const shown = kept.length ? kept.filter((resource) => !off.has(resource)) : [null];
    if (!shown.length) continue;
    const ids = shown.map((resource) => copyId(entity.id, resource));
    copiesOf.set(entity.id, ids);
    shown.forEach((resource, index) =>
      drawn.push({ ...entity, id: ids[index]!, copy_of: entity.id, copy_resource: resource, copies: Math.max(kept.length, 1) }),
    );
  }
  const lines: ErdCopyRelation[] = [];
  relations.forEach((relation, index) => {
    const sources = copiesOf.get(relation.source);
    const targets = copiesOf.get(relation.target);
    if (!sources || !targets) return;
    for (const source of sources) {
      for (const target of targets) {
        lines.push({ ...relation, source, target, relation: index, across: copyResource(source) !== copyResource(target) });
      }
    }
  });
  // A container stands in each place — a resource, or "Not stored" — that holds a copy of every one of its tables.
  const places = [...new Set(drawn.map((copy) => copy.copy_resource))];
  const copyGroups = groups.flatMap((group) =>
    places.flatMap((place) => {
      const members = group.members.map((member) => copyId(member, place));
      return members.every((member) => drawn.some((copy) => copy.id === member)) ? [{ ...group, group_id: copyId(group.group_id, place), members }] : [];
    }),
  );
  return { entities: drawn, relations: lines, same: [...copiesOf.values()].filter((ids) => ids.length > 1), groups: copyGroups };
}
