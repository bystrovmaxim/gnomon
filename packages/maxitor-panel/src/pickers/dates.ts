// @maxitor/panel — dates and their bounds as the shell's range filters and both date pickers write them (spec 081,
// FR-010, FR-014 – FR-018). Pure functions, so every rule is checked without a browser. A bound is written as the
// address keeps it: a day `2026-03-05`, a month `2026-03`, or a bound that moves with today — `now`, `now-90d`,
// `now/M`, `now-1y/y` — counted from the real today whatever moment the page is read at.

/** A bound as written: a day, a month, a moving bound, or "" for none. */
export type Bound = string;
/** A range as written: two bounds, either of them "". */
export type Range = { from: Bound; to: Bound };
/** A ready stretch of the range picker, or a ready date of the date picker (`to` absent). */
export type Preset = { label: string; from: Bound; to?: Bound };
/** The unit a picker chooses in; a day for now. */
export type Unit = "day";

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONTHS_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const WEEKDAYS_LONG = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const UNITS: Record<string, [string, string]> = { d: ["day", "days"], w: ["week", "weeks"], M: ["month", "months"], y: ["year", "years"] };
const PERIODS: Record<string, string> = { M: "month", Q: "quarter", y: "year" };
const MOVING = /^now(?:-(\d+)([dwMy]))?(?:\/([dMQy]))?$/;
const DAY_MS = 86_400_000;

/** The core's ready stretches of the range picker; a page adds its own below them. */
export const RANGE_PRESETS: Preset[] = [
  { label: "Today", from: "now/d", to: "now" },
  { label: "Last 7 days", from: "now-7d", to: "now" },
  { label: "Last 30 days", from: "now-30d", to: "now" },
  { label: "Last 90 days", from: "now-90d", to: "now" },
  { label: "This month", from: "now/M", to: "now" },
  { label: "This quarter", from: "now/Q", to: "now" },
  { label: "This year", from: "now/y", to: "now" },
  { label: "Last year", from: "now-1y/y", to: "now-1y/y" },
];

/** The core's ready dates of the date picker. */
export const DATE_PRESETS: Preset[] = [
  { label: "Today", from: "now" },
  { label: "Yesterday", from: "now-1d" },
  { label: "A week ago", from: "now-7d" },
  { label: "Start of this month", from: "now/M" },
  { label: "Start of this quarter", from: "now/Q" },
  { label: "Start of this year", from: "now/y" },
];

