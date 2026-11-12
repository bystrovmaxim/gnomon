// packages/maxitor/maxitor-core/web/components/scale/Tip.tsx
// A milestone's card (spec 079, FR-015), in the frame of the graph viewer's VersionTip as the mockup of spec 074 draws
// it: the plugin's blocks in its order — its first line with a badge, the reference and when; the title; a line of
// text; fields; a person; chips; a warning —, each drawn by the core from data alone.
"use client";

import type { BadgeIcon, CardBlock, Chip, LinePart } from "@maxitor/panel/history";

import { toneInk, toneTint, toneColour } from "@/components/scale/Point";
import { colorOf, initials } from "@/lib/colors";
import { msOf } from "@/lib/moment";

/** The badges' pictograms, 12 px strokes, as the mockup of spec 074 draws the graph viewer's. */
const ICONS: Record<BadgeIcon, string> = {
  merge: "M6 7.2v9.6M6 8c0 3 3 4 9.8 4",
  commit: "M3 12h5.8M15.2 12H21",
  pull: "M6 7.2v9.6M18 16.8V9a3 3 0 00-3-3h-4M13 4l-2 2 2 2",
  tag: "M4 12V4h8l8 8-8 8z",
  pencil: "M4 20h4L19 9l-4-4L4 16v4z",
  dot: "",
  gate: "M5 20V8l7-4 7 4v12M9 20v-6h6v6",
  cross: "M6 6l12 12M18 6L6 18",
  flag: "M6 21V4M6 4h11l-2.5 3.5L17 11H6",
  undo: "M9 7L4 12l5 5M4 12h10a6 6 0 010 12h-2",
};
const CIRCLES: Partial<Record<BadgeIcon, [number, number, number][]>> = {
  merge: [[6, 5, 2.2], [6, 19, 2.2], [18, 12, 2.2]],
  commit: [[12, 12, 3.2]],
  pull: [[6, 5, 2.2], [6, 19, 2.2], [18, 19, 2.2]],
  tag: [[8.5, 8.5, 1.3]],
  dot: [[12, 12, 4]],
};

function BadgeIconMark({ icon }: { icon: BadgeIcon }) {
  return (
    <svg className="mx-tip-badge-icon" viewBox="0 0 24 24" aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
        {(CIRCLES[icon] ?? []).map(([cx, cy, r]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />)}
        {ICONS[icon] ? <path d={ICONS[icon]} /> : null}
      </g>
    </svg>
  );
}

/** How long ago a moment was, as a reader says it. */
export function agoText(moment: string, now: number): string {
  const minutes = Math.round((now - msOf(moment)) / 60_000);
  if (minutes < 2) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 20) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

function Part({ part, now }: { part: LinePart; now: number }) {
  if ("badge" in part) {
    const { badge } = part;
    return (
      <span
        className={`mx-tip-badge${badge.outline ? " outline" : ""}`}
        style={{ background: badge.outline ? undefined : toneTint(badge.tone), color: toneInk(badge.tone), borderColor: badge.outline ? toneColour(badge.tone) : undefined }}
      >
        <BadgeIconMark icon={badge.icon} />
        {badge.label}
      </span>
    );
  }
  if ("ref" in part) return <span className="mx-tip-ref">{part.ref}</span>;
  if ("ago" in part) return <span className="mx-tip-ago">{agoText(part.ago, now)}</span>;
  if ("now" in part) return <span className="mx-tip-ago">now</span>;
  return <span className="mx-tip-ago">{part.time}</span>;
}

function ChipView({ chip }: { chip: Chip }) {
  if ("counts" in chip) {
    return (
      <span className="mx-tip-chip">
        <span className="mx-count-added">+{chip.counts[0]}</span>
        <span className="mx-count-removed">−{chip.counts[1]}</span>
      </span>
    );
  }
  if ("chip" in chip) return <span className="mx-tip-chip">{chip.chip}</span>;
  if ("release" in chip) {
    return (
      <span className="mx-tip-chip release">
        <BadgeIconMark icon="flag" />
        {chip.release}
      </span>
    );
  }
  return <span className="mx-tip-small">{chip.text}</span>;
}

function Block({ block, now }: { block: CardBlock; now: number }) {
  if ("line" in block) return <div className="mx-tip-line">{block.line.map((part, index) => <Part key={index} part={part} now={now} />)}</div>;
  if ("title" in block) return <div className="mx-tip-title">{block.title}</div>;
  if ("text" in block) return <div className="mx-tip-text">{block.text}</div>;
  if ("fields" in block) {
    return (
      <div className="mx-tip-text">
        {block.fields.map(([name, value]) => (
          <div key={name}>
            {name}: <span className="mx-tip-value">{value}</span>
          </div>
        ))}
      </div>
    );
  }
  if ("person" in block) {
    return (
      <div className="mx-tip-person">
        <span className="mx-tip-avatar" style={{ background: colorOf(block.person.id) }}>{initials(block.person.name)}</span>
        {block.person.name}
      </div>
    );
  }
  if ("chips" in block) return <div className="mx-tip-chips">{block.chips.map((chip, index) => <ChipView key={index} chip={chip} />)}</div>;
  return <div className="mx-tip-text mx-tip-warn">{block.warn}</div>;
}

/** The card of a milestone: its blocks, then what choosing it does. */
export function Tip({ blocks, foot, now }: { blocks: CardBlock[] | null; foot: string; now: number }) {
  return (
    <>
      {blocks === null ? <div className="mx-tip-text">Reading the card…</div> : blocks.map((block, index) => <Block key={index} block={block} now={now} />)}
      <div className="mx-tip-foot">{foot}</div>
    </>
  );
}
