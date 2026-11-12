// web/app/[org]/items/[item_id]/NotesView.tsx — the notes of an item on the canvas, as cards or a table, at the moment
// of the address; at now its action "New note" opens a dialog, a card edits and deletes its note, and the page reads
// again when "now" moved, marking a colleague's note new.
"use client";

import { DataTable, Dialog, MaxitorCanvas, PanelPage, usePanelQuery, type BarSection, type FilterSection } from "@maxitor/panel";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { call } from "../../notes/api";
import { cardsBounds, latestFirst, refusalText } from "../../notes/notes";
import { NoteCard, useFresh, type Note } from "../../notes/parts";
import { paletteOf } from "./people";

export type { Note };

export function NotesView({ org, itemId, notes, filters, bar }: { org: string; itemId: string; notes: Note[]; filters: FilterSection[]; bar: BarSection[] }) {
  // The view is the page's own choice in the shell's bottom bar: the shell writes ?view= into the address.
  const { view = "cards", at } = usePanelQuery();
  const now = !at;
  const router = useRouter();
  const ordered = latestFirst(notes);
  const fresh = useFresh(ordered.map((note) => note.id), now);
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState("");
  const [said, setSaid] = useState("");

  const write = async () => {
    const answer = await call(org, "POST", "/notes", { item_id: itemId, body: text });
    if (!answer.ok) return setSaid(refusalText(answer.refusal, answer.status));
    setWriting(false);
    setText("");
    setSaid("");
    router.refresh();
  };

  const content =
    ordered.length === 0 ? (
      <div className="mx-empty-state" style={{ position: "absolute", left: 0, top: 0, width: cardsBounds(1).width }}>
        <b>No notes yet</b>Notes written on this item appear here.
      </div>
    ) : view === "table" ? (
      <DataTable
        name="Notes"
        rows={ordered}
        rowKey={(note) => note.id}
        // The anchor is the note's id: the same on every screen, so another person's pointer lands on the same note.
        anchor={(note) => `note:${note.id}`}
        columns={[
          { title: "Writer", kind: "person", value: (note) => note.writer_name, colour: (note) => paletteOf(note.writer_id), width: 1 },
          { title: "Note", value: (note) => note.body, width: 3 },
          { title: "Changed", kind: "date", value: (note) => note.updated_at, width: 1 },
        ]}
      />
    ) : (
      <div className="mx-cards nt-grid" style={{ width: cardsBounds(ordered.length).width }}>
        {ordered.map((note) => (
          <NoteCard key={note.id} org={org} note={note} fresh={fresh.has(note.id)} now={now} onChanged={() => router.refresh()} />
        ))}
      </div>
    );

  return (
    <PanelPage
      title="Notes"
      filters={filters}
      bar={bar}
      actions={[{ title: "New note", icon: "plus", onClick: () => setWriting(true) }]}
      // How the page answers the core's time scale: its reading action counts the bars over a stretch; the milestones and
      // a milestone's card are actions of the folder history/. The comparisons are the passport's.
      history={{ read: "list_item_notes", milestones: "list_note_history", card: "note_milestone_card" }}
    >
      {view === "table" && ordered.length ? content : <MaxitorCanvas bounds={cardsBounds(ordered.length)} label="Notes">{content}</MaxitorCanvas>}
      {writing ? (
        <Dialog title="New note" onClose={() => setWriting(false)}>
          <textarea value={text} onChange={(event) => setText(event.currentTarget.value)} aria-label="The note's text" rows={5} autoFocus />
          {said ? <div className="nt-said" role="status">{said}</div> : null}
          <div className="nt-row">
            <button type="button" onClick={() => setWriting(false)}>Cancel</button>
            <button type="button" className="nt-primary" disabled={!text.trim()} onClick={write}>Write</button>
          </div>
        </Dialog>
      ) : null}
    </PanelPage>
  );
}
