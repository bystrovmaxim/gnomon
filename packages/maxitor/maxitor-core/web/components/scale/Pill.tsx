// packages/maxitor/maxitor-core/web/components/scale/Pill.tsx
// The pill on the right of the top row (spec 079, FR-001, FR-005), ported from the graph viewer's VersionButton with
// its arrows: the history's clock, the moment shown in bold — a green live dot and "Now", or a blue dot and the
// moment —, the chevron of what it opens; the arrows step to the previous or the next change; in the past, "Now"
// after a hairline goes back to now. The pictograms are the graph viewer's own paths.
"use client";

import type { ReactNode } from "react";

/** The graph viewer's history icon: a clock with the arrow of time turned back. */
export function HistoryIcon() {
  return (
    <svg className="mx-pill-icon" viewBox="0 0 24 24" aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3.75 12a8.25 8.25 0 1 0 2.42-5.83" />
        <path d="M3.75 4.5v3.75H7.5" />
        <path d="M12 7.75V12l2.75 1.75" />
      </g>
    </svg>
  );
}

/** The graph viewer's chevron of a control that opens something. */
function Chevron() {
  return (
    <svg className="mx-pill-icon" viewBox="0 0 24 24" aria-hidden>
      <path fill="currentColor" d="M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z" />
    </svg>
  );
}

/** An arrow of the pill: older or newer, its keys in its title; greyed out when there is no step that way. */
function Arrow({ delta, enabled, onStep }: { delta: -1 | 1; enabled: boolean; onStep: (delta: -1 | 1) => void }) {
  const label = delta < 0 ? "The previous change" : "The next change";
  return (
    <button
      type="button"
      className="mx-pill-arrow"
      aria-label={label}
      title={`${label} · Shift + ${delta < 0 ? "←" : "→"}`}
      aria-keyshortcuts={delta < 0 ? "Shift+ArrowLeft" : "Shift+ArrowRight"}
      disabled={!enabled}
      onClick={() => onStep(delta)}
    >
      <svg className="mx-pill-icon" viewBox="0 0 24 24" aria-hidden>
        <path fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" d={delta < 0 ? "M14.5 6.5 9 12l5.5 5.5" : "M9.5 6.5 15 12l-5.5 5.5"} />
      </svg>
    </button>
  );
}

export function Pill({
  label,
  live,
  open,
  onOpen,
  onStep,
  canStep,
  onNow,
  counts,
}: {
  /** The moment shown, as the pill says it: "Now", or "3 Nov, 14:05". */
  label: ReactNode;
  /** The screen shows now: the green live dot; otherwise the blue dot of the past. */
  live: boolean;
  open: boolean;
  onOpen: () => void;
  onStep: (delta: -1 | 1) => void;
  canStep: { older: boolean; newer: boolean };
  /** In the past, back to now; absent at now. */
  onNow: (() => void) | null;
  /** In a comparison, what the page counts: the place of the counts. */
  counts?: ReactNode;
}) {
  return (
    <span className={`mx-pill${open ? " open" : ""}`} role="group" aria-label="The moment">
      <Arrow delta={-1} enabled={canStep.older} onStep={onStep} />
      <span className="mx-pill-hairline" aria-hidden />
      <button type="button" className="mx-pill-main" aria-haspopup="dialog" aria-expanded={open} onClick={onOpen}>
        <HistoryIcon />
        <span className={live ? "mx-pill-live" : "mx-pill-past"} aria-hidden />
        <b className="mx-pill-name">{label}</b>
        {counts}
        <Chevron />
      </button>
      <span className="mx-pill-hairline" aria-hidden />
      <Arrow delta={1} enabled={canStep.newer} onStep={onStep} />
      {onNow ? (
        <>
          <span className="mx-pill-hairline mx-pill-now-hairline" aria-hidden />
          <button type="button" className="mx-pill-now" onClick={onNow}>Now</button>
        </>
      ) : null}
    </span>
  );
}
