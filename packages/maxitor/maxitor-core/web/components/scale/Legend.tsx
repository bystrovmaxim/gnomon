// packages/maxitor/maxitor-core/web/components/scale/Legend.tsx
// The legend behind the card's "i" (spec 079, FR-010), as the graph viewer's TrackLegend lays it out: what the scale
// draws on the left — the page's own groups first, then the core's marks, "now" and the chosen moment —, the keys on
// the right. A page's groups come from its setup; the core's marks and keys are always there.
"use client";

import { useId, type ReactNode } from "react";

export type LegendRow = { sample: ReactNode; term: string; def: string };
export type LegendGroup = { title: string; rows: LegendRow[] };

/** A sample of the legend, 40 × 20, as the scale draws the mark. */
export function Sample({ children }: { children: ReactNode }) {
  return (
    <svg className="mx-legend-sample" viewBox="0 0 40 20" width={40} height={20} aria-hidden>
      {children}
    </svg>
  );
}

function NowSample() {
  const hatch = `h${useId().replace(/:/g, "")}`;
  return (
    <Sample>
      <defs>
        <pattern id={hatch} width={4} height={4} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1={0} y1={0} x2={0} y2={4} className="mx-legend-hatch" />
        </pattern>
      </defs>
      <line x1={20} y1={2} x2={20} y2={18} className="mx-track-now" />
      <rect x={21} y={2} width={17} height={16} fill={`url(#${hatch})`} />
    </Sample>
  );
}

function MomentSample() {
  return (
    <Sample>
      <line x1={20} y1={2} x2={20} y2={13} className="mx-track-handle" />
      <circle cx={20} cy={13} r={3.6} className="mx-legend-knob" />
    </Sample>
  );
}

function Key({ keys, def }: { keys: string[]; def: string }) {
  return (
    <div className="mx-legend-key">
      <div>{keys.map((key) => <kbd key={key}>{key}</kbd>)}</div>
      <div className="mx-legend-def">{def}</div>
    </div>
  );
}

export function Legend({ groups, comparing }: { groups: LegendGroup[]; comparing: boolean }) {
  const marks: LegendGroup = {
    title: "Marks",
    rows: [
      { sample: <NowSample />, term: "Now", def: "The green dashed line. What lies right of it is hatched: it cannot be chosen yet." },
      {
        sample: <MomentSample />,
        term: "The chosen moment",
        def: comparing
          ? "A dark line with its chip under the axis; in a comparison A is hollow above, B dark below. Drag it, or click anywhere to move it."
          : "A dark line with its chip under the axis. Drag it, or click anywhere to move it.",
      },
    ],
  };
  return (
    <div className="mx-legend" role="tooltip">
      <div>
        {[...groups, marks].map((group) => (
          <div className="mx-legend-group" key={group.title}>
            <div className="mx-legend-title">{group.title}</div>
            {group.rows.map((row) => (
              <div className="mx-legend-row" key={row.term}>
                {row.sample}
                <div>
                  <div className="mx-legend-term">{row.term}</div>
                  <div className="mx-legend-def">{row.def}</div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div>
        <div className="mx-legend-group">
          <div className="mx-legend-title">Anywhere</div>
          <Key keys={["⇧", "←", "→"]} def={comparing ? "One step older or newer; with two compared, both move and keep their distance" : "One step older or newer"} />
          {comparing ? <Key keys={["⇧", "↑", "↓"]} def="The previous or the next change, when two moments are compared" /> : null}
          <Key keys={["Esc"]} def="Close a card or a list" />
        </div>
        <div className="mx-legend-group">
          <div className="mx-legend-title">On the scale</div>
          <Key keys={["drag"]} def="Across a stretch: zoom into it" />
          <Key keys={["wheel"]} def="Zoom around the pointer" />
          <Key keys={["⇧", "wheel"]} def="Move sideways" />
        </div>
      </div>
    </div>
  );
}
