// web/app/[org]/notes/revision.tsx — what Published and Draft share: a revision's and a note's shape, and the
// revision's head on the canvas.
"use client";

import { publishedLine } from "./notes";

export type Revision = { number: number; ref: string; title: string; comment: string; release: string | null; publisher_name: string; at: string; first_at?: string };
export type PublishedNote = { id: string; writer_id: string; writer_name: string; body: string; updated_at: string; written?: string; since: string; changed_by?: string };

/** The revision's card heads the canvas; what lies under it starts below. */
export const HEAD = 120;

/**
 * The revision's head on Published, as the accepted mockup of #121 draws it: the ref as a chip, the title, one line of
 * who published it, when, the release and how many notes by how many authors; with changes waiting in my draft the head
 * ends with `Your draft: N`, which opens Draft. The revision's comment stands under the time scale, not here.
 */
export function RevisionCard({
  revision,
  notes,
  waiting,
  onOpenDraft,
  empty,
}: {
  revision: Revision | null;
  notes: readonly PublishedNote[];
  waiting: number;
  onOpenDraft: () => void;
  empty: string;
}) {
  const draft = waiting ? <button type="button" onClick={onOpenDraft}>Your draft: {waiting}</button> : null;
  if (!revision) {
    return (
      <article className="mx-card nt-revision">
        <div className="nt-head"><b>{empty}</b>{draft}</div>
      </article>
    );
  }
  return (
    <article className="mx-card nt-revision" data-room-anchor={`revision:${revision.number}`}>
      <div className="nt-head">
        <span className="nt-ref">{revision.ref}</span>
        <b>{revision.title}</b>
        <span>{publishedLine(revision, notes)}</span>
        {draft}
      </div>
    </article>
  );
}
