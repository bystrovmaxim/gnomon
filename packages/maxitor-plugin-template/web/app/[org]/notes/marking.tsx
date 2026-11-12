// web/app/[org]/notes/marking.tsx — the one drawing of a change's words: the words that went struck, the words that
// came green, inside the one text. Every page that shows a changed text renders this component.
"use client";

import { diffWords } from "diff";

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
          <del key={index} className="nt-gone">
            {part.value}
          </del>
        ) : (
          <span key={index}>{part.value}</span>
        ),
      )}
    </span>
  );
}