/** Today as a day, in UTC. */
export function today(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function isoOf(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

function timeOf(day: string): number {
  return Date.parse(`${day}T00:00:00Z`);
}

/** The day ``n`` units before ``day``. */
export function shift(day: string, n: number, unit: string): string {
  const time = new Date(timeOf(day));
  if (unit === "d") time.setUTCDate(time.getUTCDate() - n);
  if (unit === "w") time.setUTCDate(time.getUTCDate() - 7 * n);
  if (unit === "M") time.setUTCMonth(time.getUTCMonth() - n);
  if (unit === "y") time.setUTCFullYear(time.getUTCFullYear() - n);
  return isoOf(time.getTime());
}

/** The first or the last day of the period of ``unit`` that holds ``day``. */
export function periodEdge(day: string, unit: string, end: boolean): string {
  const [year, month] = day.split("-").map(Number);
  if (unit === "M") return end ? isoOf(Date.UTC(year, month, 0)) : isoOf(Date.UTC(year, month - 1, 1));
  if (unit === "Q") {
    const first = Math.floor((month - 1) / 3) * 3;
    return end ? isoOf(Date.UTC(year, first + 3, 0)) : isoOf(Date.UTC(year, first, 1));
  }
  if (unit === "y") return end ? `${year}-12-31` : `${year}-01-01`;
  return day;
}

/** Whether a bound moves with today. */
export function isMoving(bound: Bound): boolean {
  return bound.startsWith("now");
}

/**
 * The day a bound reads on ``now``: a day as written; a month's first day, or its last for the end of a range; a
 * moving bound counted from today. "" for no bound or one that cannot be read.
 */
export function resolve(bound: Bound, end: boolean, now: string = today()): string {
  if (!bound) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(bound)) return bound;
  if (/^\d{4}-\d{2}$/.test(bound)) return periodEdge(`${bound}-01`, "M", end);
  const found = bound.match(MOVING);
  if (!found) return "";
  let day = found[1] ? shift(now, Number(found[1]), found[2]) : now;
  if (found[3]) day = periodEdge(day, found[3], end);
  return day;
}

/** A day as people read it: `5 Mar 2026`. */
export function dayLabel(day: string): string {
  const [year, month, date] = day.split("-");
  return `${Number(date)} ${MONTHS[Number(month) - 1]} ${year}`;
}

/** A day with its weekday: `Thu, 5 Mar 2026`. */
export function weekdayLabel(day: string): string {
  return `${WEEKDAYS_LONG[new Date(timeOf(day)).getUTCDay()]}, ${dayLabel(day)}`;
}

/** How a moving bound is set, in words — "30 days ago", "this month, start" — or "" for a fixed one. */
export function howSet(bound: Bound, end: boolean): string {
  const found = bound.match(MOVING);
  if (!found) return "";
  if (!found[1] && !found[3]) return "now";
  const edge = end ? ", end" : ", start";
  if (found[3] === "d" && !found[1]) return end ? "end of today" : "today";
  if (found[3]) {
    const which = found[1] ? (found[1] === "1" ? "last " : `${found[1]} ${UNITS[found[2]][1]} ago, `) : "this ";
    return `${which}${PERIODS[found[3]] ?? "day"}${edge}`;
  }
  return `${found[1]} ${UNITS[found[2]][Number(found[1]) === 1 ? 0 : 1]} ago`;
}

/** The date a bound shows, the same for a fixed and a moving bound; "the start" or "the end" for none. */
export function boundDate(bound: Bound, end: boolean, now: string = today()): string {
  const day = resolve(bound, end, now);
  return day ? dayLabel(day) : end ? "the end" : "the start";
}

/**
 * What a person typed, as a bound: `2026-03-05`, `5 Mar 2026`, `today`, `30 days ago`, `30d`, `6 months ago`, `1y`;
 * "" for an empty field; null for text that is not a date, which leaves the bound as it was.
 */
export function parseTyped(text: string): Bound | null {
  const typed = text.trim().toLowerCase();
  if (!typed) return "";
  if (typed === "today" || typed === "now") return "now";
  let found = typed.match(/^(\d+)\s*(d|days?|w|weeks?|m|months?|y|years?)(\s+ago)?$/);
  if (found) {
    const unit = ({ d: "d", w: "w", m: "M", y: "y" } as Record<string, string>)[found[2][0]];
    return Number(found[1]) ? `now-${Number(found[1])}${unit}` : "now";
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(typed) && !Number.isNaN(timeOf(typed)) && isoOf(timeOf(typed)) === typed) return typed;
  found = typed.match(/^(\d{1,2})\s+([a-z]{3})[a-z]*\.?\s+(\d{4})$/);
  if (found) {
    const month = MONTHS.findIndex((name) => name.toLowerCase() === found![2]);
    const day = `${found[3]}-${String(month + 1).padStart(2, "0")}-${found[1].padStart(2, "0")}`;
    if (month >= 0 && isoOf(timeOf(day)) === day) return day;
  }
  return null;
}

/** A fixed bound made to move with today (`now-30d`), or a moving bound fixed at the day it reads today. */
export function toggleMoving(bound: Bound, end: boolean, now: string = today()): Bound {
  if (!bound) return bound;
  if (isMoving(bound)) return resolve(bound, end, now);
  const days = Math.round((timeOf(now) - timeOf(resolve(bound, end, now))) / DAY_MS);
  return days > 0 ? `now-${days}d` : "now";
}

/** How many days a range holds, both ends counted; null while an end is open. */
export function daysIn(range: Range, now: string = today()): number | null {
  const from = resolve(range.from, false, now);
  const to = resolve(range.to, true, now);
  return from && to ? Math.round((timeOf(to) - timeOf(from)) / DAY_MS) + 1 : null;
}

/** A range in words for the picker's foot: `5 Mar 2026 → the end · 12 days`. */
export function rangeSummary(range: Range, now: string = today()): string {
  const days = daysIn(range, now);
  const span = days ? ` · ${days} ${days === 1 ? "day" : "days"}` : "";
  return `${boundDate(range.from, false, now)} → ${boundDate(range.to, true, now)}${span}`;
}

/** The address value of a range — `from..to`, either side empty — or null when both are open. */
export function writeRange(range: Range): string | null {
  return range.from || range.to ? `${range.from}..${range.to}` : null;
}

/** A range from its address value; both bounds open when the value is absent or not a range. */
export function readRange(value: string | undefined): Range {
  if (!value || !value.includes("..")) return { from: "", to: "" };
  const [from, to] = value.split("..", 2);
  return { from, to };
}

/** The first day a bound allows (a day, or a month's first day); "" for none. */
export function lowest(bound: Bound | undefined, now: string = today()): string {
  return bound ? resolve(bound, false, now) : "";
}

/** The last day a bound allows (a day, or a month's last day); "" for none. */
export function highest(bound: Bound | undefined, now: string = today()): string {
  return bound ? resolve(bound, true, now) : "";
}

/** A day held inside the bounds. */
export function clampDay(day: string, min: string, max: string): string {
  if (min && day < min) return min;
  if (max && day > max) return max;
  return day;
}

/** The month `YYYY-MM` that lies ``n`` months after ``month``. */
export function addMonths(month: string, n: number): string {
  const [year, number] = month.split("-").map(Number);
  return isoOf(Date.UTC(year, number - 1 + n, 1)).slice(0, 7);
}

/**
 * The left month the range picker shows, so that the months it shows lie inside the bounds: ``shown`` months from
 * it, held between the first allowed month and the last allowed month less the months after it.
 */
export function viewMonth(month: string, min: string, max: string, shown: number): string {
  const first = min ? min.slice(0, 7) : "";
  const last = max ? addMonths(max.slice(0, 7), 1 - shown) : "";
  if (last && month > last) return first && last < first ? first : last;
  if (first && month < first) return first;
  return month;
}

/** One cell of a month's grid: a day of the month, or an empty cell before or after it. */
export type DayCell = { day: string; inMonth: boolean };

/** The six weeks of a month from Monday, as the grid draws them. */
export function monthGrid(month: string): DayCell[] {
  const [year, number] = month.split("-").map(Number);
  const first = Date.UTC(year, number - 1, 1);
  const offset = (new Date(first).getUTCDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, index) => {
    const day = isoOf(first + (index - offset) * DAY_MS);
    return { day, inMonth: Number(day.slice(5, 7)) === number };
  });
}

