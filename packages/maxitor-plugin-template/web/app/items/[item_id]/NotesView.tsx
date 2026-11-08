// web/app/items/[item_id]/NotesView.tsx — the notes of an item, as a list or a table.
"use client";
import { DataTable, NoteCard, RoomLayer, usePanelQuery } from "@maxitor/panel";

export type Note = { id: string; body: string; author_name: string; updated_at: string };

export function NotesView({ notes }: { notes: Note[] }) {
  // The view switch and the author filter are Maxitor's controls, declared in navigation.yaml. Maxitor draws them and
  // writes ?view= and ?author= into the address; the page only reads them and rebuilds on panel.location.
  const { view = "list" } = usePanelQuery();

  return (
    <>
      {view === "table" ? (
        // The anchor is the note's id: the same on every participant's screen, so a pointer lands on the same note.
        <DataTable rows={notes} columns={["author_name", "body"]} anchor={(note: Note) => `note:${note.id}`} />
      ) : (
        notes.map((note) => <NoteCard key={note.id} data-room-anchor={`note:${note.id}`} note={note} />)
      )}
      {/* Other participants' pointers, clicks and selections, drawn inside the page so they scroll with it. */}
      <RoomLayer />
    </>
  );
}
