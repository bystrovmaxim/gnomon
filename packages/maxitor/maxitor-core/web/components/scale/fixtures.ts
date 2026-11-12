// packages/maxitor/maxitor-core/web/components/scale/fixtures.ts
// The core's test page answers the scale from these fixtures (spec 079, T028), in the page's memory and through no
// endpoint: bars alone, milestones alone, both, the graph viewer's kinds with small points and flags, and a milestone
// of a kind the page did not declare. They are laid out back from the watermark, so they stay in the past.

import type { Bar, BadgeIcon, CardBlock } from "@maxitor/panel/history";
import type { PageHistory, Tone } from "@maxitor/panel/protocol";

import type { HistorySource } from "@/components/scale/source";
import { momentOf, msOf } from "@/lib/moment";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** A change of the fixtures: when, before now, and what it did. */
type Change = { ago: number; op: "added" | "changed" | "removed" };

/** 240 changes over the last 20 days, denser in working hours, from a fixed sequence so every run draws the same. */
const CHANGES: Change[] = Array.from({ length: 240 }, (_, index) => {
  const seed = (index * 2654435761) % 4294967296;
  const day = seed % 20;
  const hour = 8 + ((seed >> 5) % 10);
  const minute = (seed >> 9) % 60;
  return { ago: day * DAY + (24 - hour) * HOUR - minute * 60_000, op: (["added", "changed", "changed", "removed"] as const)[(seed >> 13) % 4] };
});

type Point = { id: string; ago: number; ref: string; title: string; kind: string; small?: boolean; flag?: string; comment?: string; opens?: string; blocks: CardBlock[] };

const person = (id: string, name: string) => ({ person: { id, name } });

const PUBLICATIONS: Point[] = [
  { id: "v1", ago: 18 * DAY, ref: "v1", title: "First review", kind: "published", comment: "The notes agreed at the first review of the service.", blocks: [] },
  { id: "v2", ago: 13 * DAY, ref: "v2", title: "Refunds and settlement", kind: "published", comment: "Refunds keep the original fee; settlement imports by 06:00.", blocks: [] },
  { id: "v3", ago: 9 * DAY, ref: "v3", title: "Retry policy", kind: "published", comment: "Retries go up to five; the import deadline moves to 05:30.", blocks: [] },
  { id: "v4", ago: 4 * DAY, ref: "v4", title: "Back to v2", kind: "rollback", comment: "The retry change of v3 broke the settlement import; the notes go back to v2 until it is fixed.", blocks: [] },
  { id: "v5", ago: 2 * DAY, ref: "v5", title: "Retry policy, fixed", kind: "published", comment: "Five retries again, with the import's own timeout.", blocks: [] },
];

const GRAPH: Point[] = [
  { id: "pr41", ago: 19 * DAY, ref: "#41", title: "Payments follow the logical data model", kind: "merged", comment: "Payments follow the logical data model: two entities, three links.", blocks: [] },
  { id: "pr44", ago: 15 * DAY, ref: "#44", title: "Bump vite from 5.4.8 to 5.4.11", kind: "merged", small: true, comment: "Bumps vite from 5.4.8 to 5.4.11.", blocks: [] },
  { id: "a3f", ago: 11 * DAY, ref: "a3f9e1c", title: "Release 4.2.0", kind: "direct", flag: "maxitor-v4.2.0", comment: "Release 4.2.0.", blocks: [] },
  { id: "pr62", ago: 6 * DAY, ref: "#62", title: "The constitution follows the logical data model", kind: "merged", comment: "Every data source is named once; links are read from the model.", blocks: [] },
  { id: "pr65", ago: 3 * DAY, ref: "#65", title: "Settlement files carry their own schema", kind: "review_required", opens: "/canvas", blocks: [] },
  { id: "pr66", ago: 2 * DAY, ref: "#66", title: "Refunds get their own table", kind: "approved", opens: "/canvas", blocks: [] },
  { id: "pr67", ago: 1 * DAY, ref: "#67", title: "Ledger moves to the billing schema", kind: "changes_requested", opens: "/canvas", blocks: [] },
];

