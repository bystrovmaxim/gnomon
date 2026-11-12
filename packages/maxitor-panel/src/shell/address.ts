// @maxitor/panel — how the shell's controls write the panel address (spec 078, FR-004, FR-008, FR-011, FR-012).
// Pure functions, so the rules are checked without a browser: a filter lists the options switched on and is absent
// when all are on; a choice drops its default; a value missing from the page's new options gives way to the
// default; the core's names are never written by a page.
import type { Query } from "../protocol";

/** The layer pills' parameter. */
export const LAYER = "layer";
/** The paint switch's parameter: the param of the filter section that paints the drawing. */
export const PAINT = "paint";

/** The names that belong to the core: the moment, the time scale's mode and its other moment, and every `_…`. */
const CORE_NAMES = new Set(["at", "mode", "from"]);

/** Whether a parameter belongs to the core; names are compared case ignored. */
export function isReserved(name: string): boolean {
  const lower = name.toLowerCase();
  return CORE_NAMES.has(lower) || lower.startsWith("_");
}

/** The names of a write a page may not make, in the order it gives them. */
export function reservedIn(query: Query): string[] {
  return Object.keys(query).filter(isReserved);
}

/** The options of a filter switched on: every option when the address lists none; unknown listed values ignored. */
export function filterOn(listed: string | undefined, keys: readonly string[]): Set<string> {
  if (listed === undefined) return new Set(keys);
  const known = new Set(keys);
  return new Set(listed.split(",").filter((key) => known.has(key)));
}

/** The address value after switching one option: the options on, in the page's order, or null when all are on. */
export function toggleFilter(listed: string | undefined, keys: readonly string[], key: string): string | null {
  const on = filterOn(listed, keys);
  if (on.has(key)) on.delete(key);
  else on.add(key);
  return keys.every((each) => on.has(each)) ? null : keys.filter((each) => on.has(each)).join(",");
}

/** The value a choice shows: the address's when it is one of the options, else the default. */
export function chosen(value: string | undefined, fallback: string, options: readonly string[]): string {
  return value !== undefined && options.includes(value) ? value : fallback;
}

/** Whether the address holds a value the page no longer offers: the shell then drops it once, by replace. */
export function isMissing(value: string | undefined, options: readonly string[]): boolean {
  return value !== undefined && !options.includes(value);
}

/** The address value of a choice: null at its default, so the default is never written. */
export function writeChoice(value: string, fallback: string): string | null {
  return value === fallback ? null : value;
}

/** The two numbers a range of numbers holds — `100..250`, either side empty — each null when open or not a number. */
export function readNumbers(value: string | undefined): { from: number | null; to: number | null } {
  const [from = "", to = ""] = value?.includes("..") ? value.split("..", 2) : [];
  const number = (text: string) => (text.trim() !== "" && Number.isFinite(Number(text)) ? Number(text) : null);
  return { from: number(from), to: number(to) };
}

/** The address value of a range of numbers, or null when both bounds are open. A bound that is not a number stays out. */
export function writeNumbers(from: string, to: string): string | null {
  const clean = (text: string) => (text.trim() !== "" && Number.isFinite(Number(text)) ? text.trim() : "");
  const range = `${clean(from)}..${clean(to)}`;
  return range === ".." ? null : range;
}

/** Whether a number lies inside a range of numbers written in the address; a missing number only in an open range. */
export function numberIn(value: number | null | undefined, range: string | undefined): boolean {
  const { from, to } = readNumbers(range);
  if (value === null || value === undefined) return from === null && to === null;
  return (from === null || value >= from) && (to === null || value <= to);
}

/** How many sections the address filters by: the count the phone's Filters button shows. */
export function filtersOn(params: readonly string[], query: Query): number {
  return params.filter((param) => query[param] !== undefined).length;
}

/** The values of a long choice a search keeps, or its first ``shown`` when nothing is searched and it is folded. */
export function visibleRows<Row extends { label: string }>(rows: readonly Row[], search: string, unfolded: boolean, shown = 8): { rows: Row[]; more: number } {
  const text = search.trim().toLowerCase();
  if (text) return { rows: rows.filter((row) => row.label.toLowerCase().includes(text)), more: 0 };
  if (unfolded || rows.length <= shown) return { rows: [...rows], more: 0 };
  return { rows: rows.slice(0, shown), more: rows.length - shown };
}

/** The query with one parameter set, or removed when the value is null. */
export function withParam(query: Query, name: string, value: string | null): Query {
  const next = { ...query };
  if (value === null) delete next[name];
  else next[name] = value;
  return next;
}

/** Whether the page's actions show: only at now, never in the past or in a comparison. */
export function actionsShown(query: Query, at: string | null | undefined): boolean {
  return !at && query.mode === undefined;
}

/** The core's names a write would change — add, alter or drop — against the address it starts from. */
export function changedReserved(next: Query, current: Query): string[] {
  const names = new Set([...Object.keys(next), ...Object.keys(current)].filter(isReserved));
  return [...names].filter((name) => next[name] !== current[name]);
}

/**
 * Check a write of the panel router: a page carries the core's names as the address holds them, and may not change
 * them. Under development and tests a change throws an error naming the parameters; in production it is one line in
 * the console. Answers whether the write may go on.
 */
export function checkWrite(next: Query, current: Query, production: boolean, report: (text: string) => void = console.error): boolean {
  const refused = changedReserved(next, current);
  if (refused.length === 0) return true;
  const text = `@maxitor/panel: a page may not change ${refused.map((name) => JSON.stringify(name)).join(", ")}; at, mode, from and every name starting with _ are Maxitor's`;
  if (!production) throw new Error(text);
  report(text);
  return false;
}
