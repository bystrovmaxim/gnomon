// web/app/[org]/notes/marking.tsx — the one drawing of a change's words, and the small marks the draft's pages share:
// the words that went struck red, the words that came green, inside the one text; a state's disk; the warning and the
// draft's icons. Every page that shows a changed text renders Marking.
"use client";

import { diffWords } from "diff";

import { STATE_MARK, type ChangeState } from "./draft";

/** The two texts' difference as one text: every word appears once, struck, green or unchanged. */
export function Marking({ before, after }: { before: string; after: string }) {
  return (
    <span className="nt-marking">
      {diffWords(before, after).map((part, index) =>
        part.added ? (
          <ins key={index} className="nt-came">
            {part.value}
          </ins>
        ) : part.removed ? (
          <del key={index} className="nt-went">
            {part.value}
          </del>
        ) : (
          <span key={index}>{part.value}</span>
        ),
      )}
    </span>
  );
}

/** A state's disk, as the filter draws a kind of change: its colour with its sign in white. */
export function StateDisk({ state }: { state: ChangeState }) {
  const { colour, mark } = STATE_MARK[state];
  return (
    <svg className="nt-disk" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="11" fill={`var(--mx-palette-${colour})`} />
      <text x="12" y="16.5" textAnchor="middle" fontSize="14" fontWeight="700" fill="#fff">
        {mark}
      </text>
    </svg>
  );
}

/** The warning's icon: a ring with an exclamation. */
export function Alert() {
  return (
    <svg className="nt-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6M12 16.5v.5" />
    </svg>
  );
}

/** The draft's icon: a page with a pencil. */
export function DraftIcon() {
  return (
    <svg className="nt-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 4h9l4 4v12H6z" />
      <path d="M14 4v5h5" />
      <path d="M9 17l1-3 4.5-4.5 2 2L12 16z" />
    </svg>
  );
}