/**
 * The range after a day is chosen: a day for From moves on to To and drops an end that lay before it; a day for To
 * before the start becomes the start; any other is the end. Answers the range and the field chosen next.
 */
export function pickDay(range: Range, active: "from" | "to", day: string, now: string = today()): { range: Range; active: "from" | "to" } {
  const from = resolve(range.from, false, now);
  const to = resolve(range.to, true, now);
  if (active === "from") return { range: { from: day, to: to && to < day ? "" : range.to }, active: "to" };
  if (from && day < from) return { range: { ...range, from: day }, active: "to" };
  return { range: { ...range, to: day }, active: "to" };
}

/** A typed bound put into a range: held inside the bounds, and the ends swapped when the start would follow the end. */
export function typeBound(range: Range, which: "from" | "to", bound: Bound, min: string, max: string, now: string = today()): Range {
  const held = bound && !isMoving(bound) ? clampDay(resolve(bound, which === "to", now), min, max) : bound;
  const next = { ...range, [which]: held };
  const from = resolve(next.from, false, now);
  const to = resolve(next.to, true, now);
  return from && to && from > to ? { from: next.to, to: next.from } : next;
}

/** Whether a day lies inside a range written in the address, read on ``now``; a missing day lies only in an open range. */
export function inRange(day: string | null | undefined, range: Range, now: string = today()): boolean {
  const from = resolve(range.from, false, now);
  const to = resolve(range.to, true, now);
  if (!day) return !range.from && !range.to;
  const date = day.slice(0, 10);
  return (!from || date >= from) && (!to || date <= to);
}
