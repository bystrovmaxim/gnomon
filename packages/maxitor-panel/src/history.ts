// @maxitor/panel — what a page's history actions answer the core's time scale (spec 079, history format 2): the bars of
// a stretch, the milestones with their kinds, and a milestone's card as a list of blocks the core draws from data.
// The core keeps what the page's setup promises and names the rest; nothing of a plugin runs in the core's frame.

import type { PageHistory, Tone } from "./protocol";

/** One bar of a stretch: its start and what changed in it. */
export type Bar = { start: string; added: number; changed: number; removed: number };

/** A point of the scale, where it happened; its look comes from its kind in the page's setup. */
export type Milestone = {
  id: string;
  at: string;
  ref: string;
  title: string;
  kind: string;
  /** A small point; only when the page declared `small`. */
  small?: boolean;
  /** The flag over the point, a release; only when the page declared `flag`. */
  flag?: string;
  /** Under the scale, while it is the milestone in force. */
  comment?: string;
  /** A page path choosing it opens, with the moment kept. */
  link?: string;
  /** A milestone that is no state at any moment (an open pull request): choosing it opens this page path and `at` stays. */
  opens?: string;
};

/** The pictograms a card's badge may carry. */
export const BADGE_ICONS = ["merge", "commit", "pull", "tag", "pencil", "dot", "gate", "cross", "flag", "undo"] as const;
export type BadgeIcon = (typeof BADGE_ICONS)[number];

/** A piece of a card's first line: its badge, its reference, how long ago, now, or a time in words. */
export type LinePart =
  | { badge: { icon: BadgeIcon; label: string; tone: Tone; outline?: boolean } }
  | { ref: string }
  | { ago: string }
  | { now: true }
  | { time: string };

/** A chip of a card: lines added and removed, a short count, a release, or a word. */
export type Chip = { counts: [number, number] } | { chip: string } | { release: string } | { text: string };

/** A block of a milestone's card, in the order the plugin gives them. */
export type CardBlock =
  | { line: LinePart[] }
  | { title: string }
  | { text: string }
  | { fields: [string, string][] }
  | { person: { id: string; name: string } }
  | { chips: Chip[] }
  | { warn: string };

const MOMENT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;
const text = (value: unknown): value is string => typeof value === "string";
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const count = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0;

/** The bars of an answer, when it has the shape; null otherwise. */
export function barsOf(value: unknown): Bar[] | null {
  if (!record(value) || !Array.isArray(value.bars)) return null;
  const bars: Bar[] = [];
  for (const bar of value.bars) {
    if (!record(bar) || !text(bar.start) || !MOMENT.test(bar.start) || !count(bar.added) || !count(bar.changed) || !count(bar.removed)) return null;
    bars.push({ start: bar.start, added: bar.added, changed: bar.changed, removed: bar.removed });
  }
  return bars;
}

/**
 * The milestones of an answer the page's setup allows, in time order: a milestone of a kind the page did not declare,
 * a small point without `small` and a flag without `flag` are left out and named; a milestone of another shape is
 * named too. The rest of the scale is drawn.
 */
export function acceptMilestones(value: unknown, setup: PageHistory): { kept: Milestone[]; refused: string[] } {
  const refused: string[] = [];
  if (!record(value) || !Array.isArray(value.milestones)) return { kept: [], refused: ["its milestones are not a list of milestones"] };
  const kinds = new Set(Object.keys(setup.kinds ?? {}));
  const kept: Milestone[] = [];
  for (const given of value.milestones) {
    if (!record(given) || !text(given.id) || !text(given.at) || !MOMENT.test(given.at) || !text(given.ref) || !text(given.title) || !text(given.kind)) {
      refused.push(`a milestone ${JSON.stringify(record(given) ? given.id ?? null : given)} is not of the shape of format 2`);
      continue;
    }
    const name = JSON.stringify(given.id);
    if (!kinds.has(given.kind)) refused.push(`the milestone ${name} is of the kind ${JSON.stringify(given.kind)}, which the page did not declare`);
    else if (given.small === true && setup.small === undefined) refused.push(`the milestone ${name} is small, and the page did not declare small`);
    else if (given.flag !== undefined && given.flag !== null && setup.flag === undefined) refused.push(`the milestone ${name} carries a flag, and the page did not declare flag`);
    else {
      const milestone: Milestone = { id: given.id, at: given.at, ref: given.ref, title: given.title, kind: given.kind };
      if (given.small === true) milestone.small = true;
      for (const field of ["flag", "comment", "link", "opens"] as const) if (text(given[field])) milestone[field] = given[field] as string;
      kept.push(milestone);
    }
  }
  kept.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  return { kept, refused };
}

/** The blocks of a card answer, those of a known shape; the core draws nothing else. */
export function blocksOf(value: unknown): CardBlock[] {
  const blocks = record(value) && Array.isArray(value.blocks) ? value.blocks : [];
  return blocks.filter((block): block is CardBlock => {
    if (!record(block)) return false;
    if (Array.isArray(block.line)) return block.line.every(record);
    if (text(block.title) || text(block.text) || text(block.warn)) return true;
    if (Array.isArray(block.fields)) return block.fields.every((pair) => Array.isArray(pair) && pair.length === 2 && pair.every(text));
    if (record(block.person)) return text(block.person.id) && text(block.person.name);
    if (Array.isArray(block.chips)) return block.chips.every(record);
    return false;
  });
}

/** The milestone in force at a moment: the latest one not later than it; null before the first. */
export function inForce(milestones: readonly Milestone[], moment: string): Milestone | null {
  let found: Milestone | null = null;
  for (const milestone of milestones) if (!milestone.opens && milestone.at <= moment) found = milestone;
  return found;
}
