// web/app/[org]/items/[item_id]/published/PublishedView.tsx — Published notes on the canvas: the revision in force with
// its number, title, comment and release, then its notes as cards or a table.
"use client";

import { DataTable, MaxitorCanvas, PanelPage, usePanelQuery } from "@maxitor/panel";

import { CARD_GAP, cardsBounds } from "../../../notes/notes";
import { useFresh, type Note } from "../../../notes/parts";
import { HEAD, RevisionCard, VIEWS, type Revision } from "../../../notes/revision";

export function PublishedView({ revision, notes }: { revision: Revision | null; notes: Note[] }) {
  const { view = "cards", at } = usePanelQuery();
  useFresh(notes.map((note) => note.id), !at);
  const below = cardsBounds(notes.length);
  const bounds = { x: 0, y: 0, width: below.width, height: HEAD + CARD_GAP + below.height };
  return (
    <PanelPage title="Published notes" bar={VIEWS} history={{ milestones: "list_note_history", card: "note_milestone_card" }}>
      <MaxitorCanvas bounds={bounds} label="Published notes">
        <RevisionCard revision={revision} empty="Nothing is published yet: publish the draft to make the first revision." />
        {view === "table" ? (
          <DataTable
            name={revision ? revision.ref : "Notes"}
            at={{ x: 0, y: HEAD + CARD_GAP }}
            rows={notes}
            rowKey={(note) => note.id}
            anchor={(note) => `note:${note.id}`}
            columns={[
              { title: "Writer", kind: "person", value: (note) => note.writer_name, width: 1 },
              { title: "Note", value: (note) => note.body, width: 3 },
            ]}
          />
        ) : (
          <div className="mx-cards nt-grid" style={{ top: HEAD + CARD_GAP, width: below.width }}>
            {notes.map((note) => (
              <article key={note.id} className="mx-card nt-card" data-room-anchor={`note:${note.id}`}>
                <div className="mx-card-head"><b>{note.writer_name}</b></div>
                <div className="nt-body">{note.body}</div>
              </article>
            ))}
          </div>
        )}
      </MaxitorCanvas>
    </PanelPage>
  );
}

