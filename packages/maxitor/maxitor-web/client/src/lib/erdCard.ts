// src/lib/erdCard.ts
/** What a card says of a table or a row of the ERD, from what the diagram holds (spec 043, FR-004 – FR-006). */
import type { CardField, CardSubject } from "@/components/diagrams/ElementCard";
import { DOMAIN_CONTOUR_ID_PREFIX, isContourId, tableResource, type ErdBundle, type ErdEntity, type ErdField, type ErdRelation } from "@/lib/buildDotSource";
import { copyEntity } from "@/lib/erdViews";
import { FIELDS_CHANGED, rowCard, tableInside, type CardTarget } from "@/lib/erdDiffCard";
import { svgDataUriForGraphNodeIcon } from "@/lib/icons";
import { ROW_READABLE_PX, ROW_TAPPABLE_PX } from "@/lib/erdPostPass";
import { RELATION_END_COUNT, RELATION_END_WORDS, relationEndGlyph, relationKindGlyph } from "@/lib/relationGlyphs";
import { tooltipOf } from "@/rooms/graphvizFocus";
import type { ElementRef } from "@/rooms/focusStore";

/** A row's cell id, without the ``a_`` Graphviz adds: ``fn<table>_<row>`` or ``ft<table>_<row>``. */
const ROW = /^f[nt](\d+)_(\d+)$/;

function keyWord(field: ErdField): CardField["key"] {
  return field.primary_key ? "PK" : field.foreign_key ? "FK" : undefined;
}

function marked<T>(status: T): status is Exclude<T, "unchanged" | undefined> {
  return status !== undefined && status !== "unchanged";
}

/** What a table's card says changed: the table itself, or something in it, which a table of no change of its own shows too. */
function tableChange(entity: ErdEntity, title: string): CardTarget | null {
  const status = marked(entity.diff) ? entity.diff : (entity.fields ?? []).some((field) => marked(field.diff)) ? "changed" : null;
  if (!status) return null;
  // Its own change, a move or its lifecycle say what changed; else only its other rows did.
  const told = tableInside(entity);
  const inside = marked(entity.diff) || told.note ? told : { note: FIELDS_CHANGED };
  return { title, status, elements: [{ kind: "node", id: entity.id }], ...inside };
}


/** The table of a row too small to read or aim at: from afar a card tells the whole table (spec 043, FR-001a). */
export function fromAfar(ref: ElementRef, cell: Element | undefined, entities: readonly ErdEntity[], touch: boolean): ElementRef {
  const table = ref.kind === "row" ? ROW.exec(ref.id)?.[1] : undefined;
  const entity = table === undefined ? undefined : entities[Number(table)];
  const height = cell?.getBoundingClientRect().height ?? Infinity;
  return entity && height < (touch ? ROW_TAPPABLE_PX : ROW_READABLE_PX) ? { kind: "table", id: entity.id } : ref;
}

/** How many a line's end stands for, in the drawing's notation and in words: ``0..* (zero or more)``. */
function endCount(cardinality: string | undefined): string {
  if (!cardinality) return "";
  const words = RELATION_END_WORDS[cardinality];
  return words ? `${words} (${RELATION_END_COUNT[cardinality]})` : cardinality;
}

/** A line's id: ``re<k>``, or ``rp<k>`` for where it pointed in A. */
const LINE = /^r[ep](\d+)$/;

