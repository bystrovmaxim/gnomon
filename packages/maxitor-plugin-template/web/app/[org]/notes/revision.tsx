// web/app/[org]/notes/revision.tsx — what Published notes and Draft share: a revision's and a change's shape, the
// revision's card heading the canvas, and the choice of cards or a table.
"use client";

import type { BarSection } from "@maxitor/panel";

import { revisionLine, when } from "./notes";

export type Revision = { number: number; ref: string; title: string; comment: string; release: string | null; publisher_name: string; at: string };
export type PublishedNote = { id: string; writer_id: string; writer_name: string; body: string; updated_at: string; since: string; changed_by?: string };

/** The revision's card heads the canvas; what lies under it starts below. */
export const HEAD = 120;

export const VIEWS: BarSection[] = [
  { kind: "choice", param: "view", default: "cards", options: [{ value: "cards", title: "Cards", icon: "cards" }, { value: "table", title: "Table", icon: "table" }] },
];

export function RevisionCard({ revision, empty }: { revision: Revision | null; empty: string }) {
  if (!revision) return <article className="mx-card nt-revision"><b>{empty}</b></article>;
  return (
    <article className="mx-card nt-revision" data-room-anchor={`revision:${revision.number}`}>
      <div className="mx-card-head">
        <b>{revisionLine(revision)}</b>
        <span>{revision.publisher_name}, {when(revision.at)}</span>
      </div>
      <div className="nt-body">{revision.comment}</div>
    </article>
  );
}

