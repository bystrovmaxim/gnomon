// packages/maxitor/maxitor-core/web/lib/moment.ts
// The moment of the screen (spec 079, FR-002 – FR-005): written to the address as `at`, a UTC string to the microsecond
// that compares as text. A moment chosen on the scale is kept as chosen to the minute; one at the watermark's minute or
// later is "now", which the address writes as no `at` at all. Nothing here reads the clock: "now" is the watermark.

const MINUTE = 60_000;

/** A moment as the address writes it: UTC, to the microsecond at most. */
export const MOMENT_TEXT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$/;

/** The moment with its fraction written to six digits, so two moments compare as text. */
export function padded(moment: string): string {
  return moment.replace(/(\.\d+)?Z$/, (_whole, fraction?: string) => `${(fraction ?? ".").padEnd(7, "0")}Z`);
}

/** Whether `moment` is later than `watermark`: what the core refuses to read. */
export function laterThan(moment: string, watermark: string): boolean {
  return padded(moment) > padded(watermark);
}

/** Milliseconds since the epoch of a moment; the microseconds past the millisecond are dropped. */
export function msOf(moment: string): number {
  return Date.parse(padded(moment).replace(/(\.\d{3})\d{3}Z$/, "$1Z"));
}

/** The address's moment of a time on the scale: the start of its minute, written to the microsecond. */
export function momentOf(time: number): string {
  const start = Math.floor(time / MINUTE) * MINUTE;
  return new Date(start).toISOString().replace(/\.\d{3}Z$/, ".000000Z");
}

/**
 * The moment a click on the scale chooses: null — now — at the watermark's minute or later, never past it; otherwise
 * the minute clicked, kept as chosen and never moved to the start of a publication.
 */
export function chosenMoment(time: number, watermark: string): string | null {
  const now = msOf(watermark);
  if (Math.floor(time / MINUTE) >= Math.floor(now / MINUTE)) return null;
  return momentOf(time);
}

/**
 * One step of the pill's arrows (FR-005): the previous or the next change of the page from the moment shown. `changes`
 * are the moments of the page's changes — its bars' changes, or its milestones when it has only milestones —, in any
 * order. A step past the last change before now is now; null when there is no step that way.
 */
export function stepMoment(changes: readonly string[], at: string | null, watermark: string, delta: -1 | 1): string | null | undefined {
  const shown = padded(at ?? watermark);
  const sorted = [...new Set(changes.map(padded))].filter((moment) => moment <= padded(watermark)).sort();
  if (delta < 0) {
    const earlier = sorted.filter((moment) => moment < shown);
    return earlier.length ? earlier[earlier.length - 1] : undefined;
  }
  if (at === null) return undefined;
  const later = sorted.find((moment) => moment > shown);
  return later === undefined || later >= padded(watermark) ? null : later;
}

/** Whether each arrow has a step to make: the previous change exists; the next one is a change or now. */
export function canStep(changes: readonly string[], at: string | null, watermark: string): { older: boolean; newer: boolean } {
  return { older: stepMoment(changes, at, watermark, -1) !== undefined, newer: at !== null };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const two = (n: number) => String(n).padStart(2, "0");

/** A day as a reader says it, in the reader's time: "3 Nov". */
export function dayText(time: number): string {
  const date = new Date(time);
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** A minute as a reader says it: "14:05". */
export function clockText(time: number): string {
  const date = new Date(time);
  return `${two(date.getHours())}:${two(date.getMinutes())}`;
}

/** A moment on the pill and on the scale's chip: "3 Nov, 14:05"; with its year when it is not this year's. */
export function momentText(time: number, now: number): string {
  const date = new Date(time);
  const year = date.getFullYear() === new Date(now).getFullYear() ? "" : ` ${date.getFullYear()}`;
  return `${dayText(time)}${year}, ${clockText(time)}`;
}

/** A stretch of time as the scale's head says it: "45 min", "6 h", "12 days". */
export function spanText(span: number): string {
  const minutes = span / MINUTE;
  if (minutes < 120) return `${Math.round(minutes)} min`;
  const hours = minutes / 60;
  if (hours < 48) return `${Math.round(hours)} h`;
  return `${Math.round(hours / 24)} days`;
}