function titleCase(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** A relation's shape in words, from its source's side: ``many to one``, ``one to one``, ``many to many``. */
function relationShape(source: string | undefined, target: string | undefined): string {
  const side = (cardinality: string | undefined) => (cardinality === "one_many" || cardinality === "zero_many" ? "many" : "one");
  return `${side(source)} to ${side(target)}`;
}

/**
 * The card of a line (spec 043, FR-011; spec 071): its kind with its mark, then each end on a row of its own — the
 * line's mark for that end, the table, the field and how many of the table the end stands for, in words.
 */
function lineSubject(ref: ElementRef, entities: readonly ErdEntity[], relations: readonly ErdRelation[]): Omit<CardSubject, "at"> | null {
  const line = relations[Number(LINE.exec(ref.id)?.[1] ?? -1)];
  if (!line) return null;
  const name = (id: string) => entities.find((entity) => entity.id === id)?.label || id.split(".").pop() || id;
  const end = (id: string, field?: string | null) => (field ? `${name(id)}.${field}` : name(id));
  const title = `${end(line.source, line.source_field)} → ${end(line.target, line.target_field)}`;
  const kind = line.relationship_kind ?? "association";
  return {
    key: `line:${ref.id}`,
    ref,
    title,
    relation: {
      // Named by the field that holds it, as a row of its table is; a line with no field by its kind.
      name: line.source_field ?? titleCase(kind),
      kind: titleCase(kind),
      shape: relationShape(line.source_cardinality, line.target_cardinality),
      kindIcon: relationKindGlyph(kind),
      from: { table: name(line.source), field: line.source_field, count: endCount(line.source_cardinality), icon: relationEndGlyph(line.source_cardinality) },
      to: { table: name(line.target), field: line.target_field, count: endCount(line.target_cardinality), icon: relationEndGlyph(line.target_cardinality) },
    },
    detail: "",
    description: line.description,
    nodeId: null,
    change: marked(line.diff) ? { title, status: line.diff, elements: line.source_field ? [{ kind: "edge", id: `${line.source}|entity_relation|${line.source_field}` }] : [] } : null,
  };
}

/**
 * The card of a bundle (spec 065): its two ends, how many relations it stands for, and each of them in a row — named
 * as a line's card names one, with its kind and its counts.
 */
function bundleSubject(
  ref: ElementRef,
  bundle: ErdBundle,
  entities: readonly ErdEntity[],
  relations: readonly ErdRelation[],
  resourceLabels: Readonly<Record<string, string>>,
): Omit<CardSubject, "at"> {
  const table = (id: string) => entities.find((entity) => entity.id === id)?.label || copyEntity(id).split(".").pop() || id;
  const end = (id: string) => (isContourId(id) ? resourceLabels[id.slice(3)] || id.slice(3) : table(id));
  const lines = bundle.relations.flatMap((k) => (relations[k] ? [relations[k]] : []));
  const title = `${end(bundle.source)} ↔ ${end(bundle.target)}`;
  return {
    key: `bundle:${bundle.source}|${bundle.target}`,
    ref,
    title,
    detail: "Relations between them",
    nodeId: null,
    change: null,
    fieldNoun: "relation",
    fields: lines.map((line) => {
      const side = (id: string, field?: string | null) => (field ? `${table(id)}.${field}` : table(id));
      const counts = line.source_cardinality && line.target_cardinality ? ` · ${RELATION_END_WORDS[line.source_cardinality] ?? line.source_cardinality} → ${RELATION_END_WORDS[line.target_cardinality] ?? line.target_cardinality}` : "";
      return { name: `${side(line.source, line.source_field)} → ${side(line.target, line.target_field)}`, type: `${titleCase(line.relationship_kind ?? "association")}${counts}`, description: line.description };
    }),
  };
}

/** The full graph's fill for a resource, so a card's icon is the one the full graph draws. */
const RESOURCE_FILL = "#7570B3";

/**
 * The card of a frame, or of its folded box (spec 068; spec 070; spec 071): a resource's icon and name, or a domain's,
 * and the tables it keeps — an empty frame's card says it keeps none — folded as a table's fields are, their count on
 * the fold.
 */
function contourSubject(
  ref: ElementRef,
  id: string,
  entities: readonly ErdEntity[],
  resourceLabels: Readonly<Record<string, string>>,
  domainLabels: Readonly<Record<string, string>>,
  domainColours: Readonly<Record<string, string>>,
): Omit<CardSubject, "at"> | null {
  const key = id.slice(3);
  // Each table is a node of its own: its description is read when its row is pointed at.
  const row = (entity: ErdEntity) => ({ name: tableName(entity), type: entity.entity_kind_label ?? entity.entity_kind ?? undefined, nodeId: copyEntity(entity.id) });
  const short = (full: string) => full.split(".").pop() || full;
  const tableName = (entity: ErdEntity) => entity.label || short(copyEntity(entity.id));
  if (id.startsWith(DOMAIN_CONTOUR_ID_PREFIX)) {
    const tables = entities
      .filter((entity) => (entity.domain_qualname?.trim() || "") === key)
      .sort((one, other) => tableName(one).localeCompare(tableName(other)));
    return {
      key: `contour:${id}`,
      ref,
      title: domainLabels[key] || short(key),
      // The domain's own colour, as its frame, its disk on the drawing and its row in the filter panel have it.
      icon: svgDataUriForGraphNodeIcon(domainColours[key] ?? "#64748b", "Domain"),
      detail: tables.length ? "Domain" : "Domain · no entity",
      // The domain is a node: its description is read and stands under its name.
      nodeId: key,
      change: null,
      fieldNoun: "table",
      fields: tables.map(row),
      copy: domainLabels[key] || short(key),
    };
  }
  const resource = key;
  if (!(resource in resourceLabels) && !entities.some((entity) => tableResource(entity) === resource)) return null;
  const tables = entities.filter((entity) => tableResource(entity) === resource).sort((one, other) => tableName(one).localeCompare(tableName(other)));
  return {
    key: `contour:${id}`,
    ref,
    title: resourceLabels[resource] || short(resource),
    icon: svgDataUriForGraphNodeIcon(RESOURCE_FILL, "Resource"),
    detail: tables.length ? "Resource" : "Resource · keeps no entity",
    nodeId: resource,
    change: null,
    fieldNoun: "table",
    fields: tables.map(row),
    copy: resource,
  };
}

/** What a hover on ``ref`` lights: the tables it joins to and its lines, which its card should leave in sight. */
export function litBy(ref: ElementRef, entities: readonly ErdEntity[], relations: readonly ErdRelation[]): { tables: string[]; lines: number[] } {
  if (ref.kind === "edge") {
    const index = Number(LINE.exec(ref.id)?.[1] ?? -1);
    const line = relations[index];
    return line ? { tables: [line.source, line.target], lines: [index] } : { tables: [], lines: [] };
  }
  const place = ref.kind === "row" ? ROW.exec(ref.id) : null;
  const entity = place ? entities[Number(place[1])] : entities.find((each) => each.id === ref.id);
  if (!entity) return { tables: [], lines: [] };
  const field = place ? entity.fields?.[Number(place[2])]?.name : undefined;
  const tables = new Set<string>();
  const lines: number[] = [];
  relations.forEach((line, index) => {
    const from = line.source === entity.id && (!place || line.source_field === field);
    const to = line.target === entity.id && (!place || line.target_field === field);
    if (!from && !to) return;
    lines.push(index);
    if (from) tables.add(line.target);
    if (to) tables.add(line.source);
  });
  tables.delete(entity.id);
  return { tables: [...tables], lines };
}

/**
 * The line under a table's name (spec 070, FR-008): its domain and every resource that keeps it, or "Not stored"; in
 * Diff, the resources A gave it when they differ. A table of a graph older than protocol 1.6 shows its domain alone.
 */
export function resourceLine(
  entity: ErdEntity,
  resourceLabels: Readonly<Record<string, string>> = {},
  domainLabels: Readonly<Record<string, string>> = {},
  storageKnown = true,
): string {
  const qual = entity.domain_qualname?.trim() ?? "";
  const domain = qual ? `Domain: ${domainLabels[qual] ?? (qual.split(".").pop() || qual)}` : "";
  // A table with no list of resources comes from a server or a graph that does not say where tables lie.
  if (!storageKnown || entity.resource_ids === undefined) return domain;
  const name = (resource: string) => resourceLabels[resource] ?? (resource.split(".").pop() || resource);
  const kept = (entity.resource_ids ?? []).map(name);
  const before = entity.previous_resource_ids ? `${entity.previous_resource_ids.map(name).join(", ")} → ` : "";
  const where = kept.length ? `Resources: ${before}${kept.join(", ")}` : "Not stored";
  return domain ? `${domain} · ${where}` : where;
}

/** The subject of ``ref``, less its place; ``null`` when it is not a table, a row or a line of the drawing. */
export function erdSubject(
  ref: ElementRef,
  entities: readonly ErdEntity[],
  root: ParentNode,
  relations: readonly ErdRelation[] = [],
  resourceLabels: Readonly<Record<string, string>> = {},
  bundles: readonly ErdBundle[] = [],
  domainLabels: Readonly<Record<string, string>> = {},
  storageKnown = true,
  domainColours: Readonly<Record<string, string>> = {},
): Omit<CardSubject, "at"> | null {
  // A frame — a resource's or a domain's — and its folded box, have a card of their own (spec 068, spec 071).
  if (ref.kind === "contour") return contourSubject(ref, ref.id, entities, resourceLabels, domainLabels, domainColours);
  if (ref.kind === "table" && isContourId(ref.id)) return contourSubject(ref, ref.id, entities, resourceLabels, domainLabels, domainColours);
  const bundle = ref.kind === "edge" ? bundles.find((each) => each.id === ref.id) : undefined;
  if (bundle) return bundleSubject(ref, bundle, entities, relations, resourceLabels);
  if (ref.kind === "edge") return lineSubject(ref, entities, relations);
  if (ref.kind === "table") {
    const entity = entities.find((each) => each.id === ref.id);
    if (!entity) return null;
    const title = entity.label || entity.id;
    return {
      key: `table:${entity.id}`,
      ref,
      title,
      detail: resourceLine(entity, resourceLabels, domainLabels, storageKnown),
      nodeId: copyEntity(entity.id),
      change: tableChange(entity, title),
      // In Diff what changed comes first: from afar this list is all a person reads (spec 043, FR-006a).
      fields: [...(entity.fields ?? [])]
        .sort((one, other) => Number(marked(other.diff)) - Number(marked(one.diff)))
        .map((field) => ({ name: field.name, type: field.type, key: keyWord(field), description: field.description, status: marked(field.diff) ? field.diff : undefined, previousType: field.previous_type, lifecycleId: field.lifecycle_id })),
      lifecycleIds: (entity.fields ?? []).flatMap((field) => field.lifecycle_id ?? []),
      copy: title,
    };
  }
  if (ref.kind !== "row") return null;
  const place = ROW.exec(ref.id);
  const entity = place ? entities[Number(place[1])] : undefined;
  const row = place ? Number(place[2]) : -1;
  const field = entity?.fields?.[row];
  if (!entity || !field) return null;
  const typeCell = root.querySelector(`[id="a_ft${place![1]}_${row}"]`);
  return {
    key: `row:${entity.id}:${field.name}`,
    ref,
    title: field.name,
    detail: (typeCell ? tooltipOf(typeCell) : "") || field.annotation || field.type || "",
    // All of it is already here: a row needs no read, and a relation's row has no node to read.
    description: field.description,
    nodeId: null,
    change: marked(field.diff) ? rowCard(entity.id, field, field.diff) : null,
    lifecycleIds: field.lifecycle_id ? [field.lifecycle_id] : [],
    copy: field.name,
  };
}
