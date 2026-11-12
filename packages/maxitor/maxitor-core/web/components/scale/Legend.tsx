// packages/maxitor/maxitor-core/web/components/scale/Legend.tsx
// The legend behind the card's "i" (spec 079, FR-010), as the graph viewer's TrackLegend lays it out: what the scale
// draws on the left — the page's points, its bars, the marks it promised and the core's own —, the keys on the right.
// Its rows come from the page's setup (legendRows.ts); this file only draws them.
"use client";

import { useId } from "react";

import type { LegendSample, LegendSection } from "@/components/scale/legendRows";
import { Flag, Point, SMALL_POINT, toneColour } from "@/components/scale/Point";

const PURPLE = { tone: "purple", look: "filled" } as const;

function Sample({ sample }: { sample: LegendSample }) {
  const hatch = `h${useId().replace(/:/g, "")}`;
  let inner;
  switch (sample.kind) {
    case "point":
      inner = (
        <>
          <path d="M6 10h28" style={{ stroke: toneColour(sample.point.tone) }} className={`mx-lane-lead${sample.point.lead === "dashed" ? " dashed" : ""}`} />
          <Point x={20} y={10} r={4.6} kind={sample.point} />
        </>
      );
      break;
    case "bars":
      inner = (
        <>
          <rect x={8} y={12} width={7} height={6} className="mx-bar-added" />
          <rect x={17} y={6} width={7} height={12} className="mx-bar-changed" />
          <rect x={26} y={9} width={7} height={9} className="mx-bar-removed" />
        </>
      );
      break;
    case "size":
      inner = (
        <>
          <Point x={13} y={10} r={2.4} kind={sample.point ?? PURPLE} />
          <Point x={27} y={10} r={3.4} kind={sample.point ?? PURPLE} />
        </>
      );
      break;
    case "flag":
      inner = (
        <>
          <Flag x={20} y={25} r={SMALL_POINT} />
          <Point x={20} y={14} r={2.6} kind={sample.point ?? PURPLE} />
        </>
      );
      break;
    case "three":
      inner = (
        <>
          <path d="M9 10h22" style={{ stroke: toneColour((sample.point ?? PURPLE).tone) }} className="mx-lane-lead" />
          <Point x={10} y={10} r={3} kind={sample.point ?? PURPLE} />
          <Point x={20} y={10} r={1.9} kind={sample.point ?? PURPLE} />
          <Point x={30} y={10} r={3} kind={sample.point ?? PURPLE} />
        </>
      );
      break;
    case "now":
      inner = (
        <>
          <defs>
            <pattern id={hatch} width={4} height={4} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1={0} y1={0} x2={0} y2={4} className="mx-legend-hatch" />
            </pattern>
          </defs>
          <line x1={20} y1={2} x2={20} y2={18} className="mx-track-now" />
          <rect x={21} y={2} width={17} height={16} fill={`url(#${hatch})`} />
        </>
      );
      break;
    default:
      inner = (
        <>
          <line x1={20} y1={2} x2={20} y2={13} className="mx-track-handle" />
          <circle cx={20} cy={13} r={3.6} className="mx-legend-knob" />
        </>
      );
  }
  return (
    <svg className="mx-legend-sample" viewBox="0 0 40 20" width={40} height={20} aria-hidden>
      {inner}
    </svg>
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

export function Legend({ sections, comparing }: { sections: LegendSection[]; comparing: boolean }) {
  return (
    <div className="mx-legend" role="tooltip">
      <div>
        {sections.map((section) => (
          <div className="mx-legend-group" key={section.title}>
            <div className="mx-legend-title">{section.title}</div>
            {section.items.map((item) => (
              <div className="mx-legend-row" key={item.term}>
                <Sample sample={item.sample} />
                <div>
                  <div className="mx-legend-term">{item.term}</div>
                  <div className="mx-legend-def">{item.def}</div>
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
