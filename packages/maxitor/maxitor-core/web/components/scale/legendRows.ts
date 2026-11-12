// packages/maxitor/maxitor-core/web/components/scale/legendRows.ts
// The legend built from the page's setup (spec 079, FR-010; contracts/page-history-2.md): Points are the page's kinds in
// their order with their words; Bars only with bars; Size, Flag and Three points only with what the page promised,
// each with the page's own sentence; Now and the chosen moment always. The rows are data; Legend.tsx draws them.

import type { Kind, PageHistory } from "@maxitor/panel/protocol";

export type LegendSample = { kind: "point"; point: Kind } | { kind: "bars" } | { kind: "size"; point: Kind | null } | { kind: "flag"; point: Kind | null } | { kind: "three"; point: Kind | null } | { kind: "now" } | { kind: "moment" };
export type LegendItem = { sample: LegendSample; term: string; def: string };
export type LegendSection = { title: string; items: LegendItem[] };

/** The legend of a setup, its sections in the order the card shows them. */
export function legendOf(setup: PageHistory, comparing: boolean): LegendSection[] {
  const kinds = Object.values(setup.kinds ?? {});
  const first = kinds[0] ?? null;
  const sections: LegendSection[] = [];
  if (kinds.length) sections.push({ title: "Points", items: kinds.map((point) => ({ sample: { kind: "point", point }, term: point.term, def: point.def })) });
  if (setup.read || setup.bars) {
    sections.push({
      title: "Bars",
      items: [{ sample: { kind: "bars" }, term: "Changes", def: "A bar counts what was added, changed and removed in its stretch of time; bars get finer as you zoom in, from a week to a second." }],
    });
  }
  const marks: LegendItem[] = [];
  if (setup.small) marks.push({ sample: { kind: "size", point: first }, term: "Size", def: `${setup.small} The three points in the card's head hide the smaller ones.` });
  if (setup.flag) marks.push({ sample: { kind: "flag", point: first }, term: "Flag", def: `${setup.flag}${setup.small ? " With smaller points hidden, their flags stand on the point before them." : ""}` });
  if (setup.small) marks.push({ sample: { kind: "three", point: first }, term: "Three points", def: "In the card's head: coloured while the smaller points are shown, grey while they are hidden. Only you see it; a chosen point stays." });
  marks.push({ sample: { kind: "now" }, term: "Now", def: "The green dashed line. What lies right of it is hatched: it cannot be chosen yet." });
  marks.push({
    sample: { kind: "moment" },
    term: "The chosen moment",
    def: comparing
      ? "A dark line with its chip under the axis; in a comparison A is hollow above, B dark below. Drag it, or click anywhere to move it."
      : "A dark line with its chip under the axis. Drag it, or click anywhere to move it.",
  });
  sections.push({ title: "Marks", items: marks });
  return sections;
}
