// web/app/[org]/items/[item_id]/NotesView.tsx — the notes of an item, as a list or a table.
"use client";
import { Card, DataTable, usePanelQuery } from "@maxitor/panel";

export type Note = { id: string; item_id: string; writer_id: string; writer_name: string; body: string; updated_at: string };

export function NotesView({ notes }: { notes: Note[] }) {
  // The view switch is Maxitor's control, declared in navigation.yaml. Maxitor draws it and writes ?view= into the
  // address; the page only reads it, and rebuilds when Maxitor says the address changed.
  const { view = "list" } = usePanelQuery();

  if (view === "table") {
    return (
      <DataTable
        rows={notes}
        rowKey={(note) => note.id}
        // The anchor is the note's id: the same on every screen, so another person's pointer lands on the same note.
        anchor={(note) => `note:${note.id}`}
        columns={[
          { title: "Writer", value: (note) => note.writer_name },
          { title: "Note", value: (note) => note.body },
        ]}
        empty="No notes on this item yet."
      />
    );
  }
  if (notes.length === 0) return <Card>No notes on this item yet.</Card>;
  return notes.map((note) => (
    <Card key={note.id} data-room-anchor={`note:${note.id}`} head={<b>{note.writer_name}</b>}>
      {note.body}
    </Card>
  ));
}
