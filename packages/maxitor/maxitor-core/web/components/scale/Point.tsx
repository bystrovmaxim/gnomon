// packages/maxitor/maxitor-core/web/components/scale/Point.tsx
// A milestone's point as the core draws it for every plugin (spec 079, FR-014): its kind's tone, filled, hollow or
// dashed, as the mockup of spec 074 draws the graph viewer's track; the same point on the lane and in the legend.
"use client";

import type { Kind, Tone } from "@maxitor/panel/protocol";

/** The CSS colour of a tone of the core's palette, and of its badge's tint and ink. */
export const toneColour = (tone: Tone) => `var(--mx-tone-${tone})`;
export const toneTint = (tone: Tone) => `var(--mx-tone-${tone}-tint)`;
export const toneInk = (tone: Tone) => `var(--mx-tone-${tone}-ink)`;

/** The radius of a point, and of a small one. */
export const POINT = 4.6;
export const SMALL_POINT = 3;

export function Point({ x, y, r, kind }: { x: number; y: number; r: number; kind: Pick<Kind, "tone" | "look"> }) {
  const colour = toneColour(kind.tone);
  if (kind.look === "filled") return <circle cx={x} cy={y} r={r} style={{ fill: colour }} className="mx-point-filled" />;
  return <circle cx={x} cy={y} r={r} style={{ stroke: colour }} className={kind.look === "dashed" ? "mx-point-dashed" : "mx-point-hollow"} />;
}

/** A release's flag over a point: a stem and a pennant, as the graph's track draws a tag. */
export function Flag({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g className="mx-flag">
      <path d={`M${x} ${y - r - 1}V${y - 22}`} className="mx-flag-stem" />
      <path d={`M${x} ${y - 22}h10l-2.8 3.2 2.8 3.2h-10z`} className="mx-flag-pennant" />
    </g>
  );
}