const ODD: Point[] = [
  { id: "v1", ago: 10 * DAY, ref: "v1", title: "First review", kind: "published", comment: "Kept: its kind is declared.", blocks: [] },
  { id: "x1", ago: 6 * DAY, ref: "x1", title: "A kind nobody declared", kind: "shiny", blocks: [] },
  { id: "v2", ago: 3 * DAY, ref: "v2", title: "Second review", kind: "published", small: true, comment: "Dropped: small without small.", blocks: [] },
];

/** The card of a fixture's point, built as a plugin builds its blocks. */
function blocksOf(point: Point, now: number): CardBlock[] {
  const at = momentOf(now - point.ago);
  const badges: Record<string, { icon: BadgeIcon; label: string; tone: Tone }> = {
    published: { icon: "tag", label: "Published", tone: "purple" },
    rollback: { icon: "undo", label: "Rolled back", tone: "red" },
    merged: { icon: "merge", label: "Merged", tone: "purple" },
    direct: { icon: "commit", label: "Pushed directly", tone: "neutral" },
    review_required: { icon: "pull", label: "Review required", tone: "amber" },
    approved: { icon: "pull", label: "Approved", tone: "green" },
    changes_requested: { icon: "pull", label: "Changes requested", tone: "red" },
  };
  const badge = badges[point.kind] ?? { icon: "dot", label: point.kind, tone: "neutral" };
  return [
    { line: [{ badge }, { ref: point.ref }, point.opens ? { time: "open" } : { ago: at }] },
    { title: point.title },
    ...(point.kind === "rollback" ? [{ text: "to v2 · everything published after it stays in the history" }] : []),
    point.kind.startsWith("p") || point.kind === "rollback" ? person("olga", "Olga Sokolova") : person("bystrovmaxim", "bystrovmaxim"),
    { chips: point.flag ? [{ release: point.flag }, { chip: "1 file" }] : point.kind === "merged" ? [{ counts: [312, 40] }, { chip: "22 files" }] : [{ chip: "12 notes" }, { text: "+2 notes · 1 changed" }] },
  ];
}

const SETS: Record<string, Point[]> = { list_test_history: PUBLICATIONS, list_graph_history: GRAPH, list_odd_history: ODD };

/** The test page's history, answered from the fixtures its setup names. */
export function fixtureSource(history: PageHistory, watermark: string): HistorySource {
  const now = msOf(watermark);
  const points = (history.milestones && SETS[history.milestones]) || [];
  const milestones = points.map((point) => ({
    id: point.id,
    at: momentOf(now - point.ago),
    ref: point.ref,
    title: point.title,
    kind: point.kind,
    ...(point.small ? { small: true } : {}),
    ...(point.flag ? { flag: point.flag } : {}),
    ...(point.comment ? { comment: point.comment } : {}),
    ...(point.opens ? { opens: point.opens } : {}),
  }));
  return {
    key: JSON.stringify(["core", history]),
    bars: history.read || history.bars
      ? async (from, to, width) => {
          const start = msOf(from);
          const end = msOf(to);
          const step = width * 1000;
          const bars = new Map<number, Bar>();
          for (const change of CHANGES) {
            const time = now - change.ago;
            if (time < start || time >= end) continue;
            const slot = start + Math.floor((time - start) / step) * step;
            const bar = bars.get(slot) ?? { start: momentOf(slot), added: 0, changed: 0, removed: 0 };
            bar[change.op] += 1;
            bars.set(slot, bar);
          }
          return [...bars.entries()].sort(([a], [b]) => a - b).map(([, bar]) => bar);
        }
      : null,
    milestones: history.milestones ? async () => ({ milestones }) : null,
    card: history.card ? async (id) => {
      const point = points.find((each) => each.id === id);
      return point ? blocksOf(point, now) : [];
    } : null,
  };
}
