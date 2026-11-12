// packages/maxitor/maxitor-core/web/components/scale/geometry.ts
// The scale's geometry (spec 079, FR-003, FR-012), as the accepted mockup of spec 074 draws it: time to x and back,
// the stretch in view and its presets, the width of a bar — from a week down to a second as one zooms in —, the steps
// of the time axis, and "now" with the hatched future right of it. Pure functions: the card draws what they say.

export const SECOND = 1000;
export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** The widths a bar may take, the finest first. */
export const BAR_STEPS = [SECOND, 2 * SECOND, 5 * SECOND, 10 * SECOND, 15 * SECOND, 30 * SECOND, MINUTE, 2 * MINUTE, 5 * MINUTE, 10 * MINUTE, 15 * MINUTE, 30 * MINUTE, HOUR, 2 * HOUR, 3 * HOUR, 6 * HOUR, 12 * HOUR, DAY, 2 * DAY, 7 * DAY];
/** The steps of the time axis's lines and dates, the finest first. */
export const TICK_STEPS = [5 * SECOND, 10 * SECOND, 15 * SECOND, 30 * SECOND, MINUTE, 2 * MINUTE, 5 * MINUTE, 10 * MINUTE, 15 * MINUTE, 30 * MINUTE, HOUR, 2 * HOUR, 3 * HOUR, 6 * HOUR, 12 * HOUR, DAY, 2 * DAY, 7 * DAY, 14 * DAY];

/** The presets of the zoom, in the order the card shows them; All shows the whole history. */
export const PRESETS: readonly { label: string; span: number | null }[] = [
  { label: "1 min", span: MINUTE },
  { label: "10 min", span: 10 * MINUTE },
  { label: "1 h", span: HOUR },
  { label: "1 d", span: DAY },
  { label: "7 d", span: 7 * DAY },
  { label: "30 d", span: 30 * DAY },
  { label: "All", span: null },
];

/** The narrowest stretch one can zoom into: a minute, so changes seconds apart stand apart. */
export const MIN_SPAN = MINUTE;
/** A bar is at least this many pixels wide; the axis keeps this many pixels between two dates. */
const BAR_PIXELS = 9;
const TICK_PIXELS = 78;

/** The stretch of time in view, its start and its end in milliseconds. */
export type View = { from: number; to: number };

/** The width of a bar for a stretch drawn `width` pixels wide: the finest that keeps a bar at least 9 px wide. */
export function barStep(span: number, width: number): number {
  return BAR_STEPS.find((step) => span / step <= width / BAR_PIXELS) ?? BAR_STEPS[BAR_STEPS.length - 1];
}

/** The step of the axis for a stretch drawn `width` pixels wide: the finest that keeps dates 78 px apart. */
export function tickStep(span: number, width: number): number {
  return TICK_STEPS.find((step) => span / step <= width / TICK_PIXELS) ?? TICK_STEPS[TICK_STEPS.length - 1];
}

/**
 * The whole history the scale may show: from a day before its first change — a week before now when it has none — to
 * a little past now, so "now" and the hatch right of it are always in view at All.
 */
export function domainOf(first: number | null, now: number): View {
  const from = (first ?? now - 7 * DAY) - DAY;
  return { from, to: now + (now - from) * 0.025 };
}

/** A stretch kept inside the history and no narrower than a minute, its width kept when it is moved against an edge. */
export function clampView(view: View, domain: View): View {
  const span = Math.min(Math.max(view.to - view.from, MIN_SPAN), domain.to - domain.from);
  const from = Math.min(Math.max(view.from, domain.from), domain.to - span);
  return { from, to: from + span };
}

/**
 * The stretch a preset shows: at now, now stands near the right edge so most of the stretch is the past; at a chosen
 * moment, the moment stands in the middle; All is the whole history.
 */
export function presetView(span: number | null, moment: number | null, now: number, domain: View): View {
  if (span === null) return domain;
  const view = moment === null ? { from: now - span * 0.92, to: now + span * 0.08 } : { from: moment - span / 2, to: moment + span / 2 };
  return clampView(view, domain);
}

/** The stretch after zooming by `factor` around the time `at`: below 1 zooms in, above 1 out. */
export function zoomView(view: View, at: number, factor: number, domain: View): View {
  return clampView({ from: at - (at - view.from) * factor, to: at + (view.to - at) * factor }, domain);
}

/** The stretch moved by `shift` milliseconds, its width kept. */
export function moveView(view: View, shift: number, domain: View): View {
  return clampView({ from: view.from + shift, to: view.to + shift }, domain);
}

/** The x of a time in a stretch drawn `width` pixels wide. */
export function xOf(time: number, view: View, width: number): number {
  return ((time - view.from) / (view.to - view.from)) * width;
}

/** The time at an x of a stretch drawn `width` pixels wide. */
export function timeAt(x: number, view: View, width: number): number {
  return view.from + (x / width) * (view.to - view.from);
}

/** A tick of the axis: whether it starts a day — drawn stronger and dated —, and whether its time is said to the second. */
export type Tick = { time: number; day: boolean; dated: boolean; seconds: boolean };

/** The ticks of the axis in a stretch; below a minute apart they say their seconds. */
export function ticksOf(view: View, width: number, dayStart: (time: number) => boolean): Tick[] {
  const step = tickStep(view.to - view.from, width);
  const ticks: Tick[] = [];
  for (let time = Math.ceil(view.from / step) * step; time <= view.to; time += step) {
    const day = dayStart(time);
    ticks.push({ time, day, dated: step >= DAY || day, seconds: step < MINUTE });
  }
  return ticks;
}

/** Where the hatch of the future starts in a stretch drawn `width` pixels wide; null when now is right of the view. */
export function hatchFrom(now: number, view: View, width: number): number | null {
  const x = xOf(now, view, width);
  return x >= width ? null : Math.max(0, x);
}

/** One step of glide towards a target, as the mockup moves the scale: about 450 ms from a preset to its stretch. */
export function glide(current: View, target: View): { view: View; done: boolean } {
  const k = 0.22;
  const view = { from: current.from + (target.from - current.from) * k, to: current.to + (target.to - current.to) * k };
  const done = Math.abs(target.from - view.from) + Math.abs(target.to - view.to) < (target.to - target.from) * 2e-4;
  return done ? { view: target, done } : { view, done };
}
