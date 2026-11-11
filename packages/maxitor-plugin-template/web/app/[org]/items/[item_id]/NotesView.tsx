// web/app/[org]/items/[item_id]/NotesView.tsx — the notes of an item, as a list or a table.
"use client";
import { Card, DataTable, EmptyState, usePanelQuery } from "@maxitor/panel";

export type Note = { id: string; item_id: string; writer_id: string; writer_name: string; body: string; updated_at: string };

export function NotesView({ notes }: { notes: Note[] }) {
  // The view is the page's own choice in the shell's bottom bar: the shell writes ?view= into the address, and the
  // page reads it and rebuilds when the address changes.
  const { view = "cards" } = usePanelQuery();

  if (notes.length === 0) return <EmptyState title="No notes yet">Notes written on this item appear here.</EmptyState>;

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
      />
    );
  }
  return (
    <div className="mx-cards">
      {notes.map((note) => (
        <Card key={note.id} data-room-anchor={`note:${note.id}`} head={<b>{note.writer_name}</b>}>
          {note.body}
        </Card>
      ))}
    </div>
  );
}
